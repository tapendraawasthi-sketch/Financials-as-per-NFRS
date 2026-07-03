// src/types/trialBalance.ts

export type NFRSCategory =
  // Non-Current Assets — PPE
  | 'ppe_land'
  | 'ppe_buildings'
  | 'ppe_plant_machinery'
  | 'ppe_furniture'
  | 'ppe_vehicles'
  | 'ppe_computers'
  | 'ppe_office_equipment'
  | 'ppe_intangibles'
  | 'ppe_cwip'
  | 'accum_depreciation'
  // Non-Current Assets — Investments
  | 'investment_listed_trading'
  | 'investment_unlisted'
  | 'investment_fixed_deposit_noncurrent'
  // Non-Current Assets — Other
  | 'nca_deposits'
  | 'nca_loans_advances'
  | 'nca_other'
  | 'nca_held_for_sale'
  | 'biological_assets'
  | 'provision_impairment_investment'
  | 'related_party_receivable'
  // Current Assets — Trade Receivables
  | 'trade_receivables'
  | 'provision_impairment_debtors'
  // Current Assets — Other Receivables
  | 'other_receivables_advance_supplier'
  | 'other_receivables_prepayments'
  | 'other_receivables_staff_advance'
  | 'other_receivables_tds'
  | 'other_receivables_loans'
  | 'other_receivables_other'
  // Current Assets — Cash & Bank
  | 'cash_in_hand'
  | 'bank_current_account'
  | 'bank_savings_account'
  | 'bank_fixed_deposit_current'
  // Current Assets — Inventories
  | 'inventory_raw_materials'
  | 'inventory_wip'
  | 'inventory_finished_goods'
  // Other Current Assets
  | 'advance_tax_paid'
  | 'other_current_assets'
  // Equity
  | 'share_capital'
  | 'share_premium'
  | 'general_reserve'
  | 'retained_earnings'
  | 'other_reserves'
  // Non-Current Liabilities
  | 'borrowings_noncurrent_bank'
  | 'borrowings_noncurrent_other'
  | 'deferred_tax_liability'
  | 'employee_benefit_gratuity'
  | 'provisions_noncurrent'
  // Current Liabilities
  | 'borrowings_current_od'
  | 'borrowings_current_cc'
  | 'borrowings_current_wc'
  | 'borrowings_current_portion_lt'
  | 'trade_payables_creditors'
  | 'trade_payables_advance_customers'
  | 'tds_payable'
  | 'other_payables'
  | 'income_tax_payable'
  | 'audit_fee_payable'
  | 'employee_payables_salary'
  | 'employee_payables_bonus'
  | 'employee_payables_pf'
  | 'provisions_current'
  | 'dividend_payable'
  | 'related_party_payable'
  // Income
  | 'revenue_sales'
  | 'revenue_services'
  | 'other_income_interest'
  | 'other_income_dividend'
  | 'other_income_rental'
  | 'other_income_disposal_gain'
  | 'other_income_misc'
  // Expenses — COGS
  | 'cogs_purchases'
  | 'cogs_opening_stock'
  | 'direct_wages'
  | 'direct_expenses_other'
  // Expenses — Employee
  | 'emp_expense_salaries'
  | 'emp_expense_pf'
  | 'emp_expense_gratuity'
  | 'emp_expense_welfare'
  | 'emp_expense_bonus'
  | 'emp_expense_other'
  // Expenses — Finance
  | 'finance_cost_interest'
  | 'finance_cost_bank_charges'
  // Expenses — Admin
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
  // Expenses — Depreciation/Impairment
  | 'depreciation_expense'
  | 'impairment_expense'
  // Expenses — Tax
  | 'income_tax_expense'
  // Unclassified
  | 'unclassified';

export type MatchMethod =
  | 'exact'
  | 'synonym'
  | 'nepali_romanized'
  | 'keyword'
  | 'context'
  | 'fuzzy'
  | 'ai'
  | 'manual'
  | 'unmatched';

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
  rowLevel: number;
  isGroupRow: boolean;
  parentGroup: string;
  rawIndentSpaces: number;
}

export interface MappedTBRow extends RawTBRow {
  nfrsCategory: NFRSCategory | 'unclassified';
  matchedLabel: string | null;
  confidence: number;
  matchMethod: MatchMethod | string;
  needsReview: boolean;
  candidates: Array<{
    label: string;
    nfrsCategory: NFRSCategory | 'unclassified';
    confidence: number;
  }>;
  userOverride?: boolean | string;
  closingBalance?: number;
}

export interface ParsedTrialBalance {
  rows: MappedTBRow[];
  totalOpeningDr: number;
  totalOpeningCr: number;
  totalDuringDr: number;
  totalDuringCr: number;
  totalClosingDr: number;
  totalClosingCr: number;
  isBalanced: boolean;
  difference: number;
  warnings: string[];
  detectedColumns: Record<string, number>;
  headerRowIndex: number;
  detectedFormat: string;
  companyId?: string;
  uploadedAt?: string;
  uploadedFileName?: string;
  stats?: {
    totalDebit: number;
    totalCredit: number;
    rowCount: number;
  };
}
