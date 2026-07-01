// ===== server/services/taxEngine.ts =====
import type { IncomeStatement } from '../../src/types';

// ---------------------------------------------------------------------------
// 1. TAX_RATES
// ---------------------------------------------------------------------------
export const TAX_RATES = {
  STANDARD_COMPANY: 25,
  LISTED_COMPANY: 20,
  MANUFACTURING: 20,
  HYDROPOWER: 0,
  SPECIAL_ECONOMIC_ZONE: 10,
  EXPORT_INCOME: 20,
  AGRICULTURAL: 0,
  COOPERATIVE: 10,
  PARTNERSHIP_INDIVIDUAL_TAX: true,
} as const;

// ---------------------------------------------------------------------------
// 2. computeIncomeTax
// ---------------------------------------------------------------------------
export interface IncomeTaxParams {
  bookProfit: number;
  taxRate: number;
  disallowableExpenses: Record<string, number>;
  allowableExpenses: Record<string, number>;
  advanceTaxPaid: number;
  tdsCredit: number;
  previousYearLoss: number;
}

export interface IncomeTaxResult {
  taxableIncome: number;
  currentTaxExpense: number;
  taxPayable: number;
  taxRecoverable: number;
  effectiveTaxRate: number;
}

export function computeIncomeTax(params: IncomeTaxParams): IncomeTaxResult {
  const {
    bookProfit,
    taxRate,
    disallowableExpenses,
    allowableExpenses,
    advanceTaxPaid,
    tdsCredit,
    previousYearLoss,
  } = params;

  const totalDisallowable = Object.values(disallowableExpenses).reduce((s, v) => s + (v || 0), 0);
  const totalAllowable = Object.values(allowableExpenses).reduce((s, v) => s + (v || 0), 0);

  // Provisional taxable income before loss setoff
  const provisionalTaxable = bookProfit + totalDisallowable - totalAllowable;

  // Nepal ITA s.20: loss setoff capped at 50% of current taxable income
  const maxLossSetoff = Math.max(0, provisionalTaxable * 0.5);
  const actualLossSetoff = Math.min(previousYearLoss, maxLossSetoff);
  const taxableIncome = Math.max(0, provisionalTaxable - actualLossSetoff);

  const currentTaxExpense = Math.max(0, taxableIncome) * (taxRate / 100);
  const totalPaid = advanceTaxPaid + tdsCredit;
  const netAfterCredits = currentTaxExpense - totalPaid;

  const taxPayable = netAfterCredits > 0 ? Math.round(netAfterCredits * 100) / 100 : 0;
  const taxRecoverable = netAfterCredits < 0 ? Math.round(-netAfterCredits * 100) / 100 : 0;
  const effectiveTaxRate =
    bookProfit > 0 ? Math.round((currentTaxExpense / bookProfit) * 10000) / 100 : 0;

  return {
    taxableIncome: Math.round(taxableIncome * 100) / 100,
    currentTaxExpense: Math.round(currentTaxExpense * 100) / 100,
    taxPayable,
    taxRecoverable,
    effectiveTaxRate,
  };
}

// ---------------------------------------------------------------------------
// 3. computeDisallowableExpenses
// ---------------------------------------------------------------------------
export interface DisallowableParams {
  entertainmentExpense: number;
  donations: number;
  finesAndPenalties: number;
  interestOnLateTax: number;
  adjustedTaxableIncome: number;
  personalExpenses: number;
  cashPaymentsOverLimit: number;
}

export interface DisallowableResult {
  items: Record<string, number>;
  total: number;
}

export function computeDisallowableExpenses(params: DisallowableParams): DisallowableResult {
  const {
    entertainmentExpense,
    donations,
    finesAndPenalties,
    interestOnLateTax,
    adjustedTaxableIncome,
    personalExpenses,
    cashPaymentsOverLimit,
  } = params;

  const items: Record<string, number> = {};

  // Entertainment: allowable = max(100,000, revenue × 0.5%)
  // Here we use adjustedTaxableIncome as revenue proxy
  const entertainmentAllowable = Math.max(100_000, adjustedTaxableIncome * 0.005);
  const entertainmentDisallowable = Math.max(0, entertainmentExpense - entertainmentAllowable);
  if (entertainmentDisallowable > 0) {
    items['Entertainment Expense (excess over allowable limit)'] = entertainmentDisallowable;
  }

  // Donations: allowable = min(actual, 5% of adjusted taxable income)
  const donationAllowable = Math.min(donations, adjustedTaxableIncome * 0.05);
  const donationDisallowable = Math.max(0, donations - donationAllowable);
  if (donationDisallowable > 0) {
    items['Donations (excess over 5% of adjusted taxable income)'] = donationDisallowable;
  }

  if (finesAndPenalties > 0) {
    items['Fines and Penalties (100% disallowable)'] = finesAndPenalties;
  }
  if (interestOnLateTax > 0) {
    items['Interest on Late Tax Payments (100% disallowable)'] = interestOnLateTax;
  }
  if (personalExpenses > 0) {
    items['Personal Expenses (100% disallowable)'] = personalExpenses;
  }
  if (cashPaymentsOverLimit > 0) {
    items['Cash Payments Exceeding NPR 50,000 Limit (100% disallowable)'] = cashPaymentsOverLimit;
  }

  const total = Object.values(items).reduce((s, v) => s + v, 0);
  return { items, total: Math.round(total * 100) / 100 };
}

// ---------------------------------------------------------------------------
// 4. buildTaxReconciliation
// ---------------------------------------------------------------------------
export interface ReconciliationRow {
  label: string;
  amount: number;
}

export interface TaxReconciliationResult {
  rows: ReconciliationRow[];
  taxableIncome: number;
}

export function buildTaxReconciliation(
  incomeStatement: IncomeStatement,
  disallowable: Record<string, number>,
  bookTaxDepreciation: number,
  taxDepreciation: number,
  taxRate: number,
): TaxReconciliationResult {
  const rows: ReconciliationRow[] = [];

  rows.push({
    label: 'Profit before tax per financial statements',
    amount: incomeStatement.profitBeforeTax,
  });

  // Add back disallowable items
  for (const [label, amount] of Object.entries(disallowable)) {
    if (amount > 0) {
      rows.push({ label: `Add: ${label}`, amount });
    }
  }

  // Reverse book depreciation (it was already deducted from profit)
  rows.push({
    label: 'Add: Book depreciation (reversed)',
    amount: bookTaxDepreciation,
  });

  // Deduct tax depreciation per ITA
  rows.push({
    label: 'Less: Tax depreciation as per Income Tax Act (Schedule 2)',
    amount: -taxDepreciation,
  });

  // Running total = taxable income
  const taxableIncome = rows.reduce((s, r) => s + r.amount, 0);

  rows.push({ label: 'Taxable Income', amount: taxableIncome });

  const taxAmount = Math.max(0, taxableIncome) * (taxRate / 100);
  rows.push({
    label: `Income Tax at ${taxRate}%`,
    amount: Math.round(taxAmount * 100) / 100,
  });

  return {
    rows,
    taxableIncome: Math.round(taxableIncome * 100) / 100,
  };
}
