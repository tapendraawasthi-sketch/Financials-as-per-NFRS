// src/components/output/DownloadPanel.tsx
import React, { useState } from 'react';
import { FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { outputApi } from '../../api/client';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

interface ChecklistItem {
  label: string;
  done: boolean;
  detail?: string;
  fixStep?: string;
}

const OUTPUT_CHECKLIST = [
  'Balance Sheet, Income Statement, Cash Flow & Equity Statements',
  '26 NAS for MEs Compliance Notes',
  'Fully Formula-Linked Excel Workbook',
  'Print-Ready ICAN Format',
];

export default function DownloadPanel() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { state, dispatch } = useAppStore();
  const { company, trialBalance, adjustments } = state;
  const mappings = trialBalance?.rows ?? [];
  const financials = {
    balanceSheet: state.balanceSheet,
    incomeStatement: state.incomeStatement,
    cashFlow: state.cashFlow,
    changesInEquity: state.changesInEquity,
    notes: state.notes,
  };
  const fiscalYear = company?.fiscalYear;

  const accountCount = trialBalance?.rows?.length ?? 0;
  const allMapped =
    mappings != null &&
    mappings.length > 0 &&
    mappings.every((m: { nfrsCategory?: string }) => m.nfrsCategory && m.nfrsCategory !== 'unclassified');

  const checklist: ChecklistItem[] = [
    { label: 'Company details configured', done: company != null, fixStep: 'company_setup' },
    { label: 'Fiscal year selected', done: fiscalYear != null, fixStep: 'company_setup' },
    {
      label: `Trial balance uploaded${accountCount > 0 ? ` (${accountCount} accounts)` : ''}`,
      done: accountCount > 0,
      fixStep: 'trial_balance_upload',
    },
    { label: 'All accounts mapped to NFRS categories', done: allMapped, fixStep: 'trial_balance_mapping' },
    { label: 'Year-end adjustments entered', done: adjustments != null, fixStep: 'year_end_adjustments' },
    { label: 'Financial statements generated', done: financials != null },
  ];

  const allDone = checklist.every(item => item.done);

  const handleFixThis = (step?: string) => {
    if (!step) return;
    dispatch({ type: 'SET_STEP', payload: step as any });
  };

  const handleGenerate = async () => {
    if (!allDone || !company?.id) return;
    setIsGenerating(true);
    setError(null);
    try {
      const blob = await outputApi.generateExcel(
        company.id,
        company.companyName ?? company.name ?? 'Company',
        fiscalYear?.bsFY ?? '',
      );
      const safeName = (company?.companyName ?? company?.name ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const fy = fiscalYear?.bsFY ?? 'FY';
      outputApi.triggerDownload(blob, `NFRS_Financials_${safeName}_${fy.replace(/\//g, '-')}.xlsx`);
      setDownloadComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const fileName = `NFRS_Financials_${(company?.companyName ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_${(fiscalYear?.bsFY ?? 'FY').replace(/\//g, '-')}.xlsx`;

  const headingText = isGenerating
    ? 'Generating Your Report…'
    : downloadComplete
    ? 'Your Financial Statements Are Ready'
    : 'Generate Complete Financial Statements';

  return (
    <div className="mx-auto text-center" style={{ maxWidth: '640px' }}>
      <div
        className="mx-auto flex items-center justify-center mb-6"
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, var(--brand-400), var(--brand-700) 60%, var(--gold-500))',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <FileSpreadsheet size={32} color="white" />
      </div>

      <h1
        className="font-display mb-6"
        style={{ fontSize: '26px', fontWeight: 600, color: 'var(--ink-950)' }}
      >
        {headingText}
      </h1>

      <div className="card text-left mb-6">
        <div className="card-body space-y-3">
          {OUTPUT_CHECKLIST.map(item => (
            <div key={item} className="flex items-start gap-2.5">
              <CheckCircle2 size={16} style={{ color: 'var(--success-600)', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ color: 'var(--ink-700)', fontSize: '13.5px' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-generation readiness (preserved logic) */}
      {!allDone && (
        <div className="card text-left mb-6">
          <div className="card-header">
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-600)' }}>
              Pre-Generation Checklist
            </span>
          </div>
          <div className="card-body divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ background: item.done ? 'var(--success-600)' : 'var(--ink-300)' }}
                  aria-hidden="true"
                />
                <span
                  className="text-sm flex-1"
                  style={{ color: item.done ? 'var(--ink-700)' : 'var(--ink-400)' }}
                >
                  {item.label}
                </span>
                {!item.done && item.fixStep && (
                  <Button variant="link" size="xs" onClick={() => handleFixThis(item.fixStep)}>
                    Fix this
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {downloadComplete && (
        <div
          className="flex items-center justify-center gap-2 mb-6 rounded-lg px-4 py-3"
          style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}
        >
          <CheckCircle2 size={16} />
          <span style={{ fontSize: '13px' }}>
            Download complete. File saved: {fileName}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 text-left">
          <Alert type="error" message={error} />
        </div>
      )}

      {downloadComplete ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="lg" onClick={handleGenerate}>
            Download Again
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              sessionStorage.removeItem('nfrs_session');
              dispatch({ type: 'RESET_ALL' });
            }}
          >
            Start New Report
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          size="lg"
          onClick={handleGenerate}
          disabled={!allDone}
          loading={isGenerating}
          className="w-full"
          title={!allDone ? 'Complete all checklist items before generating' : undefined}
        >
          {isGenerating ? 'Generating…' : 'Generate and Download Excel'}
        </Button>
      )}
    </div>
  );
}
