// src/pages/AdjustmentsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useAdjustments } from '../hooks/useAdjustments';
import { adjustmentsApi } from '../api/client';
import type { AssetItem, YearEndAdjustments } from '../types';
import Tabs from '../components/ui/Tabs';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import AdjustmentJournalView from '../components/adjustments/AdjustmentJournalView';
import { useToast } from '../components/ui/Toast';

type TabId = 'assets' | 'provisions' | 'journal';

export default function AdjustmentsPage() {
  const { state, dispatch } = useAppStore();
  const { saveAssets, calculateDepreciation, finalizeAdjustments } = useAdjustments();
  const { show: showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('assets');
  const ppePrefillDone = useRef(false);
  const journalAutoDone = useRef(false);

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
    const { summary } = await calculateDepreciation();
    return summary;
  };

  const handleSaveProvisions = async (rows: any[]) => {
    if (!state.company?.id) return;
    try {
      await adjustmentsApi.saveProvisions(state.company.id, rows);
      showToast('Adjustments saved', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save adjustments.';
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
          <AssetRegisterTable
            fiscalYear={state.company?.fiscalYear?.bsFY ?? '2081/82'}
            onCalculate={handleCalculateDepreciation}
          />
        )}

        {activeTab === 'provisions' && (
          <ProvisionInputs onSave={handleSaveProvisions} />
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
