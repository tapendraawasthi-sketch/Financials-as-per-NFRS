// src/pages/AdjustmentsPage.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useAdjustments } from '../hooks/useAdjustments';
import { adjustmentsApi } from '../api/client';
import type { InventoryAdjustment, InvestmentAdjustment, ProvisionEntry, YearEndAdjustments } from '../types';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import DepreciationSchedule from '../components/adjustments/DepreciationSchedule';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import InventoryInputPanel from '../components/adjustments/InventoryInputPanel';
import InvestmentInputPanel from '../components/adjustments/InvestmentInputPanel';
import AdvanceTaxInstallmentsPanel from '../components/adjustments/AdvanceTaxInstallmentsPanel';
import AdjustmentJournalView from '../components/adjustments/AdjustmentJournalView';
import AdjustmentJournalUploadPanel from '../components/adjustments/AdjustmentJournalUploadPanel';
import DisallowedExpensesPanel from '../components/adjustments/DisallowedExpensesPanel';
import AdjustmentRelevanceBanner from '../components/adjustments/AdjustmentRelevanceBanner';
import RelatedPartyLoanPanel from '../components/adjustments/RelatedPartyLoanPanel';
import NasComplianceAdjustmentsPanel from '../components/adjustments/NasComplianceAdjustmentsPanel';
import { useToast } from '../components/ui/Toast';
import { detectAdjustmentRelevance, type AdjustmentRelevance } from '../utils/adjustmentRelevance';
import { assetItemToRow, assetRowToAssetItem } from '../utils/assetMapping';
import { isAssetRegisterEmpty, prefillAssetsFromTrialBalance } from '../utils/ppePrefill';

type TabId = 'assets' | 'provisions' | 'journal';
type ProvisionTabId = 'inventory' | 'investments' | 'provisions' | 'tax';

export default function AdjustmentsPage() {
  const { state, dispatch } = useAppStore();
  const {
    saveAssets,
    calculateDepreciation,
    saveInventory,
    saveInvestments,
    finalizeAdjustments,
  } = useAdjustments();
  const { show: showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('assets');
  const [provisionTab, setProvisionTab] = useState<ProvisionTabId>('provisions');
  const [useAIRelevance, setUseAIRelevance] = useState(false);
  const [serverRelevance, setServerRelevance] = useState<AdjustmentRelevance | null>(null);
  const ppePrefillDone = useRef(false);
  const journalAutoDone = useRef(false);

  const ruleRelevance = useMemo(
    () => detectAdjustmentRelevance(state.trialBalance?.rows ?? [], state.company),
    [state.trialBalance?.rows, state.company],
  );

  const relevance = serverRelevance ?? ruleRelevance;

  useEffect(() => {
    if (!state.company?.id) {
      setServerRelevance(null);
      return;
    }
    let cancelled = false;
    adjustmentsApi.getRelevance(state.company.id, useAIRelevance)
      .then((data) => { if (!cancelled) setServerRelevance(data); })
      .catch(() => { if (!cancelled) setServerRelevance(null); });
    return () => { cancelled = true; };
  }, [state.company?.id, state.trialBalance?.rows, useAIRelevance]);

  useEffect(() => {
    if (!relevance.hasPPE && activeTab === 'assets') {
      setActiveTab('provisions');
    }
  }, [relevance.hasPPE, activeTab]);

  const roundingLevel = state.company?.accountingPolicies?.roundingLevel ?? 100;
  const fiscalYear = state.company?.fiscalYear?.bsFY ?? '2081/82';

  const initialAssets = useMemo(
    () => (state.adjustments?.assets ?? []).map((asset) => assetItemToRow(asset)),
    [state.adjustments?.assets],
  );

  useEffect(() => {
    if (activeTab !== 'assets' || ppePrefillDone.current || !relevance.hasPPE) return;
    ppePrefillDone.current = true;

    const assetRegister = state.adjustments?.assets ?? [];
    if (!isAssetRegisterEmpty(assetRegister)) return;

    const prefilled = prefillAssetsFromTrialBalance(state.trialBalance?.rows ?? []);
    if (prefilled.length === 0) return;

    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: {
        ...(state.adjustments ?? {}),
        assets: prefilled,
      } as YearEndAdjustments,
    });
  }, [activeTab, relevance.hasPPE, state.adjustments, state.trialBalance?.rows, dispatch]);

  useEffect(() => {
    if (activeTab !== 'journal' || journalAutoDone.current) return;
    const adj = state.adjustments;
    if (!adj) return;

    const existing = adj.manualJournals ?? adj.journalEntries ?? [];
    if (existing.length > 0) return;

    const hasDepreciation = (adj.depreciationResults?.length ?? 0) > 0
      || (adj.totalDepreciationExpense ?? 0) > 0;
    const hasBonus = (adj.staffBonusProvision ?? 0) > 0;
    const hasTax = (adj.incomeTaxProvision ?? 0) > 0;
    if (!hasDepreciation && !hasBonus && !hasTax) return;

    journalAutoDone.current = true;
    const fyEnd = state.company?.fiscalYear?.endDateBS
      ?? state.company?.fiscalYear?.reportingDateBS
      ?? '';
    const depnAmount = adj.totalDepreciationExpense
      ?? adj.depreciationResults?.reduce((s, r) => s + (r.depnForYear ?? 0), 0)
      ?? 0;

    const generated: YearEndAdjustments['manualJournals'] = [];
    if (depnAmount > 0) {
      generated.push({
        id: 'auto-depn',
        description: `Depreciation expense for the year ending ${fyEnd}`,
        debitAccount: 'Depreciation Expense',
        creditAccount: 'Accumulated Depreciation',
        amount: depnAmount,
      });
    }
    if ((adj.staffBonusProvision ?? 0) > 0) {
      generated.push({
        id: 'auto-bonus',
        description: `Staff bonus provision for the year ending ${fyEnd}`,
        debitAccount: 'Staff Bonus Expense',
        creditAccount: 'Staff Bonus Payable',
        amount: adj.staffBonusProvision,
      });
    }
    if ((adj.incomeTaxProvision ?? 0) > 0) {
      generated.push({
        id: 'auto-tax',
        description: `Income tax provision for the year ending ${fyEnd}`,
        debitAccount: 'Income Tax Expense',
        creditAccount: 'Income Tax Payable',
        amount: adj.incomeTaxProvision,
      });
    }

    if (generated.length === 0) return;

    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: {
        ...adj,
        manualJournals: generated,
        journalEntries: generated,
      } as YearEndAdjustments,
    });
  }, [activeTab, state.adjustments, state.company, dispatch]);

  const handleImportFromTrialBalance = () =>
    prefillAssetsFromTrialBalance(state.trialBalance?.rows ?? []).map(assetItemToRow);

  const handleCalculateDepreciation = async (rows: ReturnType<typeof assetItemToRow>[]) => {
    const assets = rows.map(assetRowToAssetItem);
    await saveAssets(assets);
    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: { ...(state.adjustments ?? {}), assets } as YearEndAdjustments,
    });
    const { summary } = await calculateDepreciation();
    return summary;
  };

  const handleSaveProvisions = async (rows: Array<{
    id: string;
    type: string;
    openingBalance: number;
    addition: number;
    utilised: number;
    reversed: number;
    classification: 'Current' | 'Non-current';
  }>) => {
    if (!state.company?.id) return;

    const provisions: ProvisionEntry[] = rows.map((row) => ({
      id: row.id,
      provisionType: row.type,
      openingBalance: row.openingBalance,
      additionForYear: row.addition,
      utilisedDuringYear: row.utilised + row.reversed,
      closingBalance: row.openingBalance + row.addition - row.utilised - row.reversed,
      classification: row.classification,
    } as ProvisionEntry & { classification?: string }));

    try {
      await adjustmentsApi.saveProvisions(state.company.id, provisions);
      dispatch({
        type: 'SET_ADJUSTMENTS',
        payload: {
          ...(state.adjustments ?? {}),
          provisions,
          totalProvisions: provisions.reduce((sum, row) => sum + row.additionForYear, 0),
        } as YearEndAdjustments,
      });
      showToast('Provisions saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save provisions.';
      showToast(message, 'error');
    }
  };

  const handleSaveInventory = async (items: InventoryAdjustment[]) => {
    try {
      await saveInventory(items);
      dispatch({
        type: 'SET_ADJUSTMENTS',
        payload: {
          ...(state.adjustments ?? {}),
          inventoryAdjustments: items,
          totalInventoryImpairment: items.reduce((sum, item) => sum + item.impairmentAmount, 0),
        } as YearEndAdjustments,
      });
      showToast('Inventory adjustments saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save inventory adjustments.';
      showToast(message, 'error');
    }
  };

  const handleSaveInvestments = async (items: InvestmentAdjustment[]) => {
    try {
      await saveInvestments(items);
      dispatch({
        type: 'SET_ADJUSTMENTS',
        payload: {
          ...(state.adjustments ?? {}),
          investmentAdjustments: items,
          totalInvestmentFVAdjustment: items.reduce(
            (sum, item) => sum + (item.fairValueGainLoss ?? item.gainLossOnFV ?? 0),
            0,
          ),
        } as YearEndAdjustments,
      });
      showToast('Investment adjustments saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save investment adjustments.';
      showToast(message, 'error');
    }
  };

  const handleProceed = async () => {
    const journals = state.adjustments?.manualJournals ?? state.adjustments?.journalEntries ?? [];
    const skipped = state.adjustments?.journalEntriesSkipped ?? false;
    if (journals.length === 0 && !skipped) {
      showToast('Upload your adjustment journal Excel or click "No adjustment entries to upload" to continue.', 'error');
      setActiveTab('journal');
      return;
    }

    try {
      if (state.company?.id && journals.length > 0) {
        await adjustmentsApi.saveJournals(state.company.id, journals.map((j) => ({
          id: j.id,
          description: j.description,
          debitAccount: j.debitAccount,
          creditAccount: j.creditAccount,
          amount: j.amount,
          type: j.type as import('../types').JournalEntry['type'],
          source: j.id?.startsWith('auto-') ? 'System' : j.source === 'Upload' ? 'Upload' : 'Manual',
        })));
      }
      await finalizeAdjustments();
      showToast('Adjustments saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save adjustments.';
      showToast(message, 'error');
    }
  };

  const tabs = [
    ...(relevance.hasPPE ? [{ id: 'assets' as const, label: 'PPE / Depreciation' }] : []),
    { id: 'provisions' as const, label: 'Provisions & Tax' },
    { id: 'journal' as const, label: 'Adjustment Journal' },
  ];

  const effectiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id ?? 'provisions';

  const provisionTabs = useMemo(() => {
    const items: Array<{ id: ProvisionTabId; label: string }> = [];
    if (relevance.hasInventory) items.push({ id: 'inventory', label: 'Inventory' });
    if (relevance.hasInvestments) items.push({ id: 'investments', label: 'Investments' });
    items.push({ id: 'provisions', label: 'Provisions & Staff' });
    if (
      relevance.sectionVisibility.relatedPartyLoan
      || relevance.sectionVisibility.disallowedTax
      || relevance.sectionVisibility.advanceTax
    ) {
      items.push({ id: 'tax', label: 'Tax & Compliance' });
    }
    return items;
  }, [relevance]);

  const effectiveProvisionTab = provisionTabs.some((t) => t.id === provisionTab)
    ? provisionTab
    : provisionTabs[0]?.id ?? 'provisions';

  const depnSummary = state.adjustments?.depreciationSummary ?? [];

  return (
    <div>
      <div className="mb-6">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--brand-600)' }}
        >
          STEP 6 OF 8
        </p>
        <h2
          className="font-display text-2xl font-semibold mb-2"
          style={{ color: 'var(--ink-950)' }}
        >
          Year-End Adjustments
        </h2>
        <p className="text-sm max-w-2xl" style={{ color: 'var(--ink-500)', lineHeight: 1.6 }}>
          Enter depreciation and provisions, then download the journal entry template, fill your adjusting entries, and upload — or skip if none apply.
        </p>
      </div>

      <Tabs
        tabs={tabs}
        active={effectiveTab}
        onChange={(id) => setActiveTab(id as TabId)}
        variant="line"
        className="mb-5"
      />

      <div className="page-enter space-y-5">
        <AdjustmentRelevanceBanner
          relevance={relevance}
          useAI={useAIRelevance}
          onToggleAI={setUseAIRelevance}
        />
        <NasComplianceAdjustmentsPanel nasFlags={relevance.nasFlags} />

        {effectiveTab === 'assets' && relevance.hasPPE && (
          <>
            <div className="card">
              <div className="card-body">
                <AssetRegisterTable
                  fiscalYear={fiscalYear}
                  initialAssets={initialAssets}
                  roundingLevel={roundingLevel}
                  hasBorrowings={relevance.hasBorrowings}
                  hasDisposalIndicators={relevance.hasDisposalIndicators}
                  onImportFromTrialBalance={handleImportFromTrialBalance}
                  onCalculate={handleCalculateDepreciation}
                />
              </div>
            </div>
            {depnSummary.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <DepreciationSchedule
                    summary={depnSummary}
                    totalDepreciation={state.adjustments?.totalDepreciationExpense ?? 0}
                    gainOnDisposals={state.adjustments?.gainOnDisposals ?? 0}
                    lossOnDisposals={state.adjustments?.lossOnDisposals ?? 0}
                    roundingLevel={roundingLevel}
                    fiscalYear={fiscalYear}
                    taxDepreciationPools={state.adjustments?.taxDepreciationPools}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {effectiveTab === 'provisions' && (
          <div className="space-y-5">
            {provisionTabs.length > 1 && (
              <Tabs
                tabs={provisionTabs}
                active={effectiveProvisionTab}
                onChange={(id) => setProvisionTab(id as ProvisionTabId)}
                variant="line"
              />
            )}

            {effectiveProvisionTab === 'inventory' && relevance.hasInventory && (
              <InventoryInputPanel
                trialBalanceRows={state.trialBalance?.rows}
                initialItems={state.adjustments?.inventoryAdjustments}
                onSave={handleSaveInventory}
              />
            )}

            {effectiveProvisionTab === 'investments' && relevance.hasInvestments && (
              <InvestmentInputPanel
                trialBalanceRows={state.trialBalance?.rows}
                initialItems={state.adjustments?.investmentAdjustments}
                onSave={handleSaveInvestments}
              />
            )}

            {effectiveProvisionTab === 'provisions' && (
              <ProvisionInputs
                onSave={handleSaveProvisions}
                provisionApplicability={relevance.provisionApplicability}
                initialData={Object.fromEntries(
                  (state.adjustments?.provisions ?? []).map((provision) => [
                    provision.id ?? provision.provisionType,
                    provision.openingBalance,
                  ]),
                )}
              />
            )}

            {effectiveProvisionTab === 'tax' && (
              <>
                {relevance.sectionVisibility.relatedPartyLoan && (
                  <RelatedPartyLoanPanel
                    isCurrent={state.adjustments?.relatedPartyLoanCurrent === true}
                    onSave={async (relatedPartyLoanCurrent) => {
                      if (!state.company?.id) return;
                      await adjustmentsApi.saveAdjustmentSettings(state.company.id, { relatedPartyLoanCurrent });
                      dispatch({
                        type: 'SET_ADJUSTMENTS',
                        payload: { ...(state.adjustments ?? {}), relatedPartyLoanCurrent } as YearEndAdjustments,
                      });
                      showToast('Related-party loan classification saved', 'success');
                    }}
                  />
                )}
                {relevance.sectionVisibility.disallowedTax && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-700)' }}>
                        Disallowed Expenses (Section 21 ITA)
                      </h3>
                    </div>
                    <div className="card-body">
                      <DisallowedExpensesPanel
                        items={state.adjustments?.disallowedForTax ?? []}
                        onChange={(items) => {
                          dispatch({
                            type: 'SET_ADJUSTMENTS',
                            payload: { ...(state.adjustments ?? {}), disallowedForTax: items } as YearEndAdjustments,
                          });
                        }}
                        onSave={async (items) => {
                          if (!state.company?.id) return;
                          await adjustmentsApi.saveDisallowedForTax(state.company.id, items);
                          dispatch({
                            type: 'SET_ADJUSTMENTS',
                            payload: { ...(state.adjustments ?? {}), disallowedForTax: items } as YearEndAdjustments,
                          });
                          showToast('Disallowed tax items saved', 'success');
                        }}
                      />
                    </div>
                  </div>
                )}
                {relevance.sectionVisibility.advanceTax && (
                  <AdvanceTaxInstallmentsPanel
                    initialData={state.adjustments ?? undefined}
                    estimatedTaxLiability={state.adjustments?.currentTaxExpense ?? state.adjustments?.incomeTaxProvision ?? 0}
                    onSave={async (data) => {
                      if (!state.company?.id) return;
                      await adjustmentsApi.saveAdvanceTax(state.company.id, data);
                      dispatch({
                        type: 'SET_ADJUSTMENTS',
                        payload: { ...(state.adjustments ?? {}), ...data } as YearEndAdjustments,
                      });
                      showToast('Advance tax installments saved', 'success');
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {effectiveTab === 'journal' && (
          <div className="space-y-5">
            {state.company?.id && (
              <AdjustmentJournalUploadPanel
                companyId={state.company.id}
                companyName={state.company.companyName}
                skipped={state.adjustments?.journalEntriesSkipped ?? false}
                hasEntries={(state.adjustments?.manualJournalGroups ?? []).length > 0
                  || (state.adjustments?.manualJournals ?? state.adjustments?.journalEntries ?? []).length > 0}
                onUploadComplete={(groups) => {
                  const adj = state.adjustments;
                  if (!adj) return;
                  dispatch({
                    type: 'SET_ADJUSTMENTS',
                    payload: {
                      ...adj,
                      manualJournalGroups: groups,
                      journalEntriesSkipped: false,
                    } as YearEndAdjustments,
                  });
                  showToast(`${groups.length} adjustment groups imported`, 'success');
                }}
                onSkip={() => {
                  dispatch({
                    type: 'SET_ADJUSTMENTS',
                    payload: {
                      ...(state.adjustments ?? {}),
                      manualJournals: [],
                      journalEntries: [],
                      manualJournalGroups: [],
                      journalEntriesSkipped: true,
                    } as YearEndAdjustments,
                  });
                  showToast('Adjustment journal entries skipped', 'success');
                }}
                onError={(msg) => showToast(msg, 'error')}
              />
            )}
            <AdjustmentJournalView
              groups={(() => {
                const stored = state.adjustments?.manualJournalGroups ?? [];
                if (stored.length > 0) return stored;
                const flat = state.adjustments?.manualJournals ?? state.adjustments?.journalEntries ?? [];
                return flat.map((j, i) => ({
                  groupId: String(i + 1),
                  narration: j.description,
                  lines: [
                    {
                      id: `${j.id}-dr`,
                      groupId: String(i + 1),
                      lineType: 'Dr' as const,
                      account: j.debitAccount,
                      amount: j.amount,
                      source: (j.id?.startsWith('auto-') ? 'System' : j.source === 'Upload' ? 'Upload' : 'Manual') as 'System' | 'Manual' | 'Upload',
                    },
                    {
                      id: `${j.id}-cr`,
                      groupId: String(i + 1),
                      lineType: 'Cr' as const,
                      account: j.creditAccount,
                      amount: j.amount,
                      source: (j.id?.startsWith('auto-') ? 'System' : j.source === 'Upload' ? 'Upload' : 'Manual') as 'System' | 'Manual' | 'Upload',
                    },
                  ],
                  totalDr: j.amount,
                  totalCr: j.amount,
                  isBalanced: true,
                }));
              })()}
              readOnly={state.adjustments?.journalEntriesSkipped ?? false}
              onAddManual={(group) => {
                const adj = state.adjustments;
                if (!adj) return;
                const groupId = `manual-${Date.now()}`;
                const totalDr = group.lines.filter((l) => l.lineType === 'Dr').reduce((s, l) => s + l.amount, 0);
                const totalCr = group.lines.filter((l) => l.lineType === 'Cr').reduce((s, l) => s + l.amount, 0);
                const newGroup = {
                  groupId,
                  narration: group.narration,
                  lines: group.lines.map((l) => ({ ...l, groupId })),
                  totalDr,
                  totalCr,
                  isBalanced: Math.abs(totalDr - totalCr) <= 1,
                };
                const manualJournalGroups = [...(adj.manualJournalGroups ?? []), newGroup];
                dispatch({
                  type: 'SET_ADJUSTMENTS',
                  payload: {
                    ...adj,
                    manualJournalGroups,
                    journalEntriesSkipped: false,
                  } as YearEndAdjustments,
                });
              }}
            />
          </div>
        )}
      </div>

      <div className="card mt-6">
        <div className="card-footer flex justify-end">
          <Button variant="primary" size="md" onClick={handleProceed}>
            Generate Financial Statements →
          </Button>
        </div>
      </div>
    </div>
  );
}
