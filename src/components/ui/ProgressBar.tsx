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
    height: '6px',
    borderRadius: 'var(--radius-full)',
    background:
      color === 'green'
        ? 'linear-gradient(90deg, var(--success-600), var(--success-600))'
        : color === 'amber'
        ? 'linear-gradient(90deg, var(--warning-600), var(--warning-600))'
        : color === 'red'
        ? 'linear-gradient(90deg, var(--danger-600), var(--danger-600))'
        : 'linear-gradient(90deg, var(--brand-500), var(--brand-400))',
    transition: 'width var(--dur-slow) var(--ease-premium)',
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
        className="w-full overflow-hidden"
        style={{
          height: '6px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--surface-sunken)',
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div style={fillStyle} />
      </div>
    </div>
  );
}
