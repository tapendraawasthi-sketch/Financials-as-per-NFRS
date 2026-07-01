import React from 'react';
import { AppStep } from '../../types';

interface SidebarProps {
  currentStep: AppStep;
  completedSteps: AppStep[];
  onNavigate: (step: AppStep) => void;
  companyName?: string;
  fiscalYear?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  step: AppStep;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  {
    step: 'company_setup',
    label: 'Company Setup',
    shortLabel: 'Company',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    step: 'accounting_policies',
    label: 'Accounting Policies',
    shortLabel: 'Policies',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    step: 'trial_balance_upload',
    label: 'Upload Trial Balance',
    shortLabel: 'Upload TB',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    step: 'trial_balance_mapping',
    label: 'Account Mapping',
    shortLabel: 'Map Accounts',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: 'subledger_details',
    label: 'Subledger Details',
    shortLabel: 'Subledgers',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: 'year_end_adjustments',
    label: 'Year-End Adjustments',
    shortLabel: 'Adjustments',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    step: 'review_statements',
    label: 'Review Statements',
    shortLabel: 'Statements',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    step: 'generate_output',
    label: 'Download Excel',
    shortLabel: 'Download',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  completedSteps,
  onNavigate,
  companyName,
  fiscalYear,
  onClose,
}) => {
  const stepIndex = NAV_ITEMS.findIndex((n) => n.step === currentStep);

  return (
    <nav
      className="w-64 h-full bg-slate-900 text-white flex flex-col"
      aria-label="Main navigation"
    >
      {/* Logo + close button */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white">
              <rect x="6" y="4" width="18" height="24" rx="2" />
              <line x1="10" y1="10" x2="20" y2="10" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="14" x2="20" y2="14" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="18" x2="16" y2="18" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">NFRS Reporter</p>
            <p className="text-xs text-slate-400">Nepal MEs</p>
          </div>
        </div>

        {/* Close button (mobile only) */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Close navigation menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Company info chip */}
      {companyName && (
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Active Session</p>
          <p className="text-xs font-semibold text-white truncate">{companyName}</p>
          {fiscalYear && (
            <p className="text-xs text-blue-400 mt-0.5">FY {fiscalYear}</p>
          )}
        </div>
      )}

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-3">
        <ul role="list" className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item, idx) => {
            const isCompleted = completedSteps.includes(item.step);
            const isCurrent = item.step === currentStep;
            const isAccessible = idx === 0 || completedSteps.includes(NAV_ITEMS[idx - 1].step) || isCompleted || isCurrent;

            return (
              <li key={item.step}>
                <button
                  onClick={() => isAccessible && onNavigate(item.step)}
                  disabled={!isAccessible}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150
                    ${isCurrent
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : isCompleted
                      ? 'text-slate-200 hover:bg-slate-700 cursor-pointer'
                      : isAccessible
                      ? 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 cursor-pointer'
                      : 'text-slate-600 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  {/* Status indicator */}
                  <span className={`
                    flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs
                    ${isCurrent ? 'bg-blue-400/30' : isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-slate-700'}
                  `}>
                    {isCompleted && !isCurrent ? (
                      <span className="text-green-400"><CheckIcon /></span>
                    ) : isCurrent ? (
                      <span className="font-bold text-xs">{idx + 1}</span>
                    ) : isAccessible ? (
                      <span className="text-slate-500 text-xs">{idx + 1}</span>
                    ) : (
                      <span className="text-slate-600"><LockIcon /></span>
                    )}
                  </span>

                  {/* Icon */}
                  <span className={isCurrent ? 'text-white' : isCompleted ? 'text-green-400' : 'text-slate-500'}>
                    {item.icon}
                  </span>

                  {/* Label */}
                  <span className="text-xs font-medium truncate">{item.label}</span>

                  {/* Step progress indicator */}
                  {isCurrent && (
                    <span className="ml-auto flex-shrink-0">
                      <span className="text-xs text-blue-300">{idx + 1}/{NAV_ITEMS.length}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
        <p className="text-xs text-slate-500 leading-relaxed">
          Nepal NFRS/NAS for MEs<br />
          <span className="text-slate-600">Powered by ICAN Standards</span>
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Step {Math.max(1, stepIndex + 1)} of {NAV_ITEMS.length}
        </p>
      </div>
    </nav>
  );
};

export default Sidebar;
