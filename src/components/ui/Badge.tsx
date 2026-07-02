// src/components/ui/Badge.tsx
import React from 'react';

// item 163: extended variants with ring borders
type Variant =
  | 'default'
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'purple'
  | 'slate'
  | 'balanced'     // financial status — ring bordered
  | 'unbalanced';  // financial status — ring bordered

const V: Record<Variant, string> = {
  default:    'bg-slate-100 text-slate-600',
  blue:       'bg-blue-50 text-blue-700',
  green:      'bg-emerald-50 text-emerald-700',
  amber:      'bg-amber-50 text-amber-700',
  red:        'bg-red-50 text-red-700',
  purple:     'bg-violet-50 text-violet-700',
  slate:      'bg-slate-100 text-slate-500',
  // item 163: ring-bordered financial status chips
  balanced:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  unbalanced: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

// item 163: status badges use larger size by default
const SIZE_DEFAULT   = 'text-xs px-1.5 py-0.5';
const SIZE_STATUS    = 'text-[13px] font-semibold px-2.5 py-0.5';

interface BadgeProps {
  label:    string;
  variant?: Variant;
  dot?:     boolean;
  // item 163: status badges self-size
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
  const isFinancialStatus = variant === 'balanced' || variant === 'unbalanced';
  const sizeClass = (isFinancialStatus || status) ? SIZE_STATUS : SIZE_DEFAULT;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none ${sizeClass} ${V[variant]} ${className}`}
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
