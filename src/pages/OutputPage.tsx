// src/pages/OutputPage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Alert from '../components/ui/Alert';
import { outputApi } from '../api/client';

export default function OutputPage() {
  const { state } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const company = state.company;
  const hasFinancials = state.balanceSheet != null;

  const handleDownload = async () => {
    if (!company?.id) return;
    setGenerating(true);
    setError(null);
    try {
      const blob = await outputApi.generateExcel(
        company.id,
        company.companyName,
        company.fiscalYear?.bsFY ?? 'FY',
      );
      const safeName = (company.companyName ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const fy = (company.fiscalYear?.bsFY ?? 'FY').replace(/\//g, '-');
      const filename = `NFRS_Financials_${safeName}_${fy}.xlsx`;
      outputApi.triggerDownload(blob, filename);
      setDownloadComplete(true);
    } catch (err: any) {
      setError(err?.message ?? 'Excel generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const checklist = [
    { label: 'Company details configured', done: company != null },
    { label: 'Trial balance uploaded', done: state.trialBalance != null },
    { label: 'Accounts mapped', done: (state.trialBalance?.rows ?? []).length > 0 },
    { label: 'Financial statements generated', done: hasFinancials },
  ];

  const allDone = checklist.every(c => c.done);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Card title="Pre-Generation Checklist" padding="md">
        <div className="divide-y divide-slate-100">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2.5">
              <span
                className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  item.done ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <span className={`text-sm ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Generate Excel Workbook" padding="md">
        {error && <Alert type="error" message={error} className="mb-4" />}

        {downloadComplete ? (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Download complete!</p>
            <p className="text-xs text-slate-400 mb-4">
              Review all figures with your CA before submission.
            </p>
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              Download Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              The Excel workbook will contain complete financial statements formatted per
              NAS for Micro Entities (ICAN Nepal standards), including all notes, depreciation
              schedules, and tax computations.
            </p>

            <div className="divide-y divide-slate-100 text-xs text-slate-500">
              {[
                'Statement of Financial Position (Balance Sheet)',
                'Statement of Income',
                'Statement of Cash Flows (Indirect Method)',
                'Statement of Changes in Equity',
                'Notes 3.1 through 3.26',
                'Depreciation Schedule (Book & Tax)',
                'Income Tax Computation (IT Act 2058)',
                'Trial Balance with NFRS Mapping',
              ].map(item => (
                <p key={item} className="py-1.5">{item}</p>
              ))}
            </div>

            {generating ? (
              <LoadingSpinner message="Generating Excel workbook..." />
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={handleDownload}
                disabled={!allDone}
                className="w-full"
              >
                Generate and Download Excel
              </Button>
            )}

            {!allDone && (
              <p className="text-xs text-amber-600 text-center">
                Complete all checklist items before generating.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
