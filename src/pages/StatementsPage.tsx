// src/pages/StatementsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import BalanceSheetView from '../components/statements/BalanceSheetView';
import IncomeStatementView from '../components/statements/IncomeStatementView';
import CashFlowView from '../components/statements/CashFlowView';
import ChangesInEquityView from '../components/statements/ChangesInEquityView';
import NotesViewer from '../components/statements/NotesViewer';
import PrintButton from '../components/output/PrintButton';
import { financialsApi } from '../api/client';
import { formatNPRSimple } from '../utils/numberFormat';

type TabId = 'bs' | 'is' | 'equity' | 'cf' | 'notes';

export default function StatementsPage() {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>('bs');
  const [generating, setGenerating] = useState(false);

  const hasFinancials = state.balanceSheet != null;

  const handleGenerate = useCallback(async () => {
    if (!state.company?.id) return;
    setGenerating(true);
    try {
      const response = await financialsApi.generate(state.company.id) as {
        data?: {
          balanceSheet: unknown;
          incomeStatement: unknown;
          changesInEquity: unknown;
          cashFlow: unknown;
          notes: unknown;
        };
        balanceSheet?: unknown;
      };
      const payload = response.data ?? response;
      dispatch({ type: 'SET_FINANCIALS', payload: payload as NonNullable<typeof response.data> & typeof response });
      dispatch({ type: 'COMPLETE_STEP', payload: 'review_statements' });
    } catch (err: unknown) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to generate financials.',
      });
    } finally {
      setGenerating(false);
    }
  }, [state.company?.id, dispatch]);

  const balanceDiff = useMemo(() => {
    const bs = state.balanceSheet as Record<string, number> | null;
    if (!bs) return 0;
    const totalAssets = bs.totalAssets ?? 0;
    const totalEquity = bs.totalEquity ?? 0;
    const totalLiabilities = bs.totalLiabilities
      ?? ((bs.totalEquityAndLiabilities ?? 0) - totalEquity);
    return totalAssets - (totalEquity + totalLiabilities);
  }, [state.balanceSheet]);

  const isBalanceSheetBalanced = hasFinancials && Math.abs(balanceDiff) <= 1;

  // Auto-generate on mount if not yet done
  useEffect(() => {
    if (!hasFinancials && state.company?.id && state.trialBalance) {
      handleGenerate();
    }
  }, [state.company?.id, hasFinancials, state.trialBalance, handleGenerate]);

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

  const showPrintAction = hasFinancials && activeTab !== 'notes';

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
            disabled={!hasFinancials || !isBalanceSheetBalanced}
          >
            Proceed to Download →
          </Button>
        </div>
      </div>

      {hasFinancials && (
        <div className="mb-4">
          {!isBalanceSheetBalanced ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              Balance Sheet does not balance. Difference: NPR {formatNPRSimple(Math.abs(balanceDiff))}.
              Download is disabled until resolved.
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">
              Balance Sheet balanced ✓
            </div>
          )}
        </div>
      )}

      <div
        className="relative rounded-xl p-4"
        style={{ background: 'var(--surface-sunken)' }}
      >
        {showPrintAction && (
          <div className="no-print absolute top-4 right-4 z-20 flex items-center gap-2">
            <PrintButton label="Print / Export PDF" />
          </div>
        )}

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
            <div className="statement-page max-w-4xl mx-auto text-center py-16">
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
    </div>
  );
}
