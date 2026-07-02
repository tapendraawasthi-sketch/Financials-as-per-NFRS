// src/components/ui/Badge.tsx
import React from 'react';

type Variant = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';

const V: Record<Variant, string> = {
  default: 'bg-slate-100 text-slate-600',
  blue:    'bg-blue-50 text-blue-700',
  green:   'bg-emerald-50 text-emerald-700',
  amber:   'bg-amber-50 text-amber-700',
  red:     'bg-red-50 text-red-700',
  purple:  'bg-violet-50 text-violet-700',
  slate:   'bg-slate-100 text-slate-500',
};

interface BadgeProps {
  label:    string;
  variant?: Variant;
  dot?:     boolean;
  className?: string;
}

export default function Badge({
  label,
  variant   = 'default',
  dot       = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium leading-none ${V[variant]} ${className}`}
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
