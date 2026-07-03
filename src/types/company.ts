export interface CompanyProfile {
  name: string;
  address: string;
  panNo: string;
  registrationNo: string;
  typeOfEntity: 'Company' | 'Partnership' | 'Sole Proprietorship' | 'Cooperative' | 'Other';
  chairperson: string;
  director: string;
  accountsHead: string;
  auditor: string;
  auditorPosition: string;    // 'Proprietor' | 'Partner' | etc.
  auditFirmName: string;
  auditFirmType: string;      // 'Registered Auditors' | 'Member Firm' etc.
  fiscalYearCurrent: string;  // e.g. '2081/82'
  fiscalYearPrevious: string; // e.g. '2080/81'
  reportingDateBS: string;    // e.g. '31 Ashadh 2082'
  reportingDateAD: string;    // e.g. '15 July 2025'
  previousDateBS: string;
  previousDateAD: string;
  applicableStandard: 'NAS for MEs' | 'NFRS for SMEs' | 'Full NFRS';
  shareParValue: number;      // NPR per share, default 100
  authorizedCapital: number;
  authorizedSharesOrdinary: number;
  authorizedSharesPreference: number;
  issuedCapitalPY: number;
  issuedCapitalCY: number;
  shareIssuedDuringYear: number;
  dividendDeclaredPercent: number;
  employeeBonusRate: number;  // default 0.10 (10%)
  incomeTaxRate: number;      // 0.25 or 0.20 or 0.15
  noOfEmployees: number;
}

export interface AccountingPolicies {
  basisOfPreparation: string;        // going concern, accrual
  ppeMeasurement: 'cost' | 'revaluation';
  depreciationMethod: 'SLM' | 'WDV'; // per asset class
  depreciationRates: Record<string, number>; // assetClass → rate
  inventoryMeasurement: 'cost' | 'NRV';
  inventoryCostFormula: 'FIFO' | 'WeightedAverage' | 'SpecificIdentification';
  foreignCurrencyPolicy: string;
  revenueRecognitionPolicy: string;
  employeeBenefitPolicy: string;
  taxPolicy: string;
  relatedPartyPolicy: string;
  customPolicies: Array<{ heading: string; text: string }>;
}

export interface InventoryDetails {
  rawMaterialsCY: number;
  rawMaterialsPY: number;
  wIPCY: number;
  wIPPY: number;
  finishedGoodsCY: number;
  finishedGoodsPY: number;
}

export interface PreviousYearBalances {
  revenue: number;
  costOfSales: number;
  otherIncome: number;
  adminExpenses: number;
  financeCosts: number;
  depreciation: number;
  incomeTaxExpense: number;
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
