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
        boxShadow: '0 2px 8px rgba(0,0,0,0.05), 0 0 0 0 transparent',
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{
            background: 'linear-gradient(to right, #f8faff, #f5f7ff)',
            borderBottom: '1px solid #eef0f8',
            borderLeft: '3px solid',
            borderLeftColor: accent ? '#6366f1' : '#c7d2fe',
          }}
        >
          <div className="min-w-0">
            <h3 className="text-[12px] font-bold text-slate-700 leading-none uppercase tracking-wider truncate">
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

      <div className={PAD[padding]}>
        {children}
      </div>

      {footer && (
        <div
          className="px-5 py-3"
          style={{
            borderTop: '1px solid #eef0f8',
            background: 'linear-gradient(to right, #f8faff, #f5f7ff)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
