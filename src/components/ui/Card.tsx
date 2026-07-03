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
  accent?:      boolean;
}

const PAD: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm:   'p-4',
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
  accent    = false,
}: CardProps) {
  return (
    <div
      className={`bg-white relative overflow-hidden ${className}`}
      style={{
        borderRadius: '14px',
        border: noBorder ? 'none' : '1px solid #e8edf2',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{
            background: 'linear-gradient(135deg, #fafbff 0%, #f6f8fe 100%)',
            borderBottom: '1px solid #f0f4f8',
            borderLeft: `3px solid ${accent ? '#6366f1' : '#c7d2fe'}`,
          }}
        >
          <div className="min-w-0">
            <h3
              className="font-bold text-slate-700 leading-none truncate"
              style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-slate-400 mt-1 leading-none" style={{ fontSize: '11px' }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && (
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">{headerRight}</div>
          )}
        </div>
      )}

      <div className={PAD[padding]}>{children}</div>

      {footer && (
        <div
          className="px-5 py-3"
          style={{
            borderTop: '1px solid #f0f4f8',
            background: 'linear-gradient(135deg, #fafbff 0%, #f6f8fe 100%)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
