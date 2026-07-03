// src/components/ui/Toast.tsx
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
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

const VARIANT_CONFIG: Record<ToastVariant, {
  borderColor: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ size?: number }>;
}> = {
  success: { borderColor: '#14b8a6', iconBg: '#f0fdfa', iconColor: '#0d9488', Icon: CheckCircle2 },
  error:   { borderColor: '#ef4444', iconBg: '#fef2f2', iconColor: '#dc2626', Icon: XCircle     },
  info:    { borderColor: '#3b82f6', iconBg: '#eff6ff', iconColor: '#2563eb', Icon: Info         },
  warning: { borderColor: '#f59e0b', iconBg: '#fffbeb', iconColor: '#d97706', Icon: AlertTriangle },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = VARIANT_CONFIG[toast.variant];
  const { Icon } = cfg;
  const hasDuration = toast.duration > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-xl px-4 py-3 pointer-events-auto animate-fade-in relative overflow-hidden"
      style={{
        minWidth: '260px',
        maxWidth: '380px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${cfg.borderColor}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <span
        className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.iconBg }}
      >
        <Icon size={15} style={{ color: cfg.iconColor }} />
      </span>

      <p className="flex-1 font-medium text-slate-800 leading-snug min-w-0" style={{ fontSize: '13px' }}>
        {toast.message}
      </p>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-slate-400 hover:text-slate-700 rounded transition-colors"
      >
        <X size={14} />
      </button>

      {hasDuration && (
        <span
          className="absolute bottom-0 left-0 rounded-b-xl"
          style={{
            height: '3px',
            width: '100%',
            background: cfg.borderColor,
            animation: `shrink ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts:    Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
      <div
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}
