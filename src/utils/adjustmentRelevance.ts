import type { CompanyProfile, MappedTBRow } from '../types';

export interface AdjustmentSectionVisibility {
  ppe: boolean;
  inventory: boolean;
  investments: boolean;
  provisions: boolean;
  disallowedTax: boolean;
  advanceTax: boolean;
  relatedPartyLoan: boolean;
  journal: boolean;
}

export interface AdjustmentRelevance {
  hasPPE: boolean;
  hasInventory: boolean;
  hasInvestments: boolean;
  hasTradeReceivables: boolean;
  hasBorrowings: boolean;
  hasEmployeeBenefits: boolean;
  hasAuditFeePayable: boolean;
  hasDisposalIndicators: boolean;
  hasRelatedParty: boolean;
  hasAdvanceTaxAccounts: boolean;
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
  /** Which adjustment wizard panels to show (rule-based from TB + company profile). */
  sectionVisibility: AdjustmentSectionVisibility;
  /** Human-readable labels for the relevance banner. */
  activeSectionLabels: string[];
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
const RELATED_PARTY_CATEGORIES = new Set([
  'related_party_receivable',
  'related_party_payable',
  'borrowings_noncurrent_related',
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

export function defaultAdjustmentsTab(relevance: Pick<AdjustmentRelevance, 'hasPPE'>): 'assets' | 'provisions' {
  return relevance.hasPPE ? 'assets' : 'provisions';
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
  let hasRelatedParty = false;
  let hasAdvanceTaxAccounts = false;
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
    if (RELATED_PARTY_CATEGORIES.has(cat)) hasRelatedParty = true;
    if (cat === 'advance_tax_paid' || cat === 'income_tax_expense') hasAdvanceTaxAccounts = true;
  }

  const nas = company?.nasCompliance ?? {};
  const hasAuditor = Boolean(
    company?.auditor
    || company?.auditorInfo?.auditorName
    || company?.auditFirmName,
  );

  const sectionVisibility: AdjustmentSectionVisibility = {
    ppe: hasPPE,
    inventory: hasInventory,
    investments: hasInvestments,
    provisions: true,
    disallowedTax: true,
    advanceTax: true,
    relatedPartyLoan: hasRelatedParty || hasBorrowings,
    journal: true,
  };

  const activeSectionLabels: string[] = [];
  if (sectionVisibility.ppe) activeSectionLabels.push('PPE / Depreciation');
  if (sectionVisibility.inventory) activeSectionLabels.push('Inventory NRV');
  if (sectionVisibility.investments) activeSectionLabels.push('Investment FV');
  activeSectionLabels.push('Provisions');
  activeSectionLabels.push('Disallowed expenses (Tax Notes I/II)');
  activeSectionLabels.push('Advance tax (u/s 118/119)');
  if (sectionVisibility.relatedPartyLoan) activeSectionLabels.push('Related-party loan (Note 3.11)');
  activeSectionLabels.push('Adjustment journal');

  return {
    hasPPE,
    hasInventory,
    hasInvestments,
    hasTradeReceivables,
    hasBorrowings,
    hasEmployeeBenefits,
    hasAuditFeePayable,
    hasDisposalIndicators,
    hasRelatedParty,
    hasAdvanceTaxAccounts,
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
    sectionVisibility,
    activeSectionLabels,
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
