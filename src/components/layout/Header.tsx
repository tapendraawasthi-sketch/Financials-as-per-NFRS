// src/components/layout/Header.tsx
import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../../hooks/useTheme';
import { formatLastSaved } from '../../hooks/useSessionPersistence';

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
  lastSavedAt,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const isRecentlySaved = lastSavedAt
    ? Date.now() - lastSavedAt.getTime() < 60_000
    : false;

  return (
    <header
      className="app-header no-print sticky top-0 z-20 flex items-center justify-between flex-shrink-0"
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
            style={{ fontSize: 'var(--text-sm)' }}
            aria-label="Breadcrumb"
          >
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: 'var(--ink-400)', margin: '0 6px' }}>/</span>}
                <span
                  style={{
                    color: i === breadcrumb.length - 1 ? 'var(--ink-900)' : 'var(--ink-500)',
                    fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                    fontSize: 'var(--text-sm)',
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
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--ink-950)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="leading-none mt-0.5 truncate"
            style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        {lastSavedAt && (
          <div
            className="flex items-center gap-2 flex-shrink-0"
            aria-live="polite"
            aria-label={`Last saved ${formatLastSaved(lastSavedAt)}`}
          >
            <span
              className={isRecentlySaved ? 'animate-pulse' : undefined}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: 'var(--radius-full)',
                background: isRecentlySaved ? 'var(--success-600)' : 'var(--ink-300)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: isRecentlySaved ? 'var(--ink-600)' : 'var(--ink-400)',
                whiteSpace: 'nowrap',
              }}
            >
              Saved {formatLastSaved(lastSavedAt)}
            </span>
          </div>
        )}

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
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-center"
            >
              {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            </motion.span>
          </AnimatePresence>
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
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand-100)',
            color: 'var(--brand-700)',
            fontSize: 'var(--text-xs)',
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
