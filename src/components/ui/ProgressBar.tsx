// src/components/ui/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  value:       number;
  label?:      string;
  showValue?:  boolean;
  color?:      'blue' | 'green' | 'amber' | 'red';
  size?:       'sm' | 'md';
  className?:  string;
}

const TRACK_H: Record<NonNullable<ProgressBarProps['size']>, string> = {
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

  const fillStyle: React.CSSProperties = {
    width: `${pct}%`,
    background:
      color === 'green'
        ? 'linear-gradient(90deg, #14b8a6, #2dd4bf)'
        : color === 'amber'
        ? 'linear-gradient(90deg, #f59e0b, #fcd34d)'
        : color === 'red'
        ? 'linear-gradient(90deg, #dc2626, #f87171)'
        : 'linear-gradient(90deg, #6366f1, #14b8a6)',
    transition: 'width 700ms cubic-bezier(.22,.61,.36,1)',
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-slate-600">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-slate-700 tabular-nums">{pct}%</span>
          )}
        </div>
      )}

      <div
        className={`w-full rounded-full overflow-hidden bg-slate-200 ${TRACK_H[size]}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div className="h-full rounded-full" style={fillStyle} />
      </div>
    </div>
  );
}
