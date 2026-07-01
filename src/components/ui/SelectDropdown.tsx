// ===== src/components/ui/SelectDropdown.tsx =====
import React from 'react';

interface SelectDropdownProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
}

const SelectDropdown = React.forwardRef<
  HTMLSelectElement,
  SelectDropdownProps
>(
  (
    {
      label,
      options,
      error,
      helperText,
      placeholder,
      required,
      className = '',
      id,
      ...rest
    },
    ref,
  ) => {
    const selectId =
      id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const baseSelectClass =
      'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ' +
      'transition-colors appearance-none bg-white pr-9 cursor-pointer';
    const normalBorderClass =
      'border-slate-300 focus:ring-blue-500 focus:border-blue-500';
    const errorBorderClass =
      'border-red-400 focus:ring-red-400 bg-red-50';

    return (
      <div className="flex flex-col">
        {/* Label */}
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {/* Select wrapper with custom chevron */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${selectId}-error`
                : helperText
                ? `${selectId}-helper`
                : undefined
            }
            className={[
              baseSelectClass,
              error ? errorBorderClass : normalBorderClass,
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...rest}
          >
            {/* Placeholder option */}
            {placeholder && (
              <option value="" disabled selected>
                {placeholder}
              </option>
            )}

            {/* Mapped options */}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Chevron icon — pointer-events-none so the select is still clickable */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              width={16}
              height={16}
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p
            id={`${selectId}-error`}
            role="alert"
            className="text-red-600 text-xs mt-1"
          >
            {error}
          </p>
        )}

        {/* Helper text */}
        {!error && helperText && (
          <p id={`${selectId}-helper`} className="text-slate-500 text-xs mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

SelectDropdown.displayName = 'SelectDropdown';

export default SelectDropdown;
