// src/components/layout/AppShell.tsx
import React from 'react';
import Sidebar from './Sidebar';
import Header  from './Header';
import { AppStep } from '../../types';


interface AppShellProps {
  currentStep:      AppStep;
  completedSteps:   AppStep[];
  onNavigate:       (step: AppStep) => void;
  companyName?:     string;
  fiscalYear?:      string;
  headerTitle:      string;
  headerSubtitle?:  string;
  headerActions?:   React.ReactNode;
  breadcrumb?:      string[];
  error?:           string | null;
  onDismissError?:  () => void;
  children:         React.ReactNode;
}

export default function AppShell({
  currentStep,
  completedSteps,
  onNavigate,
  companyName,
  fiscalYear,
  headerTitle,
  headerSubtitle,
  headerActions,
  breadcrumb,
  error,
  onDismissError,
  children,
}: AppShellProps) {
  return (
    /* item 33: min-h-screen alongside h-screen for short laptop screens */
    <div className="flex h-screen min-h-screen bg-slate-50 overflow-hidden">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        currentStep={currentStep}
        completedSteps={completedSteps}
        onNavigate={onNavigate}
        companyName={companyName}
        fiscalYear={fiscalYear}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* item 27: pass company context down to Header */}
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
          breadcrumb={breadcrumb}
          companyName={companyName}
          fiscalYear={fiscalYear}
        />



        {/* item 31: error text raised to text-sm for readability */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700 flex-shrink-0 no-print"
          >
            <svg
              className="h-4 w-4 flex-shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9"  x2="9"  y2="15" />
              <line x1="9"  y1="9"  x2="15" y2="15" />
            </svg>
            <span className="flex-1 min-w-0">{error}</span>
            {onDismissError && (
              <button
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="flex-shrink-0 text-red-400 hover:text-red-700 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <line x1="18" y1="6"  x2="6"  y2="18" />
                  <line x1="6"  y1="6"  x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* item 30: px-6 py-6 for consistent breathing room */}
        {/* item 32: scroll-smooth via CSS html rule (already added in index.css) */}
        {/* item 8: page-enter animation on every content change */}
        {/* item 172: role="main" for ARIA landmark */}
        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto px-6 py-6"
          tabIndex={-1}
        >
          {/* page-enter class gives the 180ms fade+slide animation */}
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
