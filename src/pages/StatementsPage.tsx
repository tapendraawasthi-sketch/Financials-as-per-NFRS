// src/pages/StatementsPage.tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import Alert from '../components/ui/Alert';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import BalanceSheetView from '../components/statements/BalanceSheetView';
import IncomeStatementView from '../components/statements/IncomeStatementView';
import CashFlowView from '../components/statements/CashFlowView';
import ChangesInEquityView from '../components/statements/ChangesInEquityView';
import { formatNPR } from '../utils/numberFormat';
import {
  BalanceSheet,
  IncomeStatement,
  CashFlowStatement,
  ChangesInEquity,
} from '../types';

type TabId = 'balance_sheet' | 'income_statement' | 'cash_flow' | 'equity' | 'notes';

// Simple inline notes preview component
const NotesPreview: React.FC<{ companyId: string }> = ({ companyId: _companyId }) => {
  const notesSummary = [
    { ref: '3.1', title: 'Property, Plant & Equipment' },
    { ref: '3.2', title: 'Capital Work-in-Progress' },
    { ref: '3.3', title: 'Intangible Assets' },
    { ref: '3.4', title: 'Investments' },
    { ref: '3.5', title: 'Trade Receivables' },
    { ref: '3.6', title: 'Other Receivables & Advances' },
    { ref: '3.7', title: 'Inventories' },
    { ref: '3.8', title: 'Cash and Cash Equivalents' },
    { ref: '3.9', title: 'Share Capital' },
    { ref: '3.10', title: 'Reserves & Surplus' },
    { ref: '3.11', title: 'Borrowings' },
    { ref: '3.12', title: 'Employee Benefits Payable' },
    { ref: '3.13', title: 'Trade Payables' },
    { ref: '3.14', title: 'Other Current Liabilities' },
    { ref: '3.15', title: 'Current Tax Liabilities' },
    { ref: '3.16', title: 'Provisions' },
    { ref: '3.17', title: 'Revenue from Operations & Other Income' },
    { ref: '3.18', title: 'Material Consumed & Purchases' },
    { ref: '3.19', title: 'Direct Expenses' },
    { ref: '3.20', title: 'Employee Benefit Expenses' },
    { ref: '3.21', title: 'Finance Costs' },
    { ref: '3.22', title: 'Administrative & Other Expenses' },
    { ref: '3.23', title: 'Income Tax Expense' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-800 mb-1">Notes to the Financial Statements</h3>
      <p className="text-xs text-slate-500 mb-4">
        The following notes are included in the generated Excel workbook. Download the workbook to view full details.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {notesSummary.map((note) => (
          <div
            key={note.ref}
            className="flex items-start gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50"
          >
            <span className="text-xs font-bold text-blue-600 flex-shrink-0 w-8">{note.ref}</span>
            <span className="text-xs text-slate-600">{note.title}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-4 text-center">
        💡 Full note details with amounts are available in the downloadable Excel workbook.
      </p>
    </div>
  );
};

const StatementsPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>('balance_sheet');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const companyId = state.company?.id ?? '';

  // Fetch / generate statements on mount
  useEffect(() => {
    if (!companyId) return;
    if (state.balanceSheet && state.incomeStatement) return; // already loaded

    const generate = async () => {
      setIsGenerating(true);
      setError(null);
      try {
        const response = await fetch(`/api/financials/${companyId}/generate`, { method: 'POST' });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Server error' }));
          throw new Error(errData.error || `Server error: ${response.status}`);
        }
        const data = await response.json();

        if (data.balanceSheet) dispatch({ type: 'SET_BALANCE_SHEET', payload: data.balanceSheet });
        if (data.incomeStatement) dispatch({ type: 'SET_INCOME_STATEMENT', payload: data.incomeStatement });
        if (data.cashFlow) dispatch({ type: 'SET_CASH_FLOW', payload: data.cashFlow });
        if (data.changesInEquity) dispatch({ type: 'SET_CHANGES_IN_EQUITY', payload: data.changesInEquity });

        // Derive warnings
        const w: string[] = [];
        if (data.balanceSheet) {
          const bs = data.balanceSheet as BalanceSheet;
          const diff = Math.abs((bs.totalAssets?.cy ?? 0) - (bs.totalLiabilitiesAndEquity?.cy ?? 0));
          if (diff > 1) w.push(`Balance sheet does not balance — difference: ${formatNPR(diff)}`);
        }
        if (data.cashFlow) {
          const cf = data.cashFlow as CashFlowStatement;
          const computed =
            (cf.openingCash?.cy ?? 0) +
            (cf.netCashFromOperating?.cy ?? 0) +
            (cf.netCashFromInvesting?.cy ?? 0) +
            (cf.netCashFromFinancing?.cy ?? 0);
          if (Math.abs(computed - (cf.closingCash?.cy ?? 0)) > 1) {
            w.push('Cash flow statement reconciliation difference — please review working capital movements.');
          }
        }
        setWarnings(w);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to generate financial statements.');
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const bs = state.balanceSheet as BalanceSheet | null;
  const is = state.incomeStatement as IncomeStatement | null;
  const cf = state.cashFlow as CashFlowStatement | null;
  const ce = state.changesInEquity as ChangesInEquity | null;

  const bsBalanced = bs
    ? Math.abs((bs.totalAssets?.cy ?? 0) - (bs.totalLiabilitiesAndEquity?.cy ?? 0)) < 2
    : false;

  const tabs = [
    { id: 'balance_sheet', label: 'Balance Sheet' },
    { id: 'income_statement', label: 'Income Statement' },
    { id: 'cash_flow', label: 'Cash Flow' },
    { id: 'equity', label: 'Changes in Equity' },
    { id: 'notes', label: 'Notes Preview' },
  ];

  if (isGenerating) {
    return <LoadingSpinner message="Generating financial statements… Please wait." fullPage />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Review Financial Statements</h2>
          <p className="text-sm text-slate-500 mt-1">
            Review all four statements carefully before downloading the Excel workbook.
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' })}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1"
        >
          ← Back to Adjustments
        </button>
      </div>

      {/* Error */}
      {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}

      {/* Validation banners */}
      {bs && (
        <div className={`rounded-xl p-4 border ${bsBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-semibold ${bsBalanced ? 'text-green-700' : 'text-red-700'}`}>
            {bsBalanced
              ? '✅ Balance Sheet balances — Assets = Liabilities + Equity'
              : `⚠️ Balance Sheet does not balance — difference: ${formatNPR(
                  Math.abs((bs.totalAssets?.cy ?? 0) - (bs.totalLiabilitiesAndEquity?.cy ?? 0))
                )}`}
          </p>
          {!bsBalanced && (
            <p className="text-xs text-red-600 mt-1">
              Check that all trial balance accounts are mapped to a valid NFRS category, and that no accounts are
              mapped to 'Unclassified'.
            </p>
          )}
        </div>
      )}

      {warnings
        .filter((w) => !w.toLowerCase().includes('balance sheet'))
        .map((w, idx) => (
          <Alert key={idx} type="warning" message={w} />
        ))}

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        variant="underline"
      />

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'balance_sheet' && bs && state.company && (
          <BalanceSheetView balanceSheet={bs} company={state.company} />
        )}
        {activeTab === 'income_statement' && is && state.company && (
          <IncomeStatementView incomeStatement={is} company={state.company} />
        )}
        {activeTab === 'cash_flow' && cf && state.company && (
          <CashFlowView cashFlow={cf} company={state.company} />
        )}
        {activeTab === 'equity' && ce && state.company && (
          <ChangesInEquityView changesInEquity={ce} company={state.company} />
        )}
        {activeTab === 'notes' && (
          <NotesPreview companyId={companyId} />
        )}
        {!bs && !isGenerating && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">No statements loaded. Click the tab above or wait for generation to complete.</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4 border-t border-slate-200">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' })}
          className="text-sm text-slate-600 hover:text-slate-800 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          ← Go Back & Make Changes
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'COMPLETE_STEP', payload: 'review_statements' });
            dispatch({ type: 'SET_STEP', payload: 'generate_output' });
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          Looks Good — Download Excel Workbook →
        </button>
      </div>
    </div>
  );
};

export default StatementsPage;
