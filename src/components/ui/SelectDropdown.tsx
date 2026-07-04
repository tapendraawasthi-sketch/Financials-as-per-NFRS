// src/components/ui/SelectDropdown.tsx
import React, { useId, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';

interface SelectOption {
  value:     string;
  label:     string;
  disabled?: boolean;
}

interface SelectDropdownProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label:        string;
  options:      SelectOption[];
  error?:       string;
  helperText?:  string;
  placeholder?: string;
  required?:    boolean;
  onChange?:    React.ChangeEventHandler<HTMLSelectElement>;
}

const TRIGGER_HEIGHT = '38px';

function fireChange(
  onChange: SelectDropdownProps['onChange'],
  name: string | undefined,
  newValue: string,
) {
  if (!onChange) return;
  const event = {
    target: { value: newValue, name },
    currentTarget: { value: newValue, name },
  } as React.ChangeEvent<HTMLSelectElement>;
  onChange(event);
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
  value,
  disabled,
  name,
  onChange,
  onBlur,
  ...rest
}: SelectDropdownProps) {
  const generatedId = useId();
  const selectId    = id ?? generatedId;
  const errorId     = `${selectId}-error`;
  const helpId      = `${selectId}-help`;
  const listboxId   = `${selectId}-listbox`;

  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [typeahead, setTypeahead] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stringValue = value === undefined || value === null ? '' : String(value);

  const enabledOptions = useMemo(
    () => options.filter(o => !o.disabled),
    [options],
  );

  const selectedOption = useMemo(
    () => options.find(o => o.value === stringValue),
    [options, stringValue],
  );

  const displayLabel = selectedOption?.label ?? placeholder ?? 'Select…';

  const close = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
    setTypeahead('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        close();
        onBlur?.({ target: { name, value: stringValue } } as React.FocusEvent<HTMLSelectElement>);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close, onBlur, name, stringValue]);

  useEffect(() => {
    if (!open) return;
    const idx = enabledOptions.findIndex(o => o.value === stringValue);
    setHighlightedIndex(idx >= 0 ? idx : 0);
  }, [open, enabledOptions, stringValue]);

  useEffect(() => {
    return () => {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    };
  }, []);

  const selectAt = useCallback((index: number) => {
    const option = enabledOptions[index];
    if (!option) return;
    fireChange(onChange, name, option.value);
    close();
  }, [enabledOptions, onChange, name, close]);

  const handleTypeahead = useCallback((char: string) => {
    const next = typeahead + char.toLowerCase();
    setTypeahead(next);
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    typeaheadTimer.current = setTimeout(() => setTypeahead(''), 700);

    const matchIdx = enabledOptions.findIndex(o =>
      o.label.toLowerCase().startsWith(next),
    );
    if (matchIdx >= 0) setHighlightedIndex(matchIdx);
  }, [typeahead, enabledOptions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < enabledOptions.length - 1 ? prev + 1 : 0,
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : enabledOptions.length - 1,
          );
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (highlightedIndex >= 0) {
          selectAt(highlightedIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
      case 'Home':
        if (open) { e.preventDefault(); setHighlightedIndex(0); }
        break;
      case 'End':
        if (open) { e.preventDefault(); setHighlightedIndex(enabledOptions.length - 1); }
        break;
      default:
        if (open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleTypeahead(e.key);
        } else if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setOpen(true);
        }
        break;
    }
  };

  return (
    <div className={`flex flex-col ${className}`} style={{ gap: 'var(--space-2)' }} ref={containerRef}>
      <label
        htmlFor={selectId}
        className="leading-none"
        style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-600)' }}
      >
        {label}
        {required && <span className="text-indigo-400 ml-0.5" aria-hidden="true">*</span>}
      </label>

      {/* Hidden native select for form compatibility */}
      <select
        {...rest}
        id={selectId}
        name={name}
        value={stringValue}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>

      <div className="relative">
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helpId : undefined}
          aria-required={required}
          disabled={disabled}
          onClick={() => !disabled && setOpen(prev => !prev)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!open) onBlur?.({ target: { name, value: stringValue } } as React.FocusEvent<HTMLSelectElement>);
          }}
          className="w-full flex items-center justify-between outline-none transition-all ease-premium text-left"
          style={{
            fontSize: 'var(--text-base)',
            height: TRIGGER_HEIGHT,
            borderRadius: 'var(--radius-sm)',
            background: disabled ? 'var(--surface-sunken)' : 'var(--surface)',
            border: error ? '1px solid var(--danger-600)' : '1px solid var(--border-strong)',
            padding: '0 var(--space-3)',
            color: stringValue ? 'var(--ink-800)' : 'var(--ink-400)',
            opacity: disabled ? 0.7 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: open ? 'var(--glow-brand)' : undefined,
            borderColor: open && !error ? 'var(--brand-500)' : undefined,
          }}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            size={16}
            style={{
              color: 'var(--ink-400)',
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : undefined,
              transition: 'transform var(--dur-fast) var(--ease-premium)',
            }}
          />
        </button>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-y-auto py-1"
            style={{
              maxHeight: '240px',
              background: 'var(--surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {placeholder && !stringValue && (
              <li
                role="option"
                aria-selected={false}
                className="px-3 py-2"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-400)' }}
              >
                {placeholder}
              </li>
            )}
            {options.map((option) => {
              const enabledIdx = enabledOptions.indexOf(option);
              const isSelected = option.value === stringValue;
              const isHighlighted = enabledIdx === highlightedIndex;
              const isDisabled = !!option.disabled;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  onMouseEnter={() => !isDisabled && enabledIdx >= 0 && setHighlightedIndex(enabledIdx)}
                  onClick={() => !isDisabled && enabledIdx >= 0 && selectAt(enabledIdx)}
                  className="flex items-center gap-2 px-3 cursor-pointer transition-colors"
                  style={{
                    height: '36px',
                    fontSize: 'var(--text-base)',
                    color: isDisabled ? 'var(--ink-300)' : 'var(--ink-800)',
                    background: isHighlighted ? 'var(--surface-hover)' : 'transparent',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <Check size={14} style={{ color: 'var(--brand-500)', flexShrink: 0 }} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1 font-medium leading-tight"
          style={{ fontSize: '11.5px', color: 'var(--danger-600)' }}
          role="alert"
        >
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helpId} className="leading-snug" style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-400)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
