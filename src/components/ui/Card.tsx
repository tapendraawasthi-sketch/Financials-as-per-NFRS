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
  accent?:      boolean;   // show a left accent bar in brand indigo
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
        borderRadius: '12px',
        border: noBorder ? 'none' : '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      {/* Optional left accent bar */}
      {accent && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: 'linear-gradient(180deg, #6366f1, #3b82f6)' }}
        />
      )}

      {title && (
        <div
          className={`flex items-center justify-between px-5 py-3.5 ${accent ? 'pl-6' : ''}`}
          style={{
            borderBottom: '1px solid rgba(241,245,249,1)',
            background: 'linear-gradient(135deg, rgba(248,250,252,1), rgba(255,255,255,1))',
          }}
        >
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-slate-800 leading-none truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-1 leading-none">{subtitle}</p>
            )}
          </div>
          {headerRight && (
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {headerRight}
            </div>
          )}
        </div>
      )}

      <div className={`${PAD[padding]} ${accent ? 'pl-6' : ''}`}>
        {children}
      </div>

      {footer && (
        <div
          className="px-5 py-3"
          style={{
            borderTop: '1px solid rgba(241,245,249,1)',
            background: 'linear-gradient(135deg, rgba(248,250,252,1), rgba(255,255,255,1))',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
