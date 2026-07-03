// src/pages/AdjustmentsPage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import SubledgerInputPanel from '../components/adjustments/SubledgerInputPanel';
import Button from '../components/ui/Button';

type TabId = 'assets' | 'provisions' | 'subledger';

export default function AdjustmentsPage() {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>('assets');

  const handleCalculateDepreciation = async (assets: any[]) => {
    // In a full implementation, call the API. For now, return empty.
    return [];
  };

  const handleSaveProvisions = async (rows: any[]) => {
    // Save provisions to adjustments state
  };

  const handleProceed = () => {
    dispatch({ type: 'COMPLETE_STEP', payload: 'year_end_adjustments' });
    dispatch({ type: 'SET_STEP', payload: 'review_statements' });
  };

  const tbRows = state.trialBalance?.rows ?? [];
  const tbDebtorTotal = tbRows
    .filter(r => r.nfrsCategory === 'trade_receivables' && !r.isGroupRow)
    .reduce((s, r) => s + (r.closingDr ?? 0), 0);
  const tbCreditorTotal = tbRows
    .filter(r => r.nfrsCategory === 'trade_payables_creditors' && !r.isGroupRow)
    .reduce((s, r) => s + (r.closingCr ?? 0), 0);

  const tabs = [
    { id: 'assets', label: 'PPE / Depreciation' },
    { id: 'provisions', label: 'Provisions & Tax' },
    { id: 'subledger', label: 'Subledger Details' },
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
            fiscalYear={state.company?.fiscalYear?.bsYear ?? '2081/82'}
            onCalculate={handleCalculateDepreciation}
          />
        )}

        {activeTab === 'provisions' && (
          <ProvisionInputs onSave={handleSaveProvisions} />
        )}

        {activeTab === 'subledger' && state.company?.id && (
          <SubledgerInputPanel
            companyId={state.company.id}
            tbDebtorTotal={tbDebtorTotal}
            tbCreditorTotal={tbCreditorTotal}
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
