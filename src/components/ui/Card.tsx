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
  md:   '',
  lg:   'p-8',
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
  const cardCls = [
    'card',
    noBorder ? 'border-0 shadow-none' : '',
    className,
  ].filter(Boolean).join(' ');

  const bodyPad = padding === 'md' ? 'card-body' : PAD[padding];

  return (
    <div className={cardCls}>
      {title && (
        <div className="card-header flex items-center justify-between">
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

      <div className={bodyPad}>{children}</div>

      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
