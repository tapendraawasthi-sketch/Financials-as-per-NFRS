// src/components/ui/Toast.tsx
// Lightweight self-contained toast notification system.
// No external library required — uses React context + useReducer.

import React, { createContext, useContext, useReducer, useEffect, useCallback, useId } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id:       string;
  message:  string;
  variant:  ToastVariant;
  duration: number; // ms; 0 = persistent
}

type ToastAction =
  | { type: 'ADD';    toast: Toast }
  | { type: 'REMOVE'; id: string  };

interface ToastContextValue {
  toasts:  Toast[];
  show:    (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
ToastContext.displayName = 'ToastContext';

// ── Reducer ───────────────────────────────────────────────────────────────────

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'ADD':
      // Keep max 4 toasts; drop oldest if over limit
      return [...state.slice(-3), action.toast];
    case 'REMOVE':
      return state.filter(t => t.id !== action.id);
    default:
      return state;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

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

    if (duration > 0) {
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ── Visual styles per variant ─────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'bg-white border border-emerald-200 shadow-lg',
    icon: (
      <span className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    ),
  },
  error: {
    wrap: 'bg-white border border-red-200 shadow-lg',
    icon: (
      <span className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <svg className="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    ),
  },
  info: {
    wrap: 'bg-white border border-blue-200 shadow-lg',
    icon: (
      <span className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
    ),
  },
  warning: {
    wrap: 'bg-white border border-amber-200 shadow-lg',
    icon: (
      <span className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <svg className="h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
    ),
  },
};

// ── Single Toast item ─────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = VARIANT_STYLES[toast.variant];

  // Progress bar animation for auto-dismiss
  const hasDuration = toast.duration > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-center gap-3 rounded-lg px-3.5 py-2.5 min-w-[240px] max-w-[360px]
        pointer-events-auto animate-fade-in
        ${style.wrap}
      `}
    >
      {style.icon}

      <p className="flex-1 text-sm font-medium text-slate-800 leading-snug min-w-0">
        {toast.message}
      </p>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 rounded"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6"  y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Shrinking progress bar */}
      {hasDuration && (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-emerald-400 rounded-b-lg"
          style={{
            width: '100%',
            animation: `shrink ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

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
      {/* Keyframe for shrinking progress bar — injected inline */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>

      {/* Bottom-right fixed toast stack */}
      <div
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}
