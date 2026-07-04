// src/components/ui/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   'primary' | 'secondary' | 'danger' | 'ghost' | 'link' | 'premium';
  size?:      'xs' | 'sm' | 'md' | 'lg';
  loading?:   boolean;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
}

const SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  xs: { height: '28px', padding: '0 10px', fontSize: '11px' },
  sm: { height: '30px', padding: '0 12px', fontSize: '12.5px' },
  md: { height: '38px', padding: '0 16px', fontSize: '13.5px' },
  lg: { height: '46px', padding: '0 20px', fontSize: '14.5px' },
};

type VariantStyle = { className: string; style?: React.CSSProperties };

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, VariantStyle> = {
  primary: {
    className: 'btn-variant-primary text-white font-semibold border-0',
    style: {
      background: 'var(--brand-500)',
      boxShadow: 'var(--shadow-sm)',
    },
  },
  secondary: {
    className: 'btn-variant-secondary font-medium',
    style: {
      background: 'var(--surface)',
      border: '1px solid var(--border-strong)',
      color: 'var(--ink-700)',
    },
  },
  danger: {
    className:
      'text-red-600 font-medium border border-red-200 bg-white hover:bg-red-50 hover:border-red-300 active:bg-red-100 transition-all duration-150',
    style: { boxShadow: 'var(--shadow-sm)' },
  },
  ghost: {
    className: 'btn-variant-ghost font-medium border-transparent',
    style: {
      background: 'transparent',
      color: 'var(--brand-600)',
    },
  },
  premium: {
    className: 'btn-variant-premium font-bold border-0',
    style: {
      background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
      color: 'var(--chrome-950)',
      boxShadow: 'var(--shadow-sm)',
    },
  },
  link: {
    className:
      'text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-medium border-transparent p-0 h-auto transition-colors duration-150',
  },
};

function ButtonSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="flex-shrink-0 animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
  style,
  ...props
}: ButtonProps) {
  const { className: variantCls, style: variantStyle } = VARIANT_STYLES[variant];
  const isLink = variant === 'link';

  return (
    <>
      <style>{`
        .btn-premium-base {
          border-radius: var(--radius-md);
          transition: all var(--dur-fast) var(--ease-premium);
        }
        .btn-premium-base:focus-visible {
          box-shadow: var(--glow-brand);
          outline: none;
        }
        .btn-variant-primary:hover:not(:disabled) {
          background: var(--brand-600) !important;
          box-shadow: var(--shadow-md) !important;
          transform: translateY(-1px);
        }
        .btn-variant-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-variant-secondary:hover:not(:disabled) {
          background: var(--surface-hover) !important;
          border-color: var(--ink-300) !important;
        }
        .btn-variant-ghost:hover:not(:disabled) {
          background: var(--brand-50) !important;
        }
        .btn-variant-premium:hover:not(:disabled) {
          box-shadow: var(--glow-gold) !important;
        }
      `}</style>
      <button
        className={[
          'btn-premium-base inline-flex items-center justify-center select-none whitespace-nowrap',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantCls,
          isLink ? '' : 'gap-2',
          className,
        ].filter(Boolean).join(' ')}
        style={{
          ...(!isLink ? SIZE_STYLES[size] : {}),
          ...variantStyle,
          ...style,
        }}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <ButtonSpinner />
        ) : icon ? (
          <span className="flex-shrink-0 flex items-center" aria-hidden="true">{icon}</span>
        ) : null}

        {children}

        {!loading && iconRight ? (
          <span className="flex-shrink-0 flex items-center" aria-hidden="true">{iconRight}</span>
        ) : null}
      </button>
    </>
  );
}
