// src/components/ui/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?:     'xs' | 'sm' | 'md';
  loading?:  boolean;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium rounded border ' +
  'transition-colors focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-1 focus-visible:outline-blue-600 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap';

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white ' +
    'border-blue-700 hover:border-blue-800',
  secondary:
    'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-300',
  danger:
    'bg-white hover:bg-red-50 active:bg-red-100 text-red-700 ' +
    'border-red-300 hover:border-red-400',
  ghost:
    'bg-transparent hover:bg-slate-100 active:bg-slate-200 ' +
    'text-slate-600 border-transparent',
  link:
    'bg-transparent text-blue-700 hover:text-blue-800 underline ' +
    'border-transparent p-0 h-auto',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
};

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  icon,
  iconRight,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isLink = variant === 'link';

  return (
    <button
      className={[
        BASE,
        VARIANTS[variant],
        isLink ? '' : SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner />
      ) : icon ? (
        <span className="flex-shrink-0 h-3.5 w-3.5 flex items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      {children}

      {!loading && iconRight ? (
        <span className="flex-shrink-0 h-3.5 w-3.5 flex items-center" aria-hidden="true">
          {iconRight}
        </span>
      ) : null}
    </button>
  );
}
