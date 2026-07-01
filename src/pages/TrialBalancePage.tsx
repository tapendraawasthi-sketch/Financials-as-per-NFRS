// src/pages/TrialBalancePage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { ParsedTrialBalance } from '../types';
import TBUploadZone from '../components/trialBalance/TBUploadZone';
import TBAccountMapper from '../components/trialBalance/TBAccountMapper';
import WizardProgress from '../components/layout/WizardProgress';
import Alert from '../components/ui/Alert';

type SubStep = 'upload' | 'mapping';

const wizardSteps = [
  { id: 'company_setup' as const, label: 'Company', description: 'Company details' },
  { id: 'accounting_policies' as const, label: 'Policies', description: 'Accounting policies' },
  { id: 'trial_balance_upload' as const, label: 'Upload TB', description: 'Trial balance file' },
  { id: 'trial_balance_mapping' as const, label: 'Map Accounts', description: 'NFRS mapping' },
  { id: 'subledger_details' as const, label: 'Subledgers', description: 'Debtors & creditors' },
  { id: 'year_end_adjustments' as const, label: 'Adjustments', description: 'Year-end entries' },
  { id: 'review_statements' as const, label: 'Statements', description: 'Review financials' },
  { id: 'generate_output' as const, label: 'Download', description: 'Generate Excel' },
];

const TrialBalancePage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [subStep, setSubStep] = useState<SubStep>(
    state.trialBalance ? 'mapping' : 'upload'
  );
  const [error, setError] = useState<string | null>(null);

  const companyId = state.company?.id ?? '';

  const handleUploadComplete = (tb: ParsedTrialBalance) => {
    dispatch({ type: 'SET_TRIAL_BALANCE', payload: tb });
    setSubStep('mapping');
  };

  const handleMappingComplete = (tb: ParsedTrialBalance) => {
    dispatch({ type: 'SET_TRIAL_BALANCE', payload: tb });
    dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_upload' });
    dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_mapping' });
    dispatch({ type: 'SET_STEP', payload: 'subledger_details' });
  };

  const tb = state.trialBalance;

  // Summary counts
  const totalAccounts = tb?.rows?.length ?? 0;
  const autoMatched = tb?.rows?.filter((r) => r.confidence >= 80 && !r.needsReview).length ?? 0;
  const needsReview = tb?.rows?.filter((r) => r.needsReview || r.confidence < 80).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Wizard Progress */}
      <WizardProgress
        steps={wizardSteps.map((s) => ({ ...s, icon: null }))}
        currentStep={subStep === 'upload' ? 'trial_balance_upload' : 'trial_balance_mapping'}
        completedSteps={state.completedSteps}
        onStepClick={(step) => dispatch({ type: 'SET_STEP', payload: step })}
      />

      {/* Sub-step breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSubStep('upload')}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            subStep === 'upload' ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          3. Upload Trial Balance
        </button>
        <span className="text-slate-300 text-xs">›</span>
        <button
          onClick={() => tb && setSubStep('mapping')}
          disabled={!tb}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
            subStep === 'mapping'
              ? 'bg-blue-100 text-blue-700'
              : tb
              ? 'text-slate-400 hover:text-slate-600'
              : 'text-slate-200 cursor-not-allowed'
          }`}
        >
          4. Review Account Mappings
        </button>
      </div>

      {/* Error */}
      {error && (
        <Alert type="error" message={error} onDismiss={() => setError(null)} />
      )}

      {/* ── Upload Sub-step ── */}
      {subStep === 'upload' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Step 3: Upload Trial Balance</h2>
            <p className="text-sm text-slate-500 mt-1">
              Upload your trial balance exported from Tally, Busy, Marg, or any accounting software.
            </p>
          </div>

          {/* Format guidance card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">📋 What We Need</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-700">
              <div>
                <p className="font-semibold mb-1">Supported formats:</p>
                <ul className="space-y-0.5">
                  <li>• Excel (.xlsx, .xls)</li>
                  <li>• CSV (.csv)</li>
                  <li>• Tab-separated text</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Required columns (any order):</p>
                <ul className="space-y-0.5">
                  <li>• Account / Ledger Name</li>
                  <li>• Opening Debit / Credit</li>
                  <li>• Transactions Debit / Credit</li>
                  <li>• Closing Debit / Credit</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3 border-t border-blue-200 pt-3">
              <strong>Tip:</strong> From Tally, go to Gateway → Display More Reports → Account Books → Trial Balance
              → Export → Excel format. From Busy, go to Reports → Financial Reports → Trial Balance → Export.
            </p>
          </div>

          <TBUploadZone
            companyId={companyId}
            onUploadComplete={handleUploadComplete}
            onError={(msg) => setError(msg)}
            existingTB={state.trialBalance ?? undefined}
          />
        </div>
      )}

      {/* ── Mapping Sub-step ── */}
      {subStep === 'mapping' && tb && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Step 4: Review Account Mappings</h2>
              <p className="text-sm text-slate-500 mt-1">
                Verify that each account is mapped to the correct NFRS category. AI has pre-filled most mappings.
              </p>
            </div>
            <button
              onClick={() => setSubStep('upload')}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 flex-shrink-0 border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              ← Re-upload
            </button>
          </div>

          {/* Summary Banner */}
          <div className={`rounded-xl p-4 border ${tb.validation?.isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${tb.validation?.isBalanced ? 'text-green-600' : 'text-red-500'}`}>
                  {tb.validation?.isBalanced ? '✅' : '⚠️'}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${tb.validation?.isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                    {tb.validation?.isBalanced ? 'Trial Balance Balanced' : 'Trial Balance Does Not Balance'}
                  </p>
                  {!tb.validation?.isBalanced && (
                    <p className="text-xs text-red-500">Check your source data for missing entries.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="font-bold text-slate-700">{totalAccounts}</p>
                  <p className="text-xs text-slate-500">Accounts Uploaded</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-green-700">{autoMatched}</p>
                  <p className="text-xs text-slate-500">Auto-Matched</p>
                </div>
                <div className="text-center">
                  <p className={`font-bold ${needsReview > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {needsReview}
                  </p>
                  <p className="text-xs text-slate-500">Need Review</p>
                </div>
              </div>
            </div>
          </div>

          <TBAccountMapper
            companyId={companyId}
            parsedTB={tb}
            onMappingComplete={handleMappingComplete}
          />
        </div>
      )}

      {subStep === 'mapping' && !tb && (
        <Alert
          type="warning"
          message="No trial balance found. Please upload your trial balance first."
        />
      )}
    </div>
  );
};

export default TrialBalancePage;
