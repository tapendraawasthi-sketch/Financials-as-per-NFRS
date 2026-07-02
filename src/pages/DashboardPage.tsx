// src/pages/DashboardPage.tsx
import React from 'react';
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

// item 45: software badge list
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

function ShieldCheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
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
    <div className="min-h-full flex items-start justify-center pt-10 pb-16 px-4">
      <div className="w-full max-w-[700px]">

        {/* ── Application header ─────────────────────────────── */}
        {/* item 38: h1 raised to text-2xl font-bold */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            NFRS Financial Reporter
          </h1>
          {/* item 38: sub-description raised to text-sm */}
          <p className="text-sm text-slate-500 mt-1.5">
            Nepal Accounting Standards for Micro Entities — Automated Financial Statement Preparation
          </p>
        </div>

        {/* item 39: real vertical spacing instead of thin divider line */}
        <div className="mt-8 mb-6" />

        {/* ── Session restore notice ─────────────────────────── */}
        {/* item 40: strong left-border accent, blue tinted background */}
        {sessionExists && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 border-l-4 border-l-blue-500 bg-blue-50 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-800 leading-none">
                Previous session found
              </p>
              {state.company?.companyName && (
                <p className="text-sm text-blue-600 mt-1.5">
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

        {/* ── Quick action row ──────────────────────────────── */}
        {/* item 41: larger CTA buttons — h-10 px-6 text-base */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={onStart}
          >
            Start New Report
          </Button>
          {sessionExists && onContinue && (
            <Button
              variant="secondary"
              size="lg"
              onClick={onContinue}
            >
              Continue Session →
            </Button>
          )}
        </div>

        <div className="border-t border-slate-200 mt-8 mb-6" />

        {/* ── About this tool ───────────────────────────────── */}
        {/* item 42: section-label-brand class, leading-relaxed on para */}
        <div>
          <p className="section-label-brand">About This Tool</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Upload your trial balance exported from Tally, Busy, Marg, or any
            accounting software. The system maps accounts to NAS for Micro Entities
            categories, calculates depreciation and provisions, and generates a
            complete Excel workbook with all required financial statements and notes
            per ICAN Nepal standards.
          </p>
        </div>

        {/* ── Process steps ─────────────────────────────────── */}
        {/* item 43: step numbers in rounded circle badges */}
        {/* item 44: step name raised to text-sm font-semibold */}
        <div className="mt-6">
          <p className="section-label">How It Works</p>
          <div className="space-y-0">
            {PROCESS_STEPS.map((step, i) => (
              <div
                key={step.number}
                className={`flex gap-4 py-4 ${
                  i < PROCESS_STEPS.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                {/* item 43: circle badge matching sidebar step numbering motif */}
                <div className="flex-shrink-0 pt-0.5">
                  <span className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {step.number}
                  </span>
                </div>
                <div className="min-w-0">
                  {/* item 44: text-sm font-semibold for step name */}
                  <p className="text-sm font-semibold text-slate-700 leading-snug">
                    {step.name}
                  </p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Supported software ────────────────────────────── */}
        {/* item 45: software name badge pills instead of plain text */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Compatible with
          </p>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_SOFTWARE.map(sw => (
              <span key={sw} className="software-badge">
                {sw}
              </span>
            ))}
          </div>
        </div>

        {/* ── Compliance note ───────────────────────────────── */}
        {/* item 46: shield icon + text-slate-500 for compliance credibility */}
        <div className="border-t border-slate-200 mt-6 pt-4">
          <div className="flex items-start gap-2">
            <ShieldCheckIcon />
            <p className="text-xs text-slate-500 leading-relaxed">
              Output complies with NAS for Micro Entities issued by the Institute of
              Chartered Accountants of Nepal (ICAN). Review all generated statements
              with your Chartered Accountant before submission to tax authorities or
              regulatory bodies.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
