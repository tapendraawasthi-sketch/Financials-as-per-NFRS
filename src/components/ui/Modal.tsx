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
      style={{ background: 'rgba(2,6,23,0.60)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);    }
        }
        .modal-enter { animation: modalEnter 160ms cubic-bezier(.22,.61,.36,1) forwards; }
      `}</style>

      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'modal-enter relative w-full',
          WIDTHS[size],
          'bg-white rounded-2xl flex flex-col max-h-[85vh] outline-none',
        ].join(' ')}
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h2 id={titleId} className="font-semibold text-slate-900" style={{ fontSize: '15px' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[120px]">
          {children}
        </div>

        {footer && (
          <div
            className="flex-shrink-0 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl"
            style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
