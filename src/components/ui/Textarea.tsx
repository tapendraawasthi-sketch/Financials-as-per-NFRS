// src/components/ui/Textarea.tsx
import React, { useId } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  rows?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, required, rows = 4, className = '', id: externalId, ...rest }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;

    const baseClasses =
      'block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 ' +
      'focus:outline-none focus:ring-2 transition-colors resize-y ';

    const stateClasses = error
      ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-300 bg-white focus:border-blue-400 focus:ring-blue-100 hover:border-slate-400';

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>

        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={`${baseClasses}${stateClasses} ${className}`}
          {...rest}
        />

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
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
