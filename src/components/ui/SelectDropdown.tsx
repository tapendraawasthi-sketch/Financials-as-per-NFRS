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
        className="text-[11px] font-bold text-slate-500 leading-none uppercase tracking-widest"
      >
        {label}
        {required && (
          <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      <div className="relative">
        <select
          id={selectId}
          className={[
            'h-11 w-full appearance-none rounded-xl px-3.5 pr-9',
            'text-[13px] text-slate-800 bg-white outline-none transition-all duration-150 cursor-pointer',
            error
              ? 'border-2 border-red-300 bg-red-50/40 focus:border-red-400'
              : 'border border-slate-200 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-50 hover:border-slate-300',
            props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' : '',
            className,
          ].filter(Boolean).join(' ')}
          style={{ boxShadow: error ? 'none' : '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 2px rgba(0,0,0,0.02)' }}
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
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

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
