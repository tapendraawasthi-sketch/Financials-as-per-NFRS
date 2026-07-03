// src/pages/StatementsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import BalanceSheetView from '../components/statements/BalanceSheetView';
import IncomeStatementView from '../components/statements/IncomeStatementView';
import CashFlowView from '../components/statements/CashFlowView';
import ChangesInEquityView from '../components/statements/ChangesInEquityView';
import NotesViewer from '../components/statements/NotesViewer';
import { financialsApi } from '../api/client';

type TabId = 'bs' | 'is' | 'equity' | 'cf' | 'notes';

export default function StatementsPage() {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>('bs');
  const [generating, setGenerating] = useState(false);

  const hasFinancials = state.balanceSheet != null;

  const handleGenerate = async () => {
    if (!state.company?.id) return;
    setGenerating(true);
    try {
      const result = await financialsApi.generate(state.company.id);
      dispatch({ type: 'SET_FINANCIALS', payload: result.data });
      dispatch({ type: 'COMPLETE_STEP', payload: 'review_statements' });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', payload: err?.message ?? 'Failed to generate financials.' });
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate on mount if not yet done
  useEffect(() => {
    if (!hasFinancials && state.company?.id && state.trialBalance) {
      handleGenerate();
    }
  }, []); // eslint-disable-line

  const tabs = [
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'is', label: 'Income Statement' },
    { id: 'equity', label: 'Changes in Equity' },
    { id: 'cf', label: 'Cash Flow' },
    { id: 'notes', label: 'Notes' },
  ];

  if (generating) {
    return <LoadingSpinner message="Computing financial statements..." fullPage={false} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <Tabs
          tabs={tabs}
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          variant="pill"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleGenerate} loading={generating}>
            Refresh Statements
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              dispatch({ type: 'COMPLETE_STEP', payload: 'review_statements' });
              dispatch({ type: 'SET_STEP', payload: 'generate_output' });
            }}
            disabled={!hasFinancials}
          >
            Proceed to Download →
          </Button>
        </div>
      </div>

      <div className="page-enter">
        {activeTab === 'bs' && state.balanceSheet && state.company && (
          <BalanceSheetView data={state.balanceSheet} company={state.company} />
        )}
        {activeTab === 'is' && state.incomeStatement && state.company && (
          <IncomeStatementView data={state.incomeStatement} company={state.company} />
        )}
        {activeTab === 'equity' && <ChangesInEquityView />}
        {activeTab === 'cf' && <CashFlowView />}
        {activeTab === 'notes' && <NotesViewer />}

        {!hasFinancials && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-500 mb-4">
              Financial statements have not been generated yet.
            </p>
            <Button variant="primary" size="md" onClick={handleGenerate}>
              Generate Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
