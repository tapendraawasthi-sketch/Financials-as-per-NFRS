// src/pages/DashboardPage.tsx
import React from 'react';
import { useAppStore } from '../store/appStore';

const FeatureCard: React.FC<{ icon: string; title: string; description: string }> = ({
  icon, title, description,
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
    <div className="text-3xl mb-3">{icon}</div>
    <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
  </div>
);

const StepBubble: React.FC<{ number: number; label: string; description: string; isLast?: boolean }> = ({
  number, label, description, isLast,
}) => (
  <div className="flex items-start gap-3 flex-1">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      {!isLast && <div className="w-0.5 h-full bg-blue-200 mt-2 hidden lg:block" />}
    </div>
    <div className="pb-6">
      <p className="font-semibold text-slate-800 text-sm">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  const { state, dispatch } = useAppStore();

  const [restoredSession] = React.useState(() => {
    try {
      const saved = sessionStorage.getItem('nfrs_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed?.company?.companyName) return parsed;
      return null;
    } catch {
      return null;
    }
  });

  const handleClearSession = () => {
    sessionStorage.removeItem('nfrs_session');
    dispatch({ type: 'RESET_ALL' });
    window.location.reload();
  };

  const hasCompanyData = Boolean(state.company?.companyName);

  const features = [
    {
      icon: '🏛️',
      title: 'ICAN-Compliant Format',
      description:
        'Financial statements formatted exactly per Institute of Chartered Accountants of Nepal requirements — ready for audit and regulatory submission.',
    },
    {
      icon: '📋',
      title: 'All 4 Core Statements',
      description:
        'Balance Sheet, Income Statement, Statement of Cash Flows (indirect method), and Statement of Changes in Equity — all generated automatically.',
    },
    {
      icon: '📝',
      title: 'Complete Notes (3.1–3.23)',
      description:
        'All disclosures required by NAS for Micro Entities including PPE schedule, depreciation, borrowings, provisions, debtors, creditors and tax computation.',
    },
    {
      icon: '🏗️',
      title: 'Depreciation Schedule',
      description:
        'Automated PPE depreciation under SLM or WDV method with Nepal income-tax pool depreciation — both book and tax treatment handled.',
    },
    {
      icon: '📊',
      title: 'Excel with Live Formulas',
      description:
        'Not just printed values — real Excel formulas you can verify, edit, and extend. Green cells are editable; white cells auto-calculate.',
    },
    {
      icon: '🤖',
      title: 'AI Account Mapping',
      description:
        'Claude AI recognises account names from Tally, Busy, Marg, Zoho, and other Nepali accounting software and maps them to the correct NFRS categories automatically.',
    },
  ];

  const softwareBadges = [
    'Tally ERP 9', 'Tally Prime', 'Busy', 'Marg ERP', 'Zoho Books', 'QuickBooks', 'Excel / CSV',
  ];

  const steps = [
    {
      number: 1,
      label: 'Upload Trial Balance',
      description: 'Export your trial balance from any accounting software as Excel or CSV and upload it.',
    },
    {
      number: 2,
      label: 'AI Maps Accounts',
      description: 'Claude AI automatically recognises your account names and maps them to NFRS categories.',
    },
    {
      number: 3,
      label: 'Review & Adjust',
      description: 'Review the AI mapping, enter depreciation details, provisions, and year-end adjustments.',
    },
    {
      number: 4,
      label: 'Download Excel',
      description: 'Generate the fully-formatted NFRS Excel workbook with all four statements and notes.',
      isLast: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">

        {/* ── Hero Card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 md:p-12 text-center">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <svg viewBox="0 0 32 32" className="w-8 h-8 fill-white">
              <rect x="4" y="2" width="18" height="24" rx="2" opacity="0.3" />
              <rect x="6" y="4" width="18" height="24" rx="2" />
              <line x1="10" y1="10" x2="20" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="14" x2="20" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="18" x2="16" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            NAS for Micro Entities · ICAN Nepal
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 leading-tight">
            NFRS Financial Reporter
          </h1>
          <p className="text-slate-500 mt-3 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Generate audit-ready financial statements for Nepal businesses in minutes — from your
            trial balance to ICAN-compliant Excel in four steps.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <button
              onClick={() => dispatch({ type: 'SET_STEP', payload: 'company_setup' })}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-base"
            >
              Start New Report →
            </button>
            {hasCompanyData && (
              <button
                onClick={() => dispatch({ type: 'SET_STEP', payload: state.currentStep })}
                className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-8 py-3 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-all duration-200 text-base"
              >
                Continue — {state.company!.companyName}
              </button>
            )}
          </div>
        </div>

        {restoredSession && !state.company && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <span className="text-2xl flex-shrink-0">👋</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-blue-800">Welcome back!</h3>
                <p className="text-sm text-blue-600 mt-0.5">
                  You have an unfinished session for{' '}
                  <strong>{restoredSession.company?.companyName}</strong>{' '}
                  (Fiscal Year {restoredSession.company?.fiscalYear?.bsYear}).
                </p>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => dispatch({ type: 'RESTORE_STATE', payload: restoredSession })}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    Continue Working →
                  </button>
                  <button
                    onClick={handleClearSession}
                    className="text-sm text-blue-500 hover:text-blue-700 px-4 py-2 border border-blue-200 rounded-lg transition-colors"
                  >
                    Start Fresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── What You Get ── */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 text-center mb-6">What You Get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
            ))}
          </div>
        </div>

        {/* ── How It Works ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-bold text-slate-800 text-center mb-8">How It Works</h2>
          <div className="flex flex-col lg:flex-row gap-0 lg:gap-4">
            {steps.map((step) => (
              <StepBubble key={step.number} {...step} />
            ))}
          </div>
        </div>

        {/* ── Supported Software ── */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Supported Accounting Software</h2>
          <p className="text-sm text-slate-500 mb-5">
            Upload trial balances exported from any of these systems (Excel/CSV format):
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {softwareBadges.map((sw) => (
              <span
                key={sw}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-4 py-2 rounded-full shadow-sm"
              >
                {sw}
              </span>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="text-center border-t border-slate-200 pt-6 pb-4">
          <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Built for <strong>NFRS / NAS for Micro Entities</strong> compliance as per ICAN Nepal standards.
            This tool automates the formatting and computation — always verify the output with your
            Chartered Accountant before submission to tax authorities or regulatory bodies.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
