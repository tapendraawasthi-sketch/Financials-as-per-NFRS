// ===== src/components/ui/LoadingSpinner.tsx =====
import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

const SIZE_PX: Record<NonNullable<LoadingSpinnerProps['size']>, number> = {
  sm: 24,
  md: 48,
  lg: 64,
};

function LoadingSpinner({
  message,
  size = 'md',
  fullPage = false,
}: LoadingSpinnerProps): React.ReactElement {
  const px = SIZE_PX[size];
  const r = (px / 2) * 0.8; // radius = 80% of half the size
  const cx = px / 2;
  const circumference = 2 * Math.PI * r;

  const spinner = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      aria-hidden="true"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      {/* Track circle */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        stroke="#e2e8f0"
        strokeWidth={px * 0.1}
        fill="none"
      />
      {/* Animated arc */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        stroke="#3b82f6"
        strokeWidth={px * 0.1}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.75}
      />
    </svg>
  );

  const inner = (
    <>
      {spinner}
      {message && (
        <p className="text-slate-500 mt-3 text-sm text-center leading-normal max-w-xs">
          {message}
        </p>
      )}
    </>
  );

  if (fullPage) {
    return (
      <div
        role="status"
        aria-label={message ?? 'Loading…'}
        className="fixed inset-0 flex flex-col items-center justify-center bg-white bg-opacity-80 z-50"
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={message ?? 'Loading…'}
      className="flex flex-col items-center justify-center py-12"
    >
      {inner}
    </div>
  );
}

export default LoadingSpinner;
