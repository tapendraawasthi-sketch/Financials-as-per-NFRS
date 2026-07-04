// src/components/ui/Modal.tsx
import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  title:    string;
  size?:    'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?:  React.ReactNode;
}

const WIDTHS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  size    = 'md',
  children,
  footer,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId  = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    requestAnimationFrame(() => { panelRef.current?.focus(); });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8"
      style={{ background: 'rgba(10,14,26,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .modal-enter { animation: modalEnter var(--dur-base) var(--ease-premium) forwards; }
      `}</style>

      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'modal-enter relative w-full',
          WIDTHS[size],
          'flex flex-col max-h-[85vh] outline-none',
        ].join(' ')}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-hairline)' }}
        >
          <h2 id={titleId} className="font-semibold text-slate-900" style={{ fontSize: '15px' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="modal-close-btn h-8 w-8 flex items-center justify-center rounded-full text-slate-400 transition-colors focus-visible:outline-none"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        <style>{`
          .modal-close-btn:hover { background: var(--surface-hover); color: var(--ink-700); }
          .modal-close-btn:focus-visible { box-shadow: var(--glow-brand); }
        `}</style>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[120px]">
          {children}
        </div>

        {footer && (
          <div
            className="flex-shrink-0 px-6 py-4 flex items-center justify-end gap-3"
            style={{
              borderTop: '1px solid var(--border-hairline)',
              background: 'var(--surface-sunken)',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
