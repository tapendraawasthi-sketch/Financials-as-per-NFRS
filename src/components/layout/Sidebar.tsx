// src/components/layout/Sidebar.tsx
import React from 'react';
import { AppStep } from '../../types';

interface NavItem {
  step:  AppStep;
  label: string;
  icon:  React.ReactNode;
}

interface SidebarProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  onNavigate:     (step: AppStep) => void;
  companyName?:   string;
  fiscalYear?:    string;
}

// ── Minimal inline SVG icons (no external library) ─────────────────────────
const Icons = {
  building: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" d="M3 21h18M6 21V7l6-4 6 4v14M9 21V12h6v9" />
    </svg>
  ),
  sliders: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <line x1="4"  y1="21" x2="4"  y2="14" />
      <line x1="4"  y1="10" x2="4"  y2="3"  />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8"  x2="12" y2="3"  />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3"  />
      <line x1="1"  y1="14" x2="7"  y2="14" />
      <line x1="9"  y1="8"  x2="15" y2="8"  />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  upload: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
    </svg>
  ),
  list: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <line x1="8"  y1="6"  x2="21" y2="6"  />
      <line x1="8"  y1="12" x2="21" y2="12" />
      <line x1="8"  y1="18" x2="21" y2="18" />
      <line x1="3"  y1="6"  x2="3.01" y2="6"  />
      <line x1="3"  y1="12" x2="3.01" y2="12" />
      <line x1="3"  y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  git: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6"  cy="6"  r="3" />
      <path d="M13 6h3a2 2 0 012 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  ),
  calc: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8"  y1="6"  x2="16"   y2="6"  />
      <line x1="8"  y1="10" x2="8.01"  y2="10" />
      <line x1="12" y1="10" x2="12.01" y2="10" />
      <line x1="16" y1="10" x2="16.01" y2="10" />
      <line x1="8"  y1="14" x2="8.01"  y2="14" />
      <line x1="12" y1="14" x2="12.01" y2="14" />
      <line x1="16" y1="14" x2="16.01" y2="14" />
      <line x1="8"  y1="18" x2="12"   y2="18" />
    </svg>
  ),
  file: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  download: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  check: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

const NAV_ITEMS: NavItem[] = [
  { step: 'company_setup',         label: 'Company Setup',        icon: Icons.building  },
  { step: 'accounting_policies',   label: 'Accounting Policies',  icon: Icons.sliders   },
  { step: 'trial_balance_upload',  label: 'Upload Trial Balance', icon: Icons.upload    },
  { step: 'trial_balance_mapping', label: 'Map Accounts',         icon: Icons.git       },
  { step: 'subledger_details',     label: 'Sub-ledger Detail',    icon: Icons.list      },
  { step: 'year_end_adjustments',  label: 'Year-End Adjustments', icon: Icons.calc      },
  { step: 'review_statements',     label: 'Review Statements',    icon: Icons.file      },
  { step: 'generate_output',       label: 'Generate Excel',       icon: Icons.download  },
];

const STEP_ORDER = NAV_ITEMS.map(n => n.step);

function isAccessible(
  step:           AppStep,
  currentStep:    AppStep,
  completedSteps: AppStep[]
): boolean {
  const stepIdx    = STEP_ORDER.indexOf(step);
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  return stepIdx <= currentIdx || completedSteps.includes(step);
}

export default function Sidebar({
  currentStep,
  completedSteps,
  onNavigate,
  companyName,
  fiscalYear,
}: SidebarProps) {
  return (
    <aside
      className="w-56 min-h-screen bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800"
      aria-label="Application navigation"
    >
      {/* Brand */}
      <div className="px-4 py-4 border-b border-slate-800 flex-shrink-0">
        <p className="text-xs font-semibold text-white tracking-wide uppercase leading-none">
          NFRS Reporter
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Nepal Financial Reporting
        </p>
      </div>

      {/* Active company context */}
      {companyName && (
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none">
            Active Company
          </p>
          <p className="text-xs text-slate-200 mt-1 font-medium truncate" title={companyName}>
            {companyName}
          </p>
          {fiscalYear && (
            <p className="text-[11px] text-slate-500 mt-0.5">FY {fiscalYear}</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto" aria-label="Workflow steps">
        {NAV_ITEMS.map((item, idx) => {
          const isActive     = item.step === currentStep;
          const isDone       = completedSteps.includes(item.step);
          const accessible   = isAccessible(item.step, currentStep, completedSteps);

          return (
            <button
              key={item.step}
              onClick={() => accessible && onNavigate(item.step)}
              disabled={!accessible}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${item.label}${isDone ? ' (completed)' : ''}${!accessible ? ' (not yet available)' : ''}`}
              className={[
                'w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left transition-colors relative',
                isActive
                  ? 'bg-blue-700/30 text-white border-r-2 border-blue-500'
                  : isDone
                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  : accessible
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                  : 'text-slate-600 cursor-not-allowed',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Step number or check badge */}
              <span
                className={[
                  'h-5 w-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isDone
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-700 text-slate-400',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isDone && !isActive ? Icons.check : idx + 1}
              </span>

              {/* Icon */}
              <span className="flex-shrink-0 opacity-70">{item.icon}</span>

              {/* Label */}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          NAS for Micro Entities
          <br />
          ICAN Nepal Standards
        </p>
      </div>
    </aside>
  );
}
