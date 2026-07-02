// src/components/layout/WizardProgress.tsx
import React from 'react';
import { AppStep } from '../../types';

interface StepDef {
  id:    AppStep;
  short: string;
}

const STEPS: StepDef[] = [
  { id: 'company_setup',         short: 'Company'     },
  { id: 'accounting_policies',   short: 'Policies'    },
  { id: 'trial_balance_upload',  short: 'Upload TB'   },
  { id: 'trial_balance_mapping', short: 'Map Accounts'},
  { id: 'subledger_details',     short: 'Sub-ledger'  },
  { id: 'year_end_adjustments',  short: 'Adjustments' },
  { id: 'review_statements',     short: 'Review'      },
  { id: 'generate_output',       short: 'Export'      },
];

interface WizardProgressProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  compact?:       boolean;
  className?:     string;
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Slim progress bar embedded in AppShell below the header */
export function SlimWizardProgress({
  currentStep,
  completedSteps,
}: Pick<WizardProgressProps, 'currentStep' | 'completedSteps'>) {
  const currentIdx     = STEPS.findIndex(s => s.id === currentStep);
  const totalSteps     = STEPS.length;
  const completedCount = Math.max(completedSteps.length, currentIdx);
  const pct            = Math.round((completedCount / (totalSteps - 1)) * 100);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: '3px', background: 'rgba(226,232,240,0.7)' }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Workflow progress: step ${currentIdx + 1} of ${totalSteps}`}
    >
      <div
        className="h-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #6366f1 0%, #3b82f6 50%, #22d3ee 100%)',
          boxShadow: '0 0 8px rgba(99,102,241,0.6)',
        }}
      />
    </div>
  );
}

/** Full wizard step bar for page-level use */
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
      className={`flex items-center overflow-x-auto no-print px-2 py-3 ${className}`}
    >
      {STEPS.map((step, idx) => {
        const isDone   = completedSteps.includes(step.id);
        const isActive = step.id === currentStep;
        const isPast   = idx < currentIdx;

        const connectorDone = isPast || isDone;

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <li
                aria-hidden="true"
                role="presentation"
                className="flex-1 mx-1"
                style={{ height: '2px', minWidth: '8px', borderRadius: '2px',
                  background: connectorDone
                    ? 'linear-gradient(90deg, #6366f1, #3b82f6)'
                    : 'rgba(226,232,240,0.8)',
                  transition: 'background 0.4s ease',
                }}
              />
            )}
            <li
              className="flex flex-col items-center flex-shrink-0"
              aria-label={`Step ${idx + 1}: ${step.short}${isActive ? ' (current)' : isDone ? ' (completed)' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {/* Dot */}
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={isActive ? {
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  boxShadow: '0 0 0 3px rgba(99,102,241,0.2), 0 0 12px rgba(99,102,241,0.4)',
                  color: 'white',
                } : isDone ? {
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 0 0 2px rgba(16,185,129,0.15)',
                  color: 'white',
                } : {
                  background: 'rgba(226,232,240,0.6)',
                  border: '1.5px solid rgba(203,213,225,0.8)',
                  color: '#94a3b8',
                }}
              >
                {isDone && !isActive ? <CheckIcon /> : idx + 1}
              </div>

              {/* Label */}
              {!compact && (
                <span
                  className="text-[10px] mt-1 whitespace-nowrap font-medium"
                  style={{
                    color: isActive ? '#6366f1' : isDone ? '#64748b' : '#94a3b8',
                  }}
                  title={step.short}
                >
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
