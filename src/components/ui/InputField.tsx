// ===== src/components/ui/InputField.tsx =====
import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    { label, error, helperText, required, className = '', id, ...rest },
    ref,
  ) => {
    // Generate a stable id if none is supplied
    const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const baseInputClass =
      'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors';
    const normalBorderClass =
      'border-slate-300 focus:ring-blue-500 focus:border-blue-500';
    const errorBorderClass =
      'border-red-400 focus:ring-red-400 bg-red-50';

    return (
      <div className="flex flex-col">
        {/* Label */}
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {/* Input */}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          className={[
            baseInputClass,
            error ? errorBorderClass : normalBorderClass,
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />

        {/* Error message */}
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-red-600 text-xs mt-1"
          >
            {error}
          </p>
        )}

        {/* Helper text (shown only when no error) */}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-slate-500 text-xs mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

InputField.displayName = 'InputField';

export default InputField;
