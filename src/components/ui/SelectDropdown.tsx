// src/components/ui/SelectDropdown.tsx
import React, { useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:        string;
  options:      SelectOption[];
  error?:       string;
  helperText?:  string;
  placeholder?: string;
  required?:    boolean;
}

export default function SelectDropdown({
  label,
  options,
  error,
  helperText,
  placeholder,
  required,
  className = '',
  id,
  ...props
}: SelectDropdownProps) {
  const generatedId = useId();
  const selectId    = id ?? generatedId;
  const errorId     = `${selectId}-error`;
  const helpId      = `${selectId}-help`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className="text-[12px] font-semibold text-slate-600 leading-none uppercase tracking-wide"
      >
        {label}
        {required && (
          <span className="text-indigo-500 ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      <div className="relative">
        <select
          id={selectId}
          className={[
            'h-10 w-full appearance-none rounded-lg px-3 pr-8',
            'text-sm text-slate-800 bg-white outline-none transition-all duration-150 cursor-pointer',
            error
              ? 'border border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
              : 'border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 hover:border-slate-300',
            props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : '',
            className,
          ].filter(Boolean).join(' ')}
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>{placeholder}</option>
          )}
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
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
