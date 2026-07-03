// src/components/layout/AppShell.tsx
import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import Sidebar from './Sidebar';
import Header  from './Header';
import { SlimWizardProgress } from './WizardProgress';
import { AppStep } from '../../types';

interface AppShellProps {
  currentStep:      AppStep;
  completedSteps:   AppStep[];
  onNavigate:       (step: AppStep) => void;
  companyId?:       string;
  companyName?:     string;
  fiscalYear?:      string;
  onSwitchClient?:  (companyId: string) => void;
  headerTitle:      string;
  headerSubtitle?:  string;
  headerActions?:   React.ReactNode;
  breadcrumb?:      string[];
  lastSavedAt?:     Date | null;
  error?:           string | null;
  onDismissError?:  () => void;
  wizardFooter?:    React.ReactNode;
  children:         React.ReactNode;
}

export default function AppShell({
  currentStep,
  completedSteps,
  onNavigate,
  companyId,
  companyName,
  fiscalYear,
  onSwitchClient,
  headerTitle,
  headerSubtitle,
  headerActions,
  breadcrumb,
  lastSavedAt,
  error,
  onDismissError,
  wizardFooter,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen min-h-screen bg-slate-50 overflow-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        currentStep={currentStep}
        completedSteps={completedSteps}
        onNavigate={onNavigate}
        companyId={companyId}
        companyName={companyName}
        fiscalYear={fiscalYear}
        onSwitchClient={onSwitchClient}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
          breadcrumb={breadcrumb}
          companyName={companyName}
          fiscalYear={fiscalYear}
          lastSavedAt={lastSavedAt}
        />

        <SlimWizardProgress
          currentStep={currentStep}
          completedSteps={completedSteps}
        />

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 px-6 py-3 text-sm text-red-700 flex-shrink-0 no-print"
            style={{
              background: '#fef2f2',
              borderBottom: '1px solid #fecaca',
              borderLeft: '4px solid #dc2626',
            }}
          >
            <AlertCircle size={16} className="flex-shrink-0 text-red-500" />
            <span className="flex-1 min-w-0">{error}</span>
            {onDismissError && (
              <button
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="flex-shrink-0 text-red-400 hover:text-red-700 rounded transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto px-7 py-6 bg-slate-50"
          tabIndex={-1}
        >
          <div className="page-enter">
            {children}
          </div>
        </main>

        {wizardFooter}
      </div>
    </div>
  );
}
