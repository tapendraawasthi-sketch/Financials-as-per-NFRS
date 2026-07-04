// src/components/ui/LoadingSpinner.tsx
import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  message?:  string;
  fullPage?: boolean;
  size?:     'sm' | 'md' | 'lg';
}

const SIZES: Record<NonNullable<LoadingSpinnerProps['size']>, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

function ArcSpinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ animationDuration: '0.8s', animationTimingFunction: 'linear' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="var(--border-hairline)" strokeWidth="2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--brand-500)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoadingSpinner({
  message,
  fullPage = false,
  size     = 'md',
}: LoadingSpinnerProps) {
  const px = SIZES[size];
  const [showStillWorking, setShowStillWorking] = useState(false);

  useEffect(() => {
    if (!fullPage) return;
    setShowStillWorking(false);
    const t = setTimeout(() => setShowStillWorking(true), 3000);
    return () => clearTimeout(t);
  }, [fullPage, message]);

  const inner = (
    <div
      className="flex flex-col items-center gap-4"
      role="status"
      aria-label={message ?? 'Loading'}
      aria-live="polite"
    >
      <ArcSpinner size={px} />

      {message && (
        <span
          className="text-center"
          style={{
            fontSize: fullPage ? '13px' : '13px',
            color: 'var(--ink-500)',
            fontWeight: fullPage ? 500 : 400,
            maxWidth: fullPage ? '20rem' : undefined,
          }}
        >
          {message}
        </span>
      )}

      {fullPage && showStillWorking && (
        <span className="text-xs text-slate-400 animate-fade-in text-center">
          Still working… this may take a moment for complex computations.
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center gradient-mesh"
        style={{ backgroundColor: 'var(--canvas)' }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-10">
      {inner}
    </div>
  );
}
