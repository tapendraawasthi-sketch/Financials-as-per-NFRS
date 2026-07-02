// src/components/ui/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  value:       number;
  label?:      string;
  showValue?:  boolean;
  color?:      'blue' | 'green' | 'amber';
  size?:       'sm' | 'md';
  className?:  string;
}

const COLORS: Record<NonNullable<ProgressBarProps['color']>, string> = {
  blue:  'bg-blue-600',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
};

const HEIGHTS: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-1',
  md: 'h-2',
};

export default function ProgressBar({
  value,
  label,
  showValue  = false,
  color      = 'blue',
  size       = 'md',
  className  = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-xs text-slate-600">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-medium text-slate-700 tabular-nums">
              {pct}%
            </span>
          )}
        </div>
      )}

      <div
        className={`w-full bg-slate-200 rounded-full overflow-hidden ${HEIGHTS[size]}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${COLORS[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
