// src/components/layout/Header.tsx
import React from 'react';

interface HeaderProps {
  title:        string;
  subtitle?:    string;
  actions?:     React.ReactNode;
  breadcrumb?:  string[];
}

export default function Header({
  title,
  subtitle,
  actions,
  breadcrumb,
}: HeaderProps) {
  return (
    <header className="h-12 flex items-center justify-between px-6 bg-white border-b border-slate-200 flex-shrink-0">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="text-[11px] text-slate-400 leading-none mb-0.5" aria-label="Breadcrumb">
            {breadcrumb.join(' / ')}
          </p>
        )}
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-slate-800 leading-none truncate">
            {title}
          </h1>
          {subtitle && (
            <span className="text-xs text-slate-400 hidden sm:block leading-none">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
