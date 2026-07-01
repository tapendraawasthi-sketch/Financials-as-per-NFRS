// src/App.tsx
import React from 'react';
import { AppProvider, useAppStore } from './store/appStore';
import { AppStep } from './types';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Alert from './components/ui/Alert';
import AppShell from './components/layout/AppShell';

// Pages
import DashboardPage from './pages/DashboardPage';
import CompanySetupPage from './pages/CompanySetupPage';
import TrialBalancePage from './pages/TrialBalancePage';
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

  const isDashboard =
    state.currentStep === 'company_setup' &&
    state.completedSteps.length === 0 &&
    !state.company;

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
        <DashboardPage />
      </>
    );
  }

  // Determine page component
  const renderPage = () => {
    switch (state.currentStep) {
      case 'company_setup':
      case 'accounting_policies':
        return <CompanySetupPage />;

      case 'trial_balance_upload':
      case 'trial_balance_mapping':
        return <TrialBalancePage />;

      case 'subledger_details':
        // MVP: skip subledger step — show trial balance mapping for re-review
        return <TrialBalancePage />;

      case 'year_end_adjustments':
        return <AdjustmentsPage />;

      case 'review_statements':
        return <StatementsPage />;

      case 'generate_output':
        return <OutputPage />;

      default:
        return <DashboardPage />;
    }
  };

  const stepInfo = STEP_TITLES[state.currentStep] ?? { title: 'NFRS Reporter', subtitle: '' };

  return (
    <AppShell
      currentStep={state.currentStep}
      completedSteps={state.completedSteps}
      onNavigate={handleNavigate}
      companyName={state.company?.companyName}
      fiscalYear={state.company?.fiscalYear.bsYear}
      headerTitle={stepInfo.title}
      headerSubtitle={stepInfo.subtitle}
      breadcrumb={[
        { label: 'Home', onClick: () => handleNavigate('company_setup') },
        { label: stepInfo.title },
      ]}
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
  </AppProvider>
);

export default App;
