// src/store/appStore.tsx
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type {
  AppStep,
  CompanyProfile,
  ParsedTrialBalance,
  YearEndAdjustments,
  BalanceSheet,
  IncomeStatement,
  ChangesInEquity,
  CashFlowStatement,
  NotesData,
} from '../types';

// ── State ─────────────────────────────────────────────────────────────────────

export interface AppState {
  currentStep: AppStep;
  completedSteps: AppStep[];
  company: CompanyProfile | null;
  trialBalance: ParsedTrialBalance | null;
  adjustments: YearEndAdjustments | null;
  balanceSheet: BalanceSheet | null;
  incomeStatement: IncomeStatement | null;
  changesInEquity: ChangesInEquity | null;
  cashFlow: CashFlowStatement | null;
  notes: NotesData | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AppState = {
  currentStep: 'company_setup',
  completedSteps: [],
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
};

// ── Actions ───────────────────────────────────────────────────────────────────

type AppAction =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'COMPLETE_STEP'; payload: AppStep }
  | { type: 'SET_COMPANY'; payload: CompanyProfile }
  | { type: 'SET_TRIAL_BALANCE'; payload: ParsedTrialBalance }
  | { type: 'SET_ADJUSTMENTS'; payload: YearEndAdjustments }
  | { type: 'SET_BALANCE_SHEET'; payload: BalanceSheet }
  | { type: 'SET_INCOME_STATEMENT'; payload: IncomeStatement }
  | { type: 'SET_CHANGES_IN_EQUITY'; payload: ChangesInEquity }
  | { type: 'SET_CASH_FLOW'; payload: CashFlowStatement }
  | { type: 'SET_NOTES'; payload: NotesData }
  | { type: 'SET_FINANCIALS'; payload: {
      balanceSheet: BalanceSheet;
      incomeStatement: IncomeStatement;
      changesInEquity: ChangesInEquity;
      cashFlow: CashFlowStatement;
      notes: NotesData;
    }}
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_TB_ROW_MAPPING'; payload: { rowIndex: number; nfrsCategory: import('../types').NFRSCategory; matchedLabel: string } }
  | { type: 'RESET_ALL' };

// ── Reducer ───────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload, error: null };

    case 'COMPLETE_STEP':
      if (state.completedSteps.includes(action.payload)) return state;
      return { ...state, completedSteps: [...state.completedSteps, action.payload] };

    case 'SET_COMPANY':
      return { ...state, company: action.payload };

    case 'SET_TRIAL_BALANCE':
      return { ...state, trialBalance: action.payload };

    case 'SET_ADJUSTMENTS':
      return { ...state, adjustments: action.payload };

    case 'SET_BALANCE_SHEET':
      return { ...state, balanceSheet: action.payload };

    case 'SET_INCOME_STATEMENT':
      return { ...state, incomeStatement: action.payload };

    case 'SET_CHANGES_IN_EQUITY':
      return { ...state, changesInEquity: action.payload };

    case 'SET_CASH_FLOW':
      return { ...state, cashFlow: action.payload };

    case 'SET_NOTES':
      return { ...state, notes: action.payload };

    case 'SET_FINANCIALS':
      return {
        ...state,
        balanceSheet: action.payload.balanceSheet,
        incomeStatement: action.payload.incomeStatement,
        changesInEquity: action.payload.changesInEquity,
        cashFlow: action.payload.cashFlow,
        notes: action.payload.notes,
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'UPDATE_TB_ROW_MAPPING': {
      if (!state.trialBalance) return state;
      const { rowIndex, nfrsCategory, matchedLabel } = action.payload;
      const rows = state.trialBalance.rows.map((row, i) =>
        i === rowIndex
          ? { ...row, nfrsCategory, matchedLabel, confidence: 100, needsReview: false }
          : row,
      );
      return { ...state, trialBalance: { ...state.trialBalance, rows } };
    }

    case 'RESET_ALL':
      return { ...initialState };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
