// src/types/adjustments.ts

export enum DepreciationMethod {
  StraightLine = 'StraightLine',
  WrittenDownValue = 'WrittenDownValue',
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
  depreciationMethod: DepreciationMethod;
  wdvRate: number;
  accumDepreciationOpening: number;
  isFullyDepreciated: boolean;
  isMortgaged: boolean;
  disposed: boolean;
  disposalDateBS?: string;
  disposalValue?: number;
}

export interface AssetCategory {
  id: string;
  name: string;
  defaultMethod: string;
  defaultUsefulLife: number;
  defaultWDVRate: number;
  defaultResidualPct: number;
}

export interface DepreciationResult {
  assetId: string;
  assetName: string;
  categoryId: string;
  openingCost: number;
  additions: number;
  disposals: number;
  closingCost: number;
  openingAccumDepn: number;
  depnForYear: number;
  depnOnDisposal: number;
  closingAccumDepn: number;
  netBookValueOpening: number;
  netBookValueClosing: number;
  gainLossOnDisposal?: number;
  disposalProceeds?: number;
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
  additionsFullYear: number;
  additionsTwoThirds: number;
  additionsOneThird: number;
  disposals: number;
  depreciationBasis: number;
  taxDepreciation: number;
  closingBasis: number;
}

export interface ProvisionEntry {
  id?: string;
  provisionType: string;
  description?: string;
  openingBalance: number;
  additionForYear: number;
  utilisedDuringYear: number;
  reversedDuringYear?: number;
  closingBalance: number;
  classification?: 'Current' | 'Non-current';
}

export interface InventoryAdjustment {
  category: string;
  description?: string;
  costAmount: number;
  nrvAmount: number;
  impairmentAmount: number;
  writtenDownTo?: number;
}

export interface InvestmentAdjustment {
  investmentName: string;
  investmentType: 'listed_trading' | 'listed_ats' | 'unlisted';
  totalCost: number;
  units?: number;
  ltp?: number;
  marketValue?: number;
  fairValueGainLoss?: number;
  impairmentAmount?: number;
  carryingAmount?: number;
}

export interface JournalEntry {
  id?: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  linkedNoteRef?: string;
  isSystemGenerated?: boolean;
}

export interface YearEndAdjustments {
  companyId: string;
  fiscalYear: string;
  assets: AssetItem[];
  depreciationResults: DepreciationResult[];
  depreciationSummary: DepreciationSummary[];
  taxDepreciationPools: TaxDepreciationPool[];
  inventoryAdjustments: InventoryAdjustment[];
  investmentAdjustments: InvestmentAdjustment[];
  provisions: ProvisionEntry[];
  journalEntries: JournalEntry[];
  totalDepreciationExpense: number;
  totalInventoryImpairment: number;
  totalInvestmentFVAdjustment: number;
  totalProvisions: number;
  gainOnDisposals: number;
  lossOnDisposals: number;
  profitBeforeTax?: number;
  priorYearTax?: number;
  deferredTaxExpense?: number;
  taxDepreciation?: number;
  advanceTax1?: number;
  advanceTax2?: number;
  advanceTax3?: number;
  tdsCredit?: number;
  taxPools?: TaxDepreciationPool[];
  otherAdjustments?: any[];
  company?: any;
  taxableProfit?: number;
  currentTaxExpense?: number;
}
