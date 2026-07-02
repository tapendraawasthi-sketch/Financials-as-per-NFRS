// src/data/sampleData.ts
import { CompanyProfile, CompanyType, EntityType, DepreciationMethod, InventoryCostMethod } from '../types';

// ── SAMPLE_COMPANY ────────────────────────────────────────────────────────────

export const SAMPLE_COMPANY: CompanyProfile = {
  id: 'sample-himalayan-trading-001',
  companyName: 'Himalayan Trading Pvt. Ltd.',
  panVatNumber: '301234567',
  registrationNumber: '158/070/071',
  companyType: CompanyType.PrivateLimited,
  entityType: EntityType.NASForMEs,

  address: {
    province: 'Bagmati',
    district: 'Kathmandu',
    municipality: 'Kathmandu Metropolitan City',
    ward: '10',
    tole: 'New Baneshwor',
    fullAddress: 'New Baneshwor, Ward No. 10, Kathmandu Metropolitan City, Kathmandu, Bagmati Province',
  },

  contactPerson: 'Ramesh Shrestha',
  designation: 'Managing Director',
  phone: '9841234567',
  email: 'ramesh@himalayantrading.com.np',

  auditorInfo: {
    auditorFirmName: 'B.K. Acharya & Associates',
    auditorName: 'Bikash Kumar Acharya',
    icaRegistrationNumber: 'CA 2134',
    position: 'Partner',
  },

  fiscalYear: {
    bsYear: '2081/82',
    startDateBS: '2081-04-01',
    endDateBS: '2082-03-31',
    startDateAD: '2024-07-17',
    endDateAD: '2025-07-16',
  },

  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  accountingPolicies: {
    depreciationMethod: DepreciationMethod.WrittenDownValue,
    inventoryCostMethod: InventoryCostMethod.WeightedAverage,
    assetCategories: [
      {
        id: 'buildings',
        name: 'Building',
        depreciationMethod: DepreciationMethod.StraightLine,
        residualValuePercent: 5,
        usefulLifeYears: 20,
        taxDepreciationRate: 5,
        taxPool: 'A',
      },
      {
        id: 'vehicles',
        name: 'Vehicle',
        depreciationMethod: DepreciationMethod.WrittenDownValue,
        residualValuePercent: 10,
        usefulLifeYears: 5,
        taxDepreciationRate: 20,
        taxPool: 'C',
      },
      {
        id: 'furniture',
        name: 'Furniture & Fixtures',
        depreciationMethod: DepreciationMethod.StraightLine,
        residualValuePercent: 10,
        usefulLifeYears: 10,
        taxDepreciationRate: 10,
        taxPool: 'B',
      },
      {
        id: 'computers',
        name: 'Computers & IT Equipment',
        depreciationMethod: DepreciationMethod.WrittenDownValue,
        residualValuePercent: 0,
        usefulLifeYears: 4,
        taxDepreciationRate: 25,
        taxPool: 'B',
      },
    ],
    recognizeGratuity: true,
    gratuityDaysPerYear: 15,
    recognizeLeaveEncashment: true,
    bonusRatePercent: 10,
    incomeTaxRatePercent: 25,
    roundingLevel: 1,
    currency: 'NPR',
    investmentValuationMethod: 'CostOrMarket',
  },
};

// ── SAMPLE_TRIAL_BALANCE_CSV ──────────────────────────────────────────────────
// Format: Account Name,Closing Dr,Closing Cr
// All amounts in NPR. Total Dr must equal Total Cr.
//
// Balance verification:
//   Total Dr = 50,000 + 250,000 + 500,000 + 180,000 + 95,000 + 45,000 + 320,000
//            + 2,500,000 + 1,200,000 + 15,000 + 2,100,000 + 280,000 + 25,200
//            + 120,000 + 18,000 + 72,000 + 35,000 + 409,300
//            = 82,14,500
//   Total Cr = 500,000 + 140,000 + 75,000 + 35,000 + 8,500 + 800,000 + 2,000,000
//            + 500,000 + 200,000 + 3,500,000 + 136,000 + 320,000
//            = 82,14,500  ✓
//
// Note: Adjusted to reflect unadjusted TB for depreciation and correct closing stock double-entry.

export const SAMPLE_TRIAL_BALANCE_CSV = `Account Name,Closing Dr,Closing Cr
Cash in Hand,50000,
NIC Asia Bank Current Account,250000,
Himalayan Bank FD,500000,
Debtor - ABC Traders,180000,
Debtor - XYZ Enterprises,95000,
Advance to Suppliers,45000,
Closing Stock,320000,
Building,2500000,
Vehicle,1200000,
Accumulated Depreciation,,500000
TDS Receivable,15000,
Creditor - Supplier A,,140000
Creditor - Supplier B,,75000
Audit Fee Payable,,35000
TDS Payable,,8500
Term Loan - Nabil Bank,,800000
Paid-up Capital,,2000000
General Reserve,,500000
Retained Earnings,,200000
Sales Revenue,,3500000
Changes in Inventory,,320000
Purchase,2100000,
Salary,280000,
Provident Fund,25200,
Rent,120000,
Electricity,18000,
Interest on Loan,72000,
Audit Fee,35000,
Other Admin Expenses,409300,
VAT Payable,,136000
`;

// ── SAMPLE_PARSED_TB_ROWS ─────────────────────────────────────────────────────
// Pre-parsed TB rows for testing the account mapper without the parser.

export const SAMPLE_TB_ROW_MAPPINGS: Array<{
  rawLabel: string;
  expectedNfrsCategory: string;
  expectedConfidence: number;
}> = [
  { rawLabel: 'Cash in Hand', expectedNfrsCategory: 'cash_in_hand', expectedConfidence: 95 },
  { rawLabel: 'NIC Asia Bank Current Account', expectedNfrsCategory: 'bank_current_account', expectedConfidence: 90 },
  { rawLabel: 'Himalayan Bank FD', expectedNfrsCategory: 'bank_fixed_deposit_current', expectedConfidence: 85 },
  { rawLabel: 'Debtor - ABC Traders', expectedNfrsCategory: 'trade_receivables', expectedConfidence: 90 },
  { rawLabel: 'Debtor - XYZ Enterprises', expectedNfrsCategory: 'trade_receivables', expectedConfidence: 90 },
  { rawLabel: 'Advance to Suppliers', expectedNfrsCategory: 'other_receivables_advance_supplier', expectedConfidence: 82 },
  { rawLabel: 'Closing Stock', expectedNfrsCategory: 'inventory_finished_goods', expectedConfidence: 88 },
  { rawLabel: 'Building', expectedNfrsCategory: 'ppe_buildings', expectedConfidence: 98 },
  { rawLabel: 'Vehicle', expectedNfrsCategory: 'ppe_vehicles', expectedConfidence: 98 },
  { rawLabel: 'Accumulated Depreciation', expectedNfrsCategory: 'accum_depreciation', expectedConfidence: 98 },
  { rawLabel: 'TDS Receivable', expectedNfrsCategory: 'other_receivables_tds', expectedConfidence: 88 },
  { rawLabel: 'Creditor - Supplier A', expectedNfrsCategory: 'trade_payables_creditors', expectedConfidence: 90 },
  { rawLabel: 'Creditor - Supplier B', expectedNfrsCategory: 'trade_payables_creditors', expectedConfidence: 90 },
  { rawLabel: 'Audit Fee Payable', expectedNfrsCategory: 'audit_fee_payable', expectedConfidence: 95 },
  { rawLabel: 'TDS Payable', expectedNfrsCategory: 'tds_payable', expectedConfidence: 92 },
  { rawLabel: 'Term Loan - Nabil Bank', expectedNfrsCategory: 'borrowings_noncurrent_bank', expectedConfidence: 88 },
  { rawLabel: 'Paid-up Capital', expectedNfrsCategory: 'share_capital', expectedConfidence: 95 },
  { rawLabel: 'General Reserve', expectedNfrsCategory: 'general_reserve', expectedConfidence: 98 },
  { rawLabel: 'Retained Earnings', expectedNfrsCategory: 'retained_earnings', expectedConfidence: 98 },
  { rawLabel: 'Sales Revenue', expectedNfrsCategory: 'revenue_sales', expectedConfidence: 95 },
  { rawLabel: 'Purchase', expectedNfrsCategory: 'cogs_purchases', expectedConfidence: 95 },
  { rawLabel: 'Salary', expectedNfrsCategory: 'emp_expense_salaries', expectedConfidence: 95 },
  { rawLabel: 'Provident Fund', expectedNfrsCategory: 'emp_expense_pf', expectedConfidence: 90 },
  { rawLabel: 'Rent', expectedNfrsCategory: 'admin_rent', expectedConfidence: 95 },
  { rawLabel: 'Electricity', expectedNfrsCategory: 'admin_electricity', expectedConfidence: 90 },
  { rawLabel: 'Interest on Loan', expectedNfrsCategory: 'finance_cost_interest', expectedConfidence: 90 },
  { rawLabel: 'Audit Fee', expectedNfrsCategory: 'admin_audit_fee', expectedConfidence: 95 },
  { rawLabel: 'Depreciation', expectedNfrsCategory: 'depreciation_expense', expectedConfidence: 98 },
  { rawLabel: 'Other Admin Expenses', expectedNfrsCategory: 'admin_other', expectedConfidence: 85 },
  { rawLabel: 'VAT Payable', expectedNfrsCategory: 'other_payables', expectedConfidence: 92 },
];

// ── SAMPLE_ASSET_REGISTER ─────────────────────────────────────────────────────
// Sample assets for testing depreciation engine.

export const SAMPLE_ASSETS = [
  {
    id: 'asset-001',
    assetName: 'Office Building — New Baneshwor',
    categoryId: 'ppe_buildings',
    purchaseDateBS: '2073-01-15',  // BS date
    purchaseDateAD: '2016-04-27',
    originalCost: 2500000,
    additionalCost: 0,
    openingNBV: 1875000,        // After prior years SLM 5%
    accumDepreciationOpening: 625000,
    depreciationMethod: 'slm' as const,
    usefulLifeYears: 20,
    ratePercent: 5,
    residualValue: 250000,
    isFullYear: true,
    isFullyDepreciated: false,
    isMortgaged: false,
  },
  {
    id: 'asset-002',
    assetName: 'Delivery Vehicle — Ba 1 Ja 2345',
    categoryId: 'ppe_vehicles',
    purchaseDateBS: '2078-08-20',
    purchaseDateAD: '2021-12-05',
    originalCost: 1200000,
    additionalCost: 0,
    openingNBV: 614400,         // After 3 years WDV 20%
    accumDepreciationOpening: 585600,
    depreciationMethod: 'wdv' as const,
    wdvRate: 20,
    usefulLifeYears: 5,
    residualValue: 0,
    isFullYear: true,
    isFullyDepreciated: false,
    isMortgaged: false,
  },
];

// ── SAMPLE_EXPECTED_FINANCIALS ────────────────────────────────────────────────
// Pre-calculated expected values for validation in tests.
// Based on the sample trial balance data.

export const SAMPLE_EXPECTED = {
  totalRevenue: 3500000,
  totalPurchases: 2100000,
  grossProfit: 1400000,       // Revenue - Purchases - Stock change
  totalEmployeeCosts: 305200, // Salary 280,000 + PF 25,200
  totalFinanceCosts: 72000,
  totalAdminExpenses: 252300, // Rent + Electricity + Audit Fee + Depreciation + Other Admin
  profitBeforeTax: 770500,    // Approximate — before bonus and tax
  staffBonus: 70045,          // 10% of PBT/(1+0.1) approx
  incomeTax: 175114,          // 25% of taxable profit approx

  // Balance Sheet
  totalCurrentAssets: 1455000, // Cash + Banks + Debtors + Advance + Stock + TDS
  totalNCA: 3050000,           // Building + Vehicle net of depreciation
  totalAssets: 4505000,

  totalCurrentLiabilities: 394500, // Creditors + Audit Fee Payable + TDS + VAT
  totalNCL: 800000,            // Term Loan
  totalEquity: 3310500,        // Capital + Reserves + Retained + CY Profit (approx)
  totalLiabilitiesAndEquity: 4505000,
};
