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

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={areaId}
        className="text-[11px] font-bold text-slate-500 leading-none uppercase tracking-widest"
        style={{ textTransform: 'uppercase' }}
      >
        {label}
        {required && (
          <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      <textarea
        id={areaId}
        rows={rows}
        className={[
          'w-full rounded-xl px-3.5 py-3 text-[13px] text-slate-800',
          'placeholder:text-slate-300 resize-y outline-none transition-all duration-150 leading-relaxed',
          error
            ? 'border-2 border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-0'
            : 'border border-slate-200 bg-white focus:border-indigo-400 focus:ring-3 focus:ring-indigo-50 hover:border-slate-300',
          props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' : '',
          className,
        ].filter(Boolean).join(' ')}
        style={{ boxShadow: error ? 'none' : '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 2px rgba(0,0,0,0.02)' }}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : helperText ? helpId : undefined}
        aria-required={required}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-[11px] text-red-500 leading-tight font-medium flex items-center gap-1" role="alert">
          <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
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
