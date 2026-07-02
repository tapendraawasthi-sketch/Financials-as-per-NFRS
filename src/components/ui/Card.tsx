// src/components/ui/Card.tsx
import React from 'react';

interface CardProps {
  title?:       string;
  subtitle?:    string;
  headerRight?: React.ReactNode;
  footer?:      React.ReactNode;
  padding?:     'none' | 'sm' | 'md' | 'lg';
  className?:   string;
  children:     React.ReactNode;
  noBorder?:    boolean;
}

const PAD: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-6',
};

export default function Card({
  title,
  subtitle,
  headerRight,
  footer,
  padding   = 'md',
  className = '',
  children,
  noBorder  = false,
}: CardProps) {
  const borderClass = noBorder ? '' : 'border border-slate-200';

  return (
    <div className={`bg-white rounded-md ${borderClass} ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 leading-none truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 leading-none">{subtitle}</p>
            )}
          </div>
          {headerRight && (
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {headerRight}
            </div>
          )}
        </div>
      )}

      <div className={PAD[padding]}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-md">
          {footer}
        </div>
      )}
    </div>
  );
}
