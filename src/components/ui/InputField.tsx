// src/components/ui/InputField.tsx
import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:       string;
  error?:      string;
  helperText?: string;
  required?:   boolean;
}

const fieldBaseStyle: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  borderRadius: 'var(--radius-sm)',
  height: '38px',
  background: 'var(--surface)',
};

export default function InputField({
  label,
  error,
  helperText,
  required,
  className = '',
  id,
  ...props
}: InputFieldProps) {
  const generatedId = useId();
  const inputId     = id ?? generatedId;
  const errorId     = `${inputId}-error`;
  const helpId      = `${inputId}-help`;

  return (
    <>
      <style>{`
        .premium-field:focus {
          border-color: var(--brand-500) !important;
          box-shadow: var(--glow-brand) !important;
          outline: none;
        }
        .premium-field::placeholder { color: var(--ink-400); }
        .premium-field:disabled {
          background: var(--surface-sunken) !important;
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
      <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
        <label
          htmlFor={inputId}
          className="leading-none"
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--ink-600)',
          }}
        >
          {label}
          {required && (
            <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>
          )}
        </label>

        <input
          id={inputId}
          className={[
            'premium-field w-full px-3.5 outline-none transition-all ease-premium',
            'text-slate-800',
            error ? 'border-2' : 'border',
            className,
          ].filter(Boolean).join(' ')}
          style={{
            ...fieldBaseStyle,
            border: error ? '1px solid var(--danger-600)' : '1px solid var(--border-strong)',
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
