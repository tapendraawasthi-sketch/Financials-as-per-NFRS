// ===== src/store/appStore.ts =====
// Global application state management using React Context + useReducer.
// No external state library required — this is the single source of truth
// for the entire NFRS financial reporting session.
//
// Usage:
//   Wrap your app in <AppProvider>
//   Access state with useAppState()
//   Dispatch actions with useAppDispatch()
//   Or get both with useAppStore()

import React from 'react';

import type {
  AppState,
  AppStep,
  BalanceSheet,
  CashFlowStatement,
  ChangesInEquity,
  CompanyProfile,
  IncomeStatement,
  MappedTBRow,
  NFRSCategory,
  NotesData,
  ParsedTrialBalance,
  YearEndAdjustments,
} from '../types';

// ---------------------------------------------------------------------------
// 1. AppAction — discriminated union of all dispatchable actions
// ---------------------------------------------------------------------------
export type AppAction =
  | { type: 'SET_COMPANY'; payload: CompanyProfile }
  | { type: 'SET_TRIAL_BALANCE'; payload: ParsedTrialBalance }
  | {
      type: 'UPDATE_TB_ROW_MAPPING';
      payload: { rowIndex: number; nfrsCategory: NFRSCategory; matchedLabel: string };
    }
  | { type: 'SET_ADJUSTMENTS'; payload: YearEndAdjustments }
  | { type: 'SET_BALANCE_SHEET'; payload: BalanceSheet }
  | { type: 'SET_INCOME_STATEMENT'; payload: IncomeStatement }
  | { type: 'SET_CHANGES_IN_EQUITY'; payload: ChangesInEquity }
  | { type: 'SET_CASH_FLOW'; payload: CashFlowStatement }
  | { type: 'SET_NOTES'; payload: NotesData }
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'COMPLETE_STEP'; payload: AppStep }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESTORE_STATE'; payload: AppState }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_ALL' };

// ---------------------------------------------------------------------------
// 2. initialAppState
// ---------------------------------------------------------------------------
export const initialAppState: AppState = {
  currentStep: 'company_setup',
  company: null,
  trialBalance: null,
  adjustments: null,
  balanceSheet: null,
  incomeStatement: null,
  changesInEquity: null,
  cashFlow: null,
  notes: null,
  isLoading: false,
  error: null,
  completedSteps: [],
};

// ---------------------------------------------------------------------------
// 3. appReducer
// ---------------------------------------------------------------------------
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {

    case 'SET_COMPANY':
      return { ...state, company: action.payload, error: null };

    case 'SET_TRIAL_BALANCE':
      return { ...state, trialBalance: action.payload, error: null };

    case 'UPDATE_TB_ROW_MAPPING': {
      if (!state.trialBalance) return state;

      const { rowIndex, nfrsCategory, matchedLabel } = action.payload;
      const updatedRows: MappedTBRow[] = state.trialBalance.rows.map(
        (row, idx) => {
          if (idx !== rowIndex) return row;
          return {
            ...row,
            nfrsCategory,
            matchedLabel,
            confidence: 100,
            matchMethod: 'manual' as const,
            needsReview: false,
            userOverride: 'true',
          };
        },
      );

      return {
        ...state,
        trialBalance: {
          ...state.trialBalance,
          rows: updatedRows,
        },
        error: null,
      };
    }

    case 'SET_ADJUSTMENTS':
      return { ...state, adjustments: action.payload, error: null };

    case 'SET_BALANCE_SHEET':
      return { ...state, balanceSheet: action.payload, error: null };

    case 'SET_INCOME_STATEMENT':
      return { ...state, incomeStatement: action.payload, error: null };

    case 'SET_CHANGES_IN_EQUITY':
      return { ...state, changesInEquity: action.payload, error: null };

    case 'SET_CASH_FLOW':
      return { ...state, cashFlow: action.payload, error: null };

    case 'SET_NOTES':
      return { ...state, notes: action.payload, error: null };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'COMPLETE_STEP': {
      const alreadyCompleted = state.completedSteps.includes(action.payload);
      if (alreadyCompleted) return state;
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload],
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
      
    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'RESTORE_STATE':
      return action.payload;

    case 'RESET_ALL':
      return { ...initialAppState };

    default:
      // TypeScript exhaustiveness check — if all cases are handled this is never reached
      return state;
  }
}

// ---------------------------------------------------------------------------
// 4. AppContext
// ---------------------------------------------------------------------------
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const AppContext = React.createContext<AppContextValue | undefined>(
  undefined,
);
AppContext.displayName = 'AppContext';

// ---------------------------------------------------------------------------
// 5. AppProvider (Enhanced with session persistence)
// ---------------------------------------------------------------------------
interface AppProviderProps {
  children: React.ReactNode;
}

const SESSION_KEY = 'nfrs_session';

// Strip any binary buffer data before saving (buffers are too large for sessionStorage)
function sanitizeForStorage(state: AppState): AppState {
  return {
    ...state,
    // Don't persist the raw file buffer — only the parsed data
    trialBalance: state.trialBalance
      ? { ...state.trialBalance }
      : null,
  };
}

function loadFromStorage(): AppState | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as AppState;
    // Basic shape validation
    if (!parsed || typeof parsed !== 'object' || !parsed.currentStep) return null;
    return parsed;
  } catch {
    return null;
  }
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function saveToStorage(state: AppState): void {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      const sanitized = sanitizeForStorage(state);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
    } catch (err) {
      // Storage quota exceeded or unavailable — silently ignore
      console.warn('[AppStore] Failed to persist session:', err);
    }
  }, 2000);
}

export function AppProvider({ children }: AppProviderProps): React.ReactElement {
  const [state, dispatch] = React.useReducer(appReducer, initialAppState, (initial: AppState) => {
    // On first render, try to restore from sessionStorage
    const restored = loadFromStorage();
    return restored ?? initial;
  });

  // Save state to sessionStorage whenever it changes (debounced)
  React.useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const contextValue = React.useMemo(
    () => ({ state, dispatch }),
    [state, dispatch],
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// 6. useAppStore — returns both state and dispatch
// ---------------------------------------------------------------------------
export function useAppStore(): AppContextValue {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error(
      'useAppStore must be used inside an <AppProvider>. ' +
        'Wrap your application root with <AppProvider> before calling this hook.',
    );
  }
  return context;
}

// ---------------------------------------------------------------------------
// 7. useAppState — convenience hook for read-only state access
// ---------------------------------------------------------------------------
export function useAppState(): AppState {
  return useAppStore().state;
}

// ---------------------------------------------------------------------------
// 8. useAppDispatch — convenience hook for dispatch-only access
// ---------------------------------------------------------------------------
export function useAppDispatch(): React.Dispatch<AppAction> {
  return useAppStore().dispatch;
}
