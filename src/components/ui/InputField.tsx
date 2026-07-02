// src/components/ui/InputField.tsx
import React, { useId } from 'react';

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
        className="text-[12px] font-semibold text-slate-600 leading-none uppercase tracking-wide"
      >
        {label}
        {required && (
          <span className="text-indigo-500 ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      <div className="relative">
        <input
          id={inputId}
          className={[
            'h-10 w-full rounded-lg px-3 text-sm text-slate-800',
            'placeholder:text-slate-300 outline-none transition-all duration-150',
            error
              ? 'border border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
              : 'border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 hover:border-slate-300',
            props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : '',
            className,
          ].filter(Boolean).join(' ')}
          style={{ boxShadow: error ? undefined : '0 1px 2px rgba(0,0,0,0.04)' }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
          {...props}
        />
        {/* Focus glow ring is handled via focus:ring */}
      </div>

      {error && (
        <p id={errorId} className="text-[11px] text-red-500 leading-tight font-medium" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helpId} className="text-[11px] text-slate-400 leading-snug">
          {helperText}
        </p>
      )}
    </div>
  );
}
