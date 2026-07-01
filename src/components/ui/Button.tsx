// ===== src/components/ui/Button.tsx =====
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'hover:bg-slate-100 text-slate-600 font-medium rounded-lg transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'border-2 border-blue-700 text-blue-700 hover:bg-blue-50 font-semibold rounded-lg transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

/** Animated spinning circle SVG for loading state. */
function Spinner(): React.ReactElement {
  return (
    <svg
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <circle
        cx={12}
        cy={12}
        r={10}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={2.5}
        fill="none"
      />
      <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      disabled,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const variantClass = VARIANT_CLASSES[variant];
    const sizeClass = SIZE_CLASSES[size];
    const isDisabled = disabled || loading;

    const spinnerOrIcon = loading ? <Spinner /> : icon;
    const hasLeadingContent = spinnerOrIcon && (loading || iconPosition === 'left');
    const hasTrailingContent = !loading && icon && iconPosition === 'right';

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
          variantClass,
          sizeClass,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {hasLeadingContent && (
          <span className="flex-shrink-0">{spinnerOrIcon}</span>
        )}
        {children && <span>{children}</span>}
        {hasTrailingContent && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
