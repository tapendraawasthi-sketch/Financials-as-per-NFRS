// src/components/ui/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?:      'xs' | 'sm' | 'md' | 'lg';
  loading?:   boolean;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const SIZE_CLS: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-6 px-2.5 text-[11px]',
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-[13px]',
  lg: 'h-11 px-6 text-sm',
};

type VariantStyle = { className: string; style?: React.CSSProperties };
const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, VariantStyle> = {
  primary: {
    className: 'text-white font-semibold border-0 active:scale-[0.97] transition-all duration-150',
    style: {
      background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
      boxShadow: '0 2px 12px rgba(99,102,241,0.35), 0 1px 3px rgba(0,0,0,0.1)',
    },
  },
  secondary: {
    className: 'text-slate-700 font-medium border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all',
    style: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  },
  danger: {
    className: 'text-red-700 font-medium border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 active:bg-red-100 transition-all',
    style: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  },
  ghost: {
    className: 'text-slate-600 font-medium border-transparent hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors',
  },
  link: {
    className: 'text-indigo-600 hover:text-indigo-800 underline font-medium border-transparent p-0 h-auto transition-colors',
  },
};

export default function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  icon,
  iconRight,
  children,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const { className: variantCls, style: variantStyle } = VARIANT_STYLES[variant];
  const isLink = variant === 'link';

  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-lg select-none whitespace-nowrap',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantCls,
        isLink ? '' : SIZE_CLS[size],
        className,
      ].filter(Boolean).join(' ')}
      style={{ ...variantStyle, ...style }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon ? (
        <span className="flex-shrink-0 h-3.5 w-3.5 flex items-center" aria-hidden="true">{icon}</span>
      ) : null}

      {children}

      {!loading && iconRight ? (
        <span className="flex-shrink-0 h-3.5 w-3.5 flex items-center" aria-hidden="true">{iconRight}</span>
      ) : null}
    </button>
  );
}
