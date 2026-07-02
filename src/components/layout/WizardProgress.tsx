// src/components/layout/WizardProgress.tsx
import React from 'react';
import { AppStep } from '../../types';

interface StepDef {
  id:    AppStep;
  short: string;
}

const STEPS: StepDef[] = [
  { id: 'company_setup',         short: 'Company'      },
  { id: 'accounting_policies',   short: 'Policies'     },
  { id: 'trial_balance_upload',  short: 'Upload TB'    },
  { id: 'trial_balance_mapping', short: 'Map Accounts' },
  { id: 'subledger_details',     short: 'Sub-ledger'   },
  { id: 'year_end_adjustments',  short: 'Adjustments'  },
  { id: 'review_statements',     short: 'Review'       },
  { id: 'generate_output',       short: 'Export'       },
];

interface WizardProgressProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  /** compact=true renders the slim 1-line header bar version */
  compact?:       boolean;
  className?:     string;
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Slim progress bar for AppShell header embedding (item 34) */
export function SlimWizardProgress({
  currentStep,
  completedSteps,
}: Pick<WizardProgressProps, 'currentStep' | 'completedSteps'>) {
  const currentIdx    = STEPS.findIndex(s => s.id === currentStep);
  const totalSteps    = STEPS.length;
  const completedCount = Math.max(completedSteps.length, currentIdx);
  const pct           = Math.round((completedCount / (totalSteps - 1)) * 100);

  return (
    <div className="h-1 w-full bg-slate-200 overflow-hidden" role="progressbar"
      aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      aria-label={`Workflow progress: step ${currentIdx + 1} of ${totalSteps}`}>
      <div
        className="h-full bg-blue-500 transition-all duration-500 ease-in-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Full dot-with-label version for page-level use */
export default function WizardProgress({
  currentStep,
  completedSteps,
  compact = false,
  className = '',
}: WizardProgressProps) {
  const currentIdx = STEPS.findIndex(s => s.id === currentStep);

  return (
    <ol
      aria-label="Workflow progress"
      className={`flex items-center overflow-x-auto no-print ${className}`}
    >
      {STEPS.map((step, idx) => {
        const isDone   = completedSteps.includes(step.id);
        const isActive = step.id === currentStep;
        const isPast   = idx < currentIdx;

        const dotCls = [
          'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
          isActive
            /* item 36: ring-offset-1 ring-offset-white for optical separation */
            ? 'bg-blue-700 text-white ring-2 ring-blue-200 ring-offset-1 ring-offset-white'
            : isDone
            ? 'bg-blue-600 text-white'
            : isPast
            ? 'bg-blue-500 text-white'
            : 'bg-slate-200 text-slate-400',
        ]
          .filter(Boolean)
          .join(' ');

        /* item 35: flex-1 connectors that stretch proportionally */
        const connectorCls = [
          'h-px flex-1 flex-shrink-0 min-w-[12px]',
          isPast || isDone ? 'bg-blue-500' : 'bg-slate-200',
        ].join(' ');

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <li aria-hidden="true" className={connectorCls} role="presentation" />
            )}
            <li
              className="flex flex-col items-center flex-shrink-0"
              aria-label={`Step ${idx + 1}: ${step.short}${isActive ? ' (current)' : isDone ? ' (completed)' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className={dotCls}>
                {isDone && !isActive ? <CheckIcon /> : idx + 1}
              </div>
              {/* item 37: show label on active + completed, title attr for all */}
              {!compact && (
                <span
                  className={[
                    'text-[11px] mt-1 whitespace-nowrap',
                    isActive
                      ? 'text-blue-700 font-semibold'
                      : isDone
                      ? 'text-slate-500'
                      : 'text-slate-400',
                  ].join(' ')}
                  title={step.short}
                >
                  {/* Only show text label for active and completed steps to reduce clutter */}
                  {isActive || isDone ? step.short : ''}
                </span>
              )}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
