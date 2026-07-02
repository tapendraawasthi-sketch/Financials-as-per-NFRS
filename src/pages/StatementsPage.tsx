// src/pages/StatementsPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useAppStore }        from '../store/appStore';
import Alert                  from '../components/ui/Alert';
import LoadingSpinner         from '../components/ui/LoadingSpinner';
import Button                 from '../components/ui/Button';
import BalanceSheetView       from '../components/statements/BalanceSheetView';
import IncomeStatementView    from '../components/statements/IncomeStatementView';
import CashFlowView           from '../components/statements/CashFlowView';
import ChangesInEquityView    from '../components/statements/ChangesInEquityView';
import NotesViewer            from '../components/statements/NotesViewer';
import { formatNPR }          from '../utils/numberFormat';
import {
  BalanceSheet,
  IncomeStatement,
  CashFlowStatement,
  ChangesInEquity,
} from '../types';

type TabId = 'balance_sheet' | 'income_statement' | 'cash_flow' | 'equity' | 'notes';

// ── item 91: multi-stage loading message ──────────────────────────────────────
const LOADING_STAGES = [
  'Loading trial balance data…',
  'Computing financial positions…',
  'Building income statement…',
  'Calculating cash flows…',
  'Finalizing statements…',
];

function useLoadingStage(active: boolean): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) { setIdx(0); return; }
    const t = setInterval(() => setIdx(i => Math.min(i + 1, LOADING_STAGES.length - 1)), 1500);
    return () => clearInterval(t);
  }, [active]);
  return LOADING_STAGES[idx];
}

// ── item 92: SVG icons instead of emojis ─────────────────────────────────────
function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`${className}`} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WarningTriangleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`${className}`} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

// ── Notes Index — item 97: renamed from "Notes Preview" ──────────────────────
// item 122–125: expandable notes with data preview + NotesViewer integration
function NotesIndex({ companyId: _companyId }: { companyId: string }) {
  const { state }   = useAppStore();
  const notes       = state.notes;

  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  // item 125: full NotesViewer toggle
  const [showFullViewer, setShowFullViewer] = useState(false);

  const notesSummary = [
    { ref: '3.1',  title: 'Property, Plant & Equipment',          key: 'note31_ppe'       },
    { ref: '3.2',  title: 'Capital Work-in-Progress',             key: null               },
    { ref: '3.3',  title: 'Intangible Assets',                    key: null               },
    { ref: '3.4',  title: 'Investments',                          key: 'note32_investments'},
    { ref: '3.5',  title: 'Trade Receivables',                    key: 'note33_tradeReceivables' },
    { ref: '3.6',  title: 'Other Receivables & Advances',         key: 'note34_otherReceivables' },
    { ref: '3.7',  title: 'Inventories',                          key: 'note37_inventories' },
    { ref: '3.8',  title: 'Cash and Cash Equivalents',            key: 'note38_cashAndEquivalents' },
    { ref: '3.9',  title: 'Share Capital',                        key: 'note39_shareCapital' },
    { ref: '3.10', title: 'Reserves & Surplus',                   key: 'note310_reserves'  },
    { ref: '3.11', title: 'Borrowings',                           key: 'note311_borrowings' },
    { ref: '3.12', title: 'Employee Benefits Payable',            key: null               },
    { ref: '3.13', title: 'Trade Payables',                       key: 'note313_tradePayables' },
    { ref: '3.14', title: 'Other Current Liabilities',            key: null               },
    { ref: '3.15', title: 'Current Tax Liabilities',              key: null               },
    { ref: '3.16', title: 'Provisions',                           key: 'note314_provisions' },
    { ref: '3.17', title: 'Revenue from Operations & Other Income', key: 'note317_revenue' },
    { ref: '3.18', title: 'Material Consumed & Purchases',        key: 'note318_materialConsumed' },
    { ref: '3.19', title: 'Direct Expenses',                      key: 'note319_directExpenses'  },
    { ref: '3.20', title: 'Employee Benefit Expenses',            key: 'note320_employeeBenefitExpenses' },
    { ref: '3.21', title: 'Finance Costs',                        key: null               },
    { ref: '3.22', title: 'Administrative & Other Expenses',      key: 'note322_adminExpenses' },
    { ref: '3.23', title: 'Income Tax Expense',                   key: 'note323_incomeTax' },
  ];

  // ── item 122: render expandable content for a note key ───────────────────
  function renderNotePreview(key: string | null): React.ReactNode {
    if (!key || !notes) return null;
    const data = (notes as any)[key];
    if (!data) return <p className="text-xs text-slate-400 italic">No data available for this note.</p>;

    // Special renderers for high-value notes
    if (key === 'note38_cashAndEquivalents') {
      return (
        <div className="text-xs text-slate-600 space-y-1">
          <p><span className="text-slate-400">Cash in Hand:</span> {(data.cashInHand_cy ?? 0).toLocaleString('en-IN')}</p>
          {(data.bankBalances ?? []).slice(0, 4).map((b: any, i: number) => (
            <p key={i}><span className="text-slate-400">{b.bankName}:</span> {(b.cy ?? 0).toLocaleString('en-IN')}</p>
          ))}
          <p className="font-semibold border-t border-slate-100 pt-1 mt-1">
            Total: {(data.totalCash_cy ?? 0).toLocaleString('en-IN')}
          </p>
        </div>
      );
    }

    if (key === 'note31_ppe' && Array.isArray(data)) {
      return (
        <div className="text-xs text-slate-600 space-y-1">
          {data.slice(0, 5).map((d: any) => (
            <p key={d.categoryId}>
              <span className="text-slate-400">{d.categoryName}:</span>{' '}
              NBV {(d.netBookValueClosing ?? 0).toLocaleString('en-IN')}{' '}
              <span className="text-amber-600">(Depn: {(d.depnForYear ?? 0).toLocaleString('en-IN')})</span>
            </p>
          ))}
        </div>
      );
    }

    // Generic key-value renderer
    if (typeof data === 'object' && !Array.isArray(data)) {
      const entries = Object.entries(data).slice(0, 6);
      return (
        <div className="text-xs text-slate-600 space-y-1">
          {entries.map(([k, v]: [string, any]) => (
            <p key={k}>
              <span className="text-slate-400">{k}:</span>{' '}
              {typeof v === 'number'
                ? v.toLocaleString('en-IN')
                : typeof v === 'object' && v !== null && 'cy' in v
                ? (v.cy ?? 0).toLocaleString('en-IN')
                : String(v ?? '—')}
            </p>
          ))}
        </div>
      );
    }

    return null;
  }

  // ── item 125: Full NotesViewer overlay ────────────────────────────────────
  if (showFullViewer) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Full Notes to the Financial Statements</h3>
          <button
            type="button"
            onClick={() => setShowFullViewer(false)}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2.5 py-1 transition-colors"
          >
            ← Back to Index
          </button>
        </div>
        <NotesViewer />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* item 125: "Open Full Notes" button at top right */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Notes to the Financial Statements</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Click any note to preview amounts. Full schedules are in the Excel workbook.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFullViewer(true)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors flex-shrink-0"
        >
          Open Full Notes →
        </button>
      </div>

      {/* item 122: click-to-expand note grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {notesSummary.map(note => {
          const isExpanded  = expandedNote === note.ref;
          const hasData     = Boolean(note.key && notes && (notes as any)[note.key]);

          return (
            <div
              key={note.ref}
              className={`rounded-lg border transition-all duration-150 overflow-hidden ${
                isExpanded
                  ? 'border-blue-300 bg-blue-50 col-span-1 sm:col-span-2 lg:col-span-3'
                  : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
              }`}
            >
              {/* Header row — always visible */}
              <button
                type="button"
                onClick={() => setExpandedNote(isExpanded ? null : note.ref)}
                className="w-full flex items-center gap-2 p-2.5 text-left"
                aria-expanded={isExpanded}
              >
                <span className="text-xs font-bold text-blue-600 flex-shrink-0 w-9">{note.ref}</span>
                <span className={`text-xs flex-1 ${isExpanded ? 'text-blue-800 font-medium' : 'text-slate-600'}`}>
                  {note.title}
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  {hasData && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Data available" aria-hidden="true" />
                  )}
                  <svg
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>

              {/* item 122: expanded content */}
              {isExpanded && (
                <div className="border-t border-blue-200 px-3 py-3 bg-white">
                  {renderNotePreview(note.key) ?? (
                    <p className="text-xs text-slate-400 italic">
                      Detailed schedule available in the Excel workbook.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* item 123: Alert component instead of emoji paragraph */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 border-l-4 border-l-blue-500 bg-blue-50 px-3.5 py-2.5">
        <svg className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm text-blue-700">
          Full note details with amounts, schedules, and disclosures are available in the downloadable Excel workbook.
        </p>
      </div>
    </div>
  );
}

const StatementsPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [activeTab,    setActiveTab]    = useState<TabId>('balance_sheet');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [warnings,     setWarnings]     = useState<string[]>([]);

  // item 91: cycling loading message
  const loadingMessage = useLoadingStage(isGenerating);

  const companyId = state.company?.id ?? '';

  useEffect(() => {
    if (!companyId) return;
    if (state.balanceSheet && state.incomeStatement) return;

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
        if (data.balanceSheet)    dispatch({ type: 'SET_BALANCE_SHEET',    payload: data.balanceSheet    });
        if (data.incomeStatement) dispatch({ type: 'SET_INCOME_STATEMENT', payload: data.incomeStatement });
        if (data.cashFlow)        dispatch({ type: 'SET_CASH_FLOW',        payload: data.cashFlow        });
        if (data.changesInEquity) dispatch({ type: 'SET_CHANGES_IN_EQUITY', payload: data.changesInEquity });

        const w: string[] = [];
        if (data.balanceSheet) {
          const bs = data.balanceSheet as BalanceSheet;
          const diff = Math.abs((bs.totalAssets ?? 0) - (bs.totalEquityAndLiabilities ?? 0));
          if (diff > 1) w.push(`Balance sheet imbalance: NPR ${formatNPR(diff)}`);
        }
        if (data.cashFlow) {
          const cf = data.cashFlow as CashFlowStatement;
          const computed =
            (cf.openingCash ?? 0) +
            (cf.netCashFromOperating ?? 0) +
            (cf.netCashFromInvesting ?? 0) +
            (cf.netCashFromFinancing ?? 0);
          if (Math.abs(computed - (cf.closingCash ?? 0)) > 1) {
            w.push('Cash flow reconciliation difference — review working capital movements.');
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

  const bs = state.balanceSheet  as BalanceSheet        | null;
  const is = state.incomeStatement as IncomeStatement   | null;
  const cf = state.cashFlow       as CashFlowStatement  | null;
  const ce = state.changesInEquity as ChangesInEquity   | null;

  const bsBalanced = bs
    ? Math.abs((bs.totalAssets ?? 0) - (bs.totalEquityAndLiabilities ?? 0)) < 2
    : false;

  // item 95: tab status dots
  const tabStatus: Record<TabId, boolean> = {
    balance_sheet:    Boolean(bs),
    income_statement: Boolean(is),
    cash_flow:        Boolean(cf),
    equity:           Boolean(ce),
    notes:            true,
  };

  // item 96: abbreviated tab labels + item 97: renamed Notes to Statements
  const tabs = [
    { id: 'balance_sheet',    label: 'Balance Sheet'   },
    { id: 'income_statement', label: 'Income Statement' },
    { id: 'cash_flow',        label: 'Cash Flow'        },
    // item 96: abbreviated to prevent wrapping
    { id: 'equity',           label: 'Equity Changes'   },
    // item 97: renamed from "Notes Preview"
    { id: 'notes',            label: 'Notes to Statements' },
  ] as const;

  if (isGenerating) {
    return <LoadingSpinner message={loadingMessage} fullPage />;
  }

  return (
    // item 86: overflow-x-auto on outer wrapper
    <div className="max-w-5xl mx-auto space-y-5 overflow-x-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Review Financial Statements</h2>
          <p className="text-sm text-slate-500 mt-1">
            Review all four statements carefully before downloading the Excel workbook.
          </p>
        </div>
        {/* item 87: proper Button component for back navigation */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' })}
        >
          ← Back to Adjustments
        </Button>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}

      {/* ── item 92 + 93: Balance validation banner with SVG icons + border-l-4 ── */}
      {bs && (
        <div className={[
          'flex items-start gap-3 rounded-lg border p-4',
          // item 93: border-l-4 accent for color-blind differentiation
          bsBalanced
            ? 'bg-green-50 border-green-200 border-l-4 border-l-green-500'
            : 'bg-red-50 border-red-200 border-l-4 border-l-red-600',
        ].join(' ')}>
          {/* item 92: SVG icon instead of emoji */}
          {bsBalanced
            ? <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            : <WarningTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${bsBalanced ? 'text-green-800' : 'text-red-800'}`}>
              {bsBalanced
                ? 'Balance Sheet balanced — Assets = Liabilities + Equity'
                : `Balance Sheet does not balance — difference: NPR ${formatNPR(
                    Math.abs((bs.totalAssets ?? 0) - (bs.totalEquityAndLiabilities ?? 0))
                  )}`}
            </p>

            {/* item 94: actionable fix guidance with Fix It link */}
            {!bsBalanced && (
              <ul className="mt-2 space-y-1">
                <li className="text-xs text-red-700">
                  <strong>Likely cause:</strong> One or more trial balance accounts are mapped to "Unclassified" or an incorrect NFRS category, causing amounts to not appear in either assets or liabilities.
                </li>
                <li className="text-xs text-red-700">
                  <strong>How to fix:</strong>{' '}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_STEP', payload: 'trial_balance_mapping' })}
                    className="underline font-semibold hover:text-red-900 transition-colors"
                  >
                    Go to Account Mapping →
                  </button>{' '}
                  and ensure every account is classified.
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

      {warnings.filter(w => !w.toLowerCase().includes('balance sheet')).map((w, idx) => (
        <Alert key={idx} type="warning" message={w} />
      ))}

      {/* ── Tabs — items 95, 96, 97 ──────────────────────────────── */}
      {/* item 96: overflow-x-auto on tab bar to prevent wrapping on small screens */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <nav className="-mb-px flex items-center gap-0 min-w-max" role="tablist">
          {tabs.map(tab => {
            const hasData = tabStatus[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex items-center gap-1.5 h-10 px-4 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {tab.label}
                {/* item 95: green dot for tabs with data */}
                {hasData && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-blue-500' : 'bg-emerald-500'}`}
                    aria-hidden="true"
                    title="Data available"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab Content ────────────────────────────────────────── */}
      <div className="min-h-96 page-enter">
        {activeTab === 'balance_sheet'    && bs && state.company && (
          <BalanceSheetView data={bs} company={state.company} />
        )}
        {activeTab === 'income_statement' && is && state.company && (
          <IncomeStatementView data={is} company={state.company} />
        )}
        {activeTab === 'cash_flow'        && state.company && <CashFlowView />}
        {activeTab === 'equity'           && state.company && <ChangesInEquityView />}
        {activeTab === 'notes'            && <NotesIndex companyId={companyId} />}

        {!bs && !isGenerating && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">No statements loaded. Generation may still be in progress.</p>
          </div>
        )}
      </div>

      {/* ── Action Buttons ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' })}>
          ← Go Back & Make Changes
        </Button>
        <Button variant="primary" size="md"
          onClick={() => {
            dispatch({ type: 'COMPLETE_STEP', payload: 'review_statements' });
            dispatch({ type: 'SET_STEP',      payload: 'generate_output'   });
          }}>
          Looks Good — Download Excel Workbook →
        </Button>
      </div>
    </div>
  );
};

export default StatementsPage;
