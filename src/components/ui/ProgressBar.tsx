// src/components/ui/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  value:       number;
  label?:      string;
  showValue?:  boolean;
  // item 160: extended color variants
  color?:      'blue' | 'green' | 'amber' | 'red';
  size?:       'sm' | 'md';
  className?:  string;
}

const TRACK_COLORS: Record<NonNullable<ProgressBarProps['color']>, string> = {
  blue:  'bg-slate-200',
  green: 'bg-emerald-100',
  amber: 'bg-amber-100',
  red:   'bg-red-100',
};

const FILL_COLORS: Record<NonNullable<ProgressBarProps['color']>, string> = {
  blue:  'bg-blue-600',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red:   'bg-red-500',
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
        className={`w-full rounded-full overflow-hidden ${TRACK_COLORS[color]} ${HEIGHTS[size]}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        {/* item 161: smooth width transition */}
        <div
          className={`h-full rounded-full ${FILL_COLORS[color]} transition-[width] duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
