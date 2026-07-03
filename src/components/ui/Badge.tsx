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
  default:    { background: '#f1f5f9', color: '#475569' },
  blue:       { background: '#eff6ff', color: '#1d4ed8', boxShadow: 'inset 0 0 0 1px #bfdbfe' },
  green:      { background: '#f0fdfa', color: '#0d9488', boxShadow: 'inset 0 0 0 1px #99f6e4' },
  amber:      { background: '#fffbeb', color: '#92400e', boxShadow: 'inset 0 0 0 1px #fde68a' },
  red:        { background: '#fef2f2', color: '#991b1b', boxShadow: 'inset 0 0 0 1px #fecaca' },
  purple:     { background: '#f5f3ff', color: '#5b21b6', boxShadow: 'inset 0 0 0 1px #ddd6fe' },
  slate:      { background: '#f1f5f9', color: '#64748b' },
  balanced:   { background: '#f0fdfa', color: '#0d9488', boxShadow: 'inset 0 0 0 1px #5eead4', fontWeight: 600 },
  unbalanced: { background: '#fef2f2', color: '#991b1b', boxShadow: 'inset 0 0 0 1px #fca5a5', fontWeight: 600 },
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
