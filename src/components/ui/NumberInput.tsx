// src/components/ui/NumberInput.tsx
import React, { useState, useId, useRef } from 'react';

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
}

/**
 * Formats a number with Indian comma grouping (e.g. 12,34,567).
 * Returns empty string for zero to avoid cluttering empty fields.
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
    // Last 3 digits, then groups of 2
    formatted = intRaw.slice(-3);
    let rest  = intRaw.slice(0, -3);
    while (rest.length > 0) {
      formatted = rest.slice(-2) + ',' + formatted;
      rest      = rest.slice(0, -2);
    }
    // Trim leading comma if rest was exactly 2 chars
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
}: NumberInputProps) {
  const [focused, setFocused]     = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const generatedId               = useId();
  const inputId                   = id ?? generatedId;
  const errorId                   = `${inputId}-error`;
  const helpId                    = `${inputId}-help`;

  // While focused: show raw number for editing.
  // While blurred: show Indian-formatted display string.
  const displayValue = focused
    ? value === '' ? '' : String(value)
    : value === '' ? '' : formatIndian(value as number);

  const handleFocus = () => setFocused(true);

  const handleBlur = () => {
    setFocused(false);
    // Clamp to min/max on blur
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

  // Click on wrapper focuses the hidden/real input
  const handleWrapperClick = () => {
    inputRef.current?.focus();
  };

  const baseCls = [
    'h-8 w-full rounded border text-sm font-mono tabular-nums text-right',
    prefix  ? 'pl-8'   : 'pl-2.5',
    suffix  ? 'pr-8'   : 'pr-2.5',
    'outline-none transition-colors',
    error
      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-400'
      : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    disabled
      ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
      : 'text-slate-800',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-xs font-medium text-slate-600 leading-none"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Wrapper for prefix/suffix overlay */}
      <div
        className="relative flex items-center"
        onClick={!disabled ? handleWrapperClick : undefined}
      >
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
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? errorId : helperText ? helpId : undefined
          }
          aria-required={required}
          aria-label={label}
        />

        {suffix && (
          <span
            className="absolute right-2.5 text-xs text-slate-400 pointer-events-none select-none leading-none"
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}
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
