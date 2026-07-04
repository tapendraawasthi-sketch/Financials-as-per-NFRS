// src/components/ui/Textarea.tsx
import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label:       string;
  error?:      string;
  helperText?: string;
  required?:   boolean;
}

export default function Textarea({
  label,
  error,
  helperText,
  required,
  className = '',
  rows      = 3,
  id,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const areaId      = id ?? generatedId;
  const errorId     = `${areaId}-error`;
  const helpId      = `${areaId}-help`;

  return (
    <>
      <style>{`
        .premium-textarea:focus {
          border-color: var(--brand-500) !important;
          box-shadow: var(--glow-brand) !important;
          outline: none;
        }
        .premium-textarea::placeholder { color: var(--ink-400); }
        .premium-textarea:disabled {
          background: var(--surface-sunken) !important;
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
      <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
        <label
          htmlFor={areaId}
          className="leading-none"
          style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-600)' }}
        >
          {label}
          {required && <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>}
        </label>

        <textarea
          id={areaId}
          rows={rows}
          className={[
            'premium-textarea w-full px-3.5 py-2.5 outline-none transition-all ease-premium leading-relaxed resize-y',
            'text-slate-800',
            className,
          ].filter(Boolean).join(' ')}
          style={{
            fontSize: 'var(--text-base)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface)',
            border: error ? '1px solid var(--danger-600)' : '1px solid var(--border-strong)',
            minHeight: '38px',
          }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
          {...props}
        />

        {error && (
          <p
            id={errorId}
            className="flex items-center gap-1 font-medium leading-tight"
            style={{ fontSize: '11.5px', color: 'var(--danger-600)' }}
            role="alert"
          >
            <AlertCircle size={12} className="flex-shrink-0" />
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helpId} className="helper-text leading-snug">
            {helperText}
          </p>
        )}
      </div>
    </>
  );
}
