// src/components/ui/Button.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?:      'xs' | 'sm' | 'md' | 'lg';
  loading?:   boolean;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
}

const SIZE_CLS: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-7 px-3 text-[11px] rounded-md gap-1',
  sm: 'h-8 px-3.5 text-[12px] rounded-lg gap-1.5',
  md: 'h-10 px-5 text-[13px] rounded-lg gap-2',
  lg: 'h-11 px-6 text-sm rounded-xl gap-2',
};

type VariantStyle = { className: string; style?: React.CSSProperties };

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, VariantStyle> = {
  primary: {
    className: 'text-white font-semibold border-0 active:scale-[0.97] transition-all duration-150',
    style: {
      background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
      boxShadow: '0 2px 8px rgba(79,70,229,0.40), 0 1px 2px rgba(0,0,0,0.12)',
    },
  },
  secondary: {
    className:
      'text-slate-700 font-medium border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all duration-150',
    style: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  },
  danger: {
    className:
      'text-red-600 font-medium border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 active:bg-red-100 transition-all duration-150',
    style: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  },
  ghost: {
    className:
      'text-slate-600 font-medium border-transparent hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors duration-150',
  },
  link: {
    className:
      'text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-medium border-transparent p-0 h-auto transition-colors duration-150',
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
        'inline-flex items-center justify-center select-none whitespace-nowrap',
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
      {loading ? (
        <Loader2 size={14} className="flex-shrink-0 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0 flex items-center" aria-hidden="true">{icon}</span>
      ) : null}

      {children}

      {!loading && iconRight ? (
        <span className="flex-shrink-0 flex items-center" aria-hidden="true">{iconRight}</span>
      ) : null}
    </button>
  );
}
