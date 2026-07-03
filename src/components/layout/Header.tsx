// src/components/layout/Header.tsx
import React from 'react';
import { Building2, HelpCircle, Check } from 'lucide-react';
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
      className="flex items-center justify-between px-6 flex-shrink-0 relative bg-white/96"
      style={{
        height: '60px',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226,232,240,0.80)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Left: Title ─────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <p
            className="leading-none mb-0.5 uppercase tracking-widest"
            style={{ fontSize: '8px', color: '#94a3b8' }}
            aria-label="Breadcrumb"
          >
            {breadcrumb.join(' / ')}
          </p>
        )}
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-slate-900 leading-none truncate" style={{ fontSize: '15px' }}>
            {title}
          </h1>
          {subtitle && (
            <>
              <span className="text-slate-200 hidden sm:block" aria-hidden="true">·</span>
              <span className="text-slate-400 hidden sm:block leading-none" style={{ fontSize: '13px' }}>
                {subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Center: Company Context Pill ────────────── */}
      {companyName && (
        <div className="hidden md:flex items-center mx-4 flex-shrink-0">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-semibold max-w-[260px] truncate"
            style={{
              fontSize: '11px',
              color: '#4338ca',
              background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              border: '1px solid #c7d2fe',
            }}
          >
            <Building2 size={12} className="flex-shrink-0 text-indigo-400" />
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
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
            style={{
              fontSize: '11px',
              color: '#0d9488',
              background: '#f0fdfa',
              border: '1px solid #99f6e4',
            }}
          >
            <Check size={11} strokeWidth={3} />
            <span>{formatLastSaved(lastSavedAt)}</span>
          </span>
        )}

        {/* Help button */}
        <button
          type="button"
          aria-label="Help and documentation"
          className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Help"
        >
          <HelpCircle size={16} />
        </button>
      </div>
    </header>
  );
}
