// ===== src/types/index.ts =====
// Barrel export file — re-exports every public type from all sub-modules so
// consumers can import from '@/types' without knowing the exact file layout.

export * from './company';
export * from './trialBalance';
export * from './adjustments';
export * from './financials';

// ---------------------------------------------------------------------------
// AppStep — the ordered wizard navigation steps of the application
// ---------------------------------------------------------------------------
export type AppStep =
  | 'company_setup'
  | 'accounting_policies'
  | 'trial_balance_upload'
  | 'trial_balance_mapping'
  | 'subledger_details'
  | 'year_end_adjustments'
  | 'review_statements'
  | 'generate_output';

// ---------------------------------------------------------------------------
// AppState — top-level React application state shape
// ---------------------------------------------------------------------------
import type { CompanyProfile } from './company';
import type { ParsedTrialBalance } from './trialBalance';
import type { YearEndAdjustments } from './adjustments';
import type {
  BalanceSheet,
  CashFlowStatement,
  ChangesInEquity,
  IncomeStatement,
  NotesData,
} from './financials';

export interface AppState {
  /** Which wizard step the user is currently on */
  currentStep: AppStep;
  /** Company/engagement profile entered in Step 1 */
  company: CompanyProfile | null;
  /** Parsed and mapped trial balance from Step 3–4 */
  trialBalance: ParsedTrialBalance | null;
  /** All year-end adjustments computed in Step 6 */
  adjustments: YearEndAdjustments | null;
  /** Computed Balance Sheet ready for review/export */
  balanceSheet: BalanceSheet | null;
  /** Computed Income Statement */
  incomeStatement: IncomeStatement | null;
  /** Computed Statement of Changes in Equity */
  changesInEquity: ChangesInEquity | null;
  /** Computed Statement of Cash Flows */
  cashFlow: CashFlowStatement | null;
  /** All notes to financial statements */
  notes: NotesData | null;
  /** True while any async operation (upload, AI call, generation) is in flight */
  isLoading: boolean;
  /** Last unhandled error message, null when clear */
  error: string | null;
  /** Steps the user has successfully completed, used to render progress */
  completedSteps: AppStep[];
}
