// src/components/ui/Tabs.tsx
import React, { useId, useRef, useEffect, useState } from 'react';

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
  const tablistRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (variant !== 'line' || !tablistRef.current) return;
    const activeEl = tablistRef.current.querySelector<HTMLElement>(`[data-tab-id="${active}"]`);
    if (activeEl) {
      setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
    }
  }, [active, variant, tabs]);

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={`inline-flex items-center rounded-xl p-1 gap-0.5 ${className}`}
        style={{ background: 'var(--surface-sunken)' }}
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
              'h-8 px-3.5 rounded-lg font-medium transition-all ease-premium focus-visible:outline-none',
              active === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].filter(Boolean).join(' ')}
            style={{
              fontSize: '12px',
              boxShadow: active === t.id ? 'var(--shadow-sm)' : undefined,
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

  return (
    <div
      role="tablist"
      className={`overflow-x-auto relative ${className}`}
      style={{ borderBottom: '1px solid var(--border-hairline)' }}
    >
      <style>{`
        .premium-tab:focus-visible { box-shadow: var(--glow-brand); outline: none; }
      `}</style>
      <div ref={tablistRef} className="flex items-center gap-0 relative">
        {tabs.map(t => (
          <button
            key={t.id}
            id={`${id}-tab-${t.id}`}
            data-tab-id={t.id}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`${id}-panel-${t.id}`}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            className={[
              'premium-tab h-10 px-4 font-medium whitespace-nowrap transition-colors ease-premium',
              active === t.id
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-700',
              t.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].filter(Boolean).join(' ')}
            style={{
              fontSize: '13px',
              color: active === t.id ? 'var(--brand-600)' : 'var(--ink-500)',
              fontWeight: active === t.id ? 600 : 500,
              borderBottom: active === t.id ? '2px solid var(--brand-500)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
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
        <span
          className="absolute bottom-0 pointer-events-none transition-all ease-premium hidden"
          style={{
            left: indicator.left,
            width: indicator.width,
            height: '2px',
            background: 'var(--brand-500)',
          }}
        />
      </div>
    </div>
  );
}
