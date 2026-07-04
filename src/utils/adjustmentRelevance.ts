import type { CompanyProfile, MappedTBRow } from '../types';

export interface AdjustmentRelevance {
  hasPPE: boolean;
  hasInventory: boolean;
  hasInvestments: boolean;
  hasTradeReceivables: boolean;
  hasBorrowings: boolean;
  hasEmployeeBenefits: boolean;
  hasAuditFeePayable: boolean;
  hasDisposalIndicators: boolean;
  ppeAccountCount: number;
  provisionApplicability: {
    gratuity: boolean;
    leave: boolean;
    bonus: boolean;
    audit: boolean;
    doubtful: boolean;
  };
  nasFlags: {
    leaseArrangements: boolean;
    governmentGrants: boolean;
    foreignCurrency: boolean;
    contingentLiabilities: boolean;
    eventsAfterDate: boolean;
  };
}

const PPE_PREFIXES = ['ppe_', 'property_plant_equipment'];
const INVENTORY_CATEGORIES = new Set([
  'inventory_raw_materials',
  'inventory_wip',
  'inventory_finished_goods',
]);
const INVESTMENT_CATEGORIES = new Set([
  'investment_listed_trading',
  'investment_unlisted',
  'investment_fixed_deposit_noncurrent',
  'bank_fixed_deposit_current',
]);
const EMPLOYEE_CATEGORIES = new Set([
  'employee_benefit_gratuity',
  'employee_benefit_noncurrent',
  'employee_payables_pf',
  'employee_payables_salary',
  'employee_payables_bonus',
]);
const BORROWING_CATEGORIES = new Set([
  'borrowings_noncurrent_bank',
  'borrowings_noncurrent_other',
  'borrowings_noncurrent_related',
  'borrowings_current_od',
  'borrowings_current_cc',
  'borrowings_current_wc',
  'borrowings_current_portion_lt',
  'borrowings_related_current',
]);

function rowHasBalance(row: MappedTBRow): boolean {
  if (row.isGroupRow) return false;
  return (row.closingDr ?? 0) > 0 || (row.closingCr ?? 0) > 0;
}

function sumCategory(rows: MappedTBRow[], categories: Set<string> | string): number {
  const cats = typeof categories === 'string' ? new Set([categories]) : categories;
  return rows
    .filter((r) => !r.isGroupRow && cats.has(String(r.nfrsCategory ?? '')))
    .reduce((s, r) => s + Math.max(r.closingDr ?? 0, r.closingCr ?? 0), 0);
}

export function detectAdjustmentRelevance(
  rows: MappedTBRow[] = [],
  company?: CompanyProfile | null,
): AdjustmentRelevance {
  let hasPPE = false;
  let hasInventory = false;
  let hasInvestments = false;
  let hasTradeReceivables = false;
  let hasBorrowings = false;
  let hasEmployeeBenefits = false;
  let hasAuditFeePayable = false;
  let hasDisposalIndicators = false;
  let ppeAccountCount = 0;

  for (const row of rows) {
    if (!rowHasBalance(row)) continue;
    const cat = String(row.nfrsCategory ?? '');
    if (PPE_PREFIXES.some((prefix) => cat === prefix || cat.startsWith(prefix))) {
      hasPPE = true;
      ppeAccountCount += 1;
      if ((row.duringCr ?? 0) > 0) hasDisposalIndicators = true;
    }
    if (INVENTORY_CATEGORIES.has(cat)) hasInventory = true;
    if (INVESTMENT_CATEGORIES.has(cat)) hasInvestments = true;
    if (cat === 'trade_receivables') hasTradeReceivables = true;
    if (BORROWING_CATEGORIES.has(cat)) hasBorrowings = true;
    if (EMPLOYEE_CATEGORIES.has(cat)) hasEmployeeBenefits = true;
    if (cat === 'audit_fee_payable') hasAuditFeePayable = true;
    if (cat === 'other_income_disposal_gain') hasDisposalIndicators = true;
  }

  const nas = company?.nasCompliance ?? {};
  const hasAuditor = Boolean(
    company?.auditor
    || company?.auditorInfo?.auditorName
    || company?.auditFirmName,
  );

  return {
    hasPPE,
    hasInventory,
    hasInvestments,
    hasTradeReceivables,
    hasBorrowings,
    hasEmployeeBenefits,
    hasAuditFeePayable,
    hasDisposalIndicators,
    ppeAccountCount,
    provisionApplicability: {
      gratuity: hasEmployeeBenefits,
      leave: hasEmployeeBenefits,
      bonus: true,
      audit: hasAuditFeePayable || hasAuditor,
      doubtful: hasTradeReceivables,
    },
    nasFlags: {
      leaseArrangements: Boolean(nas.leaseArrangements),
      governmentGrants: Boolean(nas.governmentGrants),
      foreignCurrency: Boolean(nas.foreignCurrency),
      contingentLiabilities: Boolean(nas.contingentLiabilities),
      eventsAfterDate: Boolean(nas.eventsAfterDate),
    },
  };
}

export function countPpeTrialBalanceAccounts(rows: MappedTBRow[] = []): number {
  return rows.filter((row) => {
    if (row.isGroupRow || !rowHasBalance(row)) return false;
    const cat = String(row.nfrsCategory ?? '');
    return PPE_PREFIXES.some((prefix) => cat === prefix || cat.startsWith(prefix));
  }).length;
}

export function sumCategoryBalance(rows: MappedTBRow[], category: string): number {
  return sumCategory(rows, category);
}
