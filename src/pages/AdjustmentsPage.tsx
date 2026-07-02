// src/pages/AdjustmentsPage.tsx
import React, { useState } from 'react';
import { useAppStore }          from '../store/appStore';
import AssetRegisterTable       from '../components/adjustments/AssetRegisterTable';
import ProvisionInputs          from '../components/adjustments/ProvisionInputs';
import AdjustmentJournalView    from '../components/adjustments/AdjustmentJournalView';
import Tabs                     from '../components/ui/Tabs';
import Alert                    from '../components/ui/Alert';
import LoadingSpinner            from '../components/ui/LoadingSpinner';
import { YearEndAdjustments }   from '../types';

type SubStep = 'assets' | 'provisions' | 'review';

// item 83: depreciation KPI summary card
interface DeprecSummary {
  totalCost:        number;
  totalDepreciation: number;
  totalNBV:         number;
}

function DeprecSummaryCard({ summary }: { summary: DeprecSummary }) {
  const fmt = (n: number) =>
    n === 0 ? '—' : `NPR ${Math.abs(n).toLocaleString('en-IN')}`;

  return (
    <div className="grid grid-cols-3 gap-3 p-4 bg-white border border-emerald-200 rounded-xl">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold leading-none mb-1">
          Total Asset Cost
        </p>
        <p className="text-sm font-bold text-slate-800 font-mono">{fmt(summary.totalCost)}</p>
      </div>
      <div className="text-center border-x border-slate-100">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold leading-none mb-1">
          Depreciation for Year
        </p>
        <p className="text-sm font-bold text-amber-700 font-mono">{fmt(summary.totalDepreciation)}</p>
      </div>
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold leading-none mb-1">
          Net Book Value
        </p>
        <p className="text-sm font-bold text-blue-700 font-mono">{fmt(summary.totalNBV)}</p>
      </div>
    </div>
  );
}

const AdjustmentsPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [subStep,        setSubStep]        = useState<SubStep>('assets');
  const [isLoading,      setIsLoading]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [deprecSummary,  setDeprecSummary]  = useState<DeprecSummary | null>(null);

  // item 78: asset count + journal entry count for badges
  const assetCount   = (state.adjustments?.assets?.length ?? 0);
  const journalCount = (state.adjustments?.journalEntries?.length ?? 0);

  const companyId       = state.company?.id ?? '';
  const assetCategories = state.company?.accountingPolicies?.assetCategories ?? [];
  // item 77: inline fiscal year in the sub-description
  const fiscalYear      = state.company?.fiscalYear?.bsYear ?? '—';

  const handleSaveAssets = async (assets: any[]) => {
    if (!companyId) return [];
    setIsLoading(true);
    setError(null);
    try {
      const depResponse = await fetch(`/api/adjustments/${companyId}/calculate-depreciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets }),
      });
      if (!depResponse.ok) throw new Error('Failed to calculate depreciation');
      const depData = await depResponse.json();

      // item 83: compute and store summary KPIs
      const summary: DeprecSummary = {
        totalCost:        (depData.summary ?? []).reduce((s: number, r: any) => s + (r.closingCost ?? 0), 0),
        totalDepreciation: depData.totalDepreciation ?? depData.totalDepreciationExpense ?? 0,
        totalNBV:          (depData.summary ?? []).reduce((s: number, r: any) => s + (r.netBookValueClosing ?? 0), 0),
      };
      setDeprecSummary(summary);
      setSubStep('provisions');
      return depData.summary || [];
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save assets.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProvisions = async (_rows: any[]) => {
    setSubStep('review');
  };

  const handleGenerateStatements = async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/adjustments/${companyId}/calculate-all`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }
      const adjustments: YearEndAdjustments = await response.json();
      dispatch({ type: 'SET_ADJUSTMENTS', payload: adjustments });
      dispatch({ type: 'COMPLETE_STEP', payload: 'year_end_adjustments' });
      dispatch({ type: 'SET_STEP', payload: 'review_statements' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to calculate adjustments.');
    } finally {
      setIsLoading(false);
    }
  };

  // item 78: tab badges with live counts
  const tabs = [
    {
      id:    'assets',
      label: 'Asset Register',
      count: assetCount > 0 ? assetCount : undefined,
    },
    {
      id:    'provisions',
      label: 'Provisions',
    },
    {
      id:    'review',
      label: 'Review Journals',
      count: journalCount > 0 ? journalCount : undefined,
    },
  ];

  if (isLoading) {
    return <LoadingSpinner message="Processing adjustments…" fullPage />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Year-End Adjustments</h2>
        {/* item 77: fiscal year inline in sub-description */}
        <p className="text-sm text-slate-500 mt-1">
          Enter depreciation, provisions, and year-end journals for{' '}
          <span className="font-semibold text-slate-700">FY {fiscalYear}</span>.
        </p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}

      {/* item 78: tab badges */}
      <Tabs
        tabs={tabs}
        active={subStep}
        onChange={id => setSubStep(id as SubStep)}
        variant="line"
      />

      {/* ── Assets Tab ──────────────────────────────────────────── */}
      {subStep === 'assets' && (
        <div className="space-y-4">
          {/* item 79: "How it works:" framing instead of "Step 6:" */}
          <Alert
            type="info"
            title="How it works"
            message={`Enter all fixed assets as at the start of FY ${fiscalYear}. The system calculates book depreciation (SLM or WDV per your accounting policies) and generates journal entries automatically. You can also record asset disposals and additions.`}
          />
          {/* item 83: depreciation KPI card persists after calculation */}
          {deprecSummary && <DeprecSummaryCard summary={deprecSummary} />}
          <AssetRegisterTable
            fiscalYear={fiscalYear}
            onCalculate={handleSaveAssets}
          />
        </div>
      )}

      {/* ── Provisions Tab ──────────────────────────────────────── */}
      {subStep === 'provisions' && (
        <div className="space-y-4">
          <Alert
            type="info"
            title="Year-End Provisions"
            message="Review and enter provisions required under Nepal labor law and accounting standards. Toggle only those provisions applicable to your company. Each provision increases expenses and creates a liability on the balance sheet."
          />
          <ProvisionInputs onSave={handleSaveProvisions} />
        </div>
      )}

      {/* ── Review Tab ──────────────────────────────────────────── */}
      {subStep === 'review' && (
        <div className="space-y-4">
          <AdjustmentJournalView
            entries={state.adjustments?.journalEntries as any ?? []}
            onAddManual={(entry) => console.log('Add manual', entry)}
          />

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-sm font-semibold text-green-800 mb-1">
              ✓ Review all journal entries above before proceeding
            </p>
            <p className="text-xs text-green-600 mb-4">
              These entries determine your final financial statements for FY {fiscalYear}.
            </p>
            <button
              onClick={handleGenerateStatements}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
            >
              All Looks Correct — Generate Financial Statements →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdjustmentsPage;
