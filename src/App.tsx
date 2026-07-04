// src/App.tsx
import React from 'react';
import { AppProvider, useAppStore, AppState } from './store/appStore';
import type { CompanyProfile, ParsedTrialBalance, YearEndAdjustments, AppStep } from './types';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Alert from './components/ui/Alert';
import AppShell from './components/layout/AppShell';
import WizardFooter from './components/layout/WizardFooter';
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal';
import { useToast } from './components/ui/Toast';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { loadSession, saveSession, useSessionPersistence } from './hooks/useSessionPersistence';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { hasCompanyName, normalizeCompanyProfile, resolveCompanyName } from './utils/companyProfile';

// ── Prerequisite definitions ───────────────────────────────────────────────────
interface Prereq { label: string; step: AppStep; met: (s: AppState) => boolean }

const PREREQS: Partial<Record<AppStep, Prereq[]>> = {
  trial_balance_upload: [
    { label: 'Company Setup', step: 'company_setup', met: s => hasCompanyName(s.company) },
  ],
  trial_balance_mapping: [
    { label: 'Company Setup', step: 'company_setup', met: s => hasCompanyName(s.company) },
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
  subledger_details: [
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
  year_end_adjustments: [
    { label: 'Company Setup', step: 'company_setup', met: s => hasCompanyName(s.company) },
    { label: 'Upload & Map Trial Balance', step: 'trial_balance_mapping', met: s => Boolean(s.trialBalance) },
  ],
  review_statements: [
    { label: 'Company Setup', step: 'company_setup', met: s => hasCompanyName(s.company) },
    { label: 'Upload Trial Balance', step: 'trial_balance_upload', met: s => Boolean(s.trialBalance) },
  ],
  generate_output: [
    { label: 'Company Setup', step: 'company_setup', met: s => hasCompanyName(s.company) },
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
        background: 'var(--warning-100)',
        borderColor: 'var(--gold-400)',
      }}
    >
      <AlertTriangle size={17} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warning-600)' }} />
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
                  background: 'var(--warning-100)',
                  color: 'var(--warning-700)',
                  border: '1px solid var(--gold-400)',
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

const WIZARD_STEPS: AppStep[] = [
  'company_setup',
  'accounting_policies',
  'trial_balance_upload',
  'trial_balance_mapping',
  'subledger_details',
  'year_end_adjustments',
  'review_statements',
  'generate_output',
];

function resolveStoredCompanyId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get('companyId');
  if (fromUrl) return fromUrl;

  const explicit = localStorage.getItem('me_last_company_id');
  if (explicit) return explicit;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('me_session_')) {
      return key.slice('me_session_'.length);
    }
  }
  return null;
}

const RESTORE_FETCH_TIMEOUT_MS = 12_000;

async function fetchWithStatus<T>(
  path: string,
  timeoutMs = RESTORE_FETCH_TIMEOUT_MS,
): Promise<{ data: T | null; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 404) return { data: null, status: 404 };
    if (response.status >= 500) {
      let message = `Request failed: ${response.status}`;
      try {
        const err = await response.json();
        message = err.error || err.message || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    if (!response.ok) return { data: null, status: response.status };
    if (response.status === 204) return { data: null, status: 204 };
    return { data: (await response.json()) as T, status: response.status };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Session restore timed out. Using your saved draft instead.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function inferStepFromServerData(
  tbResult: { data: unknown },
  adjResult: { data: unknown },
): AppStep {
  if (adjResult.data) return 'year_end_adjustments';
  if (tbResult.data) return 'trial_balance_mapping';
  return 'trial_balance_upload';
}

async function mergeServerSession(
  companyId: string,
  dispatch: ReturnType<typeof useAppStore>['dispatch'],
  localState: AppState | null,
  inferStepWhenNoLocal: boolean,
): Promise<void> {
  const companyResult = await fetchWithStatus<Record<string, unknown>>(
    `/api/company/${companyId}`,
  );
  if (companyResult.data) {
    const serverCompany = companyResult.data as unknown as CompanyProfile;
    const merged = normalizeCompanyProfile({
      ...(localState?.company ?? {}),
      ...serverCompany,
      companyName:
        resolveCompanyName(serverCompany)
        || resolveCompanyName(localState?.company)
        || serverCompany.companyName,
    } as CompanyProfile);
    dispatch({ type: 'SET_COMPANY', payload: merged });
    localStorage.setItem('me_last_company_id', merged.id ?? companyId);
  } else if (localState?.company && hasCompanyName(localState.company)) {
    dispatch({ type: 'SET_COMPANY', payload: normalizeCompanyProfile(localState.company) });
  }

  const tbResult = await fetchWithStatus<Record<string, unknown>>(
    `/api/trial-balance/${companyId}`,
  );
  if (tbResult.data) {
    dispatch({ type: 'SET_TRIAL_BALANCE', payload: tbResult.data as unknown as ParsedTrialBalance });
  } else if (localState?.trialBalance) {
    dispatch({ type: 'SET_TRIAL_BALANCE', payload: localState.trialBalance });
  }

  const adjResult = await fetchWithStatus<Record<string, unknown>>(
    `/api/adjustments/${companyId}`,
  );
  if (adjResult.data) {
    dispatch({ type: 'SET_ADJUSTMENTS', payload: adjResult.data as unknown as YearEndAdjustments });
  } else if (localState?.adjustments) {
    dispatch({ type: 'SET_ADJUSTMENTS', payload: localState.adjustments });
  }

  if (inferStepWhenNoLocal && !localState) {
    dispatch({
      type: 'SET_STEP',
      payload: inferStepFromServerData(tbResult, adjResult),
    });
  }
}

function loadBestLocalSession(preferredCompanyId: string): {
  companyId: string;
  state: AppState;
} | null {
  const preferred = loadSession(preferredCompanyId);
  if (preferred && hasCompanyName(preferred.company)) {
    return { companyId: preferredCompanyId, state: preferred };
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('me_session_')) continue;
    const companyId = key.slice('me_session_'.length);
    if (companyId === preferredCompanyId) continue;
    const candidate = loadSession(companyId);
    if (candidate && hasCompanyName(candidate.company)) {
      return { companyId, state: candidate };
    }
  }

  return preferred ? { companyId: preferredCompanyId, state: preferred } : null;
}

const AppInner: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { show: showToast } = useToast();
  const { lastSavedAt } = useSessionPersistence(state.company?.id);

  const [hasStarted, setHasStarted] = React.useState(false);
  const [isHydrating, setIsHydrating] = React.useState(() => Boolean(resolveStoredCompanyId()));

  React.useEffect(() => {
    const companyId = resolveStoredCompanyId();
    if (!companyId) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const restored = loadBestLocalSession(companyId);
      const localState = restored?.state ?? null;
      const sessionCompanyId = restored?.companyId ?? companyId;
      if (localState && !cancelled) {
        dispatch({ type: 'HYDRATE_STATE', payload: localState });
        localStorage.setItem('me_last_company_id', sessionCompanyId);
      }

      try {
        await mergeServerSession(sessionCompanyId, dispatch, localState, !localState);
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to restore session from server.';
          if (localState) {
            showToast(message, 'warning', 4000);
          } else {
            showToast(message, 'error', 4000);
          }
        }
      } finally {
        setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, showToast]);

  const stepIndex = WIZARD_STEPS.indexOf(state.currentStep);

  const canGoNext = React.useCallback(() => {
    if (stepIndex < 0 || stepIndex >= WIZARD_STEPS.length - 1) return false;
    const nextStep = WIZARD_STEPS[stepIndex + 1];
    const prereqs = PREREQS[nextStep] ?? [];
    return prereqs.every((p) => p.met(state));
  }, [state, stepIndex]);

  const canGoPrev = stepIndex > 0;

  const goNext = React.useCallback(() => {
    if (!canGoNext()) return;
    dispatch({ type: 'SET_STEP', payload: WIZARD_STEPS[stepIndex + 1] });
  }, [canGoNext, dispatch, stepIndex]);

  const goPrev = React.useCallback(() => {
    if (!canGoPrev) return;
    dispatch({ type: 'SET_STEP', payload: WIZARD_STEPS[stepIndex - 1] });
  }, [canGoPrev, dispatch, stepIndex]);

  const restoreCompanySession = React.useCallback(async (companyId: string) => {
    const localState = loadSession(companyId);
    if (localState) {
      dispatch({ type: 'HYDRATE_STATE', payload: localState });
    }
    localStorage.setItem('me_last_company_id', companyId);

    try {
      await mergeServerSession(companyId, dispatch, localState, !localState);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to restore client session.';
      showToast(message, localState ? 'warning' : 'error', 4000);
    }
  }, [dispatch, showToast]);

  const handleSwitchClient = React.useCallback((companyId: string) => {
    void restoreCompanySession(companyId);
    showToast('Switched client', 'success');
  }, [restoreCompanySession, showToast]);

  useKeyboardShortcuts([
    {
      key: 's',
      ctrl: true,
      description: 'Save session draft',
      handler: () => {
        if (state.company?.id) {
          saveSession(state, state.company.id);
          showToast('Session saved', 'success');
        }
      },
    },
    {
      key: 'ArrowRight',
      ctrl: true,
      description: 'Next wizard step',
      enabled: canGoNext(),
      handler: () => {
        if (!canGoNext()) return;
        goNext();
      },
    },
    {
      key: 'ArrowLeft',
      ctrl: true,
      description: 'Previous wizard step',
      enabled: canGoPrev,
      handler: () => {
        if (!canGoPrev) return;
        goPrev();
      },
    },
    {
      key: 'p',
      ctrl: true,
      description: 'Print statements',
      handler: () => {
        if (state.currentStep === 'review_statements') {
          window.print();
        }
      },
    },
  ]);

  const isDashboard = !hasStarted;

  const handleNavigate = (step: AppStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  const handleDismissError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  if (isHydrating || state.isLoading) {
    return <LoadingSpinner message={isHydrating ? 'Restoring session…' : 'Loading…'} fullPage />;
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
      companyId={state.company?.id}
      companyName={state.company?.companyName}
      fiscalYear={state.company?.fiscalYear?.bsFY}
      onSwitchClient={handleSwitchClient}
      lastSavedAt={lastSavedAt}
      headerTitle={stepInfo.title}
      headerSubtitle={stepInfo.subtitle}
      breadcrumb={['Home', stepInfo.title]}
      pageKey={state.currentStep}
      wizardFooter={(
        <WizardFooter
          canGoPrev={canGoPrev}
          canGoNext={canGoNext()}
          onPrev={goPrev}
          onNext={goNext}
          stepIndex={Math.max(stepIndex, 0)}
          totalSteps={WIZARD_STEPS.length}
        />
      )}
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
