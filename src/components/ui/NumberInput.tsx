// src/components/ui/NumberInput.tsx
import React, { useState, useId, useCallback } from 'react';
import { formatNPRSimple } from '../../utils/numberFormat';

interface NumberInputProps {
  label: string;
  value: number | '';
  onChange: (value: number) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  currency?: boolean;   // shows "NPR" prefix
  percent?: boolean;    // shows "%" suffix
  disabled?: boolean;
  id?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required,
  min,
  max,
  placeholder = '0',
  currency = false,
  percent = false,
  disabled = false,
  id: externalId,
}) => {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  // Display the raw number while focused, formatted on blur
  const [isFocused, setIsFocused] = useState(false);
  const [rawInput, setRawInput] = useState<string>('');

  const formattedValue = useCallback((): string => {
    if (value === '' || value === 0) return '';
    return formatNPRSimple(value as number);
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number on focus
    setRawInput(value === '' || value === 0 ? '' : String(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Parse the raw input back to number
    const cleaned = rawInput.replace(/[,\s]/g, '');
    if (cleaned === '' || cleaned === '-') {
      onChange(0);
    } else {
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        // Apply min/max clamping
        let clamped = parsed;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        onChange(clamped);
      } else {
        onChange(0);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow: digits, minus sign at start, decimal point, commas (stripped later)
    const val = e.target.value;
    setRawInput(val);
  };

  const displayValue = isFocused ? rawInput : (value === '' || value === 0 ? '' : formattedValue());

  const baseInputClasses =
    'block w-full text-sm text-slate-900 placeholder-slate-400 ' +
    'focus:outline-none transition-colors ';

  const stateClasses = error
    ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
    : 'border-slate-300 bg-white focus:border-blue-400 focus:ring-blue-100 hover:border-slate-400';

  const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : '';

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>

      <div className={`flex items-center rounded-lg border overflow-hidden focus-within:ring-2 ${stateClasses} ${disabledClasses}`}>
        {/* Currency prefix */}
        {currency && (
          <span className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-r border-slate-200 flex-shrink-0">
            NPR
          </span>
        )}

        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={`${baseInputClasses} px-3 py-2 flex-1 min-w-0 text-right border-0 focus:ring-0 bg-transparent`}
        />

        {/* Percent suffix */}
        {percent && (
          <span className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-l border-slate-200 flex-shrink-0">
            %
          </span>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 flex items-center gap-1" role="alert">
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};

export default NumberInput;
