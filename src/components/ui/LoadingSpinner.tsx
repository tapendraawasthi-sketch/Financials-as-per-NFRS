// src/components/ui/LoadingSpinner.tsx
import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  message?:  string;
  fullPage?: boolean;
  size?:     'sm' | 'md' | 'lg';
}

const SIZES: Record<NonNullable<LoadingSpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

function SpinnerSVG({ px }: { px: number }) {
  return (
    <svg
      className="animate-spin text-blue-600"
      width={px}
      height={px}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-20"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
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

  // item 158: "still working…" text fades in after 3 seconds
  const [showStillWorking, setShowStillWorking] = useState(false);

  useEffect(() => {
    if (!fullPage) return;
    setShowStillWorking(false);
    const t = setTimeout(() => setShowStillWorking(true), 3000);
    return () => clearTimeout(t);
  }, [fullPage, message]);

  const inner = (
    <div
      className="flex flex-col items-center gap-3"
      role="status"
      aria-label={message ?? 'Loading'}
      aria-live="polite"
    >
      <SpinnerSVG px={px} />

      {/* item 159: text-base text-slate-600 font-medium for full-page */}
      {message && (
        <span className={
          fullPage
            ? 'text-base text-slate-600 font-medium text-center max-w-xs'
            : 'text-sm text-slate-500 text-center'
        }
        >
          {message}
        </span>
      )}

      {/* item 158: delayed "still working" text */}
      {fullPage && showStillWorking && (
        <span className="text-xs text-slate-400 animate-fade-in text-center">
          Still working… this may take a moment for complex computations.
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      // item 157: bg-white (fully opaque) for full-page to hide sensitive data
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
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
