// src/components/output/DownloadPanel.tsx
import React, { useState } from 'react';
import { CompanyProfile, AppStep } from '../../types';
import { useAppDispatch } from '../../store/appStore';

interface DownloadPanelProps {
  companyId: string;
  company: CompanyProfile;
  isStatementsReady: boolean;
}

interface ChecklistItem {
  label: string;
  done: boolean;
  detail?: string;
  goBackStep?: AppStep;
}

const DownloadPanel: React.FC<DownloadPanelProps> = ({ companyId, company, isStatementsReady }) => {
  const dispatch = useAppDispatch();
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checklist: ChecklistItem[] = [
    {
      label: 'Company details configured',
      done: Boolean(company?.companyName),
      detail: company?.companyName,
      goBackStep: 'company_setup',
    },
    {
      label: 'Trial balance uploaded',
      done: Boolean(companyId),
      detail: 'Accounts loaded',
      goBackStep: 'trial_balance_upload',
    },
    {
      label: 'All accounts mapped to NFRS categories',
      done: Boolean(companyId),
      detail: 'Mapping complete',
      goBackStep: 'trial_balance_mapping',
    },
    {
      label: 'Year-end adjustments calculated',
      done: Boolean(companyId),
      detail: 'Depreciation, provisions applied',
      goBackStep: 'year_end_adjustments',
    },
    {
      label: 'Financial statements generated',
      done: isStatementsReady,
      detail: 'All 4 statements ready',
      goBackStep: 'review_statements',
    },
  ];

  const allReady = checklist.every((c) => c.done);

  const workbookContents = [
    'Complete Statement of Financial Position (Balance Sheet)',
    'Statement of Income (Profit & Loss)',
    'Statement of Cash Flows (Indirect Method)',
    'Statement of Changes in Equity',
    'All Notes to Financial Statements (Note 3.1 to 3.23)',
    'Depreciation Schedule (Note 3.1)',
    'Nepal Income Tax Computation',
    'Sundry Debtors and Creditors Schedule',
    'Complete Trial Balance with NFRS Mapping',
    'All formulas for independent verification',
    'Print-ready formatting per ICAN standards',
  ];

  const importantNotes = [
    'Review all amounts carefully before submitting to your auditors.',
    'Green cells in the Excel file are editable — you can make corrections directly.',
    'All formulas are live — any changes you make will auto-update linked cells.',
    'Contact your Chartered Accountant if you are unsure about any adjustments or disclosures.',
  ];

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);
    setDownloadComplete(false);
    try {
      const response = await fetch(`/api/output/${companyId}/generate-excel`, {
        method: 'POST',
      });
      if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || `Server error: ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFRS_Financials_${company.companyName}_${company.fiscalYear.bsYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadComplete(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartNew = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  const handleGoBack = (step: AppStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hero heading */}
      <div className="text-center py-6">
        <div className="text-5xl mb-3">📊</div>
        <h2 className="text-2xl font-bold text-slate-800">Ready to Generate Your NFRS Financial Statements</h2>
        <p className="text-slate-500 mt-2 text-sm">
          {company.companyName} &mdash; Fiscal Year {company.fiscalYear.bsYear}
        </p>
      </div>

      {/* Checklist Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span className="text-lg">📋</span> Preparation Checklist
        </h3>
        <ul className="space-y-3">
          {checklist.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className={`mt-0.5 text-lg flex-shrink-0 ${item.done ? 'text-green-500' : 'text-red-400'}`}>
                {item.done ? '✅' : '❌'}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${item.done ? 'text-slate-700' : 'text-red-700'}`}>
                  {item.label}
                </span>
                {item.detail && item.done && (
                  <span className="text-xs text-slate-400 ml-2">— {item.detail}</span>
                )}
                {!item.done && item.goBackStep && (
                  <button
                    onClick={() => handleGoBack(item.goBackStep!)}
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Go back to fix
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Generation Failed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {downloadComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-green-500 text-lg flex-shrink-0">✅</span>
          <div>
            <p className="text-sm font-semibold text-green-700">
              Your NFRS Financial Statements have been generated!
            </p>
            <p className="text-xs text-green-600 mt-1">
              Please review the Excel file carefully before submission to your auditor or regulatory authority.
            </p>
          </div>
        </div>
      )}

      {/* Main Generate Card */}
      <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm p-6">
        <div className="text-center mb-6">
          <button
            onClick={handleDownload}
            disabled={!allReady || isGenerating}
            className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
              allReady && !isGenerating
                ? 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl active:scale-98 cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating your NFRS workbook… This may take a moment
              </>
            ) : downloadComplete ? (
              <>📥 Download Again</>
            ) : (
              <>📊 Generate NFRS Excel Workbook</>
            )}
          </button>
          {!allReady && (
            <p className="text-xs text-red-500 mt-2">
              Please complete all checklist items above before generating the workbook.
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
            Your Excel file will contain:
          </p>
          <ul className="space-y-1.5">
            {workbookContents.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
          <span>📌</span> Important Notes
        </h4>
        <ul className="space-y-2">
          {importantNotes.map((note, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-amber-700">
              <span className="flex-shrink-0 mt-0.5">•</span>
              {note}
            </li>
          ))}
        </ul>
      </div>

      {/* Start New Company */}
      <div className="text-center pb-4">
        <button
          onClick={handleStartNew}
          className="text-sm text-slate-500 hover:text-slate-700 underline transition-colors"
        >
          Start New Company / Reset Application
        </button>
      </div>
    </div>
  );
};

export default DownloadPanel;
