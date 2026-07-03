// src/components/ui/Alert.tsx
import React from 'react';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

const STYLES: Record<AlertType, {
  wrap: React.CSSProperties;
  borderLeft: string;
  iconColor: string;
}> = {
  info: {
    wrap: { background: '#eff6ff', border: '1px solid #bfdbfe' },
    borderLeft: '#3b82f6',
    iconColor: '#3b82f6',
  },
  success: {
    wrap: { background: '#f0fdfa', border: '1px solid #99f6e4' },
    borderLeft: '#14b8a6',
    iconColor: '#14b8a6',
  },
  warning: {
    wrap: { background: '#fffbeb', border: '1px solid #fde68a' },
    borderLeft: '#f59e0b',
    iconColor: '#f59e0b',
  },
  error: {
    wrap: { background: '#fef2f2', border: '1px solid #fecaca' },
    borderLeft: '#dc2626',
    iconColor: '#dc2626',
  },
};

const TEXT_COLORS: Record<AlertType, string> = {
  info:    '#1d4ed8',
  success: '#0d9488',
  warning: '#92400e',
  error:   '#991b1b',
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
  const color   = TEXT_COLORS[type];
  const IconCmp = ICONS[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start rounded-xl px-4 py-3 text-sm ${className}`}
      style={{
        ...s.wrap,
        borderLeft: `4px solid ${s.borderLeft}`,
        color,
      }}
    >
      <span className="flex-shrink-0 mt-0.5 mr-3" style={{ color: s.iconColor }}>
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
