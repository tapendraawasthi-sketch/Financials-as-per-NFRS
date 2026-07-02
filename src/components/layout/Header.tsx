// src/components/layout/Header.tsx
import React from 'react';
import { formatLastSaved } from '../../hooks/useSessionPersistence';

interface HeaderProps {
  title:          string;
  subtitle?:      string;
  actions?:       React.ReactNode;
  breadcrumb?:    string[]
  companyName?:   string;
  fiscalYear?:    string;
  // item 178: last saved timestamp
  lastSavedAt?:  Date | null;
}

function HelpIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SavedIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Header({
  title,
  subtitle,
  actions,
  breadcrumb,
  companyName,
  fiscalYear,
  lastSavedAt,
}: HeaderProps) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6 flex-shrink-0 relative"
      style={{
        background: 'rgba(255,255,255,0.97)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      {/* ── Left: Title ─────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="text-[10px] text-slate-400 leading-none mb-0.5 uppercase tracking-wide" aria-label="Breadcrumb">
            {breadcrumb.join(' / ')}
          </p>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-bold text-slate-800 leading-none truncate">
            {title}
          </h1>
          {subtitle && (
            <>
              <span className="text-slate-200 hidden sm:block" aria-hidden="true">·</span>
              <span className="text-[13px] text-slate-400 hidden sm:block leading-none">
                {subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Center: Company Context Pill ────────────── */}
      {companyName && (
        <div className="hidden md:flex items-center gap-2 mx-4 flex-shrink-0">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-indigo-700 max-w-[260px] truncate"
            style={{
              background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
              border: '1px solid #c7d2fe',
              boxShadow: '0 1px 3px rgba(99,102,241,0.12)',
            }}
          >
            <svg className="h-3 w-3 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M3 21h18M6 21V7l6-4 6 4v14" />
            </svg>
            <span className="truncate font-semibold" title={companyName}>{companyName}</span>
            {fiscalYear && (
              <>
                <span className="text-indigo-300" aria-hidden="true">·</span>
                <span className="text-indigo-500 whitespace-nowrap">FY {fiscalYear}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* ── Right: Actions + Utils ───────────────────── */}
      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        {actions && (
          <div className="flex items-center gap-2 mr-1">{actions}</div>
        )}

        {/* Session saved indicator */}
        {lastSavedAt !== undefined && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-emerald-700 font-semibold"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
          >
            <SavedIcon />
            <span>{formatLastSaved(lastSavedAt)}</span>
          </span>
        )}

        {/* Help button */}
        <button
          type="button"
          aria-label="Help and documentation"
          className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-600 transition-all"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Help"
        >
          <HelpIcon />
        </button>
      </div>
    </header>
  );
}
