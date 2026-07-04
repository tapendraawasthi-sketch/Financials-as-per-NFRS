// src/types/index.ts — barrel export with legacy compatibility wideners

import type { CompanyProfile as CompanyProfileBase, AccountingPolicies as AccountingPoliciesBase, InventoryDetails } from './company';
import type { BalanceSheet as BalanceSheetBase, IncomeStatement as IncomeStatementBase, ChangesInEquity as ChangesInEquityBase, NotesData as NotesDataBase } from './financials';
import type { MappedTBRow as MappedTBRowBase, NFRSCategory, RawTBRow, RawTBParseResult, ParsedTrialBalance, NormalizedTrialBalancePreview } from './trialBalance';
import type { YearEndAdjustments as YearEndAdjustmentsBase, AssetRegisterEntry as AssetRegisterEntryBase, InvestmentAdjustment as InvestmentAdjustmentBase } from './adjustments';

export type { NFRSCategory, RawTBRow, RawTBParseResult, ParsedTrialBalance, InventoryDetails, PreviousYearBalances } from './company';
export type { NormalizedTrialBalancePreview } from './trialBalance';
export type { FiscalYearEntry as FiscalYearInfo } from '../data/fiscalYears';
export type { CashFlowStatement, PPENote, InvestmentsNote } from './financials';
export type { BankAccountDetail, CreditorEntry, DebtorEntry, RelatedPartyEntry } from './adjustments';

export type CompanyProfile = CompanyProfileBase & {
  id?: string;
  companyName?: string;
  panVatNumber?: string;
  registrationNumber?: string;
  companyType?: string;
  entityType?: string;
  province?: string;
  district?: string;
  municipality?: string;
  wardNumber?: string;
  tole?: string;
  fullAddress?: string;
  contactPerson?: string;
  designation?: string;
  phone?: string;
  email?: string;
  directors?: string[];
  nasCompliance?: Record<string, boolean>;
  fiscalYear?: import('../data/fiscalYears').FiscalYearEntry;
  previousFiscalYear?: import('../data/fiscalYears').FiscalYearEntry;
  accountingPolicies?: AccountingPolicies;
  auditorInfo?: { auditorName: string; auditorFirmName: string; position: string; icanRegNumber?: string };
  previousYearData?: Record<string, number>;
  numberOfEmployees?: number;
  annualTurnover?: number;
  bankBorrowings?: number;
  balanceSheetTotal?: number;
  fiduciaryAssets?: number;
};

export type AccountingPolicies = AccountingPoliciesBase & {
  incomeTaxRatePercent?: number;
  bonusRatePercent?: number;
  roundingLevel?: number;
  assetCategories?: Array<{ id: string; name: string; defaultMethod: string; defaultUsefulLife: number; defaultWDVRate: number; defaultResidualPct: number }>;
};

export type MappedTBRow = MappedTBRowBase & {
  matchedLabel?: string | null;
  candidates?: Array<{ label: string; nfrsCategory: string; confidence: number }>;
  closingBalance?: number;
};

export type AssetRegisterEntry = AssetRegisterEntryBase & {
  depnForYear?: number;
  gainLossOnDisposal?: number;
};

export type InvestmentAdjustment = InvestmentAdjustmentBase & {
  fairValueGainLoss?: number;
  investmentName?: string;
  investmentType?: string;
  totalCost?: number;
  carryingAmount?: number;
};

export type YearEndAdjustments = YearEndAdjustmentsBase & {
  companyId?: string;
  fiscalYear?: string;
  assets?: AssetItem[];
  depreciationResults?: DepreciationResult[];
  depreciationSummary?: DepreciationSummary[];
  taxDepreciationPools?: TaxDepreciationPool[];
  inventoryAdjustments?: InventoryAdjustment[];
  provisions?: ProvisionEntry[];
  journalEntries?: JournalEntry[];
  totalInvestmentFVAdjustment?: number;
  totalProvisions?: number;
  gainOnDisposals?: number;
  lossOnDisposals?: number;
  currentTaxExpense?: number;
  taxableProfit?: number;
};

export type BalanceSheet = BalanceSheetBase & Record<string, number | Partial<BalanceSheetBase> | boolean | string | undefined>;
export type IncomeStatement = IncomeStatementBase & Record<string, number | Partial<IncomeStatementBase> | undefined>;

export type ChangesInEquity = ChangesInEquityBase & Record<string, number | undefined | ChangesInEquityBase['rows']>;
export type NotesData = NotesDataBase & Record<string, unknown>;

export type AppStep =
  | 'company_setup'
  | 'accounting_policies'
  | 'trial_balance_upload'
  | 'trial_balance_mapping'
  | 'subledger_details'
  | 'year_end_adjustments'
  | 'review_statements'
  | 'generate_output';

export type MatchMethod = MappedTBRowBase['matchMethod'];

export interface ProvisionEntry {
  id?: string;
  provisionType: string;
  openingBalance: number;
  additionForYear: number;
  utilisedDuringYear: number;
  closingBalance: number;
}

export interface InventoryAdjustment {
  category: string;
  costAmount: number;
  nrvAmount: number;
  impairmentAmount: number;
}

export interface AssetItem {
  id: string;
  assetName: string;
  categoryId: string;
  purchaseDateBS: string;
  originalCost: number;
  additionalCost: number;
  usefulLifeYears: number;
  residualValue: number;
  depreciationMethod: string;
  wdvRate: number;
  accumDepreciationOpening: number;
  isFullyDepreciated: boolean;
  isMortgaged: boolean;
  disposed: boolean;
  disposalDateBS?: string;
  disposalValue?: number;
}

export interface DepreciationResult {
  assetId: string;
  depnForYear: number;
  gainLossOnDisposal?: number;
  netBookValueClosing: number;
}

export interface DepreciationSummary {
  categoryId: string;
  categoryName: string;
  openingCost: number;
  additions: number;
  disposals: number;
  closingCost: number;
  openingAccumDepn: number;
  depnForYear: number;
  depnOnDisposal: number;
  closingAccumDepn: number;
  netBookValueClosing: number;
  assets: DepreciationResult[];
}

export interface TaxDepreciationPool {
  pool: string;
  poolName: string;
  rate: number;
  openingBasis: number;
  additions?: number;
  disposals?: number;
  absorbed?: number;
  unabsorbed?: number;
  depreciationBasis?: number;
  taxDepreciation: number;
  closingBasis: number;
  nextYearBasis?: number;
  repairExpense?: number;
}

export interface JournalEntry {
  id?: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
}

export enum DepreciationMethod {
  StraightLine = 'StraightLine',
  WrittenDownValue = 'WrittenDownValue',
}
