// ===== src/components/ui/Tabs.tsx =====
import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pill';
}

function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
}: TabsProps): React.ReactElement {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className="inline-flex bg-slate-100 rounded-xl p-1 gap-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isActive
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
                tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={[
                    'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5',
                    'rounded-full text-xs font-semibold',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600',
                  ].join(' ')}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline variant
  return (
    <div
      role="tablist"
      className="flex border-b border-slate-200 gap-0"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium',
              'border-b-2 -mb-px transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5',
                  'rounded-full text-xs font-semibold',
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600',
                ].join(' ')}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
