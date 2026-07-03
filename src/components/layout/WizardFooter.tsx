import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';

interface WizardFooterProps {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  stepIndex: number;
  totalSteps: number;
}

export default function WizardFooter({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  stepIndex,
  totalSteps,
}: WizardFooterProps) {
  return (
    <footer
      className="flex-shrink-0 no-print border-t border-slate-200 bg-white/95 backdrop-blur-sm px-7 py-3"
      aria-label="Wizard navigation"
    >
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="Previous step"
        >
          <ArrowLeft size={14} className="mr-1.5" />
          Previous
        </Button>

        <p className="text-xs text-slate-500 font-medium">
          Step {stepIndex + 1} of {totalSteps}
        </p>

        <Button
          variant="primary"
          size="sm"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Next step"
        >
          Next
          <ArrowRight size={14} className="ml-1.5" />
        </Button>
      </div>
    </footer>
  );
}
