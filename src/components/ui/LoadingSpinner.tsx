// src/components/ui/LoadingSpinner.tsx
import React from 'react';

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

  const inner = (
    <div
      className="flex flex-col items-center gap-2.5"
      role="status"
      aria-label={message ?? 'Loading'}
    >
      <SpinnerSVG px={px} />
      {message && (
        <span className="text-sm text-slate-500">{message}</span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
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
