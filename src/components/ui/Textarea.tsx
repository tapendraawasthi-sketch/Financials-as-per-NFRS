// src/components/ui/Textarea.tsx
import React, { useId } from 'react';

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

  const areaCls = [
    'w-full rounded border px-2.5 py-2 text-sm text-slate-800',
    'placeholder:text-slate-400 resize-y outline-none transition-colors duration-150 leading-relaxed',
    error
      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-400'
      : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      {/* item 48: text-[13px] text-slate-700 */}
      <label
        htmlFor={areaId}
        className="text-[13px] font-medium text-slate-700 leading-none"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      <textarea
        id={areaId}
        rows={rows}
        className={areaCls}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : helperText ? helpId : undefined}
        aria-required={required}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-xs text-red-600 leading-tight" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helpId} className="text-xs text-slate-400 leading-snug">
          {helperText}
        </p>
      )}
    </div>
  );
}
