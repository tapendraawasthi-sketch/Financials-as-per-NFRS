// ─── Enums ────────────────────────────────────────────────────────────────────

export enum CompanyType {
  PrivateLimited   = 'PrivateLimited',
  PublicLimited    = 'PublicLimited',
  Partnership      = 'Partnership',
  Proprietorship   = 'Proprietorship',
  NGO              = 'NGO',
  Cooperative      = 'Cooperative',
  Other            = 'Other',
}

export enum EntityType {
  NASForMEs = 'NASForMEs',   // Default — Micro Entities
  FullNFRS  = 'FullNFRS',    // Larger companies
}

export enum DepreciationMethod {
  StraightLine      = 'StraightLine',
  WrittenDownValue  = 'WrittenDownValue',
  UnitsOfProduction = 'UnitsOfProduction',
}

export enum InventoryCostMethod {
  FIFO            = 'FIFO',
  WeightedAverage = 'WeightedAverage',
}

// ─── Fiscal Year ──────────────────────────────────────────────────────────────

export interface FiscalYear {
  bsYear: string;       // e.g. "2081/82"
  startDateBS: string;  // e.g. "1 Shrawan 2081"
  endDateBS: string;    // e.g. "31 Ashadh 2082"
  startDateAD: string;  // e.g. "July 16, 2024"
  endDateAD: string;    // e.g. "July 15, 2025"
}

// ─── Asset Category ───────────────────────────────────────────────────────────

export interface AssetCategory {
  id: string;
  name: string;                          // e.g. "Buildings"
  usefulLifeYears: number;
  residualValuePercent: number;          // 0–100
  depreciationMethod: DepreciationMethod;
  taxDepreciationRate: number;           // e.g. 5 for 5% (Nepal Income Tax Act pools)
  taxPool: 'A' | 'B' | 'C' | 'D';
}

// ─── Accounting Policies ──────────────────────────────────────────────────────

export interface AccountingPolicies {
  depreciationMethod: DepreciationMethod;
  inventoryCostMethod: InventoryCostMethod;
  assetCategories: AssetCategory[];
  recognizeGratuity: boolean;
  gratuityDaysPerYear: number;           // default 15
  recognizeLeaveEncashment: boolean;
  bonusRatePercent: number;              // default 0
  incomeTaxRatePercent: number;          // e.g. 25
  roundingLevel: 1 | 10 | 100 | 1000 | 10000;
  currency: 'NPR';
  investmentValuationMethod: 'CostOrMarket' | 'FairValue';
}

// ─── Auditor Info ─────────────────────────────────────────────────────────────

export interface AuditorInfo {
  auditorName: string;
  auditorFirmName: string;
  icaRegistrationNumber: string;
  position: 'Partner' | 'Proprietor' | 'Qualified';
}

// ─── Company Profile ──────────────────────────────────────────────────────────

export interface CompanyProfile {
  id: string;                  // UUID
  companyName: string;         // Exact as per registration certificate
  panVatNumber: string;
  registrationNumber: string;
  companyType: CompanyType;
  entityType: EntityType;
  address: {
    province: string;
    district: string;
    municipality: string;
    ward: string;
    tole: string;
    fullAddress: string;
  };
  contactPerson: string;
  designation: string;
  phone: string;
  email: string;
  chairperson?: string;
  director?: string;
  accountsHead?: string;
  auditorInfo?: AuditorInfo;
  fiscalYear: FiscalYear;
  accountingPolicies: AccountingPolicies;
  createdAt: string;           // ISO date string
  updatedAt: string;
}

// ─── Default Asset Categories ─────────────────────────────────────────────────
// Based on Nepal standard useful lives and Income Tax Act depreciation pools

export const DEFAULT_ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: 'land',
    name: 'Land',
    usefulLifeYears: 0,
    residualValuePercent: 0,
    depreciationMethod: DepreciationMethod.StraightLine,
    taxDepreciationRate: 0,
    taxPool: 'A',
  },
  {
    id: 'buildings',
    name: 'Buildings',
    usefulLifeYears: 40,
    residualValuePercent: 5,
    depreciationMethod: DepreciationMethod.StraightLine,
    taxDepreciationRate: 5,
    taxPool: 'A',
  },
  {
    id: 'office_equipment',
    name: 'Office Equipment',
    usefulLifeYears: 5,
    residualValuePercent: 10,
    depreciationMethod: DepreciationMethod.WrittenDownValue,
    taxDepreciationRate: 25,
    taxPool: 'B',
  },
  {
    id: 'computers',
    name: 'Computers',
    usefulLifeYears: 5,
    residualValuePercent: 10,
    depreciationMethod: DepreciationMethod.WrittenDownValue,
    taxDepreciationRate: 25,
    taxPool: 'B',
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    usefulLifeYears: 5,
    residualValuePercent: 10,
    depreciationMethod: DepreciationMethod.WrittenDownValue,
    taxDepreciationRate: 25,
    taxPool: 'B',
  },
  {
    id: 'furniture',
    name: 'Furniture & Fixtures',
    usefulLifeYears: 10,
    residualValuePercent: 10,
    depreciationMethod: DepreciationMethod.StraightLine,
    taxDepreciationRate: 20,
    taxPool: 'C',
  },
  {
    id: 'plant_machinery',
    name: 'Plant & Machinery',
    usefulLifeYears: 15,
    residualValuePercent: 10,
    depreciationMethod: DepreciationMethod.WrittenDownValue,
    taxDepreciationRate: 20,
    taxPool: 'C',
  },
  {
    id: 'intangibles',
    name: 'Intangible Assets',
    usefulLifeYears: 5,
    residualValuePercent: 0,
    depreciationMethod: DepreciationMethod.StraightLine,
    taxDepreciationRate: 15,
    taxPool: 'D',
  },
];

// ─── Default Accounting Policies ─────────────────────────────────────────────

export const DEFAULT_ACCOUNTING_POLICIES: AccountingPolicies = {
  depreciationMethod: DepreciationMethod.WrittenDownValue,
  inventoryCostMethod: InventoryCostMethod.WeightedAverage,
  assetCategories: DEFAULT_ASSET_CATEGORIES,
  recognizeGratuity: true,
  gratuityDaysPerYear: 15,
  recognizeLeaveEncashment: true,
  bonusRatePercent: 0,
  incomeTaxRatePercent: 25,
  roundingLevel: 100,
  currency: 'NPR',
  investmentValuationMethod: 'CostOrMarket',
};
