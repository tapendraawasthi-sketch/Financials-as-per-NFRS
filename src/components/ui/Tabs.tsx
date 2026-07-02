// src/components/ui/Tabs.tsx
import React, { useId } from 'react';

interface Tab {
  id:        string;
  label:     string;
  count?:    number;
  disabled?: boolean;
}

interface TabsProps {
  tabs:       Tab[];
  active:     string;
  onChange:   (id: string) => void;
  variant?:   'line' | 'pill';
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
        className={`inline-flex items-center bg-slate-100 rounded-xl p-0.5 gap-0.5 ${className}`}
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
              // item 147: h-8 px-3 text-sm for pill tabs
              'h-8 px-3 rounded-lg text-sm font-medium transition-colors',
              active === t.id
                ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'  // item 149
                : 'text-slate-500 hover:text-slate-700',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].filter(Boolean).join(' ')}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
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

  // ── Line variant ──────────────────────────────────────────────────────────
  return (
    <div role="tablist" className={`border-b border-slate-200 ${className}`}>
      <div className="flex items-center gap-0 -mb-px overflow-x-auto">
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
              // item 147: h-10 text-sm for line tabs
              'h-10 px-4 text-sm font-medium whitespace-nowrap',
              // item 148: border-b-[3px] for more definitive active indicator
              active === t.id
                ? 'border-b-[3px] border-blue-600 text-blue-700'
                : 'border-b-[3px] border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              'transition-colors duration-150',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].filter(Boolean).join(' ')}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 tabular-nums bg-slate-100 text-slate-500 text-xs rounded-full px-1.5 py-0.5">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
