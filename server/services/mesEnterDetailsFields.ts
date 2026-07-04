import type { CompanyProfile } from '../../src/types/company.js';
import type { YearEndAdjustments } from '../../src/types/adjustments.js';

/** MEs reference labels — column B in Enter Details (parser reads cols 2–3). */
export interface MesEnterDetailsField {
  label: string;
  value: string | number;
  isNumeric?: boolean;
}

export function buildMesEnterDetailsFields(
  company: CompanyProfile,
  adjustments?: Pick<YearEndAdjustments, 'inventoryDetails' | 'dividendPayable'>,
): MesEnterDetailsField[] {
  const policies = company.accountingPolicies;
  const inv = adjustments?.inventoryDetails;
  const taxRate = policies?.incomeTaxRatePercent
    ?? (company as CompanyProfile & { incomeTaxRate?: number }).incomeTaxRate
    ?? 25;
  const bonusRate = policies?.bonusRatePercent
    ?? ((company as CompanyProfile & { employeeBonusRate?: number }).employeeBonusRate ?? 0.1) * 100;
  const employees = (company as CompanyProfile & { noOfEmployees?: number; numberOfEmployees?: number }).noOfEmployees
    ?? company.numberOfEmployees
    ?? 0;
  const dividendDeclared = company.dividendDeclaredPercent ?? 0;
  const dividendCapacity = Math.max(0, 100 - dividendDeclared); // headroom vs declared %

  const fields: MesEnterDetailsField[] = [
    { label: 'name of entity', value: company.companyName ?? company.name ?? '' },
    { label: 'address', value: company.fullAddress ?? company.address ?? '' },
    { label: 'this year', value: company.fiscalYear?.bsFY ?? company.fiscalYearCurrent ?? '' },
    { label: 'last year', value: company.previousFiscalYear?.bsFY ?? company.fiscalYearPrevious ?? '' },
    { label: 'reporting date (bs)', value: company.fiscalYear?.endDateBS ?? company.reportingDateBS ?? '' },
    { label: 'reporting date (ad)', value: company.fiscalYear?.endDateAD ?? company.reportingDateAD ?? '' },
    { label: 'entity type', value: company.entityType ?? company.typeOfEntity ?? company.companyType ?? '' },
    { label: 'applicable standard', value: company.applicableStandard ?? 'NAS for MEs' },
    { label: 'pan / vat number', value: company.panVatNumber ?? company.panNo ?? '' },
    { label: 'registration no.', value: company.registrationNumber ?? company.registrationNo ?? '' },
    { label: 'chairperson', value: company.chairperson ?? '' },
    { label: 'director', value: company.director ?? '' },
    { label: 'accounts head', value: company.accountsHead ?? '' },
    { label: 'auditor', value: company.auditorInfo?.auditorName ?? company.auditor ?? '' },
    { label: 'name of audit firm', value: company.auditorInfo?.auditorFirmName ?? company.auditFirmName ?? '' },
    { label: 'ican registration no.', value: company.auditorInfo?.icanRegNumber ?? '' },
    { label: 'number of employees', value: employees, isNumeric: true },
    { label: 'income tax rate (%)', value: taxRate, isNumeric: true },
    { label: 'bonus rate (%)', value: typeof bonusRate === 'number' && bonusRate <= 1 ? bonusRate * 100 : bonusRate, isNumeric: true },
    { label: 'rounding level (npr)', value: policies?.roundingLevel ?? 100, isNumeric: true },
    { label: 'authorized share capital', value: company.authorizedCapital ?? 0, isNumeric: true },
    { label: 'issued share capital (cy)', value: company.issuedCapitalCY ?? 0, isNumeric: true },
    { label: 'dividend capacity (%)', value: dividendCapacity, isNumeric: true },
    { label: 'dividend declared (%)', value: dividendDeclared, isNumeric: true },
    { label: 'dividend payable (npr)', value: adjustments?.dividendPayable ?? 0, isNumeric: true },
  ];

  if (inv) {
    fields.push(
      { label: 'inventory — raw materials (cy)', value: inv.rawMaterialsCY ?? 0, isNumeric: true },
      { label: 'inventory — raw materials (py)', value: inv.rawMaterialsPY ?? 0, isNumeric: true },
      { label: 'inventory — work in progress (cy)', value: inv.wipCY ?? 0, isNumeric: true },
      { label: 'inventory — work in progress (py)', value: inv.wipPY ?? 0, isNumeric: true },
      { label: 'inventory — finished goods (cy)', value: inv.finishedGoodsCY ?? 0, isNumeric: true },
      { label: 'inventory — finished goods (py)', value: inv.finishedGoodsPY ?? 0, isNumeric: true },
    );
  }

  return fields;
}
