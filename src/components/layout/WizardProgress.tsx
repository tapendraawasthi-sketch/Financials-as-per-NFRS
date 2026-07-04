// src/components/layout/WizardProgress.tsx
import React from 'react';
import { Check } from 'lucide-react';
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
  compact?:       boolean;
  className?:     string;
}

export function SlimWizardProgress({
  currentStep,
  completedSteps,
}: Pick<WizardProgressProps, 'currentStep' | 'completedSteps'>) {
  const currentIdx = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div
      className="relative w-full flex"
      style={{ height: '4px', background: 'var(--border-hairline)' }}
      role="progressbar"
      aria-valuenow={currentIdx + 1}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-label={`Workflow progress: step ${currentIdx + 1} of ${STEPS.length}`}
    >
      {STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id) || idx < currentIdx;
        return (
          <div
            key={step.id}
            className="flex-1 h-full transition-all ease-premium"
            style={{
              background: isCompleted ? 'var(--brand-500)' : 'var(--surface-sunken)',
              transitionDuration: 'var(--dur-slow)',
            }}
          />
        );
      })}
    </div>
  );
}

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
                className="flex-1 mx-1 transition-all ease-premium"
                style={{
                  height: '3px',
                  minWidth: '8px',
                  borderRadius: '3px',
                  background: connectorDone ? 'var(--brand-500)' : 'var(--border-hairline)',
                }}
              />
            )}
            <li
              className="flex flex-col items-center flex-shrink-0"
              aria-label={`Step ${idx + 1}: ${step.short}${isActive ? ' (current)' : isDone ? ' (completed)' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ease-premium"
                style={
                  isActive
                    ? {
                        background: 'var(--gold-500)',
                        boxShadow: 'var(--glow-gold)',
                        color: 'var(--chrome-950)',
                      }
                    : isDone
                    ? {
                        background: 'var(--success-600)',
                        color: 'white',
                      }
                    : {
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--ink-400)',
                      }
                }
              >
                {isDone && !isActive ? <Check size={13} strokeWidth={3} /> : idx + 1}
              </div>

              {!compact && (
                <span
                  className="text-[10px] mt-1 whitespace-nowrap font-medium"
                  style={{
                    color: isActive ? 'var(--brand-400)' : isDone ? 'var(--ink-700)' : 'var(--ink-600)',
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
