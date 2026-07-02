// src/components/ui/Tabs.tsx
import React, { useId } from 'react';

interface Tab {
  id:        string;
  label:     string;
  count?:    number;
  disabled?: boolean;
}

interface TabsProps {
  tabs:      Tab[];
  active:    string;
  onChange:  (id: string) => void;
  variant?:  'line' | 'pill';
  className?: string;
}

export default function Tabs({
  tabs,
  active,
  onChange,
  variant   = 'line',
  className = '',
}: TabsProps) {
  const id = useId();

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={`inline-flex items-center bg-slate-100 rounded-md p-0.5 gap-0.5 ${className}`}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            id={`${id}-tab-${t.id}`}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`${id}-panel-${t.id}`}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            className={[
              'h-7 px-3 rounded text-xs font-medium transition-colors',
              active === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`ml-1.5 text-xs rounded px-1 ${
                  active === t.id
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Line variant (default)
  return (
    <div
      role="tablist"
      className={`border-b border-slate-200 ${className}`}
    >
      <div className="flex items-center gap-0 -mb-px">
        {tabs.map(t => (
          <button
            key={t.id}
            id={`${id}-tab-${t.id}`}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`${id}-panel-${t.id}`}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            className={[
              'h-9 px-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
              active === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 tabular-nums bg-slate-100 text-slate-500 text-xs rounded px-1">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
