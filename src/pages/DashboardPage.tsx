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

interface DashboardPageProps {
  onStart:    () => void;
  onContinue?: () => void;
  hasSession?: boolean;
}

export default function DashboardPage({
  onStart,
  onContinue,
  hasSession = false,
}: DashboardPageProps) {
  const { state } = useAppStore();

  // Detect a restored session from the store if not passed as prop
  const sessionExists =
    hasSession ||
    Boolean(state.company?.companyName) ||
    Boolean(state.trialBalance?.rows?.length);

  return (
    <div className="min-h-full flex items-start justify-center pt-12 pb-16 px-4">
      <div className="w-full max-w-[680px]">

        {/* Application header */}
        <div>
          <h1 className="text-lg font-semibold text-slate-800 leading-snug">
            NFRS Financial Reporter
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Nepal Accounting Standards for Micro Entities — Automated Financial Statement Preparation
          </p>
        </div>

        <div className="border-t border-slate-200 my-5" />

        {/* Session restore notice */}
        {sessionExists && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 leading-none">
                Previous session found
              </p>
              {state.company?.companyName && (
                <p className="text-xs text-slate-500 mt-1">
                  {state.company.companyName}
                  {state.company.fiscalYear?.bsYear
                    ? ` — FY ${state.company.fiscalYear.bsYear}`
                    : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={onStart}
              >
                Discard
              </Button>
              {onContinue && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onContinue}
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Quick action row */}
        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" onClick={onStart}>
            Start New Report
          </Button>
          {sessionExists && onContinue && (
            <Button variant="secondary" size="md" onClick={onContinue}>
              Continue Session
            </Button>
          )}
        </div>

        <div className="border-t border-slate-200 my-5" />

        {/* About this tool */}
        <div>
          <p className="section-label">About This Tool</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Upload your trial balance exported from Tally, Busy, Marg, or any
            accounting software. The system maps accounts to NAS for Micro Entities
            categories, calculates depreciation and provisions, and generates a
            complete Excel workbook with all required financial statements and notes
            per ICAN Nepal standards.
          </p>
        </div>

        {/* Process steps */}
        <div className="mt-5">
          <p className="section-label">How It Works</p>
          <div className="space-y-0">
            {PROCESS_STEPS.map((step, i) => (
              <div
                key={step.number}
                className={`flex gap-4 py-3 ${
                  i < PROCESS_STEPS.length - 1
                    ? 'border-b border-slate-100'
                    : ''
                }`}
              >
                <div className="flex-shrink-0 w-5 pt-0.5">
                  <span className="text-xs font-bold text-blue-700 leading-none">
                    {step.number}.
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 leading-none">
                    {step.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported software */}
        <p className="text-xs text-slate-400 mt-5">
          Compatible with exports from: Tally ERP 9, Tally Prime, Busy, Marg,
          Zoho Books, and any CSV or Excel trial balance.
        </p>

        {/* Compliance note */}
        <div className="border-t border-slate-200 mt-5 pt-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Output complies with NAS for Micro Entities issued by ICAN. Review all
            generated statements with your Chartered Accountant before submission.
          </p>
        </div>

      </div>
    </div>
  );
}
