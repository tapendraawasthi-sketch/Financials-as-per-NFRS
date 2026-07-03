// src/pages/AdjustmentsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useAdjustments } from '../hooks/useAdjustments';
import { adjustmentsApi } from '../api/client';
import type { AssetItem, YearEndAdjustments } from '../types';
import Tabs from '../components/ui/Tabs';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import Button from '../components/ui/Button';

type TabId = 'assets' | 'provisions';

export default function AdjustmentsPage() {
  const { state, dispatch } = useAppStore();
  const { saveAssets, calculateDepreciation, finalizeAdjustments } = useAdjustments();
  const [activeTab, setActiveTab] = useState<TabId>('assets');
  const ppePrefillDone = useRef(false);

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

  const handleCalculateDepreciation = async (assets: any[]) => {
    await saveAssets(assets);
    const { summary } = await calculateDepreciation();
    return summary;
  };

  const handleSaveProvisions = async (rows: any[]) => {
    if (!state.company?.id) return;
    await adjustmentsApi.saveProvisions(state.company.id, rows);
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
      </div>

      <div className="flex justify-end mt-6">
        <Button variant="primary" size="md" onClick={handleProceed}>
          Generate Financial Statements →
        </Button>
      </div>
    </div>
  );
}
