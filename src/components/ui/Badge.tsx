// src/components/ui/Badge.tsx
import React from 'react';

type Variant =
  | 'default'
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'purple'
  | 'slate'
  | 'balanced'
  | 'unbalanced';

const V: Record<Variant, React.CSSProperties> = {
  default:    { background: 'var(--surface-sunken)', color: 'var(--ink-600)' },
  blue:       { background: 'var(--brand-50)', color: 'var(--brand-700)', boxShadow: 'inset 0 0 0 1px var(--brand-100)' },
  green:      { background: 'var(--success-100)', color: 'var(--success-700)', boxShadow: 'inset 0 0 0 1px var(--success-600)' },
  amber:      { background: 'var(--warning-100)', color: 'var(--warning-700)', boxShadow: 'inset 0 0 0 1px var(--gold-400)' },
  red:        { background: 'var(--danger-100)', color: 'var(--danger-700)', boxShadow: 'inset 0 0 0 1px var(--danger-600)' },
  purple:     { background: 'var(--brand-100)', color: 'var(--brand-800)', boxShadow: 'inset 0 0 0 1px var(--brand-300)' },
  slate:      { background: 'var(--surface-sunken)', color: 'var(--ink-500)' },
  balanced:   { background: 'var(--success-100)', color: 'var(--success-700)', boxShadow: 'inset 0 0 0 1px var(--success-600)', fontWeight: 600 },
  unbalanced: { background: 'var(--danger-100)', color: 'var(--danger-700)', boxShadow: 'inset 0 0 0 1px var(--danger-600)', fontWeight: 600 },
};

const SIZE_NORMAL  = { fontSize: '11px', padding: '2px 8px' };
const SIZE_STATUS  = { fontSize: '12px', padding: '4px 10px' };

interface BadgeProps {
  label:    string;
  variant?: Variant;
  dot?:     boolean;
  status?:  boolean;
  className?: string;
}

export default function Badge({
  label,
  variant   = 'default',
  dot       = false,
  status    = false,
  className = '',
}: BadgeProps) {
  const isStatus = variant === 'balanced' || variant === 'unbalanced' || status;
  const sizeStyle = isStatus ? SIZE_STATUS : SIZE_NORMAL;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none ${className}`}
      style={{ ...V[variant], ...sizeStyle }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-70 flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
