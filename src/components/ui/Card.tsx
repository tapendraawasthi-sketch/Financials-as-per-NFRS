// ===== src/components/ui/Card.tsx =====
import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8',
};

function Card({
  title,
  subtitle,
  headerRight,
  footer,
  padding = 'md',
  className = '',
  children,
}: CardProps): React.ReactElement {
  const paddingClass = PADDING_CLASSES[padding];

  return (
    <div
      className={[
        'bg-white rounded-xl shadow-sm border border-slate-200',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header — rendered only when title is present */}
      {title && (
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && (
            <div className="flex-shrink-0">{headerRight}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={paddingClass}>{children}</div>

      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
