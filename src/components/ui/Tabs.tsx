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
        className={`inline-flex items-center rounded-xl p-1 gap-0.5 ${className}`}
        style={{ background: '#f1f5f9' }}
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
              'h-8 px-3.5 rounded-lg font-medium transition-all duration-150',
              active === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].filter(Boolean).join(' ')}
            style={{
              fontSize: '12px',
              boxShadow: active === t.id
                ? '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)'
                : undefined,
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 ${
                  active === t.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
                style={{ fontSize: '11px' }}
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
    <div
      role="tablist"
      className={`overflow-x-auto ${className}`}
      style={{ borderBottom: '2px solid #e2e8f0' }}
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
              'h-10 px-4 font-medium whitespace-nowrap border-b-[3px] transition-colors duration-150',
              active === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].filter(Boolean).join(' ')}
            style={{ fontSize: '13px' }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`ml-1.5 tabular-nums rounded-full px-1.5 py-0.5 ${
                  active === t.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
                style={{ fontSize: '11px' }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
