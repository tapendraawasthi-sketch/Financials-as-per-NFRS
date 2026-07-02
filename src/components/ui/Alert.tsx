// src/components/ui/Alert.tsx
import React from 'react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

// item 154: border-l-4 colored accent on all alerts
const STYLES: Record<AlertType, { wrap: string; icon: string }> = {
  info:    {
    wrap: 'bg-blue-50 border border-blue-200 border-l-4 border-l-blue-500 text-blue-800',
    icon: 'text-blue-500',
  },
  success: {
    wrap: 'bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-800',
    icon: 'text-emerald-500',
  },
  warning: {
    wrap: 'bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 text-amber-800',
    icon: 'text-amber-500',
  },
  error: {
    wrap: 'bg-red-50 border border-red-200 border-l-4 border-l-red-600 text-red-800',
    icon: 'text-red-500',
  },
};

const ICONS: Record<AlertType, React.ReactNode> = {
  info: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8"  x2="12"   y2="12"   />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  success: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9"  x2="12"   y2="13"   />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9"  x2="9"  y2="15" />
      <line x1="9"  y1="9"  x2="15" y2="15" />
    </svg>
  ),
};

interface AlertProps {
  type:       AlertType;
  title?:     string;
  message:    string;
  onDismiss?: () => void;
  className?: string;
}

export default function Alert({
  type,
  title,
  message,
  onDismiss,
  className = '',
}: AlertProps) {
  const s = STYLES[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      // item 154: rounded-lg (8px) + border-l-4 already in wrap classes
      className={`flex items-start rounded-lg px-3.5 py-2.5 text-sm ${s.wrap} ${className}`}
    >
      {/* item 155: gap-3 for more icon-text breathing room */}
      <span className={`mt-0.5 mr-3 flex-shrink-0 ${s.icon}`}>{ICONS[type]}</span>

      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold leading-snug">{title}</p>
        )}
        <p className="leading-snug text-sm opacity-90">{message}</p>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          // item 156: permanent opacity-70 so dismiss button is always visible
          className="ml-3 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity leading-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <line x1="18" y1="6"  x2="6"  y2="18" />
            <line x1="6"  y1="6"  x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
