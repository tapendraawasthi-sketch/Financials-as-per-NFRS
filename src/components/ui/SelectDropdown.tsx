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

  const selectCls = [
    'h-8 w-full appearance-none rounded border px-2.5 pr-7',
    'text-sm text-slate-800 bg-white outline-none transition-colors cursor-pointer',
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
      : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    props.disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className="text-xs font-medium text-slate-600 leading-none"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <select
          id={selectId}
          className={selectCls}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Custom chevron */}
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

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
