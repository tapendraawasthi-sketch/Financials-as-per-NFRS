// src/types/index.ts — barrel export

export type { CompanyProfile, AccountingPolicies, PreviousYearBalances, FiscalYearInfo, AuditorInfo, AssetCategory as CompanyAssetCategory } from './company';
export type {
  NFRSCategory,
  MatchMethod,
  RawTBRow,
  MappedTBRow,
  ParsedTrialBalance,
} from './trialBalance';
export {
  DepreciationMethod,
} from './adjustments';
export type {
  AssetItem,
  AssetCategory,
  DepreciationResult,
  DepreciationSummary,
  TaxDepreciationPool,
  ProvisionEntry,
  InventoryAdjustment,
  InvestmentAdjustment,
  JournalEntry,
  YearEndAdjustments,
} from './adjustments';
export type {
  BalanceSheet,
  IncomeStatement,
  ChangesInEquity,
  CashFlowStatement,
  NotesData,
} from './financials';

// App-level types
export type AppStep =
  | 'company_setup'
  | 'accounting_policies'
  | 'trial_balance_upload'
  | 'trial_balance_mapping'
  | 'subledger_details'
  | 'year_end_adjustments'
  | 'review_statements'
  | 'generate_output';
