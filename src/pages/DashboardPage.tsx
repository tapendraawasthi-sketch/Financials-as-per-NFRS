// src/pages/DashboardPage.tsx
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAppStore } from '../store/appStore';

const PROCESS_STEPS = [
  {
    number: 1,
    name:   'Upload Trial Balance',
    desc:   'Export your trial balance from Tally, Busy, Marg, or any accounting software as Excel or CSV and upload it here.',
  },
  {
    number: 2,
    name:   'Review Account Mapping',
    desc:   'The system automatically maps account names to NAS for Micro Entities categories. Review and correct any that need adjustment.',
  },
  {
    number: 3,
    name:   'Enter Adjustments',
    desc:   'Add asset register entries, provisions for gratuity and leave, staff bonus computation, and other year-end journals.',
  },
  {
    number: 4,
    name:   'Download Excel',
    desc:   'Generate the complete workbook containing all four financial statements, all notes (3.1–3.23), and the tax computation sheet.',
  },
] as const;

const SUPPORTED_SOFTWARE = [
  'Tally ERP 9',
  'Tally Prime',
  'Busy',
  'Marg',
  'Zoho Books',
  'Any CSV / Excel TB',
];

interface DashboardPageProps {
  onStart:     () => void;
  onContinue?: () => void;
  hasSession?: boolean;
}

export default function DashboardPage({
  onStart,
  onContinue,
  hasSession = false,
}: DashboardPageProps) {
  const { state } = useAppStore();

  const sessionExists =
    hasSession ||
    Boolean(state.company?.companyName) ||
    Boolean(state.trialBalance?.rows?.length);

  return (
    <div className="min-h-full flex items-start justify-center pt-12 pb-16 px-4">
      <div className="w-full" style={{ maxWidth: '750px' }}>

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-8">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              boxShadow: '0 0 32px rgba(99,102,241,0.40)',
            }}
          >
            <span className="text-white font-black text-xl leading-none select-none">N</span>
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 leading-tight tracking-tight" style={{ fontSize: '26px' }}>
              NFRS Financial Reporter
            </h1>
            <p className="text-slate-500 leading-relaxed mt-1.5" style={{ fontSize: '14px' }}>
              Nepal Accounting Standards for Micro Entities — Automated Financial Statement Preparation
            </p>
          </div>
        </div>

        {/* ── Session restore notice ─────────────────────── */}
        {sessionExists && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl px-4 py-3.5"
            style={{
              background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)',
              border: '1px solid #c7d2fe',
              borderLeft: '4px solid #4f46e5',
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-none" style={{ fontSize: '15px', color: '#3730a3' }}>
                Previous session found
              </p>
              {state.company?.companyName && (
                <p className="text-indigo-600 mt-1.5" style={{ fontSize: '13.5px' }}>
                  {state.company.companyName}
                  {state.company.fiscalYear?.bsYear
                    ? ` · FY ${state.company.fiscalYear.bsYear}`
                    : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <Button variant="secondary" size="sm" onClick={onStart}>
                Discard
              </Button>
              {onContinue && (
                <Button variant="primary" size="sm" onClick={onContinue}>
                  Continue →
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── CTA buttons ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="primary" size="lg" onClick={onStart}>
            Start New Report
          </Button>
          {sessionExists && onContinue && (
            <Button variant="secondary" size="lg" onClick={onContinue}>
              Continue Session →
            </Button>
          )}
        </div>

        {/* Divider */}
        <div
          className="mb-8"
          style={{
            height: '1px',
            background: 'linear-gradient(to right, transparent, #e2e8f0, transparent)',
          }}
        />

        {/* ── About section ───────────────────────────────── */}
        <div className="mb-8">
          <p className="section-label-brand">About This Tool</p>
          <p className="text-slate-600 leading-relaxed" style={{ fontSize: '13.5px' }}>
            Upload your trial balance exported from Tally, Busy, Marg, or any
            accounting software. The system maps accounts to NAS for Micro Entities
            categories, calculates depreciation and provisions, and generates a
            complete Excel workbook with all required financial statements and notes
            per ICAN Nepal standards.
          </p>
        </div>

        {/* ── Process steps ─────────────────────────────── */}
        <div className="mb-8">
          <p className="section-label">How It Works</p>
          <div className="flex flex-col gap-3">
            {PROCESS_STEPS.map((step, i) => (
              <div
                key={step.number}
                className="flex gap-4 p-4 rounded-xl transition-all duration-150"
                style={{
                  background: '#ffffff',
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#c7d2fe';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#f1f5f9';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                    minWidth: '40px',
                  }}
                >
                  {step.number}
                </div>
                <div>
                  <p className="font-semibold text-slate-800" style={{ fontSize: '13.5px' }}>
                    {step.name}
                  </p>
                  <p className="text-slate-500 mt-1 leading-relaxed" style={{ fontSize: '13px' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Supported software ─────────────────────────── */}
        <div className="mb-6">
          <p className="section-label">Compatible with</p>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_SOFTWARE.map(sw => (
              <span key={sw} className="software-badge">{sw}</span>
            ))}
          </div>
        </div>

        {/* ── Compliance note ─────────────────────────────── */}
        <div className="flex items-start gap-2 pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
          <ShieldCheck size={14} className="flex-shrink-0 mt-0.5 text-blue-500" />
          <p className="text-slate-500 leading-relaxed" style={{ fontSize: '12.5px' }}>
            Output complies with NAS for Micro Entities issued by the Institute of
            Chartered Accountants of Nepal (ICAN). Review all generated statements
            with your Chartered Accountant before submission to tax authorities or
            regulatory bodies.
          </p>
        </div>

      </div>
    </div>
  );
}
