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

const fieldBaseStyle: React.CSSProperties = {
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  height: '38px',
  background: 'var(--surface)',
};

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
    <>
      <style>{`
        .premium-field:focus {
          border-color: var(--brand-500) !important;
          box-shadow: var(--glow-brand) !important;
          outline: none;
        }
        .premium-field:disabled {
          background: var(--surface-sunken) !important;
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
      <div className="flex flex-col" style={{ gap: '6px' }}>
        <label
          htmlFor={selectId}
          className="leading-none"
          style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink-600)', marginBottom: '6px' }}
        >
          {label}
          {required && <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>}
        </label>

        <div className="relative">
          <select
            id={selectId}
            className={[
              'premium-field w-full appearance-none px-3.5 pr-9 outline-none transition-all ease-premium cursor-pointer',
              'text-slate-800',
              className,
            ].filter(Boolean).join(' ')}
            style={{
              ...fieldBaseStyle,
              border: error ? '1px solid var(--danger-600)' : '1px solid var(--border-strong)',
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
          <p
            id={errorId}
            className="leading-tight font-medium"
            style={{ fontSize: '11.5px', color: 'var(--danger-600)' }}
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helpId} className="leading-snug" style={{ fontSize: '11px', color: 'var(--ink-400)' }}>
            {helperText}
          </p>
        )}
      </div>
    </>
  );
}
