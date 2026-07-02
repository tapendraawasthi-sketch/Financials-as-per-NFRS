// src/components/ui/Modal.tsx
import React, { useEffect, useRef, useId } from 'react';

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
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
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
      // item 150: Tailwind backdrop classes + backdrop-blur-sm frosted glass
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-8 bg-slate-900/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      {/* item 151: fade + scale-up animation via inline keyframe */}
      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        .modal-enter { animation: modalEnter 150ms ease-out forwards; }
      `}</style>

      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'modal-enter relative w-full',
          WIDTHS[size],
          'bg-white rounded-xl',
          // item 152: no border, shadow-2xl defines modal boundary
          'shadow-2xl',
          'flex flex-col max-h-[80vh] outline-none',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 flex-shrink-0">
          <h2 id={titleId} className="text-sm font-semibold text-slate-800">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* item 153: min-h-[120px] on body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[120px]">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
