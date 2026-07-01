// ===== src/utils/numberFormat.ts =====
// Number formatting utilities for Nepal Rupee (NPR) amounts in NFRS
// financial statements. Uses the Indian numbering system (lakhs & crores).
//
// Indian numbering system:
//   Last 3 digits, then groups of 2 from right.
//   E.g. 1,23,45,678 not 1,234,5678.
//
// Financial statement conventions:
//   • Zero → dash "–"
//   • Negative → brackets "(1,50,000)"
//   • Positive → plain "1,50,000"

import type { NFRSCategory } from '../types';

// ---------------------------------------------------------------------------
// 1. formatIndianNumber (private helper)
// ---------------------------------------------------------------------------

/**
 * Formats a non-negative integer string using the Indian numbering system.
 * Input must be an absolute value string with no sign or decimals.
 */
function formatIndianNumber(absValueStr: string): string {
  // Remove any leading zeros
  const digits = absValueStr.replace(/^0+/, '') || '0';

  if (digits.length <= 3) return digits;

  // Last 3 digits form the first group from the right
  const last3 = digits.slice(-3);
  const remaining = digits.slice(0, -3);

  if (remaining.length === 0) return last3;

  // Remaining digits grouped in 2s from the right
  const groups: string[] = [];
  let rem = remaining;
  while (rem.length > 2) {
    groups.unshift(rem.slice(-2));
    rem = rem.slice(0, -2);
  }
  if (rem.length > 0) groups.unshift(rem);

  return groups.join(',') + ',' + last3;
}

// ---------------------------------------------------------------------------
// 2. formatNPR
// ---------------------------------------------------------------------------

/**
 * Formats a number as a Nepal Rupee amount using the Indian numbering system.
 *
 * Conventions:
 *   • Zero          → "–"       (em-dash, as per ICAN model financial statements)
 *   • Positive      → "12,50,000"
 *   • Negative      → "(1,50,000)"  (brackets for negatives in statements)
 *
 * @param amount        The numeric value to format (may be fractional)
 * @param roundingLevel Round to the nearest N before formatting (default 100)
 *
 * @example formatNPR(1250000)  // → "12,50,000"
 * @example formatNPR(250500)   // → "2,50,500"
 * @example formatNPR(-150000)  // → "(1,50,000)"
 * @example formatNPR(0)        // → "–"
 * @example formatNPR(49)       // → "–"  (rounds to 0 at default rounding of 100)
 */
export function formatNPR(amount: number, roundingLevel: number = 100): string {
  const rounded = roundToLevel(amount, roundingLevel);

  if (rounded === 0) return '–';

  const isNegative = rounded < 0;
  const absStr = Math.abs(rounded).toFixed(0);
  const formatted = formatIndianNumber(absStr);

  return isNegative ? `(${formatted})` : formatted;
}

// ---------------------------------------------------------------------------
// 3. formatNPRSimple
// ---------------------------------------------------------------------------

/**
 * Same as formatNPR but shows negatives with a minus sign rather than
 * brackets. Used in working schedules and non-formal reports.
 *
 * @example formatNPRSimple(-150000) // → "−1,50,000"
 * @example formatNPRSimple(0)       // → "–"
 */
export function formatNPRSimple(amount: number): string {
  if (amount === 0) return '–';

  const isNegative = amount < 0;
  const absStr = Math.abs(Math.round(amount)).toFixed(0);
  const formatted = formatIndianNumber(absStr);

  return isNegative ? `\u2212${formatted}` : formatted; // U+2212 = minus sign
}

// ---------------------------------------------------------------------------
// 4. roundToLevel
// ---------------------------------------------------------------------------

/**
 * Rounds `amount` to the nearest `roundingLevel`.
 *
 * @example roundToLevel(12345, 100)  // → 12300
 * @example roundToLevel(12350, 100)  // → 12400 (round-half-up)
 * @example roundToLevel(12345, 1)    // → 12345
 * @example roundToLevel(12345, 1000) // → 12000
 */
export function roundToLevel(amount: number, roundingLevel: number): number {
  if (roundingLevel <= 0) return amount;
  return Math.round(amount / roundingLevel) * roundingLevel;
}

// ---------------------------------------------------------------------------
// 5. applyRounding — alias for roundToLevel
// ---------------------------------------------------------------------------

/**
 * Alias for roundToLevel — rounds `amount` to the nearest `roundingLevel`.
 * Provided as a named alternative for use in policy-driven code.
 */
export function applyRounding(amount: number, roundingLevel: number): number {
  return roundToLevel(amount, roundingLevel);
}

// ---------------------------------------------------------------------------
// 6. computeClosingBalance
// ---------------------------------------------------------------------------

/**
 * Computes the closing balance from trial balance Opening, During, and
 * Adjustment columns (exactly mirroring the MEs Financials Format formula):
 *
 *   closingDr = openingDr + duringDr + adjDr
 *   closingCr = openingCr + duringCr + adjCr
 *   net       = closingDr - closingCr
 *
 * A positive net means a debit (asset/expense) balance.
 * A negative net means a credit (liability/equity/income) balance.
 *
 * @returns { debit, credit, net }
 *
 * @example
 *   computeClosingBalance(0, 50000, 0, 1000000, 0, 0)
 *   // → { debit: 0, credit: 1050000, net: -1050000 }  (credit balance)
 */
export function computeClosingBalance(
  openingDr: number,
  openingCr: number,
  duringDr: number,
  duringCr: number,
  adjDr: number,
  adjCr: number,
): { debit: number; credit: number; net: number } {
  const totalDr = (openingDr || 0) + (duringDr || 0) + (adjDr || 0);
  const totalCr = (openingCr || 0) + (duringCr || 0) + (adjCr || 0);
  const net = totalDr - totalCr;

  // Represent as either a debit or credit closing balance (one will be zero)
  const debit = net >= 0 ? net : 0;
  const credit = net < 0 ? -net : 0;

  return { debit, credit, net };
}

// ---------------------------------------------------------------------------
// 7. isDebitBalance
// ---------------------------------------------------------------------------

/**
 * Returns true if the given NFRS category normally carries a debit balance
 * (i.e. assets and expenses).
 *
 * Used by the trial balance validator to flag accounts whose closing balance
 * sign is contrary to their expected normal balance.
 */
export function isDebitBalance(nfrsCategory: NFRSCategory): boolean {
  // These category prefix patterns all represent normal-debit accounts
  const debitPrefixes: string[] = [
    // Assets — PPE
    'ppe_',
    'accum_depreciation',  // contra-asset (credit), but listed here for completeness — handled below
    // Non-current assets
    'nca_',
    'investment_',
    'other_noncurrent_assets',
    // Current assets
    'ca_',
    'inventory_',
    'trade_receivables',
    'provision_impairment_debtors', // contra (credit) — handled below
    'other_receivables_',
    'other_current_assets',
    'bank_current_account',
    'bank_fixed_deposit_current',
    'cash_in_hand',
    // COGS
    'cogs_',
    // Expenses
    'direct_wages',
    'direct_expenses_',
    'emp_expense_',
    'finance_cost_',
    'depreciation_expense',
    'impairment_expense',
    'admin_',
    'income_tax_expense',
    // Revenue categories that are sometimes shown on debit side in TB
    // (they have credit normal balance — NOT debit)
    // — excluded deliberately
  ];

  // Explicit credit-normal categories (contra-assets, liabilities, equity, income)
  const creditCategories = new Set<NFRSCategory>([
    'share_capital',
    'share_premium',
    'general_reserve',
    'retained_earnings',
    'borrowings_noncurrent_bank',
    'trade_payables_creditors',
    'trade_payables_advance_customers',
    'borrowings_current_od',
    'borrowings_current_cc',
    'borrowings_current_wc',
    'tds_payable',
    'other_payables',
    'employee_payables_pf',
    'employee_payables_bonus',
    'audit_fee_payable',
    'employee_payables_salary',
    'income_tax_payable',
    'accum_depreciation',
    'provision_impairment_debtors',
    'revenue_sales',
    'revenue_services',
    'other_income_interest',
    'other_income_dividend',
    'other_income_rental',
    'other_income_disposal_gain',
    'other_income_misc',
  ] as unknown as NFRSCategory[]);

  if (creditCategories.has(nfrsCategory)) return false;

  // Check debit prefixes
  for (const prefix of debitPrefixes) {
    if ((nfrsCategory as string).startsWith(prefix) ||
        (nfrsCategory as string) === prefix.replace(/_$/, '')) {
      return true;
    }
  }

  // Default: debit (conservative — better to flag than to miss)
  return true;
}

// ---------------------------------------------------------------------------
// 8. formatPercentage
// ---------------------------------------------------------------------------

/**
 * Formats a decimal or percentage value as a percentage string.
 *
 * @param value    The value to format. Values ≤ 1.0 are treated as decimals
 *                 and multiplied by 100; values > 1.0 are treated as already
 *                 in percentage form.
 * @param decimals Number of decimal places (default 1)
 *
 * @example formatPercentage(0.25)    // → "25.0%"
 * @example formatPercentage(25)      // → "25.0%"
 * @example formatPercentage(0.125, 2) // → "12.50%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}
