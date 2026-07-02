// src/components/ui/NumberInput.tsx
import React, { useState, useId, useRef, useCallback } from 'react';

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
  // item 162: show +/- stepper buttons opt-in
  showSteppers?: boolean;
  step?:         number;
}

/**
 * Formats a number with Indian comma grouping (e.g. 12,34,567).
 * Returns empty string for zero.
 */
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
  const [focused, setFocused]   = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const generatedId             = useId();
  const inputId                 = id ?? generatedId;
  const errorId                 = `${inputId}-error`;
  const helpId                  = `${inputId}-help`;

  const displayValue = focused
    ? value === '' ? '' : String(value)
    : value === '' ? '' : formatIndian(value as number);

  const handleFocus = () => setFocused(true);

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
    if (raw === '' || raw === '-') {
      onChange(0);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(parsed);
  };

  // item 162: custom stepper increment/decrement
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

  // item 162: hide native spinners via CSS injected inline
  const noSpinnerStyle: React.CSSProperties = {
    MozAppearance:    'textfield' as any,
    WebkitAppearance: 'none',
  };

  const baseCls = [
    // item 162: consistent h-9 (from Section 7 upgrade)
    'h-9 w-full rounded border text-sm font-mono tabular-nums',
    'placeholder:text-slate-400 outline-none transition-colors duration-150',
    // pad for prefix/suffix/steppers
    prefix ? 'pl-8' : 'pl-2.5',
    suffix ? 'pr-8' : showSteppers ? 'pr-16' : 'pr-2.5',
    'text-right',
    error
      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-400'
      : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'text-slate-800',
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-slate-700 leading-none"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      <div className="relative flex items-center">
        {prefix && (
          <span
            className="absolute left-2.5 text-xs text-slate-400 pointer-events-none select-none leading-none"
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type={focused ? 'number' : 'text'}
          inputMode="decimal"
          value={displayValue}
          disabled={disabled}
          min={min}
          max={max}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={baseCls}
          style={noSpinnerStyle}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
        />

        {/* item 162: custom styled +/- stepper buttons */}
        {showSteppers && !disabled && (
          <div className="absolute right-0 flex flex-col h-9 border-l border-slate-300">
            <button
              type="button"
              onClick={increment}
              disabled={disabled || (max !== undefined && (typeof value === 'number' ? value : 0) >= max)}
              className="flex-1 w-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-tr border-b border-slate-200 disabled:opacity-30 transition-colors"
              aria-label="Increase value"
              tabIndex={-1}
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={decrement}
              disabled={disabled || (min !== undefined && (typeof value === 'number' ? value : 0) <= min)}
              className="flex-1 w-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-br disabled:opacity-30 transition-colors"
              aria-label="Decrease value"
              tabIndex={-1}
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}

        {suffix && !showSteppers && (
          <span
            className="absolute right-2.5 text-xs text-slate-400 pointer-events-none select-none leading-none"
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}
      </div>

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
