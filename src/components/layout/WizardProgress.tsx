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
  className?:     string;
}

function CheckIcon() {
  return (
    <svg
      className="h-3 w-3"
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

export default function WizardProgress({
  currentStep,
  completedSteps,
  className = '',
}: WizardProgressProps) {
  const currentIdx = STEPS.findIndex(s => s.id === currentStep);

  return (
    <ol
      aria-label="Workflow progress"
      className={`flex items-center gap-0 overflow-x-auto no-print ${className}`}
    >
      {STEPS.map((step, idx) => {
        const isDone   = completedSteps.includes(step.id);
        const isActive = step.id === currentStep;
        const isPast   = idx < currentIdx;

        const dotCls = [
          'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
          isActive
            ? 'bg-blue-700 text-white ring-2 ring-blue-200'
            : isDone
            ? 'bg-blue-600 text-white'
            : isPast
            ? 'bg-blue-500 text-white'
            : 'bg-slate-200 text-slate-400',
        ]
          .filter(Boolean)
          .join(' ');

        const connectorCls = [
          'h-px w-6 flex-shrink-0',
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
              <span
                className={[
                  'text-[10px] mt-1 whitespace-nowrap',
                  isActive ? 'text-blue-700 font-semibold' : 'text-slate-400',
                ].join(' ')}
              >
                {step.short}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
