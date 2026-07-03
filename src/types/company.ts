// src/types/company.ts

export interface FiscalYearInfo {
  bsYear: string;          // "2081/82"
  startDateBS: string;     // "1 Shrawan 2081"
  endDateBS: string;       // "31 Ashadh 2082"
  startDateAD: string;     // "July 16, 2024"
  endDateAD: string;       // "July 15, 2025"
  startYear: number;       // 2024
  endYear: number;         // 2025
  isLeapYear: boolean;
}

export interface AuditorInfo {
  auditorName: string;
  auditorFirmName: string;
  position: string;
  icanRegNumber?: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  defaultMethod: 'StraightLine' | 'WrittenDownValue';
  defaultUsefulLife: number;
  defaultWDVRate: number;
  defaultResidualPct: number;
}

export interface AccountingPolicies {
  depreciationMethod: 'StraightLine' | 'WrittenDownValue';
  inventoryCostMethod: 'FIFO' | 'WeightedAverage' | 'SpecificIdentification';
  incomeTaxRatePercent: number;
  roundingLevel: number;
  bonusRatePercent: number;
  gratuityDaysPerYear: number;
  recognizeGratuity?: boolean;
  recognizeLeaveEncashment?: boolean;
  hasGratuityLiability?: boolean;
  hasLeaveEncashment?: boolean;
  dateOfAuthorizationForIssue?: string;
  assetCategories: AssetCategory[];
}

export interface PreviousYearBalances {
  // Income Statement
  revenue: number;
  costOfSales: number;
  otherIncome: number;
  adminExpenses: number;
  financeCosts: number;
  depreciation: number;
  incomeTaxExpense: number;
  // Balance Sheet
  ppe: number;
  investments: number;
  currentAssets: number;
  cashAndEquivalents: number;
  shareCapital: number;
  reserves: number;
  borrowingsNonCurrent: number;
  borrowingsCurrent: number;
  tradePayables: number;
  provisions: number;
}

export interface CompanyProfile {
  id: string;
  companyName: string;
  panVatNumber?: string;
  registrationNumber?: string;
  companyType: string;
  entityType?: string;
  province?: string;
  district?: string;
  municipality?: string;
  wardNumber?: string;
  tole?: string;
  fullAddress?: string;
  contactPerson?: string;
  designation?: string;
  phone?: string;
  email?: string;
  chairperson?: string;
  director?: string;
  accountsHead?: string;
  auditorInfo?: AuditorInfo;
  fiscalYear: FiscalYearInfo;
  previousFiscalYear?: FiscalYearInfo;
  accountingPolicies: AccountingPolicies;
  previousYearData?: PreviousYearBalances;
  numberOfEmployees?: number;
  dividendDeclaredPercent?: number;
  employeeBonusRate?: number;
  incomeTaxRate?: number;
  shareIssuedDuringYear?: number;
  openingShareCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
