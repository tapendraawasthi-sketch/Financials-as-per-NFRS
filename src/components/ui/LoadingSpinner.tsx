// src/components/ui/LoadingSpinner.tsx
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

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
      <Loader2 size={px} className="text-indigo-600 animate-spin" />

      {message && (
        <span
          className={`text-center ${
            fullPage
              ? 'text-slate-600 font-medium max-w-xs'
              : 'text-slate-500 text-sm'
          }`}
          style={{ fontSize: fullPage ? '14px' : undefined }}
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
