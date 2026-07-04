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
      className="sticky bottom-0 flex-shrink-0 no-print flex items-center justify-between"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border-hairline)',
        padding: '16px 28px',
      }}
      aria-label="Wizard navigation"
    >
      <Button
        variant="secondary"
        size="md"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Previous step"
      >
        <ArrowLeft size={14} />
        Previous
      </Button>

      <p style={{ color: 'var(--ink-500)', fontSize: '12.5px' }}>
        Step {stepIndex + 1} of {totalSteps}
      </p>

      <Button
        variant="primary"
        size="md"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next step"
      >
        Next
        <ArrowRight size={14} />
      </Button>
    </footer>
  );
}
