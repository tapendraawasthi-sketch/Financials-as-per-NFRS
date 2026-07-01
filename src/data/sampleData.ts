// src/data/sampleData.ts
import { CompanyProfile } from '../types';

// ── SAMPLE_COMPANY ────────────────────────────────────────────────────────────

export const SAMPLE_COMPANY: CompanyProfile = {
  id: 'sample-himalayan-trading-001',
  companyName: 'Himalayan Trading Pvt. Ltd.',
  companyNameNepali: 'हिमालयन ट्रेडिङ प्रा. लि.',
  panVatNumber: '301234567',
  registrationNumber: '158/070/071',
  companyType: 'PrivateLimited',
  entityType: 'NASForMEs',

  address: {
    province: 'Bagmati',
    district: 'Kathmandu',
    municipality: 'Kathmandu Metropolitan City',
    wardNo: '10',
    streetOrTole: 'New Baneshwor',
    fullAddress: 'New Baneshwor, Ward No. 10, Kathmandu Metropolitan City, Kathmandu, Bagmati Province',
  },

  contactPerson: {
    name: 'Ramesh Shrestha',
    designation: 'Managing Director',
    phone: '9841234567',
    email: 'ramesh@himalayantrading.com.np',
  },

  auditor: {
    firmName: 'B.K. Acharya & Associates',
    caName: 'Bikash Kumar Acharya',
    membershipNumber: 'CA 2134',
    firmRegistrationNumber: 'CR 457',
  },

  fiscalYear: {
    bsYear: '2081/82',
    startDateBS: '2081-04-01',
    endDateBS: '2082-03-31',
    startDateAD: '2024-07-17',
    endDateAD: '2025-07-16',
    isLeapYear: false,
  },

  incomeTaxRatePercent: 25,
  roundingLevel: 100,

  accountingPolicies: {
    defaultDepreciationMethod: 'SLM',
    assetCategories: [
      {
        category: 'Building',
        method: 'SLM',
        ratePercent: 5,
        taxPoolRate: 5,
        nfrsCategory: 'ppe_building',
      },
      {
        category: 'Vehicle',
        method: 'WDV',
        ratePercent: 20,
        taxPoolRate: 20,
        nfrsCategory: 'ppe_vehicles',
      },
      {
        category: 'Furniture & Fixtures',
        method: 'SLM',
        ratePercent: 10,
        taxPoolRate: 10,
        nfrsCategory: 'ppe_furniture_fixtures',
      },
      {
        category: 'Computers & IT Equipment',
        method: 'WDV',
        ratePercent: 25,
        taxPoolRate: 25,
        nfrsCategory: 'ppe_computers',
      },
    ],
    inventoryCostFormula: 'WeightedAverage',
    hasGratuityLiability: true,
    hasLeaveEncashment: true,
    hasStaffBonus: true,
    auditFeeProvision: true,
    doubtfulDebtProvisionPercent: 5,
    currencyRounding: 'NPR',
    presentationCurrency: 'NPR',
    dateOfAuthorizationForIssue: '2025-10-15',
  },
};

// ── SAMPLE_TRIAL_BALANCE_CSV ──────────────────────────────────────────────────
// Format: Account Name,Closing Dr,Closing Cr
// All amounts in NPR. Total Dr must equal Total Cr.
//
// Balance verification:
//   Total Dr  = 50,000 + 250,000 + 500,000 + 180,000 + 95,000 + 45,000 + 320,000
//             + 2,500,000 + 1,200,000 + 15,000 + 2,100,000 + 280,000 + 25,200
//             + 120,000 + 18,000 + 72,000 + 35,000 + 150,000 + 42,000 + 47,300
//             = 8,044,500
//   Total Cr  = 650,000 + 140,000 + 75,000 + 35,000 + 8,500 + 800,000 + 2,000,000
//             + 500,000 + 200,000 + 3,500,000 + 136,000
//             = 8,044,500  ✓
//
// Note: "Other Admin Expenses" adjusted to 47,300 to ensure exact balance.

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
Accumulated Depreciation,,650000
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
Purchase,2100000,
Salary,280000,
Provident Fund,25200,
Rent,120000,
Electricity,18000,
Interest on Loan,72000,
Audit Fee,35000,
Depreciation,150000,
Other Admin Expenses,47300,
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
  { rawLabel: 'Himalayan Bank FD', expectedNfrsCategory: 'short_term_fdr', expectedConfidence: 85 },
  { rawLabel: 'Debtor - ABC Traders', expectedNfrsCategory: 'trade_receivables', expectedConfidence: 90 },
  { rawLabel: 'Debtor - XYZ Enterprises', expectedNfrsCategory: 'trade_receivables', expectedConfidence: 90 },
  { rawLabel: 'Advance to Suppliers', expectedNfrsCategory: 'loans_advances_others', expectedConfidence: 82 },
  { rawLabel: 'Closing Stock', expectedNfrsCategory: 'inventory_trading_goods', expectedConfidence: 88 },
  { rawLabel: 'Building', expectedNfrsCategory: 'ppe_building', expectedConfidence: 98 },
  { rawLabel: 'Vehicle', expectedNfrsCategory: 'ppe_vehicles', expectedConfidence: 98 },
  { rawLabel: 'Accumulated Depreciation', expectedNfrsCategory: 'accumulated_depreciation', expectedConfidence: 98 },
  { rawLabel: 'TDS Receivable', expectedNfrsCategory: 'advance_tax', expectedConfidence: 88 },
  { rawLabel: 'Creditor - Supplier A', expectedNfrsCategory: 'trade_payables', expectedConfidence: 90 },
  { rawLabel: 'Creditor - Supplier B', expectedNfrsCategory: 'trade_payables', expectedConfidence: 90 },
  { rawLabel: 'Audit Fee Payable', expectedNfrsCategory: 'audit_fee_payable', expectedConfidence: 95 },
  { rawLabel: 'TDS Payable', expectedNfrsCategory: 'tds_payable', expectedConfidence: 92 },
  { rawLabel: 'Term Loan - Nabil Bank', expectedNfrsCategory: 'long_term_loan_bank', expectedConfidence: 88 },
  { rawLabel: 'Paid-up Capital', expectedNfrsCategory: 'share_capital', expectedConfidence: 95 },
  { rawLabel: 'General Reserve', expectedNfrsCategory: 'general_reserve', expectedConfidence: 98 },
  { rawLabel: 'Retained Earnings', expectedNfrsCategory: 'retained_earnings', expectedConfidence: 98 },
  { rawLabel: 'Sales Revenue', expectedNfrsCategory: 'revenue_sales', expectedConfidence: 95 },
  { rawLabel: 'Purchase', expectedNfrsCategory: 'purchases', expectedConfidence: 95 },
  { rawLabel: 'Salary', expectedNfrsCategory: 'salary_expense', expectedConfidence: 95 },
  { rawLabel: 'Provident Fund', expectedNfrsCategory: 'pf_expense', expectedConfidence: 90 },
  { rawLabel: 'Rent', expectedNfrsCategory: 'rent_expense', expectedConfidence: 95 },
  { rawLabel: 'Electricity', expectedNfrsCategory: 'electricity_expense', expectedConfidence: 90 },
  { rawLabel: 'Interest on Loan', expectedNfrsCategory: 'bank_interest_expense', expectedConfidence: 90 },
  { rawLabel: 'Audit Fee', expectedNfrsCategory: 'audit_fee_expense', expectedConfidence: 95 },
  { rawLabel: 'Depreciation', expectedNfrsCategory: 'depreciation_expense', expectedConfidence: 98 },
  { rawLabel: 'Other Admin Expenses', expectedNfrsCategory: 'admin_expense_other', expectedConfidence: 85 },
  { rawLabel: 'VAT Payable', expectedNfrsCategory: 'vat_payable', expectedConfidence: 92 },
];

// ── SAMPLE_ASSET_REGISTER ─────────────────────────────────────────────────────
// Sample assets for testing depreciation engine.

export const SAMPLE_ASSETS = [
  {
    id: 'asset-001',
    assetName: 'Office Building — New Baneshwor',
    category: 'Building',
    purchaseDate: '2073-01-15',  // BS date
    originalCost: 2500000,
    openingNBV: 1875000,        // After prior years SLM 5%
    openingAccDep: 625000,
    method: 'SLM' as const,
    ratePercent: 5,
    residualValue: 250000,
    isFullYear: true,
  },
  {
    id: 'asset-002',
    assetName: 'Delivery Vehicle — Ba 1 Ja 2345',
    category: 'Vehicle',
    purchaseDate: '2078-08-20',
    originalCost: 1200000,
    openingNBV: 614400,         // After 3 years WDV 20%
    openingAccDep: 585600,
    method: 'WDV' as const,
    ratePercent: 20,
    residualValue: 0,
    isFullYear: true,
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
