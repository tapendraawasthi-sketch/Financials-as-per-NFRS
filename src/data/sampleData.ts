// src/data/sampleData.ts
import type { CompanyProfile } from '../types';

export const SAMPLE_COMPANY: CompanyProfile = {
  id: 'sample-001',
  companyName: 'ABC PRIVATE LIMITED',
  panVatNumber: '123456789',
  registrationNumber: '12345/074/075',
  companyType: 'PrivateLimited',
  entityType: 'NASForMEs',
  fullAddress: 'Kathmandu, Nepal',
  chairperson: 'Mr. A',
  director: 'Mr. B',
  accountsHead: 'Mr. C',
  auditorInfo: {
    auditorName: 'CA. A',
    auditorFirmName: 'A & Associates',
    position: 'Proprietor',
  },
  fiscalYear: {
    bsYear: '2081/82',
    startDateBS: '1 Shrawan 2081',
    endDateBS: '31 Ashadh 2082',
    startDateAD: 'July 16, 2024',
    endDateAD: 'July 15, 2025',
    startYear: 2024,
    endYear: 2025,
    isLeapYear: false,
  },
  accountingPolicies: {
    depreciationMethod: 'StraightLine',
    inventoryCostMethod: 'WeightedAverage',
    incomeTaxRatePercent: 25,
    roundingLevel: 100,
    bonusRatePercent: 10,
    gratuityDaysPerYear: 15,
    recognizeGratuity: true,
    recognizeLeaveEncashment: true,
    assetCategories: [
      { id: 'buildings', name: 'Buildings', defaultMethod: 'StraightLine', defaultUsefulLife: 25, defaultWDVRate: 5, defaultResidualPct: 0 },
      { id 'furniture', name: 'Furniture & Office Equipment', defaultMethod: 'StraightLine', defaultUsefulLife: 5, defaultWDVRate: 25, defaultResidualPct: 0 },
      { id: 'vehicles', name: 'Vehicles', defaultMethod: 'StraightLine', defaultUsefulLife: 10, defaultWDVRate: 20, defaultResidualPct: 0 },
      { id: 'plant', name: 'Plant & Machinery', defaultMethod: 'StraightLine', defaultUsefulLife: 15, defaultWDVRate: 15, defaultResidualPct: 0 },
      { id: 'intangibles', name: 'Intangible Assets', defaultMethod: 'StraightLine', defaultUsefulLife: 10, defaultWDVRate: 0, defaultResidualPct: 0 },
    ],
  },
  numberOfEmployees: 12,
};

export const SAMPLE_TRIAL_BALANCE_CSV = \`Account Name,Opening Dr,Opening Cr,During Dr,During Cr,Closing Dr,Closing Cr
Paid-up Capital,0,50000000,0,1000000,0,51000000
Reserves & Surplus,0,2532000,0,0,938901,0
Bank A,0,2500000,1000000,0,0,1500000
Bank B,0,1200000,200000,0,0,1000000
Creditor A,0,125000,50000,400000,0,475000
Creditor B,0,55000,5000,50000,0,100000
Creditor C,0,0,100000,0,100000,0
Audit Fee Payable,0,115000,115000,150000,0,150000
Staff Bonus Payable,0,115000,0,132349,0,247349
Provision for CSR,0,25000,0,0,0,25000
Director A,0,75000,30000,0,0,45000
Director B,0,115000,20000,0,0,95000
Employee A,0,10000,10000,20000,0,20000
Employee B,0,15000,15000,30000,0,30000
Provident Fund Payable,0,0,0,10000,0,10000
TDS - Audit Fee,0,10000,5000,20000,0,25000
TDS - Ltd. Company,0,25000,0,0,0,25000
TDS- Proprietorship,0,5000,0,0,0,5000
TDS - Pvt. Ltd,0,10000,0,0,0,10000
TDS- Salary,0,15000,0,15000,0,30000
TDS - SST,0,5000,0,0,0,5000
TDS - Rental,0,10000,0,0,0,10000
VAT,0,15000,15000,30000,0,30000
Income Tax Payable,0,55000,55000,252243,0,252243
Land,37190767,0,0,0,37190767,0
Building,5500000,0,0,0,5500000,0
Furniture & Office Equipment,1900000,0,0,0,1900000,0
Vehicle,1700000,0,0,0,1700000,0
Plant & Machinery,2200000,0,0,0,2200000,0
Tally Software,165000,0,0,0,165000,0
Leasehold,6000000,0,0,0,6000000,0
Work In Progress,2800000,0,0,0,2800000,0
Biological Assets,0,0,1010000,0,1010000,0
Accumulated Depreciation,0,2380767,0,907506,0,3288274
Shares of XYZ Ltd.,0,0,500000,0,500000,0
Shares of PQR Ltd.,0,0,1200000,0,1200000,0
Provision for Impairment on Investment,0,0,0,200000,0,200000
Deposits,225000,0,200000,150000,275000,0
Loans & Advances (Asset),20000,0,50000,20000,50000,0
Staff Advance,75000,0,0,50000,25000,0
Debtor A,1302000,0,1100000,1200000,1202000,0
Debtor B,75000,0,200000,50000,225000,0
Debtor C,0,0,0,100000,0,100000
Provision for Impairment on debtors,0,0,0,100000,0,100000
Director C,0,0,50000,0,50000,0
Director D,0,0,50000,0,50000,0
Petty Cash,10000,0,20000,8000,22000,0
Bank C,85000,0,100000,70000,115000,0
Bank D,115000,0,74000,115000,74000,0
Inventory,25000,0,0,0,25000,0
Advance Tax,25000,0,0,0,25000,0
Non Current Assets held for Sale,0,0,10000,0,10000,0
Sales Revenue,0,0,0,9000000,0,9000000
Service Income,0,0,0,1500000,0,1500000
Purchase,0,0,6000000,0,6000000,0
Wages,0,0,500000,0,500000,0
Other Direct Expenses,0,0,100000,0,100000,0
Interest Income,0,0,0,2000,0,2000
Commission Income,0,0,0,50000,0,50000
Other Indirect Income,0,0,0,5000,0,5000
Rental Income,0,0,0,5000,0,5000
Dividend Income,0,0,0,10000,0,10000
Salaries & Wages,0,0,500000,0,500000,0
Allowances,0,0,100000,0,100000,0
PF / SSF / CIT,0,0,100000,0,100000,0
Staff Bonus,0,0,0,0,132349,0
Leave Encashment,0,0,20000,0,20000,0
Other employee related expenses,0,0,50000,0,50000,0
Interest expense,0,0,250000,0,250000,0
Bank Charges,0,0,10000,0,10000,0
Depreciation,0,0,0,0,907506,0
Impairment on Receivables,0,0,100000,0,100000,0
Impairment on Unlisted Shares,0,0,200000,0,200000,0
Pool A,0,0,10000,0,10000,0
Pool B,0,0,5000,0,5000,0
Pool C,0,0,25000,0,25000,0
Pool D,0,0,10000,0,10000,0
Pool E,0,0,1000,0,1000,0
Income Tax Expense,0,0,0,0,252243,0
Audit Fee,0,0,25000,0,25000,0
Advertisement & Business Promotion,0,0,20000,0,20000,0
Fuel Expenses,0,0,50000,0,50000,0
House Rent,0,0,50000,0,50000,0
Insurance Premium,0,0,20000,0,20000,0
Miscellaneous expenses,0,0,25000,0,25000,0
Printing & Stationery,0,0,10000,0,10000,0
Refreshment Expenses,0,0,100000,0,100000,0
Travelling,0,0,20000,0,20000,0
Water & Electricity Charges,0,0,25000,0,25000,0
Cash Credit,0,0,0,100000,0,100000
Working Capital Loan,0,0,0,50000,0,50000\`;

export const SAMPLE_EXPECTED = {
  totalAssets: 58785494,
  totalCurrentAssets: 2008000,
  totalNCA: 56777494,
  totalLiabilitiesAndEquity: 58785494,
  totalCurrentLiabilities: 5145494,
  totalNCL: 2640000,
  totalEquity: 51000000,
  totalRevenue: 10500000,
  totalPurchases: 6000000,
  profitBeforeTax: 1191144,
  incomeTax: 252243,
  netProfit: 938901,
};
