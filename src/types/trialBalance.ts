// ─── NFRS Category ────────────────────────────────────────────────────────────
// All NFRS/NAS balance sheet and income statement account categories

export type NFRSCategory =
  // ── Non-Current Assets ──────────────────────────────────────────────────────
  | 'ppe_land'
  | 'ppe_buildings'
  | 'ppe_vehicles'
  | 'ppe_office_equipment'
  | 'ppe_computers'
  | 'ppe_furniture'
  | 'ppe_plant_machinery'
  | 'ppe_intangibles'
  | 'ppe_cwip'
  | 'accum_depreciation'
  | 'investment_listed_trading'
  | 'investment_listed_ats'
  | 'investment_unlisted'
  | 'investment_fixed_deposit_noncurrent'
  | 'nca_loans_advances'
  | 'nca_deposits'
  | 'nca_other'
  // ── Current Assets ──────────────────────────────────────────────────────────
  | 'inventory_raw_materials'
  | 'inventory_wip'
  | 'inventory_finished_goods'
  | 'trade_receivables'
  | 'provision_impairment_debtors'
  | 'other_receivables_loans'
  | 'other_receivables_deposits'
  | 'other_receivables_prepayments'
  | 'other_receivables_advance_supplier'
  | 'other_receivables_staff_advance'
  | 'other_receivables_tds'
  | 'other_receivables_related_party'
  | 'other_receivables_other'
  | 'cash_in_hand'
  | 'bank_current_account'
  | 'bank_savings_account'
  | 'bank_fixed_deposit_current'
  | 'investment_current'
  // ── Equity ──────────────────────────────────────────────────────────────────
  | 'share_capital'
  | 'share_premium'
  | 'general_reserve'
  | 'retained_earnings'
  | 'other_reserves'
  // ── Non-Current Liabilities ─────────────────────────────────────────────────
  | 'borrowings_noncurrent_bank'
  | 'borrowings_noncurrent_other'
  | 'employee_benefit_gratuity'
  | 'employee_benefit_leave'
  | 'provisions_noncurrent'
  | 'deferred_tax_liability'
  // ── Current Liabilities ─────────────────────────────────────────────────────
  | 'borrowings_current_od'
  | 'borrowings_current_cc'
  | 'borrowings_current_wc'
  | 'borrowings_current_portion_lt'
  | 'trade_payables_creditors'
  | 'trade_payables_advance_customers'
  | 'employee_payables_salary'
  | 'employee_payables_bonus'
  | 'employee_payables_pf'
  | 'tds_payable'
  | 'audit_fee_payable'
  | 'income_tax_payable'
  | 'other_payables'
  | 'provisions_current'
  | 'related_party_payable'
  // ── Income ───────────────────────────────────────────────────────────────────
  | 'revenue_sales'
  | 'revenue_services'
  | 'other_income_interest'
  | 'other_income_dividend'
  | 'other_income_rental'
  | 'other_income_fv_gain'
  | 'other_income_disposal_gain'
  | 'other_income_misc'
  // ── Expenses ─────────────────────────────────────────────────────────────────
  | 'cogs_purchases'
  | 'cogs_opening_stock'
  | 'direct_wages'
  | 'direct_expenses_other'
  | 'emp_expense_salaries'
  | 'emp_expense_pf'
  | 'emp_expense_gratuity'
  | 'emp_expense_bonus'
  | 'emp_expense_welfare'
  | 'emp_expense_other'
  | 'finance_cost_interest'
  | 'finance_cost_bank_charges'
  | 'depreciation_expense'
  | 'impairment_expense'
  | 'admin_rent'
  | 'admin_rates_taxes'
  | 'admin_insurance'
  | 'admin_repairs'
  | 'admin_electricity'
  | 'admin_communication'
  | 'admin_printing'
  | 'admin_legal_professional'
  | 'admin_traveling'
  | 'admin_audit_fee'
  | 'admin_other'
  | 'income_tax_expense'
  | 'unclassified';

// ─── Match Method ─────────────────────────────────────────────────────────────

export type MatchMethod =
  | 'exact'
  | 'synonym'
  | 'fuzzy'
  | 'ai'
  | 'keyword'
  | 'manual'
  | 'unmatched';

// ─── Raw Trial Balance Row ────────────────────────────────────────────────────
// Direct output from Excel parsing, before any AI/fuzzy mapping

export interface RawTBRow {
  rowIndex: number;
  rawLabel: string;
  openingDr: number;
  openingCr: number;
  duringDr: number;
  duringCr: number;
  adjustmentDr: number;
  adjustmentCr: number;
  closingDr: number;
  closingCr: number;
}

// ─── Mapped Trial Balance Row ─────────────────────────────────────────────────
// After NFRS category matching — includes all raw columns plus mapping metadata

export interface MappedTBRow {
  rowIndex: number;
  rawLabel: string;
  matchedLabel: string | null;
  nfrsCategory: NFRSCategory;
  confidence: number;                   // 0–100
  matchMethod: MatchMethod;
  candidates: Array<{
    label: string;
    nfrsCategory: NFRSCategory;
    confidence: number;
  }>;
  openingDr: number;
  openingCr: number;
  duringDr: number;
  duringCr: number;
  adjustmentDr: number;
  adjustmentCr: number;
  closingDr: number;
  closingCr: number;
  closingBalance: number;               // positive = debit, negative = credit
  needsReview: boolean;                 // true if confidence < 80 or unmatched
  userOverride?: string;                // if user manually changed the category
  notes?: string;                       // any user notes about this account
}

// ─── Trial Balance Validation Result ─────────────────────────────────────────

export interface TBValidationResult {
  isBalanced: boolean;
  totalOpeningDr: number;
  totalOpeningCr: number;
  totalDuringDr: number;
  totalDuringCr: number;
  totalClosingDr: number;
  totalClosingCr: number;
  difference: number;
  openingDifference: number;
  duringDifference: number;
  warnings: string[];
  errors: string[];
  unmappedAccounts: string[];
  negativBalanceWarnings: string[];     // accounts with unexpected balance signs
}

// ─── Parsed Trial Balance ─────────────────────────────────────────────────────
// Top-level object representing a fully parsed + mapped trial balance upload

export interface ParsedTrialBalance {
  companyId: string;
  fiscalYear: string;
  uploadedFileName: string;
  uploadedAt: string;
  rows: MappedTBRow[];
  validation: TBValidationResult;
  totalRows: number;
  autoMappedCount: number;
  needsReviewCount: number;
  unmatchedCount: number;
  hasAdjustments: boolean;              // true if any adjustment columns have non-zero values
}

// ─── Sub-Ledger Entry ─────────────────────────────────────────────────────────
// For sundry debtors / creditors / bank detail breakdowns

export interface SubLedgerEntry {
  id: string;
  accountType:
    | 'debtor'
    | 'creditor'
    | 'bank'
    | 'related_party'
    | 'investment'
    | 'loan';
  partyName: string;
  accountNumber?: string;
  bankName?: string;
  openingBalance: number;               // positive = Dr, negative = Cr
  closingBalance: number;
  duringDr: number;
  duringCr: number;
  notes?: string;
}
