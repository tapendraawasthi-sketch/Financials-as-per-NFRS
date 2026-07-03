// src/components/ui/SelectDropdown.tsx
import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value:     string;
  label:     string;
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
        className="leading-none"
        style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: '#64748b' }}
      >
        {label}
        {required && <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>}
      </label>

      <div className="relative">
        <select
          id={selectId}
          className={[
            'h-11 w-full appearance-none rounded-xl px-3.5 pr-9 bg-white outline-none transition-all duration-150 cursor-pointer',
            error
              ? 'border-2 border-red-400 bg-red-50/40 focus:border-red-500'
              : 'border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 hover:border-slate-300',
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
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {error && (
        <p id={errorId} className="text-xs text-red-500 leading-tight font-medium" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p id={helpId} className="text-xs text-slate-400 leading-snug">{helperText}</p>
      )}
    </div>
  );
}
