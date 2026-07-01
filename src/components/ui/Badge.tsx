// ===== src/components/ui/Badge.tsx =====
import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  purple:  'bg-purple-100 text-purple-700',
};

const SIZE_CLASSES: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

function Badge({
  label,
  variant = 'default',
  size = 'sm',
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-medium',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
      ].join(' ')}
    >
      {label}
    </span>
  );
}

export default Badge;
