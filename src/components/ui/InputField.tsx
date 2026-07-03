// src/components/ui/InputField.tsx
import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:       string;
  error?:      string;
  helperText?: string;
  required?:   boolean;
}

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
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="leading-none"
        style={{
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.10em',
          color: '#64748b',
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
          'h-11 w-full rounded-xl px-3.5 bg-white outline-none transition-all duration-150',
          'placeholder:text-slate-300',
          error
            ? 'border-2 border-red-400 bg-red-50/40 focus:ring-0'
            : 'border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50',
          props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' : 'text-slate-800',
          className,
        ].filter(Boolean).join(' ')}
        style={{
          fontSize: '13px',
          boxShadow: error
            ? 'none'
            : '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 2px rgba(0,0,0,0.02)',
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
          style={{ fontSize: '11px', color: '#ef4444' }}
          role="alert"
        >
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helpId} className="leading-snug" style={{ fontSize: '11px', color: '#94a3b8' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
