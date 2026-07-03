// src/components/ui/NumberInput.tsx
import React, { useState, useId, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface NumberInputProps {
  label:        string;
  value:        number | '';
  onChange:     (value: number) => void;
  error?:       string;
  helperText?:  string;
  required?:    boolean;
  min?:         number;
  max?:         number;
  placeholder?: string;
  prefix?:      string;
  suffix?:      string;
  disabled?:    boolean;
  id?:          string;
  showSteppers?: boolean;
  step?:         number;
}

function formatIndian(n: number): string {
  if (n === 0) return '';
  const isNeg    = n < 0;
  const abs      = Math.abs(n);
  const [intRaw, decPart] = abs.toString().split('.');
  let formatted = '';
  const len     = intRaw.length;
  if (len <= 3) {
    formatted = intRaw;
  } else {
    formatted = intRaw.slice(-3);
    let rest  = intRaw.slice(0, -3);
    while (rest.length > 0) {
      formatted = rest.slice(-2) + ',' + formatted;
      rest      = rest.slice(0, -2);
    }
    if (formatted.startsWith(',')) formatted = formatted.slice(1);
  }
  if (decPart) formatted += '.' + decPart;
  return isNeg ? '-' + formatted : formatted;
}

export default function NumberInput({
  label,
  value,
  onChange,
  error,
  helperText,
  required,
  placeholder = '0',
  prefix,
  suffix,
  disabled,
  min,
  max,
  id,
  showSteppers = false,
  step         = 1,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const generatedId           = useId();
  const inputId               = id ?? generatedId;
  const errorId               = `${inputId}-error`;
  const helpId                = `${inputId}-help`;

  const displayValue = focused
    ? value === '' ? '' : String(value)
    : value === '' ? '' : formatIndian(value as number);

  const handleBlur = () => {
    setFocused(false);
    if (value !== '' && typeof value === 'number') {
      let clamped = value;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      if (clamped !== value) onChange(clamped);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') { onChange(0); return; }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(parsed);
  };

  const increment = useCallback(() => {
    const current = typeof value === 'number' ? value : 0;
    const next    = current + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  }, [value, step, max, onChange]);

  const decrement = useCallback(() => {
    const current = typeof value === 'number' ? value : 0;
    const next    = current - step;
    if (min !== undefined && next < min) return;
    onChange(next);
  }, [value, step, min, onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="font-medium text-slate-700 leading-none"
        style={{ fontSize: '13px' }}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>

      <div className="relative flex items-center">
        {prefix && (
          <span
            className="absolute left-2.5 text-slate-400 pointer-events-none select-none leading-none"
            style={{ fontSize: '12px' }}
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          type={focused ? 'number' : 'text'}
          inputMode="decimal"
          value={displayValue}
          disabled={disabled}
          min={min}
          max={max}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onChange={handleChange}
          className={[
            'h-11 w-full rounded-xl border outline-none transition-all duration-150 text-right',
            'font-mono tabular-nums',
            prefix ? 'pl-8' : 'pl-2.5',
            suffix ? 'pr-8' : showSteppers ? 'pr-16' : 'pr-2.5',
            error
              ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-400'
              : 'border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 hover:border-slate-300',
            disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'text-slate-800',
          ].filter(Boolean).join(' ')}
          style={{ fontSize: '13px', MozAppearance: 'textfield' as any, WebkitAppearance: 'none' }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
        />

        {showSteppers && !disabled && (
          <div className="absolute right-0 flex flex-col h-11" style={{ borderLeft: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={increment}
              disabled={disabled || (max !== undefined && (typeof value === 'number' ? value : 0) >= max)}
              className="flex-1 w-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-tr-xl disabled:opacity-30 transition-colors"
              style={{ borderBottom: '1px solid #e2e8f0' }}
              aria-label="Increase value"
              tabIndex={-1}
            >
              <ChevronUp size={11} />
            </button>
            <button
              type="button"
              onClick={decrement}
              disabled={disabled || (min !== undefined && (typeof value === 'number' ? value : 0) <= min)}
              className="flex-1 w-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-br-xl disabled:opacity-30 transition-colors"
              aria-label="Decrease value"
              tabIndex={-1}
            >
              <ChevronDown size={11} />
            </button>
          </div>
        )}

        {suffix && !showSteppers && (
          <span
            className="absolute right-2.5 text-slate-400 pointer-events-none select-none leading-none"
            style={{ fontSize: '12px' }}
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs text-red-600 leading-tight" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p id={helpId} className="text-xs text-slate-400 leading-snug">{helperText}</p>
      )}
    </div>
  );
}
