// src/pages/AdjustmentsPage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAdjustments } from '../hooks/useAdjustments';
import { adjustmentsApi } from '../api/client';
import Tabs from '../components/ui/Tabs';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import Button from '../components/ui/Button';

type TabId = 'assets' | 'provisions';

export default function AdjustmentsPage() {
  const { state, dispatch } = useAppStore();
  const { saveAssets, calculateDepreciation, finalizeAdjustments } = useAdjustments();
  const [activeTab, setActiveTab] = useState<TabId>('assets');

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
