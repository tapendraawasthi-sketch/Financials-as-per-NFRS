// Nepal Income Tax Act 2058 tax computation engine.

import type { IncomeStatement } from '../../src/types/financials.js';
import type { YearEndAdjustments } from '../../src/types/adjustments.js';

export const TAX_RATES = {
  CORPORATE_STANDARD: 0.25,
  MANUFACTURING: 0.20,
  TOURISM_IT: 0.20,
  HYDROPOWER: 0.20,
  PRIVATE_FIRM_SLAB: true,
} as const;

export interface TaxComputationInput {
  accountingProfit: number;       // PBT from income statement
  accountingDepreciation: number;
  taxDepreciation: number;          // sum of tax pool depreciation
  disallowedForTax: YearEndAdjustments['disallowedForTax'];
  staffBonus: number;
  profitBeforeBonus: number;
  donations?: number;
  researchDevelopment?: number;
  advanceTaxPaid: number;
  incomeTaxRate: number;          // 0.25, 0.20, or 0.15
  entityType: 'Company' | 'Partnership' | 'Sole Proprietorship' | 'Cooperative' | 'Other';
}

export interface TaxComputationResult {
  taxableIncome: number;
  currentTaxExpense: number;
  netTaxPayable: number;
  staffBonusAllowed: number;
  bookTaxReconciliation: Array<{ label: string; amount: number }>;
}

/** Staff Bonus per Labor Act 2074 Section 53: 10% of PBT before bonus. */
export function computeStaffBonus(profitBeforeBonus: number, rate = 0.10): number {
  return Math.max(0, Math.round(profitBeforeBonus * rate * 100) / 100);
}

/** TDS on dividend: 5% of declared dividend. */
export function computeDividendTDS(dividendAmount: number): number {
  return Math.round(dividendAmount * 0.05 * 100) / 100;
}

function computePrivateFirmTax(taxableIncome: number): number {
  if (taxableIncome <= 500_000) return 0;
  if (taxableIncome <= 700_000) return (taxableIncome - 500_000) * 0.15;
  return 50_000 * 0.15 + (taxableIncome - 700_000) * 0.25;
}

export function computeTax(input: TaxComputationInput): TaxComputationResult {
  const {
    accountingProfit,
    accountingDepreciation,
    taxDepreciation,
    disallowedForTax,
    staffBonus,
    profitBeforeBonus,
    donations = 0,
    researchDevelopment = 0,
    advanceTaxPaid,
    incomeTaxRate,
    entityType,
  } = input;

  const reconciliation: Array<{ label: string; amount: number }> = [];
  reconciliation.push({ label: 'Accounting profit before tax', amount: accountingProfit });

  reconciliation.push({ label: 'Add: Accounting depreciation', amount: accountingDepreciation });
  reconciliation.push({ label: 'Less: Tax depreciation (ITA pools)', amount: -taxDepreciation });

  const totalDisallowed = disallowedForTax.reduce((s, d) => s + d.amount, 0);
  if (totalDisallowed > 0) {
    reconciliation.push({ label: 'Add: Disallowed expenses', amount: totalDisallowed });
  }

  // Staff bonus allowed if ≤ 10% of PBT
  const maxBonusAllowed = profitBeforeBonus * 0.10;
  const staffBonusAllowed = Math.min(staffBonus, maxBonusAllowed);

  let adjustedProfit =
    accountingProfit +
    accountingDepreciation -
    taxDepreciation +
    totalDisallowed;

  // Donations limited to 5% of adjusted profit
  const donationAllowed = Math.min(donations, adjustedProfit * 0.05);
  adjustedProfit -= donationAllowed;

  // R&D 150% allowable
  const rdAllowance = researchDevelopment * 0.5;
  adjustedProfit -= rdAllowance;

  const taxableIncome = Math.max(0, Math.round(adjustedProfit * 100) / 100);
  reconciliation.push({ label: 'Taxable income', amount: taxableIncome });

  let currentTaxExpense: number;
  if (entityType === 'Sole Proprietorship' || entityType === 'Partnership') {
    currentTaxExpense = computePrivateFirmTax(taxableIncome);
  } else {
    currentTaxExpense = Math.round(taxableIncome * incomeTaxRate * 100) / 100;
  }

  const netTaxPayable = Math.max(0, Math.round((currentTaxExpense - advanceTaxPaid) * 100) / 100);

  reconciliation.push({
    label: `Income tax at ${(incomeTaxRate * 100).toFixed(0)}%`,
    amount: currentTaxExpense,
  });

  return {
    taxableIncome,
    currentTaxExpense,
    netTaxPayable,
    staffBonusAllowed,
    bookTaxReconciliation: reconciliation,
  };
}

// Legacy exports
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
  const result = computeTax({
    accountingProfit: params.bookProfit,
    accountingDepreciation: 0,
    taxDepreciation: 0,
    disallowedForTax: Object.entries(params.disallowableExpenses).map(([description, amount]) => ({
      description, amount, section: 'Section 21 ITA',
    })),
    staffBonus: 0,
    profitBeforeBonus: params.bookProfit,
    advanceTaxPaid: params.advanceTaxPaid + params.tdsCredit,
    incomeTaxRate: params.taxRate / 100,
    entityType: 'Company',
  });

  const netAfterCredits = result.currentTaxExpense - params.advanceTaxPaid - params.tdsCredit;
  return {
    taxableIncome: result.taxableIncome,
    currentTaxExpense: result.currentTaxExpense,
    taxPayable: netAfterCredits > 0 ? netAfterCredits : 0,
    taxRecoverable: netAfterCredits < 0 ? -netAfterCredits : 0,
    effectiveTaxRate: params.bookProfit > 0
      ? Math.round((result.currentTaxExpense / params.bookProfit) * 10000) / 100
      : 0,
  };
}

export function buildTaxReconciliation(
  incomeStatement: IncomeStatement,
  disallowable: Record<string, number>,
  bookDepreciation: number,
  taxDepreciation: number,
  taxRate: number,
) {
  const result = computeTax({
    accountingProfit: incomeStatement.profitBeforeTax,
    accountingDepreciation: bookDepreciation,
    taxDepreciation,
    disallowedForTax: Object.entries(disallowable).map(([description, amount]) => ({
      description, amount, section: 'Section 21 ITA',
    })),
    staffBonus: incomeStatement.staffBonus,
    profitBeforeBonus: incomeStatement.profitBeforeStaffBonus,
    advanceTaxPaid: 0,
    incomeTaxRate: taxRate / 100,
    entityType: 'Company',
  });

  return {
    rows: result.bookTaxReconciliation,
    taxableIncome: result.taxableIncome,
  };
}

export function computeDisallowableExpenses(params: {
  entertainmentExpense: number;
  donations: number;
  finesAndPenalties: number;
  interestOnLateTax: number;
  adjustedTaxableIncome: number;
  personalExpenses: number;
  cashPaymentsOverLimit: number;
}) {
  const items: Record<string, number> = {};
  const entertainmentAllowable = Math.max(100_000, params.adjustedTaxableIncome * 0.005);
  const entertainmentDisallowable = Math.max(0, params.entertainmentExpense - entertainmentAllowable);
  if (entertainmentDisallowable > 0) items['Entertainment (excess)'] = entertainmentDisallowable;
  if (params.finesAndPenalties > 0) items['Fines and penalties'] = params.finesAndPenalties;
  if (params.personalExpenses > 0) items['Personal expenses'] = params.personalExpenses;
  const total = Object.values(items).reduce((s, v) => s + v, 0);
  return { items, total };
}
