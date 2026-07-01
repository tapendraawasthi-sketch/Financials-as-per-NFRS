// ===== src/components/ui/Alert.tsx =====
import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
}

// Inline SVG icons — no external dependency
function CheckCircleIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={18} height={18} aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
    </svg>
  );
}

function XCircleIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={18} height={18} aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
    </svg>
  );
}

function WarningTriangleIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={18} height={18} aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
    </svg>
  );
}

function InfoCircleIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={18} height={18} aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
    </svg>
  );
}

function DismissIcon(): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={16} height={16} aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

const ALERT_STYLES = {
  success: {
    container: 'bg-green-50 border border-green-300 text-green-800',
    icon: <CheckCircleIcon />,
    dismissHover: 'hover:bg-green-100 text-green-600',
  },
  error: {
    container: 'bg-red-50 border border-red-300 text-red-800',
    icon: <XCircleIcon />,
    dismissHover: 'hover:bg-red-100 text-red-600',
  },
  warning: {
    container: 'bg-amber-50 border border-amber-300 text-amber-800',
    icon: <WarningTriangleIcon />,
    dismissHover: 'hover:bg-amber-100 text-amber-600',
  },
  info: {
    container: 'bg-blue-50 border border-blue-300 text-blue-800',
    icon: <InfoCircleIcon />,
    dismissHover: 'hover:bg-blue-100 text-blue-600',
  },
};

function Alert({ type, title, message, onDismiss }: AlertProps): React.ReactElement {
  const styles = ALERT_STYLES[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={['flex items-start gap-3 rounded-xl p-4', styles.container].join(' ')}
    >
      {/* Icon */}
      <span className="flex-shrink-0 mt-0.5">{styles.icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-semibold text-sm leading-snug mb-0.5">{title}</p>
        )}
        <p className="text-sm leading-normal">{message}</p>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className={[
            'flex-shrink-0 rounded-md p-0.5 transition-colors focus:outline-none',
            'focus-visible:ring-2 focus-visible:ring-offset-1',
            styles.dismissHover,
          ].join(' ')}
        >
          <DismissIcon />
        </button>
      )}
    </div>
  );
}

export default Alert;
