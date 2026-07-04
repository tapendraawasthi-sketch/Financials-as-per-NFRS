// src/components/layout/AppShell.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  pageKey?:          string;
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
  pageKey,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen min-h-screen overflow-hidden" style={{ background: 'var(--canvas)' }}>
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
        lastSavedAt={lastSavedAt}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
          breadcrumb={breadcrumb}
          companyName={companyName}
          fiscalYear={fiscalYear}
        />

        <SlimWizardProgress
          currentStep={currentStep}
          completedSteps={completedSteps}
        />

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 px-6 py-3 text-sm flex-shrink-0 no-print"
            style={{
              background: 'var(--danger-100)',
              borderBottom: '1px solid var(--danger-100)',
              borderLeft: '3px solid var(--danger-600)',
              color: 'var(--danger-700)',
            }}
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span className="flex-1 min-w-0">{error}</span>
            {onDismissError && (
              <button
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="flex-shrink-0 rounded transition-colors"
                style={{ color: 'var(--danger-600)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--canvas)', padding: '28px' }}
          tabIndex={-1}
        >
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pageKey ?? 'page'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
          </div>
        </main>

        {wizardFooter}
      </div>
    </div>
  );
}
