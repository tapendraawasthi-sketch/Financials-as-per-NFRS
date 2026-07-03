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
        className="leading-none"
        style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#64748b' }}
      >
        {label}
        {required && <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>}
      </label>

      <textarea
        id={areaId}
        rows={rows}
        className={[
          'w-full rounded-xl px-3.5 py-2.5 bg-white outline-none transition-all duration-150 leading-relaxed resize-y',
          'placeholder:text-slate-300',
          error
            ? 'border-2 border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-0'
            : 'border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50',
          props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' : 'text-slate-800',
          className,
        ].filter(Boolean).join(' ')}
        style={{
          fontSize: '13px',
          boxShadow: error ? 'none' : '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 2px rgba(0,0,0,0.02)',
        }}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : helperText ? helpId : undefined}
        aria-required={required}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-xs text-red-500 leading-tight font-medium" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p id={helpId} className="text-xs text-slate-400 leading-snug">{helperText}</p>
      )}
    </div>
  );
}
