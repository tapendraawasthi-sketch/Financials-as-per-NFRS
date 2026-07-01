// ===== src/components/ui/ProgressBar.tsx =====
import React from 'react';

interface ProgressBarProps {
  value: number;        // 0–100
  label?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const COLOR_CLASSES: Record<NonNullable<ProgressBarProps['color']>, string> = {
  blue:  'bg-blue-600',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red:   'bg-red-500',
};

const SIZE_CLASSES: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

function ProgressBar({
  value,
  label,
  showPercentage = false,
  color = 'blue',
  size = 'md',
}: ProgressBarProps): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, value));
  const colorClass = COLOR_CLASSES[color];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className="w-full">
      {/* Label row */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-xs font-medium text-slate-600">{label}</span>
          )}
          {showPercentage && (
            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              {clamped.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className={['bg-slate-200 rounded-full overflow-hidden w-full', sizeClass].join(' ')}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {/* Fill */}
        <div
          className={['rounded-full', colorClass, sizeClass].join(' ')}
          style={{
            width: `${clamped}%`,
            transition: 'width 0.5s ease-in-out',
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
