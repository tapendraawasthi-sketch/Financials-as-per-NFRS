// src/components/layout/Header.tsx
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  title:         string;
  subtitle?:     string;
  actions?:      React.ReactNode;
  breadcrumb?:   string[];
  companyName?:  string;
  fiscalYear?:   string;
  lastSavedAt?:  Date | null;
}

function getInitials(name?: string): string {
  if (!name) return 'CA';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Header({
  title,
  subtitle,
  actions,
  breadcrumb,
  companyName,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between flex-shrink-0"
      style={{
        height: '64px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border-hairline)',
        backdropFilter: 'blur(8px)',
        padding: '0 28px',
      }}
    >
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <p
            className="leading-none mb-1"
            style={{ fontSize: '12.5px' }}
            aria-label="Breadcrumb"
          >
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: 'var(--ink-400)', margin: '0 6px' }}>/</span>}
                <span
                  style={{
                    color: i === breadcrumb.length - 1 ? 'var(--ink-900)' : 'var(--ink-500)',
                    fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                    fontSize: '12.5px',
                  }}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </p>
        )}
        <h1
          className="leading-tight truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--ink-950)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="leading-none mt-0.5 truncate"
            style={{ color: 'var(--ink-500)', fontSize: '12.5px' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}

        <style>{`.premium-header-btn:focus-visible { box-shadow: var(--glow-brand); outline: none; }`}</style>
        <button
          type="button"
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          onClick={toggleTheme}
          className="premium-header-btn h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--ink-500)' }}
        >
          {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <span
          style={{
            width: '1px',
            height: '24px',
            background: 'var(--border-hairline)',
          }}
          aria-hidden="true"
        />

        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9999px',
            background: 'var(--brand-100)',
            color: 'var(--brand-700)',
            fontSize: '12px',
            fontWeight: 700,
          }}
          title={companyName}
        >
          {getInitials(companyName)}
        </div>
      </div>
    </header>
  );
}
