// src/pages/AdjustmentsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useAdjustments } from '../hooks/useAdjustments';
import { adjustmentsApi } from '../api/client';
import type { AssetItem, YearEndAdjustments, InvestmentAdjustment } from '../types';
import Tabs from '../components/ui/Tabs';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import DepreciationSchedule from '../components/adjustments/DepreciationSchedule';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import AdjustmentJournalView from '../components/adjustments/AdjustmentJournalView';
import Button from '../components/ui/Button';
import { computeStaffBonus } from '../../server/services/taxEngine';

type TabId = 'assets' | 'provisions' | 'journal';

interface AccountingJudgments {
  landRevalued: boolean;
  assetDisposed: boolean;
  financeLeases: boolean;
  inventoryWrittenDown: boolean;
  investmentFVChanges: boolean;
}

const EMPTY_JUDGMENTS: AccountingJudgments = {
  landRevalued: false,
  assetDisposed: false,
  financeLeases: false,
  inventoryWrittenDown: false,
  investmentFVChanges: false,
};

const JUDGMENT_QUESTIONS: Array<{ key: keyof AccountingJudgments; label: string }> = [
  { key: 'landRevalued', label: 'Was any land revalued during the year?' },
  { key: 'assetDisposed', label: 'Were any fixed assets disposed of during the year?' },
  { key: 'financeLeases', label: 'Are any leases classified as finance leases?' },
  { key: 'inventoryWrittenDown', label: 'Was any inventory written down to NRV?' },
  { key: 'investmentFVChanges', label: 'Were there any investment fair value changes?' },
];

export default function AdjustmentsPage() {
  const { state, dispatch } = useAppStore();
  const { saveAssets, calculateDepreciation, finalizeAdjustments, recalculateProvisions } = useAdjustments();
  const [activeTab, setActiveTab] = useState<TabId>('assets');
  const [judgmentsOpen, setJudgmentsOpen] = useState(false);
  const [bonusTooltipOpen, setBonusTooltipOpen] = useState(false);
  const ppePrefillDone = useRef(false);
  const journalAutoDone = useRef(false);

  const judgments: AccountingJudgments = {
    ...EMPTY_JUDGMENTS,
    ...((state.adjustments as YearEndAdjustments & { judgments?: AccountingJudgments })?.judgments ?? {}),
  };

  const roundingLevel = state.company?.accountingPolicies?.roundingLevel ?? 100;
  const depnSummary = state.adjustments?.depreciationSummary ?? [];
  const totalDepreciation = state.adjustments?.totalDepreciationExpense ?? 0;
  const gainOnDisposals = state.adjustments?.gainOnDisposals ?? 0;
  const lossOnDisposals = state.adjustments?.lossOnDisposals ?? 0;
  const investmentAdjustments = state.adjustments?.investmentAdjustments ?? [];

  useEffect(() => {
    if (activeTab !== 'assets' || ppePrefillDone.current) return;
    ppePrefillDone.current = true;

    const assetRegister = state.adjustments?.assetRegister ?? state.adjustments?.assets ?? [];
    const isEmptyOrBlank = assetRegister.length === 0 || assetRegister.every((a) => {
      const row = a as AssetItem & { name?: string; cost?: number };
      return !(row.assetName ?? row.name)?.trim() && (row.originalCost ?? row.cost ?? 0) === 0;
    });
    if (!isEmptyOrBlank) return;

    const mappings = (state as { mappings?: Array<Record<string, unknown>> }).mappings
      ?? state.trialBalance?.rows
      ?? [];
    const ppeAccounts = mappings.filter((account) =>
      account.nfrsCategory === 'property_plant_equipment'
      || (typeof account.nfrsCategory === 'string' && account.nfrsCategory.startsWith('ppe_')),
    );
    if (ppeAccounts.length === 0) return;

    const prefilled: AssetItem[] = ppeAccounts.map((account, i) => {
      const nfrs = String(account.nfrsCategory ?? '');
      const subcategory = account.subcategory as string | undefined;
      return {
        id: `ppe-prefill-${account.rowIndex ?? i}`,
        assetName: String(account.accountName ?? account.displayLabel ?? account.rawLabel ?? ''),
        categoryId: subcategory ?? (nfrs.startsWith('ppe_') ? nfrs.replace('ppe_', '') : 'other'),
        originalCost: Number(account.closingDr ?? 0),
        additionalCost: 0,
        purchaseDateBS: '',
        usefulLifeYears: 0,
        residualValue: 0,
        depreciationMethod: 'StraightLine',
        wdvRate: 0,
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
        assetRegister: prefilled as YearEndAdjustments['assetRegister'],
      } as YearEndAdjustments,
    });
  }, [activeTab, state.adjustments, state.trialBalance, dispatch]);

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
    const provisionEntries = (adj as YearEndAdjustments & { provisionEntries?: unknown[] }).provisionEntries
      ?? adj.provisions
      ?? [];
    if (!hasDepreciation || !hasBonus || !hasTax || provisionEntries.length === 0) return;

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

    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: {
        ...adj,
        manualJournals: generated,
        journalEntries: generated,
      } as YearEndAdjustments,
    });
  }, [activeTab, state.adjustments, state.company, dispatch]);

  const handleCalculateDepreciation = async (assets: any[]) => {
    await saveAssets(assets);
    const { summary, results } = await calculateDepreciation();
    const totalDepreciationExpense = results.reduce((s, r) => s + (r.depnForYear ?? 0), 0);
    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: {
        ...(state.adjustments ?? {}),
        depreciationSummary: summary,
        depreciationResults: results,
        totalDepreciationExpense,
      } as YearEndAdjustments,
    });
    return summary;
  };

  const handleSaveProvisions = async (rows: any[]) => {
    if (!state.company?.id) return;
    await adjustmentsApi.saveProvisions(state.company.id, rows);
  };

  const updateJudgments = (key: keyof AccountingJudgments, value: boolean) => {
    const adj = state.adjustments ?? {} as YearEndAdjustments;
    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: {
        ...adj,
        judgments: { ...judgments, [key]: value },
      } as YearEndAdjustments,
    });
  };

  const updateAdjustmentsField = (patch: Partial<YearEndAdjustments & { revaluationReserve?: number; disposalProceeds?: number; disposalDate?: string }>) => {
    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: { ...(state.adjustments ?? {}), ...patch } as YearEndAdjustments,
    });
  };

  const handleAutoCalcStaffBonus = () => {
    const adj = state.adjustments ?? {} as YearEndAdjustments;
    const rows = state.trialBalance?.rows ?? [];
    const isIncome = (cat: string) => cat.startsWith('revenue_') || cat.startsWith('other_income_');
    const isExpense = (cat: string) =>
      cat.startsWith('cogs_') || cat.startsWith('emp_expense_') || cat.startsWith('direct_')
      || cat.startsWith('finance_cost_') || cat === 'impairment_expense' || cat.startsWith('admin_');

    const profitBeforeTax = adj.profitBeforeTax ?? (
      rows.filter(r => !r.isGroupRow && isIncome(String(r.nfrsCategory))).reduce((s, r) => s + (r.closingCr ?? 0), 0)
      - rows.filter(r => !r.isGroupRow && isExpense(String(r.nfrsCategory))).reduce((s, r) => s + (r.closingDr ?? 0), 0)
      - (adj.totalDepreciationExpense ?? 0)
    );

    const bonusRate = (state.company?.accountingPolicies?.bonusRatePercent ?? 10) / 100;
    const staffBonusProvision = computeStaffBonus(profitBeforeTax, bonusRate);
    updateAdjustmentsField({ profitBeforeTax, staffBonusProvision });
    recalculateProvisions({ profitBeforeTax, staffBonusProvision });
  };

  const updateInvestmentAdjustment = (id: string, patch: Partial<InvestmentAdjustment>) => {
    const next = investmentAdjustments.map(item =>
      item.id === id ? { ...item, ...patch } : item,
    );
    updateAdjustmentsField({ investmentAdjustments: next });
  };

  const addInvestmentAdjustment = () => {
    updateAdjustmentsField({
      investmentAdjustments: [
        ...investmentAdjustments,
        {
          id: `inv-${Date.now()}`,
          type: 'listed',
          name: '',
          totalCost: 0,
          gainLossOnFV: 0,
        },
      ],
    });
  };

  const handleProceed = async () => {
    try {
      await finalizeAdjustments();
    } catch {
      return;
    }
  };

  const tabs = [
    { id: 'assets', label: 'PPE / Depreciation' },
    { id: 'provisions', label: 'Provisions & Tax' },
    { id: 'journal', label: 'Adjustment Journal' },
  ];

  return (
    <div>
      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        variant="line"
        className="mb-5"
      />

      <div className="page-enter">
        {activeTab === 'assets' && (
          <div className="space-y-6">
            <AssetRegisterTable
              fiscalYear={state.company?.fiscalYear?.bsFY ?? '2081/82'}
              onCalculate={handleCalculateDepreciation}
            />

            {depnSummary.length > 0 && (
              <DepreciationSchedule
                summary={depnSummary}
                totalDepreciation={totalDepreciation}
                gainOnDisposals={gainOnDisposals}
                lossOnDisposals={lossOnDisposals}
                roundingLevel={roundingLevel}
              />
            )}

            {judgments.assetDisposed && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Asset Disposal Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm text-slate-700">
                    Disposal proceeds (NPR)
                    <input
                      type="number"
                      className="mt-1 w-full h-8 text-sm border border-slate-300 rounded px-2"
                      value={(state.adjustments as YearEndAdjustments & { disposalProceeds?: number })?.disposalProceeds ?? ''}
                      onChange={e => updateAdjustmentsField({ disposalProceeds: parseFloat(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Disposal date
                    <input
                      type="date"
                      className="mt-1 w-full h-8 text-sm border border-slate-300 rounded px-2"
                      value={(state.adjustments as YearEndAdjustments & { disposalDate?: string })?.disposalDate ?? ''}
                      onChange={e => updateAdjustmentsField({ disposalDate: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'provisions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <label className="text-sm text-slate-700">
                Staff Bonus Provision (NPR)
                <input
                  type="number"
                  className="mt-1 block w-48 h-8 text-sm border border-slate-300 rounded px-2 font-mono"
                  value={state.adjustments?.staffBonusProvision ?? ''}
                  onChange={e => updateAdjustmentsField({ staffBonusProvision: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <div className="relative">
                <Button variant="secondary" size="sm" onClick={handleAutoCalcStaffBonus}>
                  Auto-Calculate
                </Button>
                <button
                  type="button"
                  className="ml-2 text-xs text-slate-500 underline"
                  onMouseEnter={() => setBonusTooltipOpen(true)}
                  onMouseLeave={() => setBonusTooltipOpen(false)}
                  onFocus={() => setBonusTooltipOpen(true)}
                  onBlur={() => setBonusTooltipOpen(false)}
                >
                  Formula
                </button>
                {bonusTooltipOpen && (
                  <span
                    className="absolute left-0 top-full z-10 mt-1 w-72 rounded-lg bg-slate-800 text-white text-xs px-3 py-2 shadow-lg"
                    role="tooltip"
                  >
                    10% of Net Profit Before Bonus and Tax (NPBBT) per Nepal Labour Act
                  </span>
                )}
              </div>
            </div>

            <ProvisionInputs onSave={handleSaveProvisions} />

            <div className="rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setJudgmentsOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
              >
                <span>Accounting Judgments</span>
                <span className="text-slate-400">{judgmentsOpen ? '−' : '+'}</span>
              </button>
              {judgmentsOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                  {JUDGMENT_QUESTIONS.map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between gap-4 text-sm text-slate-700">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={judgments[key]}
                        onChange={e => updateJudgments(key, e.target.checked)}
                      />
                    </label>
                  ))}

                  {judgments.landRevalued && (
                    <label className="block text-sm text-slate-700 pt-2">
                      Revaluation reserve (NPR)
                      <input
                        type="number"
                        className="mt-1 w-full max-w-xs h-8 text-sm border border-slate-300 rounded px-2 font-mono"
                        value={(state.adjustments as YearEndAdjustments & { revaluationReserve?: number })?.revaluationReserve ?? ''}
                        onChange={e => updateAdjustmentsField({ revaluationReserve: parseFloat(e.target.value) || 0 })}
                      />
                    </label>
                  )}

                  {judgments.investmentFVChanges && (
                    <div className="pt-2 space-y-2">
                      <p className="text-sm font-medium text-slate-700">Investment fair value adjustments</p>
                      {investmentAdjustments.map(item => (
                        <div key={item.id} className="grid grid-cols-3 gap-2 items-center">
                          <input
                            type="text"
                            className="h-8 text-sm border border-slate-300 rounded px-2"
                            value={item.name}
                            placeholder="Investment name"
                            onChange={e => updateInvestmentAdjustment(item.id, { name: e.target.value })}
                          />
                          <input
                            type="number"
                            className="h-8 text-sm border border-slate-300 rounded px-2 font-mono"
                            value={item.totalCost ?? ''}
                            placeholder="Cost"
                            onChange={e => updateInvestmentAdjustment(item.id, { totalCost: parseFloat(e.target.value) || 0 })}
                          />
                          <input
                            type="number"
                            className="h-8 text-sm border border-slate-300 rounded px-2 font-mono"
                            value={item.gainLossOnFV ?? ''}
                            placeholder="FV adjustment"
                            onChange={e => updateInvestmentAdjustment(item.id, { gainLossOnFV: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      ))}
                      <Button variant="secondary" size="sm" onClick={addInvestmentAdjustment}>
                        + Add Investment
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'journal' && (
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
              source: j.id.startsWith('auto-') ? 'System' as const : 'Manual' as const,
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

      <div className="flex justify-end mt-6">
        <Button variant="primary" size="md" onClick={handleProceed}>
          Generate Financial Statements →
        </Button>
      </div>
    </div>
  );
}
