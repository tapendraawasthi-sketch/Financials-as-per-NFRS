// src/components/ui/NumberInput.tsx
import React, { useState, useId, useCallback, useMemo } from 'react';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { formatNPR } from '../../utils/numberFormat';

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
  validator?:   (value: number) => boolean | string;
}

function formatDisplay(n: number): string {
  if (n === 0) return '';
  return formatNPR(n);
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
  validator,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const generatedId           = useId();
  const inputId               = id ?? generatedId;
  const errorId               = `${inputId}-error`;
  const helpId                = `${inputId}-help`;

  const validationError = useMemo(() => {
    if (value === '' || typeof value !== 'number') return undefined;
    if (min !== undefined && value < min) return `Must be at least ${formatNPR(min)}`;
    if (max !== undefined && value > max) return `Must be at most ${formatNPR(max)}`;
    if (validator) {
      const result = validator(value);
      if (typeof result === 'string') return result;
      if (result === false) return 'Invalid value';
    }
    return undefined;
  }, [value, min, max, validator]);

  const displayError = error ?? validationError;
  const showStepperControls = (showSteppers || step !== undefined) && !disabled;

  const displayValue = focused
    ? value === '' ? '' : String(value)
    : value === '' ? '' : formatDisplay(value as number);

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

  const affixPadLeft  = prefix ? 'var(--space-8)' : 'var(--space-3)';
  const affixPadRight = suffix
    ? 'var(--space-8)'
    : showStepperControls
    ? 'var(--space-8)'
    : 'var(--space-3)';

  return (
    <>
      <style>{`
        .premium-number-field::-webkit-inner-spin-button,
        .premium-number-field::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .premium-number-field:focus {
          border-color: var(--brand-500) !important;
          box-shadow: var(--glow-brand) !important;
          outline: none;
        }
        .premium-number-field:disabled {
          background: var(--surface-sunken) !important;
          opacity: 0.7;
          cursor: not-allowed;
        }
        .premium-number-stepper {
          opacity: 0;
          transition: opacity var(--dur-fast) var(--ease-premium);
        }
        .premium-number-wrap:hover .premium-number-stepper,
        .premium-number-wrap:focus-within .premium-number-stepper {
          opacity: 1;
        }
      `}</style>
      <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
        <label
          htmlFor={inputId}
          className="leading-none"
          style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-600)' }}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>

        <div
          className="premium-number-wrap relative flex items-center"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            borderRadius: 'var(--radius-sm)',
            border: displayError ? '1px solid var(--danger-600)' : '1px solid var(--border-strong)',
            background: 'var(--surface)',
            height: '38px',
            transition: 'border-color var(--dur-fast) var(--ease-premium), box-shadow var(--dur-fast) var(--ease-premium)',
          }}
        >
          {prefix && (
            <span
              className="absolute left-0 flex items-center justify-center pointer-events-none select-none"
              style={{
                width: 'var(--space-8)',
                height: '100%',
                fontSize: 'var(--text-sm)',
                color: 'var(--ink-400)',
                borderRight: '1px solid var(--border-hairline)',
              }}
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
            step={step}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            onChange={handleChange}
            className="premium-number-field num w-full border-0 outline-none bg-transparent ease-premium"
            style={{
              fontSize: 'var(--text-base)',
              height: '100%',
              paddingLeft: affixPadLeft,
              paddingRight: affixPadRight,
              color: 'var(--ink-800)',
              MozAppearance: 'textfield' as React.CSSProperties['MozAppearance'],
              WebkitAppearance: 'none',
            }}
            aria-invalid={displayError ? 'true' : undefined}
            aria-describedby={displayError ? errorId : helperText ? helpId : undefined}
            aria-required={required}
          />

          {suffix && (
            <span
              className="absolute right-0 flex items-center justify-center pointer-events-none select-none"
              style={{
                width: showStepperControls && hovered ? 'calc(var(--space-8) + var(--space-6))' : 'var(--space-8)',
                height: '100%',
                fontSize: 'var(--text-sm)',
                color: 'var(--ink-400)',
                borderLeft: '1px solid var(--border-hairline)',
                paddingRight: showStepperControls && hovered ? 'var(--space-6)' : 0,
              }}
              aria-hidden="true"
            >
              {suffix}
            </span>
          )}

          {showStepperControls && (
            <div
              className="premium-number-stepper absolute right-0 flex flex-col"
              style={{
                width: 'var(--space-6)',
                height: '100%',
                borderLeft: '1px solid var(--border-hairline)',
              }}
            >
              <button
                type="button"
                onClick={increment}
                disabled={max !== undefined && (typeof value === 'number' ? value : 0) >= max}
                className="flex-1 flex items-center justify-center transition-colors"
                style={{
                  color: 'var(--ink-500)',
                  borderBottom: '1px solid var(--border-hairline)',
                  borderRadius: '0 var(--radius-sm) 0 0',
                  background: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                aria-label="Increase value"
                tabIndex={-1}
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                onClick={decrement}
                disabled={min !== undefined && (typeof value === 'number' ? value : 0) <= min}
                className="flex-1 flex items-center justify-center transition-colors"
                style={{
                  color: 'var(--ink-500)',
                  borderRadius: '0 0 var(--radius-sm) 0',
                  background: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                aria-label="Decrease value"
                tabIndex={-1}
              >
                <ChevronDown size={11} />
              </button>
            </div>
          )}
        </div>

        {displayError && (
          <p
            id={errorId}
            className="flex items-center gap-1 font-medium leading-tight"
            style={{ fontSize: '11.5px', color: 'var(--danger-600)' }}
            role="alert"
          >
            <AlertCircle size={12} className="flex-shrink-0" />
            {displayError}
          </p>
        )}
        {!displayError && helperText && (
          <p id={helpId} className="leading-snug" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-400)' }}>
            {helperText}
          </p>
        )}
      </div>
    </>
  );
}
