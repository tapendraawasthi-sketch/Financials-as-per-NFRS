// src/components/ui/Card.tsx
import React from 'react';

type CardAccent = 'brand' | 'gold' | 'success' | 'danger';

interface CardProps {
  title?:       string;
  subtitle?:    string;
  headerRight?: React.ReactNode;
  footer?:      React.ReactNode;
  padding?:     'none' | 'sm' | 'md' | 'lg' | 'dense';
  className?:   string;
  children:     React.ReactNode;
  noBorder?:    boolean;
  accent?:      CardAccent;
  interactive?: boolean;
}

const ACCENT_BORDER: Record<CardAccent, string> = {
  brand:   'var(--brand-500)',
  gold:    'var(--gold-500)',
  success: 'var(--success-600)',
  danger:  'var(--danger-600)',
};

const PAD: Record<NonNullable<CardProps['padding']>, string> = {
  none:  '',
  sm:    'p-4',
  md:    '',
  lg:    'p-8',
  dense: 'p-3',
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
  accent,
  interactive = false,
}: CardProps) {
  const cardCls = [
    interactive ? 'card-interactive' : 'card',
    noBorder ? 'border-0 shadow-none' : '',
    className,
  ].filter(Boolean).join(' ');

  const bodyPad = padding === 'md' ? 'card-body' : PAD[padding];
  const headerPad = padding === 'dense' ? 'px-3 py-2.5' : undefined;
  const footerPad = padding === 'dense' ? 'px-3 py-2' : undefined;

  return (
    <div
      className={cardCls}
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-sm)',
        borderRadius: 'var(--radius-lg)',
        border: noBorder ? 'none' : '1px solid var(--border-hairline)',
        borderTop: accent ? `3px solid ${ACCENT_BORDER[accent]}` : undefined,
        transition: interactive ? 'box-shadow var(--dur-base) var(--ease-premium)' : undefined,
      }}
    >
      {title && (
        <div
          className={`card-header flex items-center justify-between ${headerPad ?? ''}`}
          style={padding === 'dense' ? { padding: 'var(--space-3)' } : undefined}
        >
          <div className="min-w-0">
            <h3
              className="font-bold leading-none truncate"
              style={{
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--ink-600)',
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 leading-none" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-400)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && (
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">{headerRight}</div>
          )}
        </div>
      )}

      <div
        className={bodyPad}
        style={padding === 'dense' ? { padding: 'var(--space-3)' } : undefined}
      >
        {children}
      </div>

      {footer && (
        <div
          className={`card-footer ${footerPad ?? ''}`}
          style={padding === 'dense' ? { padding: 'var(--space-2) var(--space-3)' } : undefined}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
