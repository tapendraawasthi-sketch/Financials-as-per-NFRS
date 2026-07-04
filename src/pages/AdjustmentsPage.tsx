// src/pages/AdjustmentsPage.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useAdjustments } from '../hooks/useAdjustments';
import { adjustmentsApi } from '../api/client';
import type { AssetItem, InventoryAdjustment, InvestmentAdjustment, ProvisionEntry, YearEndAdjustments } from '../types';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import DepreciationSchedule from '../components/adjustments/DepreciationSchedule';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import InventoryInputPanel from '../components/adjustments/InventoryInputPanel';
import InvestmentInputPanel from '../components/adjustments/InvestmentInputPanel';
import AdjustmentJournalView from '../components/adjustments/AdjustmentJournalView';
import { useToast } from '../components/ui/Toast';
import { detectAdjustmentRelevance } from '../utils/adjustmentRelevance';
import { assetItemToRow, assetRowToAssetItem } from '../utils/assetMapping';

type TabId = 'assets' | 'provisions' | 'journal';

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
  const ppePrefillDone = useRef(false);
  const journalAutoDone = useRef(false);

  const relevance = useMemo(
    () => detectAdjustmentRelevance(state.trialBalance?.rows ?? []),
    [state.trialBalance?.rows],
  );

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
    const isEmptyOrBlank = assetRegister.length === 0 || assetRegister.every((a) => {
      const row = a as AssetItem & { name?: string; cost?: number };
      return !(row.assetName ?? row.name)?.trim() && (row.originalCost ?? row.cost ?? 0) === 0;
    });
    if (!isEmptyOrBlank) return;

    const mappings = state.trialBalance?.rows ?? [];
    const ppeAccounts = mappings.filter((account) =>
      account.nfrsCategory === 'property_plant_equipment'
      || (typeof account.nfrsCategory === 'string' && account.nfrsCategory.startsWith('ppe_')),
    );
    if (ppeAccounts.length === 0) return;

    const prefilled: AssetItem[] = ppeAccounts.map((account, i) => {
      const nfrs = String(account.nfrsCategory ?? '');
      return {
        id: `ppe-prefill-${account.rowIndex ?? i}`,
        assetName: String(account.accountName ?? account.displayLabel ?? account.rawLabel ?? ''),
        categoryId: nfrs.startsWith('ppe_') ? nfrs.replace('ppe_', '') : 'building',
        originalCost: Number(account.closingDr ?? 0),
        additionalCost: 0,
        purchaseDateBS: '',
        usefulLifeYears: 10,
        residualValue: 0,
        depreciationMethod: 'StraightLine',
        wdvRate: 20,
        accumDepreciationOpening: 0,
        isFullyDepreciated: false,
        isMortgaged: false,
        disposed: false,
      };
    });

    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: {
        ...(state.adjustments ?? {}),
        assets: prefilled,
      } as YearEndAdjustments,
    });
  }, [activeTab, relevance.hasPPE, state.adjustments, state.trialBalance, dispatch]);

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
          totalInvestmentFVAdjustment: items.reduce((sum, item) => sum + (item.fairValueGainLoss ?? item.gainLossOnFV ?? 0), 0),
        } as YearEndAdjustments,
      });
      showToast('Investment adjustments saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save investment adjustments.';
      showToast(message, 'error');
    }
  };

  const handleProceed = async () => {
    try {
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
          Enter depreciation, provisions, and adjusting journal entries before generating financial statements.
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
        {effectiveTab === 'assets' && relevance.hasPPE && (
          <>
            <div className="card">
              <div className="card-body">
                <AssetRegisterTable
                  fiscalYear={fiscalYear}
                  initialAssets={initialAssets}
                  roundingLevel={roundingLevel}
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
            {relevance.hasInventory && (
              <InventoryInputPanel
                trialBalanceRows={state.trialBalance?.rows}
                initialItems={state.adjustments?.inventoryAdjustments}
                onSave={handleSaveInventory}
              />
            )}
            {relevance.hasInvestments && (
              <InvestmentInputPanel
                trialBalanceRows={state.trialBalance?.rows}
                initialItems={state.adjustments?.investmentAdjustments}
                onSave={handleSaveInvestments}
              />
            )}
            <ProvisionInputs
              onSave={handleSaveProvisions}
              initialData={Object.fromEntries(
                (state.adjustments?.provisions ?? []).map((provision) => [
                  provision.id ?? provision.provisionType,
                  provision.openingBalance,
                ]),
              )}
            />
          </div>
        )}

        {effectiveTab === 'journal' && (
          <AdjustmentJournalView
            entries={(state.adjustments?.manualJournals ?? state.adjustments?.journalEntries ?? []).map((j) => ({
              id: j.id,
              description: j.description,
              drAccount: j.debitAccount,
              crAccount: j.creditAccount,
              amount: j.amount,
              type: j.debitAccount.includes('Tax') ? 'TAX' as const
                : j.debitAccount.includes('Bonus') ? 'PROV' as const
                : j.debitAccount.includes('Depreciation') ? 'DEPN' as const
                : 'OTHER' as const,
              source: j.id?.startsWith('auto-') ? 'System' as const : 'Manual' as const,
            }))}
            onAddManual={(entry) => {
              const adj = state.adjustments;
              if (!adj) return;
              const newEntry = {
                id: `manual-${Date.now()}`,
                description: entry.description,
                debitAccount: entry.drAccount,
                creditAccount: entry.crAccount,
                amount: entry.amount,
              };
              const manualJournals = [...(adj.manualJournals ?? []), newEntry];
              dispatch({
                type: 'SET_ADJUSTMENTS',
                payload: { ...adj, manualJournals, journalEntries: manualJournals } as YearEndAdjustments,
              });
            }}
          />
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
