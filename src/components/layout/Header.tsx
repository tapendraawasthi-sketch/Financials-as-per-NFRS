import React from 'react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumb,
  onMenuClick,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Open navigation menu"
          aria-expanded={false}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-0.5">
              {breadcrumb.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-300 text-xs">›</span>}
                  {crumb.onClick ? (
                    <button
                      onClick={crumb.onClick}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Title row */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-base md:text-lg font-bold text-slate-800 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-slate-500 hidden sm:block truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
