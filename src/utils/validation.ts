// ===== src/utils/validation.ts =====
// Validation functions for company setup, accounting policies, trial balance,
// and general field-level checks for the NFRS Nepal financial reporting system.

import type {
  CompanyProfile,
  AccountingPolicies,
  MappedTBRow,
  NFRSCategory,
  TBValidationResult,
} from '../types';

// Re-export convenience types used by consumers
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Standard email regex (RFC 5322 simplified). */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/** Nepal PAN: exactly 9 digits. */
const PAN_REGEX = /^\d{9}$/;

/** Nepal VAT: exactly 9 digits (same as PAN for most entities). */
const VAT_REGEX = /^\d{9}(\d{2})?$/; // 9 or 11 digits

/**
 * Nepal phone number:
 *   Mobile: 10 digits starting with 97 or 98 (Ncell/NTC mobile)
 *   Landline Kathmandu: 10 digits starting with 01
 */
const PHONE_REGEX = /^(97|98|01)\d{8}$/;

/** NFRS categories that carry a normal DEBIT balance (assets, expenses). */
const DEBIT_NORMAL_PREFIXES = [
  'ppe_', 'nca_', 'investment_', 'other_noncurrent_assets',
  'ca_', 'inventory_', 'trade_receivables', 'other_receivables_',
  'other_current_assets', 'bank_current_account', 'bank_fixed_deposit_current',
  'cash_in_hand', 'cogs_', 'direct_wages', 'direct_expenses_',
  'emp_expense_', 'finance_cost_', 'depreciation_expense',
  'impairment_expense', 'admin_', 'income_tax_expense',
];

function isNormallyDebit(category: NFRSCategory): boolean {
  const cat = category as string;
  for (const prefix of DEBIT_NORMAL_PREFIXES) {
    if (cat.startsWith(prefix) || cat === prefix.replace(/_$/, '')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 1. validateCompanyProfile
// ---------------------------------------------------------------------------

/**
 * Validates the company/engagement profile entered in the wizard Step 1.
 *
 * Required fields:
 *   • companyName        — required, max 200 characters
 *   • panVatNumber       — required, 9 digits (PAN) or 9–11 digits (VAT)
 *   • registrationNumber — required
 *   • companyType        — required
 *   • fiscalYear         — required
 *   • email              — valid email format if provided; required
 *
 * Returns { isValid, errors } where errors is keyed by field name.
 */
export function validateCompanyProfile(
  data: Partial<CompanyProfile>,
): ValidationResult {
  const errors: Record<string, string> = {};

  // companyName
  if (!data.companyName || data.companyName.trim() === '') {
    errors.companyName = 'Company name is required.';
  } else if (data.companyName.trim().length > 200) {
    errors.companyName = 'Company name must not exceed 200 characters.';
  }

  // panVatNumber
  if (!data.panVatNumber || data.panVatNumber.trim() === '') {
    errors.panVatNumber = 'PAN/VAT number is required.';
  } else {
    const panVal = data.panVatNumber.replace(/\s/g, '');
    if (!PAN_REGEX.test(panVal) && !VAT_REGEX.test(panVal)) {
      errors.panVatNumber =
        'PAN must be exactly 9 digits; VAT must be 9 or 11 digits.';
    }
  }

  // registrationNumber
  if (!data.registrationNumber || data.registrationNumber.trim() === '') {
    errors.registrationNumber = 'Company registration number is required.';
  }

  // companyType
  if (!data.companyType) {
    errors.companyType = 'Company type is required.';
  }

  // fiscalYear
  if (!data.fiscalYear || !data.fiscalYear.bsYear) {
    errors.fiscalYear = 'Fiscal year is required.';
  }

  // email — required and must be valid
  if (!data.email || data.email.trim() === '') {
    errors.email = 'Email address is required.';
  } else if (!validateEmail(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 2. validateAccountingPolicies
// ---------------------------------------------------------------------------

/**
 * Validates accounting policies entered in wizard Step 2.
 *
 * Rules:
 *   • incomeTaxRatePercent — 0 to 50
 *   • gratuityDaysPerYear  — 1 to 30 (Nepal law: typically 15–30 days)
 *   • bonusRatePercent     — 0 to 100 (Nepal Bonus Act: 10% standard)
 *   • roundingLevel        — one of [1, 10, 100, 1000, 10000]
 *   • assetCategories      — at least one defined
 */
export function validateAccountingPolicies(
  policies: Partial<AccountingPolicies>,
): ValidationResult {
  const errors: Record<string, string> = {};
  const VALID_ROUNDING = [1, 10, 100, 1000, 10000];

  if (policies.incomeTaxRatePercent !== undefined) {
    if (
      policies.incomeTaxRatePercent < 0 ||
      policies.incomeTaxRatePercent > 50
    ) {
      errors.incomeTaxRatePercent =
        'Income tax rate must be between 0 and 50 percent.';
    }
  }

  if (policies.gratuityDaysPerYear !== undefined) {
    if (
      policies.gratuityDaysPerYear < 1 ||
      policies.gratuityDaysPerYear > 30
    ) {
      errors.gratuityDaysPerYear =
        'Gratuity days per year must be between 1 and 30.';
    }
  }

  if (policies.bonusRatePercent !== undefined) {
    if (policies.bonusRatePercent < 0 || policies.bonusRatePercent > 100) {
      errors.bonusRatePercent =
        'Staff bonus rate must be between 0 and 100 percent.';
    }
  }

  if (policies.roundingLevel !== undefined) {
    if (!VALID_ROUNDING.includes(policies.roundingLevel)) {
      errors.roundingLevel = `Rounding level must be one of: ${VALID_ROUNDING.join(', ')}.`;
    }
  }

  if (
    !policies.assetCategories ||
    policies.assetCategories.length === 0
  ) {
    errors.assetCategories =
      'At least one asset category (e.g. Land, Buildings) must be defined.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 3. validateTrialBalanceTotals
// ---------------------------------------------------------------------------

/**
 * Performs a full arithmetical and structural validation of the mapped
 * trial balance rows.
 *
 * Checks:
 *   • Trial balance foots (closingDr ≈ closingCr within NPR 1.00)
 *   • No unclassified accounts remain
 *   • No accounts with unexpectedly large balances (> NPR 50,000,000)
 *   • No accounts whose closing balance sign contradicts their expected
 *     normal balance (warns — does not make isBalanced false)
 */
export function validateTrialBalanceTotals(
  rows: MappedTBRow[],
): TBValidationResult {
  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalDuringDr = 0;
  let totalDuringCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;

  const warnings: string[] = [];
  const errors: string[] = [];
  const unmappedAccounts: string[] = [];
  const negativeBalanceWarnings: string[] = [];

  for (const row of rows) {
    totalOpeningDr += row.openingDr ?? 0;
    totalOpeningCr += row.openingCr ?? 0;
    totalDuringDr += row.duringDr ?? 0;
    totalDuringCr += row.duringCr ?? 0;
    totalClosingDr += row.closingDr ?? 0;
    totalClosingCr += row.closingCr ?? 0;

    // Unclassified / unmapped
    if (!row.nfrsCategory || (row.nfrsCategory as string) === 'unclassified') {
      unmappedAccounts.push(row.rawLabel);
    }

    // Unusually large balance warning (> NPR 5 crore = 50,000,000)
    const closingNet = (row.closingDr ?? 0) - (row.closingCr ?? 0);
    if (Math.abs(closingNet) > 50_000_000) {
      warnings.push(
        `"${row.rawLabel}" has an unusually large closing balance of ` +
          `NPR ${Math.abs(closingNet).toLocaleString()}. Please verify.`,
      );
    }

    // Unexpected balance sign
    if (row.nfrsCategory && (row.nfrsCategory as string) !== 'unclassified') {
      const isDebit = isNormallyDebit(row.nfrsCategory);
      if (isDebit && closingNet < 0) {
        negativeBalanceWarnings.push(
          `${row.rawLabel} has unexpected credit balance of ${closingNet}`
        );
      }
      if (!isDebit && closingNet > 0) {
        negativeBalanceWarnings.push(
          `${row.rawLabel} has unexpected debit balance of ${closingNet}`
        );
      }
    }
  }

  // Round totals to avoid floating-point noise
  const roundedClosingDr = Math.round(totalClosingDr * 100) / 100;
  const roundedClosingCr = Math.round(totalClosingCr * 100) / 100;
  const difference = Math.round((roundedClosingDr - roundedClosingCr) * 100) / 100;
  const isBalanced = Math.abs(difference) < 1.0;

  if (!isBalanced) {
    errors.push(
      `Trial balance does not foot: total closing debit NPR ` +
        `${roundedClosingDr.toLocaleString()} ≠ total closing credit NPR ` +
        `${roundedClosingCr.toLocaleString()} (difference: NPR ${difference.toLocaleString()}). ` +
        `This must be resolved before financial statements can be generated.`,
    );
  }

  if (unmappedAccounts.length > 0) {
    warnings.push(
      `${unmappedAccounts.length} account(s) are unclassified and will be ` +
        `excluded from financial statements. Please map all accounts before proceeding.`,
    );
  }

  if (negativeBalanceWarnings.length > 0) {
    warnings.push(
      `${negativeBalanceWarnings.length} account(s) have an unexpected balance ` +
        `sign (e.g. a debit account showing a credit balance). Review before finalising.`,
    );
  }

  return {
    isBalanced,
    totalOpeningDr: Math.round(totalOpeningDr),
    totalOpeningCr: Math.round(totalOpeningCr),
    totalDuringDr: Math.round(totalDuringDr),
    totalDuringCr: Math.round(totalDuringCr),
    totalClosingDr: Math.round(roundedClosingDr),
    totalClosingCr: Math.round(roundedClosingCr),
    difference,
    openingDifference: Math.round(totalOpeningDr - totalOpeningCr),
    duringDifference: Math.round(totalDuringDr - totalDuringCr),
    warnings,
    errors,
    unmappedAccounts,
    negativBalanceWarnings: negativeBalanceWarnings,
  };
}

// ---------------------------------------------------------------------------
// 4. validatePANNumber
// ---------------------------------------------------------------------------

/**
 * Returns true if the given string is a valid Nepal PAN number
 * (exactly 9 digits, no spaces or punctuation).
 *
 * @example validatePANNumber('123456789') // → true
 * @example validatePANNumber('12345678')  // → false (8 digits)
 */
export function validatePANNumber(pan: string): boolean {
  if (!pan) return false;
  return PAN_REGEX.test(pan.replace(/\s/g, ''));
}

// ---------------------------------------------------------------------------
// 5. validateEmail
// ---------------------------------------------------------------------------

/**
 * Returns true if the string is a syntactically valid email address.
 * Follows RFC 5322 simplified pattern.
 *
 * @example validateEmail('ca@example.com')   // → true
 * @example validateEmail('not-an-email')      // → false
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
}

// ---------------------------------------------------------------------------
// 6. validatePhoneNumber
// ---------------------------------------------------------------------------

/**
 * Returns true if the string is a valid Nepal phone number.
 * Accepts:
 *   • 10-digit mobile numbers starting with 97 (NTC) or 98 (Ncell/others)
 *   • 10-digit Kathmandu landlines starting with 01
 *
 * @example validatePhoneNumber('9841234567') // → true  (mobile)
 * @example validatePhoneNumber('0114567890') // → true  (landline)
 * @example validatePhoneNumber('1234567890') // → false
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-+]/g, '');
  return PHONE_REGEX.test(cleaned);
}
