// src/data/nfrsCategories.ts
import { NFRSCategory } from '../types';

export interface NFRSCategoryInfo {
  value: NFRSCategory;
  label: string;
  group: string;
  normalBalance: 'debit' | 'credit';
  noteRef: string;
  description: string;
}

export const NFRS_CATEGORY_INFO: NFRSCategoryInfo[] = [
  // ── Non-Current Assets — PPE ──────────────────────────────────────────────
  {
    value: 'ppe_land',
    label: 'Land',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Freehold and leasehold land held for business operations.',
  },
  {
    value: 'ppe_building',
    label: 'Buildings',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Factory, office and other buildings owned by the company.',
  },
  {
    value: 'ppe_plant_machinery',
    label: 'Plant & Machinery',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Production plant, industrial machinery and equipment.',
  },
  {
    value: 'ppe_furniture_fixtures',
    label: 'Furniture & Fixtures',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Office furniture, fittings and built-in fixtures.',
  },
  {
    value: 'ppe_vehicles',
    label: 'Vehicles',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Cars, vans, trucks and other motor vehicles.',
  },
  {
    value: 'ppe_computers',
    label: 'Computers & IT Equipment',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Computers, servers, printers and IT peripherals.',
  },
  {
    value: 'ppe_equipment',
    label: 'Other Equipment',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Other tangible fixed assets not classified elsewhere.',
  },
  {
    value: 'ppe_cwip',
    label: 'Capital Work-in-Progress',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.2',
    description: 'Assets under construction or not yet ready for use.',
  },
  {
    value: 'accumulated_depreciation',
    label: 'Accumulated Depreciation',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'credit',
    noteRef: '3.1',
    description: 'Total depreciation charged on PPE to date (contra-asset).',
  },
  {
    value: 'intangible_assets',
    label: 'Intangible Assets',
    group: 'Non-Current Assets — Property, Plant & Equipment',
    normalBalance: 'debit',
    noteRef: '3.3',
    description: 'Goodwill, software licences, trademarks and other intangibles.',
  },

  // ── Non-Current Assets — Investments ─────────────────────────────────────
  {
    value: 'investment_equity_listed',
    label: 'Investment in Listed Shares',
    group: 'Non-Current Assets — Investments',
    normalBalance: 'debit',
    noteRef: '3.4',
    description: 'Investment in equity shares listed on NEPSE.',
  },
  {
    value: 'investment_equity_unlisted',
    label: 'Investment in Unlisted Shares',
    group: 'Non-Current Assets — Investments',
    normalBalance: 'debit',
    noteRef: '3.4',
    description: 'Investment in private company equity shares not listed on NEPSE.',
  },
  {
    value: 'investment_mutual_fund',
    label: 'Investment in Mutual Funds',
    group: 'Non-Current Assets — Investments',
    normalBalance: 'debit',
    noteRef: '3.4',
    description: 'Units held in SEBON-registered mutual funds.',
  },
  {
    value: 'investment_bonds_debentures',
    label: 'Bonds & Debentures',
    group: 'Non-Current Assets — Investments',
    normalBalance: 'debit',
    noteRef: '3.4',
    description: 'Government securities, corporate bonds and debentures.',
  },
  {
    value: 'investment_fdr',
    label: 'Fixed Deposit Receipts (FDR)',
    group: 'Non-Current Assets — Investments',
    normalBalance: 'debit',
    noteRef: '3.4',
    description: 'Long-term fixed deposits placed with banks and financial institutions.',
  },
  {
    value: 'investment_other',
    label: 'Other Investments',
    group: 'Non-Current Assets — Investments',
    normalBalance: 'debit',
    noteRef: '3.4',
    description: 'Other long-term investments not classified elsewhere.',
  },

  // ── Non-Current Assets — Other ────────────────────────────────────────────
  {
    value: 'goodwill',
    label: 'Goodwill',
    group: 'Non-Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.3',
    description: 'Goodwill arising on acquisition of a business.',
  },
  {
    value: 'deferred_tax_asset',
    label: 'Deferred Tax Asset',
    group: 'Non-Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.23',
    description: 'Deferred tax asset arising from timing differences.',
  },
  {
    value: 'other_nca',
    label: 'Other Non-Current Assets',
    group: 'Non-Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Long-term deposits, security deposits and other NCA not classified above.',
  },
  {
    value: 'long_term_loans_advances',
    label: 'Long-term Loans & Advances',
    group: 'Non-Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Loans and advances recoverable after twelve months.',
  },

  // ── Current Assets — Trade Receivables ───────────────────────────────────
  {
    value: 'trade_receivables',
    label: 'Trade Receivables (Debtors)',
    group: 'Current Assets — Trade Receivables',
    normalBalance: 'debit',
    noteRef: '3.5',
    description: 'Amounts owed by customers for goods/services already delivered.',
  },
  {
    value: 'allowance_for_doubtful_debts',
    label: 'Less: Allowance for Doubtful Debts',
    group: 'Current Assets — Trade Receivables',
    normalBalance: 'credit',
    noteRef: '3.5',
    description: 'Provision for estimated uncollectable trade receivables (contra-asset).',
  },
  {
    value: 'bills_receivable',
    label: 'Bills Receivable',
    group: 'Current Assets — Trade Receivables',
    normalBalance: 'debit',
    noteRef: '3.5',
    description: 'Promissory notes and bills of exchange receivable.',
  },

  // ── Current Assets — Cash & Bank ─────────────────────────────────────────
  {
    value: 'cash_in_hand',
    label: 'Cash in Hand',
    group: 'Current Assets — Cash & Bank',
    normalBalance: 'debit',
    noteRef: '3.8',
    description: 'Physical cash held at premises and petty cash.',
  },
  {
    value: 'bank_current_account',
    label: 'Bank — Current Account',
    group: 'Current Assets — Cash & Bank',
    normalBalance: 'debit',
    noteRef: '3.8',
    description: 'Balances in bank current / cheque accounts.',
  },
  {
    value: 'bank_savings_account',
    label: 'Bank — Savings Account',
    group: 'Current Assets — Cash & Bank',
    normalBalance: 'debit',
    noteRef: '3.8',
    description: 'Balances in bank savings accounts.',
  },
  {
    value: 'bank_od_account',
    label: 'Bank Overdraft (Asset Balance)',
    group: 'Current Assets — Cash & Bank',
    normalBalance: 'debit',
    noteRef: '3.8',
    description: 'Temporary debit balance on an overdraft facility (asset side).',
  },
  {
    value: 'short_term_fdr',
    label: 'Short-term Fixed Deposits (≤3 months)',
    group: 'Current Assets — Cash & Bank',
    normalBalance: 'debit',
    noteRef: '3.8',
    description: 'Fixed deposits maturing within three months, treated as cash equivalents.',
  },

  // ── Current Assets — Inventories ──────────────────────────────────────────
  {
    value: 'inventory_raw_material',
    label: 'Inventories — Raw Materials',
    group: 'Current Assets — Inventories',
    normalBalance: 'debit',
    noteRef: '3.7',
    description: 'Raw materials and components held for production.',
  },
  {
    value: 'inventory_wip',
    label: 'Inventories — Work-in-Progress',
    group: 'Current Assets — Inventories',
    normalBalance: 'debit',
    noteRef: '3.7',
    description: 'Goods partially manufactured and awaiting completion.',
  },
  {
    value: 'inventory_finished_goods',
    label: 'Inventories — Finished Goods',
    group: 'Current Assets — Inventories',
    normalBalance: 'debit',
    noteRef: '3.7',
    description: 'Completed goods held for sale.',
  },
  {
    value: 'inventory_trading_goods',
    label: 'Inventories — Trading / Stock-in-Trade',
    group: 'Current Assets — Inventories',
    normalBalance: 'debit',
    noteRef: '3.7',
    description: 'Goods purchased for resale without further processing.',
  },
  {
    value: 'inventory_consumables',
    label: 'Inventories — Consumables & Stores',
    group: 'Current Assets — Inventories',
    normalBalance: 'debit',
    noteRef: '3.7',
    description: 'Office consumables, packing materials and factory stores.',
  },

  // ── Current Assets — Other ────────────────────────────────────────────────
  {
    value: 'advance_tax',
    label: 'Advance Income Tax / TDS Receivable',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Tax paid in advance and TDS deducted at source on income.',
  },
  {
    value: 'vat_receivable',
    label: 'VAT Receivable (Input Tax)',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Input VAT credit available for set-off against output VAT.',
  },
  {
    value: 'prepaid_expenses',
    label: 'Prepaid Expenses',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Expenses paid in advance for future periods.',
  },
  {
    value: 'accrued_income',
    label: 'Accrued Income / Interest Receivable',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Income earned but not yet received or invoiced.',
  },
  {
    value: 'loans_advances_staff',
    label: 'Loans & Advances to Staff',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Short-term advances and salary advances to employees.',
  },
  {
    value: 'loans_advances_others',
    label: 'Loans & Advances to Others',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Other short-term advances and deposits recoverable.',
  },
  {
    value: 'other_current_assets',
    label: 'Other Current Assets',
    group: 'Current Assets — Other',
    normalBalance: 'debit',
    noteRef: '3.6',
    description: 'Miscellaneous current assets not classified elsewhere.',
  },

  // ── Equity ────────────────────────────────────────────────────────────────
  {
    value: 'share_capital',
    label: 'Share Capital',
    group: 'Equity',
    normalBalance: 'credit',
    noteRef: '3.9',
    description: 'Paid-up share capital — authorised and issued ordinary shares.',
  },
  {
    value: 'share_premium',
    label: 'Share Premium / Securities Premium',
    group: 'Equity',
    normalBalance: 'credit',
    noteRef: '3.9',
    description: 'Premium received on issue of shares above face value.',
  },
  {
    value: 'general_reserve',
    label: 'General Reserve',
    group: 'Equity',
    normalBalance: 'credit',
    noteRef: '3.10',
    description: 'Accumulated general reserve appropriated from retained earnings.',
  },
  {
    value: 'retained_earnings',
    label: 'Retained Earnings / Accumulated Profit',
    group: 'Equity',
    normalBalance: 'credit',
    noteRef: '3.10',
    description: 'Cumulative profit/(loss) retained in the business after dividends.',
  },
  {
    value: 'other_reserves',
    label: 'Other Reserves',
    group: 'Equity',
    normalBalance: 'credit',
    noteRef: '3.10',
    description: 'Capital reserve, revaluation reserve and other specific reserves.',
  },
  {
    value: 'proprietors_capital',
    label: "Proprietor's Capital (Sole Trade/Partnership)",
    group: 'Equity',
    normalBalance: 'credit',
    noteRef: '3.9',
    description: "Capital contributed by proprietor or partners in non-corporate entities.",
  },

  // ── Non-Current Liabilities ───────────────────────────────────────────────
  {
    value: 'long_term_loan_bank',
    label: 'Long-term Loan — Bank',
    group: 'Non-Current Liabilities',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Term loans from banks repayable after twelve months.',
  },
  {
    value: 'long_term_loan_others',
    label: 'Long-term Loan — Others',
    group: 'Non-Current Liabilities',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Long-term loans from NBFIs, related parties or other sources.',
  },
  {
    value: 'debentures',
    label: 'Debentures / Bonds Issued',
    group: 'Non-Current Liabilities',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Long-term debt instruments issued by the company.',
  },
  {
    value: 'deferred_tax_liability',
    label: 'Deferred Tax Liability',
    group: 'Non-Current Liabilities',
    normalBalance: 'credit',
    noteRef: '3.23',
    description: 'Deferred tax liability arising from timing differences.',
  },
  {
    value: 'gratuity_provision',
    label: 'Provision for Gratuity (Non-current)',
    group: 'Non-Current Liabilities',
    normalBalance: 'credit',
    noteRef: '3.12',
    description: 'Long-term portion of defined benefit gratuity obligation.',
  },
  {
    value: 'other_ncl',
    label: 'Other Non-Current Liabilities',
    group: 'Non-Current Liabilities',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Other long-term obligations not classified elsewhere.',
  },

  // ── Current Liabilities — Borrowings ──────────────────────────────────────
  {
    value: 'bank_overdraft',
    label: 'Bank Overdraft',
    group: 'Current Liabilities — Borrowings',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Bank overdraft balance (credit balance on OD/CC account).',
  },
  {
    value: 'short_term_loan',
    label: 'Short-term Loans & Working Capital',
    group: 'Current Liabilities — Borrowings',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Cash credit, working capital demand loans and other short-term bank facilities.',
  },
  {
    value: 'current_portion_lt_loan',
    label: 'Current Portion of Long-term Loan',
    group: 'Current Liabilities — Borrowings',
    normalBalance: 'credit',
    noteRef: '3.11',
    description: 'Instalments of long-term loans due within twelve months.',
  },

  // ── Current Liabilities — Trade Payables ──────────────────────────────────
  {
    value: 'trade_payables',
    label: 'Trade Payables (Creditors)',
    group: 'Current Liabilities — Trade Payables',
    normalBalance: 'credit',
    noteRef: '3.13',
    description: 'Amounts owed to suppliers for goods and services received.',
  },
  {
    value: 'bills_payable',
    label: 'Bills Payable',
    group: 'Current Liabilities — Trade Payables',
    normalBalance: 'credit',
    noteRef: '3.13',
    description: 'Promissory notes and bills of exchange payable to creditors.',
  },
  {
    value: 'advance_from_customers',
    label: 'Advance from Customers',
    group: 'Current Liabilities — Trade Payables',
    normalBalance: 'credit',
    noteRef: '3.14',
    description: 'Deposits and advance payments received from customers before delivery.',
  },

  // ── Current Liabilities — Employee & Statutory ────────────────────────────
  {
    value: 'salary_payable',
    label: 'Salary & Wages Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.12',
    description: 'Accrued salaries and wages payable to employees.',
  },
  {
    value: 'bonus_payable',
    label: 'Staff Bonus Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.12',
    description: 'Staff bonus accrued and payable (10% of net profit per Bonus Act 2030).',
  },
  {
    value: 'pf_payable',
    label: 'PF / SSF Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.12',
    description: 'Provident fund and Social Security Fund contributions payable.',
  },
  {
    value: 'tds_payable',
    label: 'TDS / Withholding Tax Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.15',
    description: 'Tax deducted at source pending deposit to IRD.',
  },
  {
    value: 'vat_payable',
    label: 'VAT Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.15',
    description: 'Net VAT liability (output tax less input tax) payable to IRD.',
  },
  {
    value: 'income_tax_payable',
    label: 'Income Tax Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.15',
    description: 'Current-year income tax liability net of advance tax paid.',
  },
  {
    value: 'audit_fee_payable',
    label: 'Audit Fee Payable',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.16',
    description: 'Statutory audit fee accrued and payable to auditors.',
  },
  {
    value: 'other_provisions',
    label: 'Other Provisions',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.16',
    description: 'Other accruals and provisions for known obligations.',
  },
  {
    value: 'other_current_liabilities',
    label: 'Other Current Liabilities',
    group: 'Current Liabilities — Employee & Statutory',
    normalBalance: 'credit',
    noteRef: '3.14',
    description: 'Miscellaneous current liabilities not classified elsewhere.',
  },

  // ── Income ────────────────────────────────────────────────────────────────
  {
    value: 'revenue_sales',
    label: 'Revenue — Sales of Goods',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Revenue from sale of goods, net of returns and trade discounts.',
  },
  {
    value: 'revenue_services',
    label: 'Revenue — Service Income',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Revenue from rendering of services.',
  },
  {
    value: 'revenue_other',
    label: 'Revenue — Other Operating Income',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Other income directly related to business operations.',
  },
  {
    value: 'interest_income',
    label: 'Interest Income',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Interest earned on bank deposits, loans and investments.',
  },
  {
    value: 'dividend_income',
    label: 'Dividend Income',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Dividends received from investments in shares.',
  },
  {
    value: 'rental_income',
    label: 'Rental Income',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Income from renting out property or equipment.',
  },
  {
    value: 'other_income',
    label: 'Other Income',
    group: 'Income',
    normalBalance: 'credit',
    noteRef: '3.17',
    description: 'Gains, miscellaneous income and receipts not from operations.',
  },

  // ── Cost of Goods Sold ────────────────────────────────────────────────────
  {
    value: 'purchases',
    label: 'Purchases',
    group: 'Cost of Goods Sold',
    normalBalance: 'debit',
    noteRef: '3.18',
    description: 'Cost of goods purchased for trading or raw materials for production.',
  },
  {
    value: 'direct_expenses',
    label: 'Direct Expenses',
    group: 'Cost of Goods Sold',
    normalBalance: 'debit',
    noteRef: '3.19',
    description: 'Direct labour, freight, packing and other costs directly attributable to production.',
  },
  {
    value: 'opening_stock',
    label: 'Opening Stock',
    group: 'Cost of Goods Sold',
    normalBalance: 'debit',
    noteRef: '3.18',
    description: 'Inventory at the beginning of the reporting period.',
  },
  {
    value: 'closing_stock',
    label: 'Closing Stock',
    group: 'Cost of Goods Sold',
    normalBalance: 'credit',
    noteRef: '3.18',
    description: 'Inventory at the end of the reporting period.',
  },

  // ── Employee Expenses ─────────────────────────────────────────────────────
  {
    value: 'salary_expense',
    label: 'Salaries & Wages',
    group: 'Employee Expenses',
    normalBalance: 'debit',
    noteRef: '3.20',
    description: 'Gross salaries, wages and allowances paid to employees.',
  },
  {
    value: 'pf_expense',
    label: 'PF / SSF Contribution (Employer)',
    group: 'Employee Expenses',
    normalBalance: 'debit',
    noteRef: '3.20',
    description: "Employer's contribution to Provident Fund and Social Security Fund.",
  },
  {
    value: 'gratuity_expense',
    label: 'Gratuity Expense',
    group: 'Employee Expenses',
    normalBalance: 'debit',
    noteRef: '3.20',
    description: 'Gratuity expense accrued for the period per actuarial estimate.',
  },
  {
    value: 'leave_expense',
    label: 'Leave Encashment Expense',
    group: 'Employee Expenses',
    normalBalance: 'debit',
    noteRef: '3.20',
    description: 'Expense for accumulated leave liability of employees.',
  },
  {
    value: 'bonus_expense',
    label: 'Staff Bonus Expense',
    group: 'Employee Expenses',
    normalBalance: 'debit',
    noteRef: '3.20',
    description: 'Staff bonus charged to income statement (10% of net profit before tax).',
  },
  {
    value: 'staff_welfare',
    label: 'Staff Welfare Expenses',
    group: 'Employee Expenses',
    normalBalance: 'debit',
    noteRef: '3.20',
    description: 'Medical, canteen, training, uniform and other staff welfare costs.',
  },

  // ── Finance Costs ─────────────────────────────────────────────────────────
  {
    value: 'bank_interest_expense',
    label: 'Bank Interest Expense',
    group: 'Finance Costs',
    normalBalance: 'debit',
    noteRef: '3.21',
    description: 'Interest charged on bank loans, overdrafts and credit facilities.',
  },
  {
    value: 'bank_charges',
    label: 'Bank Charges & Commission',
    group: 'Finance Costs',
    normalBalance: 'debit',
    noteRef: '3.21',
    description: 'Bank service charges, LC commission and other financial charges.',
  },
  {
    value: 'other_finance_costs',
    label: 'Other Finance Costs',
    group: 'Finance Costs',
    normalBalance: 'debit',
    noteRef: '3.21',
    description: 'Other borrowing costs not separately classified.',
  },

  // ── Depreciation & Impairment ─────────────────────────────────────────────
  {
    value: 'depreciation_expense',
    label: 'Depreciation Expense',
    group: 'Depreciation & Impairment',
    normalBalance: 'debit',
    noteRef: '3.1',
    description: 'Systematic depreciation of PPE charged to income statement.',
  },
  {
    value: 'impairment_loss',
    label: 'Impairment Loss',
    group: 'Depreciation & Impairment',
    normalBalance: 'debit',
    noteRef: '3.21',
    description: 'Impairment write-down of assets below their carrying amount.',
  },

  // ── Administrative Expenses ───────────────────────────────────────────────
  {
    value: 'rent_expense',
    label: 'Rent Expense',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Rent paid for office, factory and business premises.',
  },
  {
    value: 'electricity_expense',
    label: 'Electricity, Water & Utilities',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Utility costs for office and factory operations.',
  },
  {
    value: 'telephone_internet',
    label: 'Telephone, Internet & Communication',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Communication costs including internet, mobile and landline.',
  },
  {
    value: 'printing_stationery',
    label: 'Printing & Stationery',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Office stationery, printing and photocopying costs.',
  },
  {
    value: 'repairs_maintenance',
    label: 'Repairs & Maintenance',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Expenditure on repair and maintenance of assets.',
  },
  {
    value: 'audit_fee_expense',
    label: 'Audit Fee',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Statutory audit fee and other professional charges.',
  },
  {
    value: 'legal_professional',
    label: 'Legal & Professional Fees',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Legal fees, consultancy fees and professional charges.',
  },
  {
    value: 'selling_distribution',
    label: 'Selling & Distribution Expenses',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Sales commission, advertisement, delivery and marketing expenses.',
  },
  {
    value: 'travel_conveyance',
    label: 'Travel & Conveyance',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Staff travel, vehicle running costs and conveyance allowances.',
  },
  {
    value: 'insurance_expense',
    label: 'Insurance Premium',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Insurance premiums for assets, stock and business.',
  },
  {
    value: 'miscellaneous_expense',
    label: 'Miscellaneous Expenses',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Sundry and miscellaneous operational expenses.',
  },
  {
    value: 'admin_expense_other',
    label: 'Other Administrative Expenses',
    group: 'Administrative Expenses',
    normalBalance: 'debit',
    noteRef: '3.22',
    description: 'Other general and administrative costs not separately listed.',
  },

  // ── Tax ───────────────────────────────────────────────────────────────────
  {
    value: 'current_tax_expense',
    label: 'Current Tax Expense',
    group: 'Tax',
    normalBalance: 'debit',
    noteRef: '3.23',
    description: 'Current-year income tax expense based on taxable income.',
  },
  {
    value: 'deferred_tax_expense',
    label: 'Deferred Tax Expense / (Income)',
    group: 'Tax',
    normalBalance: 'debit',
    noteRef: '3.23',
    description: 'Movement in deferred tax asset or liability for the period.',
  },

  // ── Unclassified ──────────────────────────────────────────────────────────
  {
    value: 'unclassified',
    label: 'Unclassified / Not Mapped',
    group: 'Unclassified',
    normalBalance: 'debit',
    noteRef: '—',
    description: 'Account has not been mapped to an NFRS category — review required.',
  },
];

// ── Helper Functions ──────────────────────────────────────────────────────────

export function getNFRSCategoryInfo(category: NFRSCategory): NFRSCategoryInfo | undefined {
  return NFRS_CATEGORY_INFO.find((info) => info.value === category);
}

export function getGroupedCategories(): { group: string; items: NFRSCategoryInfo[] }[] {
  const groups: Record<string, NFRSCategoryInfo[]> = {};

  for (const info of NFRS_CATEGORY_INFO) {
    if (!groups[info.group]) {
      groups[info.group] = [];
    }
    groups[info.group].push(info);
  }

  return Object.entries(groups).map(([group, items]) => ({ group, items }));
}

export function getCategoryLabel(category: NFRSCategory): string {
  const info = getNFRSCategoryInfo(category);
  return info?.label ?? category;
}
