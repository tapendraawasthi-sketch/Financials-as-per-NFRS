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
          background: 'linear-gradient(90deg, #6366f1 0%, #14b8a6 100%)',
          boxShadow: '0 0 8px rgba(99,102,241,0.6)',
        }}
      />
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
                className="flex-1 mx-1"
                style={{
                  height: '3px',
                  minWidth: '8px',
                  borderRadius: '3px',
                  background: connectorDone
                    ? 'linear-gradient(90deg, #6366f1, #14b8a6)'
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
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        boxShadow: '0 0 0 3px rgba(99,102,241,0.25), 0 0 12px rgba(99,102,241,0.4)',
                        color: 'white',
                      }
                    : isDone
                    ? {
                        background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                        boxShadow: '0 0 0 2px rgba(20,184,166,0.20)',
                        color: 'white',
                      }
                    : {
                        background: 'rgba(226,232,240,0.6)',
                        border: '1.5px solid rgba(203,213,225,0.8)',
                        color: '#94a3b8',
                      }
                }
              >
                {isDone && !isActive ? <Check size={13} strokeWidth={3} /> : idx + 1}
              </div>

              {!compact && (
                <span
                  className="text-[10px] mt-1 whitespace-nowrap font-medium"
                  style={{ color: isActive ? '#6366f1' : isDone ? '#64748b' : '#94a3b8' }}
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
