// src/utils/validation.ts

import type { MappedTBRow, CompanyProfile, AccountingPolicies } from '../types';
import { resolveCompanyName } from './companyProfile';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalClosingDr: number;
  totalClosingCr: number;
  totalDebitBalance?: number;
  totalCreditBalance?: number;
  openingDebitTotal?: number;
  openingCreditTotal?: number;
  closingDebitTotal?: number;
  closingCreditTotal?: number;
  isBalanced: boolean;
}

export function validateTrialBalanceTotals(rows: MappedTBRow[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;

  for (const row of rows) {
    if (row.isGroupRow) continue;
    totalOpeningDr += row.openingDr ?? 0;
    totalOpeningCr += row.openingCr ?? 0;
    totalClosingDr += row.closingDr ?? 0;
    totalClosingCr += row.closingCr ?? 0;
  }

  totalClosingDr = Math.round(totalClosingDr * 100) / 100;
  totalClosingCr = Math.round(totalClosingCr * 100) / 100;
  const difference = Math.abs(totalClosingDr - totalClosingCr);
  const isBalanced = difference < 1.0;

  if (!isBalanced) {
    errors.push(
      `Trial balance is not balanced. Closing Dr: ${totalClosingDr.toLocaleString('en-IN')}, ` +
      `Closing Cr: ${totalClosingCr.toLocaleString('en-IN')}. Difference: ${difference.toLocaleString('en-IN')}.`
    );
  }

  const unmapped = rows.filter(r => !r.isGroupRow && (!r.nfrsCategory || r.nfrsCategory === 'unclassified'));
  if (unmapped.length > 0) {
    warnings.push(`${unmapped.length} account(s) are not yet classified to an NFRS category.`);
  }

  const lowConfidence = rows.filter(r => !r.isGroupRow && (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80);
  if (lowConfidence.length > 0) {
    warnings.push(`${lowConfidence.length} account(s) have low-confidence mappings that should be reviewed.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalClosingDr,
    totalClosingCr,
    totalDebitBalance: totalClosingDr,
    totalCreditBalance: totalClosingCr,
    openingDebitTotal: Math.round(totalOpeningDr * 100) / 100,
    openingCreditTotal: Math.round(totalOpeningCr * 100) / 100,
    closingDebitTotal: totalClosingDr,
    closingCreditTotal: totalClosingCr,
    isBalanced,
  };
}

export function validateCompanyProfile(data: Partial<CompanyProfile>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resolveCompanyName(data)) errors.push('Company name is required.');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalClosingDr: 0,
    totalClosingCr: 0,
    isBalanced: true,
  };
}

export function validateAccountingPolicies(data: Partial<AccountingPolicies>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.incomeTaxRatePercent !== undefined) {
    if (data.incomeTaxRatePercent < 0 || data.incomeTaxRatePercent > 100) {
      errors.push('Income tax rate must be between 0% and 100%.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalClosingDr: 0,
    totalClosingCr: 0,
    isBalanced: true,
  };
}
