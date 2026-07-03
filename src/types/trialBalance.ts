// ─── NFRS Category ────────────────────────────────────────────────────────────
// All NFRS/NAS balance sheet and income statement account categories

export type NFRSCategory =
  // ── Non-Current Assets — PPE ─────────────────────────────────────────────
  | 'ppe_land'
  | 'ppe_buildings'
  | 'ppe_plant_machinery'
  | 'ppe_furniture'
  | 'ppe_vehicles'
  | 'ppe_computers'
  | 'ppe_office_equipment'
  | 'ppe_cwip'
  | 'accum_depreciation'
  | 'ppe_intangibles'
  // ── Non-Current Assets — Investments ─────────────────────────────────────
  | 'investment_listed_trading'
  | 'investment_listed_ats'
  | 'investment_unlisted'
  | 'investment_fixed_deposit_noncurrent'
  // ── Non-Current Assets — Other ────────────────────────────────────────────
  | 'nca_other'
  | 'nca_loans_advances'
  | 'nca_deposits'
  | 'biological_assets'         // NEW: NAS for MEs Note 3.5
  | 'nca_held_for_sale'         // NEW: Non-current assets held for sale
  | 'provision_impairment_investment'  // NEW: impairment on investments
  // ── Current Assets — Trade Receivables ───────────────────────────────────
  | 'trade_receivables'
  | 'provision_impairment_debtors'
  // ── Current Assets — Cash & Bank ─────────────────────────────────────────
  | 'cash_in_hand'
  | 'bank_current_account'
  | 'bank_savings_account'
  | 'bank_fixed_deposit_current'
  // ── Current Assets — Inventories ──────────────────────────────────────────
  | 'inventory_raw_materials'
  | 'inventory_wip'
  | 'inventory_finished_goods'
  // ── Current Assets — Other ────────────────────────────────────────────────
  | 'other_receivables_tds'
  | 'other_receivables_advance_supplier'
  | 'other_receivables_prepayments'
  | 'other_receivables_staff_advance'
  | 'other_receivables_loans'
  | 'other_receivables_other'
  | 'advance_tax_paid'
  | 'related_party_receivable'  // NEW: Receivable from directors/related parties
  // ── Equity ────────────────────────────────────────────────────────────────
  | 'share_capital'
  | 'share_premium'
  | 'general_reserve'
  | 'retained_earnings'
  | 'other_reserves'
  // ── Non-Current Liabilities ───────────────────────────────────────────────
  | 'borrowings_noncurrent_bank'
  | 'borrowings_noncurrent_other'
  | 'borrowings_noncurrent_debentures'
  | 'deferred_tax_liability'
  | 'employee_benefit_gratuity'
  | 'provisions_noncurrent'
  // ── Current Liabilities — Borrowings ──────────────────────────────────────
  | 'borrowings_current_od'
  | 'borrowings_current_cc'
  | 'borrowings_current_wc'
  | 'borrowings_current_portion_lt'
  // ── Current Liabilities — Trade Payables ──────────────────────────────────
  | 'trade_payables_creditors'
  | 'trade_payables_advance_customers'
  // ── Current Liabilities — Employee & Statutory ────────────────────────────
  | 'employee_payables_salary'
  | 'employee_payables_bonus'
  | 'employee_payables_pf'
  | 'tds_payable'
  | 'other_payables'
  | 'income_tax_payable'
  | 'audit_fee_payable'
  | 'provisions_current'
  | 'dividend_payable'          // NEW: Dividend declared but not yet paid
  | 'related_party_payable'     // NEW: Loan from director / related party payable
  // ── Revenue / Income ──────────────────────────────────────────────────────
  | 'revenue_sales'
  | 'revenue_services'
  | 'other_income_interest'
  | 'other_income_dividend'
  | 'other_income_rental'
  | 'other_income_disposal_gain'
  | 'other_income_misc'
  // ── Cost of Goods Sold ────────────────────────────────────────────────────
  | 'cogs_purchases'
  | 'cogs_opening_stock'
  | 'direct_wages'
  | 'direct_expenses_other'
  | 'direct_expenses_wages'     // NEW: explicit wages sub-category
  // ── Employee Benefit Expenses ─────────────────────────────────────────────
  | 'emp_expense_salaries'
  | 'emp_expense_pf'
  | 'emp_expense_gratuity'
  | 'emp_expense_welfare'
  | 'emp_expense_bonus'
  | 'emp_expense_other'
  | 'emp_expense_leave'
  // ── Finance Costs ─────────────────────────────────────────────────────────
  | 'finance_cost_interest'
  | 'finance_cost_bank_charges'
  | 'interest_expense_bank'     // NEW: explicit bank interest sub-category
  | 'bank_charges'              // NEW: explicit bank charges sub-category
  // ── Administrative Expenses ───────────────────────────────────────────────
  | 'admin_rent'
  | 'admin_rates_taxes'
  | 'admin_insurance'
  | 'admin_repairs'
  | 'admin_electricity'
  | 'admin_communication'
  | 'admin_printing'
  | 'admin_legal_professional'
  | 'admin_audit_fee'
  | 'admin_traveling'
  | 'admin_advertisement'
  | 'admin_other'
  // ── Depreciation & Impairment ─────────────────────────────────────────────
  | 'depreciation_expense'
  | 'impairment_expense'
  // ── Tax ───────────────────────────────────────────────────────────────────
  | 'income_tax_expense'
  // ── Catch-all ─────────────────────────────────────────────────────────────
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
