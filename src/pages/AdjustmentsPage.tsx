// src/pages/AdjustmentsPage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import AssetRegisterTable from '../components/adjustments/AssetRegisterTable';
import ProvisionInputs from '../components/adjustments/ProvisionInputs';
import AdjustmentJournalView from '../components/adjustments/AdjustmentJournalView';
import Tabs from '../components/ui/Tabs';
import Alert from '../components/ui/Alert';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { YearEndAdjustments } from '../types';

type SubStep = 'assets' | 'provisions' | 'review';

const AdjustmentsPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [subStep, setSubStep] = useState<SubStep>('assets');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depreciationPreview, setDepreciationPreview] = useState<string | null>(null);

  const companyId = state.company?.id ?? '';
  const assetCategories = state.company?.accountingPolicies?.assetCategories ?? [];
  const fiscalYear = state.company?.fiscalYear.bsYear ?? '2081/82';

  const handleSaveAssets = async (assets: any[]) => {
    if (!companyId) return [];
    setIsLoading(true);
    setError(null);
    try {
      // Calculate depreciation after saving assets
      const depResponse = await fetch(`/api/adjustments/${companyId}/calculate-depreciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets })
      });
      if (!depResponse.ok) throw new Error('Failed to calculate depreciation');
      const depData = await depResponse.json();
      setDepreciationPreview(`Depreciation calculated: NPR ${depData.totalDepreciation?.toLocaleString() ?? 0}`);
      setSubStep('provisions');
      return depData.summary || [];
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save assets.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProvisions = async (rows: any[]) => {
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

  const tabs = [
    {
      id: 'assets',
      label: 'Asset Register',
      badge: assetCategories.length > 0 ? String(assetCategories.length) : undefined,
    },
    { id: 'provisions', label: 'Provisions' },
    { id: 'review', label: 'Review Journals' },
  ];

  if (isLoading) {
    return <LoadingSpinner message="Processing adjustments…" fullPage />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Year-End Adjustments</h2>
        <p className="text-sm text-slate-500 mt-1">
          Enter your asset register for depreciation, provisions, and review the resulting journal entries.
        </p>
      </div>

      {/* Error */}
      {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}

      {/* Depreciation Preview */}
      {depreciationPreview && (
        <Alert type="success" message={depreciationPreview} onDismiss={() => setDepreciationPreview(null)} />
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        active={subStep}
        onChange={(id) => setSubStep(id as SubStep)}
        variant="line"
      />

      {/* ── Assets Tab ── */}
      {subStep === 'assets' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs text-blue-700">
              <strong>Step 6:</strong> Enter all assets owned by the company as at the beginning of this fiscal year.
              Depreciation will be calculated automatically based on your accounting policies.
            </p>
          </div>
          <AssetRegisterTable
            fiscalYear={fiscalYear}
            onCalculate={handleSaveAssets}
          />
        </div>
      )}

      {/* ── Provisions Tab ── */}
      {subStep === 'provisions' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs text-amber-700">
              Review and enter year-end provisions. These will be included in your financial statements
              and adjusting journal entries. Toggle only those provisions applicable to your company.
            </p>
          </div>
          <ProvisionInputs
            onSave={handleSaveProvisions}
          />
        </div>
      )}

      {/* ── Review Tab ── */}
      {subStep === 'review' && (
        <div className="space-y-4">
          <AdjustmentJournalView
            entries={state.adjustments?.journalEntries as any ?? []}
            onAddManual={(entry) => console.log('Add manual', entry)}
          />

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-sm font-semibold text-green-800 mb-1">
              ✅ Review all journal entries above before proceeding.
            </p>
            <p className="text-xs text-green-600 mb-4">
              These entries will be used to compute your final financial statements.
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
