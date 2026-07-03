// src/App.tsx
import React from 'react';
import { AppProvider, useAppStore, AppState } from './store/appStore';
import { AppStep } from './types';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Alert from './components/ui/Alert';
import AppShell from './components/layout/AppShell';
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// ── Prerequisite definitions ───────────────────────────────────────────────────
interface Prereq { label: string; step: AppStep; met: (s: AppState) => boolean }

const PREREQS: Partial<Record<AppStep, Prereq[]>> = {
  trial_balance_upload: [
    { label: 'Company Setup', step: 'company_setup', met: s => Boolean(s.company?.companyName) },
  ],
  trial_balance_mapping: [
    { label: 'Company Setup', step: 'company_setup', met: s => Boolean(s.company?.companyName) },
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
  subledger_details: [
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
  year_end_adjustments: [
    { label: 'Company Setup', step: 'company_setup', met: s => Boolean(s.company?.companyName) },
    { label: 'Upload & Map Trial Balance', step: 'trial_balance_mapping', met: s => Boolean(s.trialBalance) },
  ],
  review_statements: [
    { label: 'Company Setup', step: 'company_setup', met: s => Boolean(s.company?.companyName) },
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
  generate_output: [
    { label: 'Company Setup', step: 'company_setup', met: s => Boolean(s.company?.companyName) },
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
};

// ── Banner shown when prerequisites are missing ────────────────────────────────
function PrereqBanner({
  missing,
  onGoTo,
}: {
  missing: Prereq[];
  onGoTo: (step: AppStep) => void;
}) {
  return (
    <div
      role="alert"
      className="mx-7 mt-4 mb-2 rounded-xl border px-4 py-3.5 flex items-start gap-3"
      style={{
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        borderColor: '#fcd34d',
      }}
    >
      <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Complete earlier steps to fill data here
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          The following steps still need to be completed:
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {missing.map(p => (
            <li key={p.step}>
              <button
                onClick={() => onGoTo(p.step)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: '#fef08a',
                  color: '#92400e',
                  border: '1px solid #fcd34d',
                }}
              >
                {p.label}
                <ArrowRight size={10} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Pages
import DashboardPage from './pages/DashboardPage';
import CompanySetupPage from './pages/CompanySetupPage';
import TrialBalancePage from './pages/TrialBalancePage';
import SubledgerPage from './pages/SubledgerPage';
import AdjustmentsPage from './pages/AdjustmentsPage';
import StatementsPage from './pages/StatementsPage';
import OutputPage from './pages/OutputPage';

// Step → human-readable header title
const STEP_TITLES: Record<AppStep, { title: string; subtitle: string }> = {
  company_setup: { title: 'Company Setup', subtitle: 'Enter basic company and registration details' },
  accounting_policies: { title: 'Accounting Policies', subtitle: 'Configure depreciation and accounting methods' },
  trial_balance_upload: { title: 'Upload Trial Balance', subtitle: 'Import your trial balance from accounting software' },
  trial_balance_mapping: { title: 'Account Mapping', subtitle: 'Map accounts to NFRS / NAS for MEs categories' },
  subledger_details: { title: 'Subledger Details', subtitle: 'Review debtors, creditors and bank balances' },
  year_end_adjustments: { title: 'Year-End Adjustments', subtitle: 'Enter depreciation, provisions and adjusting entries' },
  review_statements: { title: 'Review Statements', subtitle: 'Review all four financial statements before download' },
  generate_output: { title: 'Download Excel', subtitle: 'Generate and download your NFRS financial statements' },
};

const AppInner: React.FC = () => {
  const { state, dispatch } = useAppStore();

  const [hasStarted, setHasStarted] = React.useState(false);

  const isDashboard = !hasStarted;

  const handleNavigate = (step: AppStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  const handleDismissError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Show full-page spinner for global loading
  if (state.isLoading) {
    return <LoadingSpinner message="Loading…" fullPage />;
  }

  // Dashboard — no shell
  if (isDashboard) {
    return (
      <>
        {state.error && (
          <div className="fixed top-4 right-4 z-50 max-w-sm">
            <Alert type="error" message={state.error} onDismiss={handleDismissError} />
          </div>
        )}
        <DashboardPage
          onStart={() => {
            dispatch({ type: 'RESET_ALL' });
            setHasStarted(true);
          }}
          onContinue={() => setHasStarted(true)}
          hasSession={Boolean(state.company || state.trialBalance || state.completedSteps.length > 0)}
        />
      </>
    );
  }

  // Determine page component with prerequisite banner
  const renderPage = () => {
    const prereqs  = PREREQS[state.currentStep] ?? [];
    const missing  = prereqs.filter(p => !p.met(state));
    const banner   = missing.length > 0
      ? <PrereqBanner missing={missing} onGoTo={handleNavigate} />
      : null;

    const page = (() => {
      switch (state.currentStep) {
        case 'company_setup':
        case 'accounting_policies':
          return <CompanySetupPage />;

        case 'trial_balance_upload':
        case 'trial_balance_mapping':
          return <TrialBalancePage />;

        case 'subledger_details':
          return <SubledgerPage />;

        case 'year_end_adjustments':
          return <AdjustmentsPage />;

        case 'review_statements':
          return <StatementsPage />;

        case 'generate_output':
          return <OutputPage />;

        default:
          return <CompanySetupPage />;
      }
    })();

    return (
      <>
        {banner}
        {page}
      </>
    );
  };

  const stepInfo = STEP_TITLES[state.currentStep] ?? { title: 'NFRS Reporter', subtitle: '' };

  return (
    <AppShell
      currentStep={state.currentStep}
      completedSteps={state.completedSteps}
      onNavigate={handleNavigate}
      companyName={state.company?.companyName}
      fiscalYear={state.company?.fiscalYear.bsFY}
      headerTitle={stepInfo.title}
      headerSubtitle={stepInfo.subtitle}
      breadcrumb={['Home', stepInfo.title]}
    >
      {/* Global error banner */}
      {state.error && (
        <div className="mx-6 mt-4">
          <Alert type="error" message={state.error} onDismiss={handleDismissError} />
        </div>
      )}
      {renderPage()}
    </AppShell>
  );
};

// Root export — wraps everything in AppProvider
const App: React.FC = () => (
  <AppProvider>
    <AppInner />
    <KeyboardShortcutsModal />
  </AppProvider>
);

export default App;
