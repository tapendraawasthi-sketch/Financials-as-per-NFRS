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

// ── Minimal inline SVG icons ────────────────────────────────────────
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
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  calendar: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  ),
  shield: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
      /* item 10: widened to w-60 for label breathing room */
      /* item 11: right-edge shadow for proper elevation separation */
      className="w-60 min-h-screen min-w-[240px] bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 shadow-[4px_0_16px_-4px_rgb(0_0_0/0.3)]"
      aria-label="Application navigation"
    >
      {/* ── Brand ─────────────────────────────────────────────────── */}
      {/* item 12: larger brand text with better contrast */}
      {/* item 13: brand identity block with logo mark */}
      <div className="px-4 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Minimal logo mark */}
          <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm leading-none select-none">N</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-[0.08em] uppercase leading-none">
              NFRS Reporter
            </p>
            {/* item 12: raised sub-label */}
            <p className="text-[12px] text-slate-400 mt-0.5 leading-none">
              Nepal Financial Reporting
            </p>
          </div>
        </div>
      </div>

      {/* ── Active company context ─────────────────────────────────── */}
      {/* item 14: left border accent for strong visual signal */}
      {/* item 15: tooltip on company name via title attr */}
      {/* item 16: fiscal year elevated with icon */}
      {companyName && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 border-l-[3px] border-l-blue-500 flex-shrink-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none">
            Active Company
          </p>
          <p
            className="text-xs text-slate-200 mt-1 font-medium truncate"
            title={companyName}
          >
            {companyName}
          </p>
          {fiscalYear && (
            <p className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1">
              {Icons.calendar}
              <span>FY {fiscalYear}</span>
            </p>
          )}
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 py-2 overflow-y-auto" aria-label="Workflow steps">
        {NAV_ITEMS.map((item, idx) => {
          const isActive   = item.step === currentStep;
          const isDone     = completedSteps.includes(item.step);
          const accessible = isAccessible(item.step, currentStep, completedSteps);

          return (
            <button
              key={item.step}
              onClick={() => accessible && onNavigate(item.step)}
              disabled={!accessible}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${item.label}${isDone ? ' (completed)' : ''}${!accessible ? ' (not yet available)' : ''}`}
              /* item 18: full-opacity icons — removed opacity-70 */
              /* item 19: stronger active bg + thicker right border */
              /* item 20: disabled items at opacity-50 as a unit */
              /* item 21: hover gets left border accent to echo active pattern */
              title={item.label}
              className={[
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left relative',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400',
                isActive
                  ? 'bg-blue-600/20 text-white border-r-[3px] border-r-blue-400'
                  : isDone
                  ? 'text-slate-300 hover:bg-slate-800 hover:text-white hover:border-l-[3px] hover:border-l-slate-600'
                  : accessible
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300 hover:border-l-[3px] hover:border-l-slate-600'
                  : 'text-slate-700 cursor-not-allowed opacity-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* item 17: larger step number badge h-6 w-6 rounded-full, text-xs */}
              <span
                className={[
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isDone
                    /* item 22: lighter emerald for better visibility on dark bg */
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-400',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* item 22: check icon h-3.5 w-3.5 */}
                {isDone && !isActive ? Icons.check : idx + 1}
              </span>

              {/* Icon — full opacity, no opacity-70 */}
              <span className="flex-shrink-0">{item.icon}</span>

              {/* Label — with tooltip via parent button's title attr */}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────── */}
      {/* item 23: raised to 11px with subtle compliance badge feel */}
      <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
        <div className="inline-flex items-center gap-1.5 bg-slate-800/60 rounded-full px-2.5 py-1">
          {Icons.shield}
          <p className="text-[11px] text-slate-500 leading-snug">
            NAS for MEs · ICAN Nepal
          </p>
        </div>
      </div>
    </aside>
  );
}
