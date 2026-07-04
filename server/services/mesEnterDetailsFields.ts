import type { CompanyProfile } from '../../src/types/company.js';
import type { YearEndAdjustments } from '../../src/types/adjustments.js';
import type { BalanceSheet, IncomeStatement } from '../../src/types/financials.js';
import { fillNumericPlaceholder, fillPlaceholder } from '../../src/utils/fillPlaceholder.js';

/** MEs reference labels — column B in Enter Details (parser reads cols 2–3). */
export interface MesEnterDetailsField {
  label: string;
  value: string | number;
  isNumeric?: boolean;
}

export interface MesEnterDetailsContext {
  inventoryDetails?: YearEndAdjustments['inventoryDetails'];
  dividendPayable?: number;
  dividendCapacityPercent?: number;
  balanceSheetInventoryCY?: number;
  balanceSheetInventoryPY?: number;
}

/** Dividend capacity = closing RE (after current profit, before dividend) / paid-up capital × 100. */
export function computeDividendCapacityPercent(
  retainedEarnings: number,
  currentYearProfit: number,
  paidUpCapital: number,
): number {
  if (paidUpCapital <= 0) return 0;
  const reAfterProfit = retainedEarnings + currentYearProfit;
  return Math.round((reAfterProfit / paidUpCapital) * 10000) / 100;
}

export function buildMesEnterDetailsFields(
  company: CompanyProfile,
  ctx?: MesEnterDetailsContext,
  financials?: { balanceSheet?: Partial<BalanceSheet>; incomeStatement?: Partial<IncomeStatement> },
): MesEnterDetailsField[] {
  const policies = company.accountingPolicies;
  const inv = ctx?.inventoryDetails;
  const taxRate = policies?.incomeTaxRatePercent
    ?? (company as CompanyProfile & { incomeTaxRate?: number }).incomeTaxRate
    ?? 25;
  const bonusRate = policies?.bonusRatePercent
    ?? ((company as CompanyProfile & { employeeBonusRate?: number }).employeeBonusRate ?? 0.1) * 100;
  const employees = (company as CompanyProfile & { noOfEmployees?: number; numberOfEmployees?: number }).noOfEmployees
    ?? company.numberOfEmployees
    ?? 0;
  const dividendDeclared = company.dividendDeclaredPercent ?? 0;
  const paidUpCapital = company.issuedCapitalCY ?? financials?.balanceSheet?.shareCapital ?? 0;
  const retainedEarnings = financials?.balanceSheet?.retainedEarnings ?? 0;
  const currentProfit = financials?.incomeStatement?.netProfit ?? 0;
  const dividendCapacity = ctx?.dividendCapacityPercent
    ?? computeDividendCapacityPercent(retainedEarnings, currentProfit, paidUpCapital);

  const fields: MesEnterDetailsField[] = [
    { label: 'name of entity', value: company.companyName ?? company.name ?? '' },
    { label: 'address', value: fillPlaceholder('Address', company.fullAddress ?? company.address) },
    { label: 'this year', value: fillPlaceholder('Fiscal Year', company.fiscalYear?.bsFY ?? company.fiscalYearCurrent) },
    { label: 'last year', value: fillPlaceholder('Previous Fiscal Year', company.previousFiscalYear?.bsFY ?? company.fiscalYearPrevious) },
    { label: 'reporting date (bs)', value: fillPlaceholder('Reporting Date (BS)', company.fiscalYear?.endDateBS ?? company.reportingDateBS) },
    { label: 'reporting date (ad)', value: fillPlaceholder('Reporting Date (AD)', company.fiscalYear?.endDateAD ?? company.reportingDateAD) },
    { label: 'entity type', value: fillPlaceholder('Entity Type', company.entityType ?? company.typeOfEntity ?? company.companyType) },
    { label: 'applicable standard', value: company.applicableStandard ?? 'NAS for MEs' },
    { label: 'pan / vat number', value: fillPlaceholder('PAN', company.panVatNumber ?? company.panNo) },
    { label: 'registration no.', value: fillPlaceholder('Registration No.', company.registrationNumber ?? company.registrationNo) },
    { label: 'chairperson', value: fillPlaceholder('Chairperson', company.chairperson) },
    { label: 'director', value: fillPlaceholder('Director', company.director) },
    { label: 'accounts head', value: fillPlaceholder('Accounts Head', company.accountsHead) },
    { label: 'auditor', value: fillPlaceholder('Auditor', company.auditorInfo?.auditorName ?? company.auditor) },
    { label: 'auditor position', value: fillPlaceholder('Auditor Position', company.auditorInfo?.auditorPosition ?? company.auditorPosition) },
    { label: 'name of audit firm', value: fillPlaceholder('Audit Firm Name', company.auditorInfo?.auditorFirmName ?? company.auditFirmName) },
    { label: 'type of audit firm', value: fillPlaceholder('Type of Audit Firm', company.auditFirmType ?? 'Registered Auditors') },
    { label: 'ican registration no.', value: fillPlaceholder('ICAN Registration No.', company.auditorInfo?.icanRegNumber) },
    { label: 'number of employees', value: fillNumericPlaceholder('Number of Employees', employees), isNumeric: true },
    { label: 'income tax rate (%)', value: taxRate, isNumeric: true },
    { label: 'bonus rate (%)', value: typeof bonusRate === 'number' && bonusRate <= 1 ? bonusRate * 100 : bonusRate, isNumeric: true },
    { label: 'rounding level (npr)', value: policies?.roundingLevel ?? 100, isNumeric: true },
    { label: 'authorized share capital', value: company.authorizedCapital ?? 0, isNumeric: true },
    { label: 'issued share capital (cy)', value: company.issuedCapitalCY ?? paidUpCapital, isNumeric: true },
    { label: 'dividend capacity (%)', value: dividendCapacity, isNumeric: true },
    { label: 'dividend declared (%)', value: dividendDeclared, isNumeric: true },
    { label: 'dividend payable (npr)', value: ctx?.dividendPayable ?? 0, isNumeric: true },
    { label: 'notes integral part declaration', value: 'Notes 3.1 to 3.26 form an integral part of these financial statements.' },
  ];

  if (inv) {
    const invTotalCY = (inv.rawMaterialsCY ?? 0) + (inv.wipCY ?? 0) + (inv.finishedGoodsCY ?? 0);
    const invTotalPY = (inv.rawMaterialsPY ?? 0) + (inv.wipPY ?? 0) + (inv.finishedGoodsPY ?? 0);
    const bsInvCY = ctx?.balanceSheetInventoryCY ?? 0;
    fields.push(
      { label: 'inventory — raw materials (cy)', value: inv.rawMaterialsCY ?? 0, isNumeric: true },
      { label: 'inventory — raw materials (py)', value: inv.rawMaterialsPY ?? 0, isNumeric: true },
      { label: 'inventory — work in progress (cy)', value: inv.wipCY ?? 0, isNumeric: true },
      { label: 'inventory — work in progress (py)', value: inv.wipPY ?? 0, isNumeric: true },
      { label: 'inventory — finished goods (cy)', value: inv.finishedGoodsCY ?? 0, isNumeric: true },
      { label: 'inventory — finished goods (py)', value: inv.finishedGoodsPY ?? 0, isNumeric: true },
      { label: 'inventory — total (cy)', value: invTotalCY, isNumeric: true },
      { label: 'inventory — total (py)', value: invTotalPY, isNumeric: true },
      { label: 'inventory — balance sheet (cy)', value: bsInvCY, isNumeric: true },
      { label: 'inventory check (cy = bs?)', value: Math.abs(invTotalCY - bsInvCY) < 1 ? 'TRUE' : 'FALSE' },
    );
  }

  return fields;
}
