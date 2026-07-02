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

  const inputCls = [
    'h-8 w-full rounded border px-2.5 text-sm text-slate-800',
    'placeholder:text-slate-400 outline-none transition-colors',
    error
      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-400'
      : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-xs font-medium text-slate-600 leading-none"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <input
        id={inputId}
        className={inputCls}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={
          error ? errorId : helperText ? helpId : undefined
        }
        aria-required={required}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-xs text-red-600 leading-none" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helpId} className="text-xs text-slate-400 leading-none">
          {helperText}
        </p>
      )}
    </div>
  );
}
