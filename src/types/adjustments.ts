export interface AssetRegisterEntry {
  id: string;
  assetClass: string;     // 'Land'|'Building'|'OfficeEquipment'|'Vehicle'|
                          // 'PlantMachinery'|'Intangible'|'UnderConstruction'
  assetName: string;
  purchaseDate: string;   // BS date
  originalCost: number;
  additionsCY: number;
  disposalDate?: string;
  disposalValue?: number;
  depreciationMethodOverride?: 'SLM' | 'WDV';
  rateOverride?: number;
  accumulatedDepnPY: number;
  // Computed
  depreciationCY?: number;
  accumulatedDepnCY?: number;
  netBookValueCY?: number;
  netBookValuePY?: number;
}

export interface InvestmentAdjustment {
  id: string;
  type: 'listed' | 'unlisted';
  name: string;
  units?: number;
  costPerUnit?: number;
  totalCost: number;
  fairValuePerUnit?: number;
  totalFairValue?: number;
  impairmentAmount?: number;
  gainLossOnFV?: number;
}

export interface BankAccountDetail {
  id: string;
  bankName: string;
  accountNumber: string;
  type: 'Current'|'Savings'|'Call'|'FixedDeposit'|'Loan'|'Overdraft'|'CashCredit'|'WorkingCapital';
  balanceCY: number;
  balancePY: number;
  isNonCurrent: boolean;    // if loan maturity > 12 months
  loanDetails?: {
    sanctionedAmount: number;
    interestRate: number;
    emiAmount: number;
    maturityDate: string;
    security: string;
  };
}

export interface DebtorEntry {
  id: string;
  name: string;
  isRelatedParty: boolean;
  balanceCY: number;
  balancePY: number;
  ageCategory: '<30days'|'31-60days'|'61-90days'|'>90days';
  isAdvanceFromCustomer: boolean;
}

export interface CreditorEntry {
  id: string;
  name: string;
  isRelatedParty: boolean;
  balanceCY: number;
  balancePY: number;
}

export interface RelatedPartyEntry {
  id: string;
  name: string;
  relationship: string;    // Director, Shareholder, Subsidiary, Associate, etc.
  transactionType: 'Receivable'|'Payable'|'Purchase'|'Sale'|'Loan'|'Other';
  balanceCY: number;
  balancePY: number;
  transactionAmount: number;
  interestRate?: number;
  terms: string;
}

export interface InventoryDetails {
  rawMaterialsCY: number;
  rawMaterialsPY: number;
  wipCY: number;
  wipPY: number;
  finishedGoodsCY: number;
  finishedGoodsPY: number;
}

export interface JournalLine {
  id: string;
  groupId: string;
  lineType: 'Dr' | 'Cr';
  account: string;
  amount: number;
  linkedTo?: string;
  source: 'System' | 'Manual' | 'Upload';
}

export interface JournalEntryGroup {
  groupId: string;
  narration: string;
  lines: JournalLine[];
  totalDr: number;
  totalCr: number;
  isBalanced: boolean;
}

export interface YearEndAdjustments {
  // Depreciation
  assetRegister: AssetRegisterEntry[];
  totalDepreciationExpense: number;
  // Investments
  investmentAdjustments: InvestmentAdjustment[];
  // Provisions
  staffBonusProvision: number;     // auto-computed from PBT × bonus rate
  staffBonusPayablePY: number;
  incomeTaxProvision: number;      // auto-computed after bonus
  incomeTaxPaidPY: number;
  // Subledgers
  bankAccounts: BankAccountDetail[];
  debtors: DebtorEntry[];
  creditors: CreditorEntry[];
  relatedParties: RelatedPartyEntry[];
  // Inventory
  inventoryDetails: {
    rawMaterialsCY: number; rawMaterialsPY: number;
    wipCY: number; wipPY: number;
    finishedGoodsCY: number; finishedGoodsPY: number;
  };
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
  taxableProfit?: number;
  currentTaxExpense?: number;
  dividendPayable?: number;
  // Tax depreciation (Nepal Income Tax Act pool method)
  taxDepPool: Array<{
    poolName: string;
    rate: number;
    openingBasis: number;
    additions: number;
    disposals: number;
    absorbed: number;
    unabsorbed: number;
    nextYearBasis: number;
    repairExpense: number;
  }>;
  // Manual journals
  manualJournals: Array<{
    id: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    type?: string;
    source?: string;
  }>;
  /** User chose to skip uploading adjustment journal entries. */
  journalEntriesSkipped?: boolean;
  manualJournalGroups?: JournalEntryGroup[];
  adjustedTrialBalance?: import('./trialBalance').ParsedTrialBalance;
  allComputedGroups?: JournalEntryGroup[];
  // Disallowed expenses for tax
  disallowedForTax: Array<{
    description: string;
    amount: number;
    section: string;
    side?: 'income' | 'expense';
    asPerBooks?: number;
  }>;
  /** Key Management Personnel compensation (Note 3.20 sub-table). */
  kmpCompensation?: {
    salary: number;
    bonus: number;
    otherBenefits: number;
  };
  /** Prior-year loss balances for u/s 20 carry-forward schedule. */
  priorYearLosses?: Array<{ fiscalYear: string; amount: number }>;
  assets?: import('./index').AssetItem[];
  depreciationResults?: import('./index').DepreciationResult[];
  journalEntries?: import('./index').JournalEntry[];
  taxDepreciationPools?: import('./index').TaxDepreciationPool[];
}
