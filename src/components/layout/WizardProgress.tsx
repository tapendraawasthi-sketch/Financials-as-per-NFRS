// ===== src/components/layout/WizardProgress.tsx =====
import React from 'react';
import type { AppStep } from '../../types';

interface WizardStep {
  id: AppStep;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: AppStep;
  completedSteps: AppStep[];
  onStepClick?: (step: AppStep) => void;
}

/** Check icon rendered inline — no external dependency. */
function CheckIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function WizardProgress({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: WizardProgressProps): React.ReactElement {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const totalSteps = steps.length;

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 overflow-x-auto"
      role="navigation" aria-label="Form Progress"
    >
      {/* Mobile: simple step counter + progress bar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">
            Step {currentIndex + 1} of {totalSteps}
          </span>
          <span className="text-xs text-slate-500">
            {steps[currentIndex]?.label ?? ''}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
            role="progressbar"
            aria-valuenow={currentIndex + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          />
        </div>
        {/* Show prev / current / next steps on mobile */}
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{currentIndex > 0 ? steps[currentIndex - 1].label : ''}</span>
          <span className="font-semibold text-blue-600">{steps[currentIndex]?.label}</span>
          <span>{currentIndex < totalSteps - 1 ? steps[currentIndex + 1].label : ''}</span>
        </div>
      </div>

      {/* Desktop: full step circles */}
      <ol
        className="hidden md:flex items-start gap-0 min-w-max"
        role="list"
      >
        {steps.map((step, visibleIdx) => {
          // Determine the real index in the full steps array
          const realIndex = steps.findIndex((s) => s.id === step.id);
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isFuture = !isCompleted && !isCurrent;
          const isClickable = (isCompleted || isCurrent) && !!onStepClick;

          // Connector line — between adjacent steps
          const isLastVisible = visibleIdx === steps.length - 1;
          const nextStep = steps[realIndex + 1];
          const nextCompleted = nextStep
            ? completedSteps.includes(nextStep.id)
            : false;
          const connectorColor = isCompleted && nextCompleted
            ? 'bg-green-400'
            : isCompleted || isCurrent
            ? 'bg-blue-300'
            : 'bg-slate-200';

          return (
            <React.Fragment key={step.id}>
              <li
                className="flex flex-col items-center"
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Circle + number/check */}
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick!(step.id)}
                  aria-label={`${step.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
                    'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
                    isCompleted
                      ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600 shadow-sm'
                      : isCurrent
                      ? 'bg-blue-700 text-white shadow-md ring-4 ring-blue-100 cursor-default'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <CheckIcon />
                  ) : (
                    <span>{realIndex + 1}</span>
                  )}
                </button>

                {/* Label + description */}
                <div className="mt-2 text-center w-20">
                  <p
                    className={[
                      'text-xs font-semibold leading-tight',
                      isCompleted
                        ? 'text-green-700'
                        : isCurrent
                        ? 'text-blue-700'
                        : 'text-slate-400',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </li>

              {/* Connector line between circles */}
              {!isLastVisible && (
                <div
                  className="flex-shrink-0 self-start mt-4 mx-1"
                  aria-hidden="true"
                >
                  <div
                    className={[
                      'h-0.5 transition-colors duration-300',
                      connectorColor,
                    ].join(' ')}
                    style={{ width: '48px' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}
