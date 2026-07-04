// src/components/ui/Alert.tsx
import React from 'react';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

const STYLES: Record<AlertType, {
  background: string;
  borderLeft: string;
  color: string;
}> = {
  info: {
    background: 'var(--brand-50)',
    borderLeft: 'var(--brand-500)',
    color: 'var(--brand-700)',
  },
  success: {
    background: 'var(--success-100)',
    borderLeft: 'var(--success-600)',
    color: 'var(--success-700)',
  },
  warning: {
    background: 'var(--warning-100)',
    borderLeft: 'var(--warning-600)',
    color: 'var(--warning-700)',
  },
  error: {
    background: 'var(--danger-100)',
    borderLeft: 'var(--danger-600)',
    color: 'var(--danger-700)',
  },
};

const ICONS: Record<AlertType, React.ComponentType<{ size?: number; className?: string }>> = {
  info:    Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error:   XCircle,
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
  const s       = STYLES[type];
  const IconCmp = ICONS[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start px-4 py-3 text-sm ${className}`}
      style={{
        background: s.background,
        borderLeft: `3px solid ${s.borderLeft}`,
        borderRadius: 'var(--radius-md)',
        color: s.color,
        padding: '12px 16px',
      }}
    >
      <span className="flex-shrink-0 mt-0.5 mr-3" style={{ color: s.color }}>
        <IconCmp size={16} />
      </span>

      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold leading-snug mb-0.5">{title}</p>
        )}
        <p className="leading-snug text-sm opacity-90">{message}</p>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-3 flex-shrink-0 rounded transition-opacity opacity-60 hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
