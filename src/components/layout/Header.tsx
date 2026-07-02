// src/components/layout/Header.tsx
import React from 'react';
import { formatLastSaved } from '../../hooks/useSessionPersistence';

interface HeaderProps {
  title:          string;
  subtitle?:      string;
  actions?:       React.ReactNode;
  breadcrumb?:    string[];
  companyName?:   string;    /* item 27: company context in header */
  fiscalYear?:    string;    /* item 27: fiscal year in header */
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
    /* item 24: h-14 (56px) — standard SaaS topbar height */
    /* item 29: subtle shadow for elevation above content */
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 flex-shrink-0 shadow-[0_1px_4px_rgb(0_0_0/0.06)]">

      {/* ── Left: Title + Breadcrumb ─────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="text-[11px] text-slate-400 leading-none mb-0.5" aria-label="Breadcrumb">
            {breadcrumb.join(' / ')}
          </p>
        )}
        <div className="flex items-center gap-2">
          {/* item 25: text-base (16px) for page title */}
          <h1 className="text-base font-semibold text-slate-800 leading-none truncate">
            {title}
          </h1>
          {/* item 26: separator + subtitle color raised */}
          {subtitle && (
            <>
              <span className="text-slate-300 hidden sm:block" aria-hidden="true">·</span>
              <span className="text-sm text-slate-500 hidden sm:block leading-none">
                {subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* item 27: company context pill — center of header */}
      {companyName && (
        <div className="hidden md:flex items-center gap-2 mx-4 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs font-medium text-slate-600 max-w-[280px] truncate">
            <svg className="h-3 w-3 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M3 21h18M6 21V7l6-4 6 4v14" />
            </svg>
            <span className="truncate" title={companyName}>{companyName}</span>
            {fiscalYear && (
              <>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-slate-500 whitespace-nowrap">FY {fiscalYear}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* ── Right: Actions + Persistent utils ───────────────────── */}
      {/* item 28: help icon + session status always visible */}
      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        {actions && (
          <div className="flex items-center gap-2 mr-1">
            {actions}
          </div>
        )}

        {/* Session saved indicator */}
        {lastSavedAt !== undefined && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <SavedIcon />
            <span>{formatLastSaved(lastSavedAt)}</span>
          </span>
        )}

        {/* Help button */}
        <button
          type="button"
          aria-label="Help and documentation"
          className="h-7 w-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200"
          title="Help"
        >
          <HelpIcon />
        </button>
      </div>
    </header>
  );
}
