// src/components/output/DownloadPanel.tsx
import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

interface ChecklistItem {
  label: string;
  done: boolean;
  detail?: string;
  fixStep?: string;
}

const WORKBOOK_CONTENTS = [
  'Statement of Financial Position (Balance Sheet)',
  'Statement of Income',
  'Statement of Cash Flows',
  'Statement of Changes in Equity',
  'Notes 3.1 to 3.23',
  'Depreciation Schedule (Tax and Book)',
  'Income Tax Computation',
  'Trial Balance with NFRS Mapping',
  'Sundry Debtors and Creditors Schedule',
];

export default function DownloadPanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const { state, dispatch } = useAppStore();
  const { company, trialBalance, adjustments } = state;
  const mappings = trialBalance?.rows ?? [];
  const financials = {
    balanceSheet: state.balanceSheet,
    incomeStatement: state.incomeStatement,
    cashFlow: state.cashFlow,
    changesInEquity: state.changesInEquity,
    notes: state.notes
  };
  const fiscalYear = company?.fiscalYear;

  const accountCount = trialBalance?.rows?.length ?? 0;
  const allMapped =
    mappings != null &&
    mappings.length > 0 &&
    mappings.every((m: any) => m.nfrsCategory && m.nfrsCategory !== 'unclassified');

  const checklist: ChecklistItem[] = [
    {
      label: 'Company details configured',
      done: company != null,
      fixStep: 'company_setup',
    },
    {
      label: 'Fiscal year selected',
      done: fiscalYear != null,
      fixStep: 'company_setup',
    },
    {
      label: `Trial balance uploaded${accountCount > 0 ? ` (${accountCount} accounts)` : ''}`,
      done: accountCount > 0,
      fixStep: 'trial_balance_upload',
    },
    {
      label: 'All accounts mapped to NFRS categories',
      done: allMapped,
      fixStep: 'trial_balance_mapping',
    },
    {
      label: 'Year-end adjustments entered',
      done: adjustments != null,
      fixStep: 'adjustments',
    },
    {
      label: 'Financial statements generated',
      done: financials != null,
    },
  ];

  const allDone = checklist.every((item) => item.done);

  const handleFixThis = (step?: string) => {
    if (!step) return;
    dispatch({ type: 'SET_STEP', payload: step as any });
  };

  const handleGenerate = async () => {
    if (!allDone) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/excel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, fiscalYear, financials, adjustments }),
      });
      if (!response.ok) throw new Error('Generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (company?.companyName ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const fy = fiscalYear?.bsYear ?? 'FY';
      a.download = `NFRS_Financials_${safeName}_${fy.replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadComplete(true);
    } catch {
      // error handled silently — could add error state
    } finally {
      setIsGenerating(false);
    }
  };

  const fileName = `NFRS_Financials_${(company?.companyName ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_${(fiscalYear?.bsYear ?? 'FY').replace(/\//g, '-')}.xlsx`;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Pre-generation checklist */}
      <Card title="Pre-Generation Checklist">
        <div className="divide-y divide-slate-100">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <span
                className={[
                  'h-2 w-2 rounded-full flex-shrink-0',
                  item.done ? 'bg-emerald-500' : 'bg-slate-300',
                ].join(' ')}
                aria-hidden="true"
              />
              <span
                className={[
                  'text-sm flex-1',
                  item.done ? 'text-slate-700' : 'text-slate-400',
                ].join(' ')}
              >
                {item.label}
              </span>
              {!item.done && item.fixStep && (
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => handleFixThis(item.fixStep)}
                >
                  Fix this
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Generate section */}
      <Card title="Generate Excel Workbook" className="mt-4">
        {downloadComplete ? (
          <div>
            <hr className="border-emerald-300 mb-3" />
            <p className="text-sm text-slate-700 font-medium">Download complete.</p>
            <p className="text-xs text-slate-500 mt-2">File saved: {fileName}</p>
            <p className="text-xs text-slate-400 mt-3">
              Review all figures with your Chartered Accountant before submission to auditors or
              regulatory authorities.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={handleGenerate}>
                Download Again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  sessionStorage.removeItem('nfrs_session');
                  dispatch({ type: 'RESET_ALL' });
                }}
              >
                Start New Report
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              The Excel workbook will contain complete financial statements formatted per NAS for
              Micro Entities (ICAN Nepal standards), including all notes, depreciation schedules,
              and tax computations with live Excel formulas.
            </p>

            {/* Contents list */}
            <div className="divide-y divide-slate-100 mb-4">
              {WORKBOOK_CONTENTS.map((item) => (
                <p key={item} className="text-xs text-slate-500 py-1.5">
                  {item}
                </p>
              ))}
            </div>

            {isGenerating ? (
              <LoadingSpinner message="Generating Excel workbook..." />
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={!allDone}
                className="w-full"
                title={!allDone ? 'Complete all checklist items before generating' : undefined}
              >
                Generate and Download Excel
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
