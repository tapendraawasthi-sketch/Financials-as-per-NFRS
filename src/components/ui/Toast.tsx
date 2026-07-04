// src/components/ui/Toast.tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id:       string;
  message:  string;
  variant:  ToastVariant;
  duration: number;
}

type ToastAction =
  | { type: 'ADD';    toast: Toast }
  | { type: 'REMOVE'; id: string  };

interface ToastContextValue {
  toasts:  Toast[];
  show:    (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
ToastContext.displayName = 'ToastContext';

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'ADD':    return [...state.slice(-3), action.toast];
    case 'REMOVE': return state.filter(t => t.id !== action.id);
    default:       return state;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const show = useCallback((
    message:  string,
    variant:  ToastVariant = 'success',
    duration: number       = 2500,
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({ type: 'ADD', toast: { id, message, variant, duration } });
    if (duration > 0) setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: 'var(--success-600)',
  error:   'var(--danger-600)',
  info:    'var(--brand-500)',
  warning: 'var(--warning-600)',
};

const VARIANT_ICONS: Record<ToastVariant, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const accentColor = VARIANT_ACCENT[toast.variant];
  const Icon = VARIANT_ICONS[toast.variant];
  const hasDuration = toast.duration > 0;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      layout
      initial={{ opacity: 0, x: 24, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 24, y: 8 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 px-4 py-3 pointer-events-auto relative overflow-hidden"
      style={{
        minWidth: '260px',
        maxWidth: '380px',
        background: 'var(--surface)',
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span className="flex-shrink-0" style={{ color: accentColor }}>
        <Icon size={16} />
      </span>

      <p
        className="flex-1 font-medium leading-snug min-w-0"
        style={{ fontSize: 'var(--text-base)', color: 'var(--ink-800)' }}
      >
        {toast.message}
      </p>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 rounded transition-colors"
        style={{ color: 'var(--ink-400)' }}
      >
        <X size={14} />
      </button>

      {hasDuration && (
        <span
          className="absolute bottom-0 left-0"
          style={{
            height: '2px',
            width: '100%',
            background: accentColor,
            transformOrigin: 'left center',
            animation: `toast-progress ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </motion.div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts:    Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <>
      <style>{`
        @keyframes toast-progress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
      <div
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
