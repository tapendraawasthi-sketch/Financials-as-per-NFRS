// ===== src/data/chartOfAccounts.ts =====
// Master chart of accounts for the NFRS/NAS for MEs financial reporting
// automation system for Nepal. Maps common accounting-software account names
// (including all major bank names, Tally/Busy ledger labels, and manual
// book labels) to their canonical NFRS category and note reference.
//
// This is the SINGLE SOURCE OF TRUTH for account classification.
// The deterministic matcher in accountMatcher.ts consults this file first;
// unresolved names fall back to the Claude AI classifier.
//
// Design:
//   • synonyms are lower-cased and trimmed for matching — do NOT store
//     duplicates of the canonical label in synonyms.
//   • noteRef maps to the note number in the ICAN MEs template (e.g. "3.1").
//   • NFRSCategory values must match the union type defined in src/types/company.ts.

import type { NFRSCategory } from '../types';

// ---------------------------------------------------------------------------
// ChartAccountEntry — one entry in the chart of accounts
// ---------------------------------------------------------------------------
export interface ChartAccountEntry {
  /** Canonical NFRS label as it appears in the financial statement template */
  label: string;
  /** Classification used to route the account to the correct statement line */
  nfrsCategory: NFRSCategory;
  /**
   * Common alternate names used in Nepal accounting software (Tally, Busy,
   * AccountsIQ, Excel manual books). All stored in lower-case; matching is
   * also performed case-insensitively.
   */
  synonyms: string[];
  /** Primary note where this account is disclosed, e.g. "3.1" */
  noteRef: string;
  /** Debit-normal or credit-normal balance */
  normalBalance: 'debit' | 'credit';
  /**
   * For repeatable sub-ledger families (sundry debtors, creditors, banks,
   * director loans, repair pools) — identifies the bucket so the matcher
   * can offer "add as new slot in this bucket" instead of a forced label match.
   */
  bucket?: string;
}

// ---------------------------------------------------------------------------
// CHART_OF_ACCOUNTS — the comprehensive mapping table (120+ entries)
// ---------------------------------------------------------------------------
export const CHART_OF_ACCOUNTS: ChartAccountEntry[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // EQUITY
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Paid-up Capital',
    nfrsCategory: 'share_capital',
    noteRef: '3.9',
    normalBalance: 'credit',
    synonyms: [
      'share capital',
      'paid up capital',
      'capital',
      'equity share capital',
      'issued capital',
      'subscribed capital',
      'issued share capital',
      'authorized capital paid up',
      'ordinary share capital',
      'common stock',
    ],
  },
  {
    label: 'Share Premium',
    nfrsCategory: 'share_premium',
    noteRef: '3.10',
    normalBalance: 'credit',
    synonyms: [
      'securities premium',
      'premium on shares',
      'capital premium',
      'share issue premium',
      'additional paid-in capital',
    ],
  },
  {
    label: 'General Reserve',
    nfrsCategory: 'general_reserve',
    noteRef: '3.10',
    normalBalance: 'credit',
    synonyms: [
      'reserves',
      'reserve fund',
      'general fund',
      'free reserve',
      'revenue reserve',
      'statutory reserve',
      'capital redemption reserve',
    ],
  },
  {
    label: 'Retained Earnings',
    nfrsCategory: 'retained_earnings',
    noteRef: '3.10',
    normalBalance: 'credit',
    synonyms: [
      'retained profit',
      'accumulated profit',
      'profit and loss account',
      'surplus',
      'accumulated surplus',
      'p&l balance',
      'unappropriated profit',
      'profit brought forward',
      'balance of profit and loss',
      'undistributed profit',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NON-CURRENT BORROWINGS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Term Loan - Bank',
    nfrsCategory: 'borrowings_noncurrent_bank',
    noteRef: '3.11',
    normalBalance: 'credit',
    bucket: 'bank_term_loans',
    synonyms: [
      'bank loan',
      'term loan',
      'secured loan',
      'long term loan',
      'loan from bank',
      'nabil bank loan',
      'sbi loan',
      'nic asia loan',
      'himalayan bank loan',
      'sanima bank loan',
      'global ime loan',
      'kumari bank loan',
      'everest bank loan',
      'nepal investment bank loan',
      'standard chartered loan',
      'citizens bank loan',
      'bank of kathmandu loan',
      'agriculture development bank loan',
      'rastriya banijya bank loan',
      'nepal bank loan',
      'prabhu bank loan',
      'sunrise bank loan',
      'lumbini bank loan',
      'janata bank loan',
      'mahalaxmi bank loan',
      'sindhu bank loan',
      'green development bank loan',
      'muktinath development bank loan',
      'excel development bank loan',
      'garima development bank loan',
      'machhapuchchhre bank loan',
      'century commercial bank loan',
      'prime commercial bank loan',
      'megha bank loan',
      'civil bank loan',
      'siddhartha bank loan',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRADE PAYABLES
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Sundry Creditors',
    nfrsCategory: 'trade_payables_creditors',
    noteRef: '3.13',
    normalBalance: 'credit',
    bucket: 'sundry_creditors',
    synonyms: [
      'creditors',
      'accounts payable',
      'trade creditors',
      'sundry creditors control',
      'payable to suppliers',
      'supplier payable',
      'trade payable',
      'creditor control',
      'purchase creditors',
      'vendor payable',
      'creditors for goods',
      'payable to vendors',
    ],
  },
  {
    label: 'Advance from Customer',
    nfrsCategory: 'trade_payables_advance_customers',
    noteRef: '3.16',
    normalBalance: 'credit',
    synonyms: [
      'customer advance',
      'advance received',
      'advance from customers',
      'customer deposit',
      'receipt in advance',
      'deferred income - advance',
      'advance against orders',
      'booking advance',
      'earnest money received',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CURRENT BORROWINGS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Bank Overdraft',
    nfrsCategory: 'borrowings_current_od',
    noteRef: '3.11',
    normalBalance: 'credit',
    synonyms: [
      'od',
      'overdraft',
      'bank od',
      'current account overdraft',
      'od account',
      'overdraft facility',
    ],
  },
  {
    label: 'Cash Credit',
    nfrsCategory: 'borrowings_current_cc',
    noteRef: '3.11',
    normalBalance: 'credit',
    synonyms: [
      'cc',
      'cash credit account',
      'cc loan',
      'working capital cc',
      'cc facility',
    ],
  },
  {
    label: 'Working Capital Loan',
    nfrsCategory: 'borrowings_current_wc',
    noteRef: '3.11',
    normalBalance: 'credit',
    synonyms: [
      'wc loan',
      'working capital',
      'short term loan',
      'demand loan',
      'current portion bank',
      'revolving credit',
      'short-term bank loan',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE & STATUTORY PAYABLES
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'TDS Payable',
    nfrsCategory: 'tds_payable',
    noteRef: '3.13',
    normalBalance: 'credit',
    synonyms: [
      'tds payable',
      'withholding tax payable',
      'tax deducted at source',
      'tds on salary',
      'tds on rent',
      'tds on service fee',
      'tds on audit fee',
      'tds - audit fee',
      'tds - ltd. company',
      'tds- propritership',
      'tds - pvt. ltd',
      'tds- salary',
      'tds - sst',
      'tds - rental',
      'tds - dividend',
      'tds on interest',
      'tds payable-contractor',
    ],
  },
  {
    label: 'VAT Payable',
    nfrsCategory: 'other_payables',
    noteRef: '3.13',
    normalBalance: 'credit',
    synonyms: [
      'vat payable',
      'value added tax payable',
      'vat liability',
      'output vat',
    ],
  },
  {
    label: 'Provident Fund Payable',
    nfrsCategory: 'employee_payables_pf',
    noteRef: '3.12',
    normalBalance: 'credit',
    synonyms: [
      'pf payable',
      'provident fund payable',
      'ssf payable',
      'cit payable',
      'social security fund',
      'employees provident fund',
      'employer pf payable',
      'ssf contribution payable',
    ],
  },
  {
    label: 'Staff Bonus Payable',
    nfrsCategory: 'employee_payables_bonus',
    noteRef: '3.12',
    normalBalance: 'credit',
    synonyms: [
      'bonus payable',
      'employee bonus',
      'profit sharing bonus',
      'staff bonus',
      'performance bonus payable',
    ],
  },
  {
    label: 'Audit Fee Payable',
    nfrsCategory: 'audit_fee_payable',
    noteRef: '3.13',
    normalBalance: 'credit',
    synonyms: [
      'audit fees payable',
      'provision for audit fee',
      'auditor fees',
      'statutory audit fee payable',
      'external auditor payable',
    ],
  },
  {
    label: 'Salary Payable',
    nfrsCategory: 'employee_payables_salary',
    noteRef: '3.12',
    normalBalance: 'credit',
    synonyms: [
      'salary payable',
      'wages payable',
      'outstanding salary',
      'accrued salary',
      'payroll payable',
      'salary outstanding',
      'employee a',
      'employee b',
      'employee c',
      'staff salary payable',
    ],
  },
  {
    label: 'Income Tax Payable',
    nfrsCategory: 'income_tax_payable',
    noteRef: '3.14',
    normalBalance: 'credit',
    synonyms: [
      'income tax payable',
      'corporate tax payable',
      'advance tax recoverable',
      'provision for income tax',
      'income tax provision',
      'current tax liability',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PPE ASSETS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Land',
    nfrsCategory: 'ppe_land',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'land',
      'plot',
      'land and site',
      'land at cost',
      'agricultural land',
      'commercial land',
      'property',
      'land - freehold',
    ],
  },
  {
    label: 'Buildings',
    nfrsCategory: 'ppe_buildings',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'building',
      'office building',
      'factory building',
      'godown',
      'warehouse',
      'shop',
      'structure',
      'premises',
      'factory',
      'plant building',
      'commercial building',
      'residential building',
      'leasehold improvement',
      'leasehold',
    ],
  },
  {
    label: 'Vehicles',
    nfrsCategory: 'ppe_vehicles',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'vehicle',
      'motor vehicle',
      'car',
      'motorcycle',
      'truck',
      'van',
      'jeep',
      'bus',
      'tempo',
      'auto',
      'two wheeler',
      'four wheeler',
      'transport',
      'ambulance',
      'tractor',
    ],
  },
  {
    label: 'Office Equipment',
    nfrsCategory: 'ppe_office_equipment',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'office equipment',
      'equipment',
      'printer',
      'photocopier',
      'fax',
      'air conditioner',
      'ac',
      'generator',
      'ups',
      'telephone set',
      'projector',
      'scanner',
      'inverter',
      'cctv camera',
    ],
  },
  {
    label: 'Computers',
    nfrsCategory: 'ppe_computers',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'computer',
      'laptop',
      'desktop',
      'server',
      'tablet',
      'it equipment',
      'hardware',
      'computing equipment',
      'network equipment',
      'router',
      'switch',
    ],
  },
  {
    label: 'Furniture & Fixtures',
    nfrsCategory: 'ppe_furniture',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'furniture',
      'fixture',
      'fitting',
      'sofa',
      'chair',
      'table',
      'desk',
      'shelf',
      'rack',
      'almirah',
      'cupboard',
      'furniture & office equipment',
      'office furniture',
      'partition',
    ],
  },
  {
    label: 'Plant & Machinery',
    nfrsCategory: 'ppe_plant_machinery',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'plant',
      'machinery',
      'machine',
      'equipment heavy',
      'manufacturing equipment',
      'production machinery',
      'plant equipment',
      'plant and machinery',
      'industrial equipment',
      'generator set',
      'boiler',
      'compressor',
    ],
  },
  {
    label: 'Intangible Assets',
    nfrsCategory: 'ppe_intangibles',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'software',
      'intangible',
      'patent',
      'trademark',
      'goodwill',
      'licence',
      'license',
      'tally software',
      'erp software',
      'accounting software',
      'computer software',
      'crm software',
      'domain name',
    ],
  },
  {
    label: 'Capital Work in Progress',
    nfrsCategory: 'ppe_cwip',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'cwip',
      'capital wip',
      'construction in progress',
      'building under construction',
      'work in progress fixed assets',
      'capital expenditure in progress',
      'plant under installation',
    ],
  },
  {
    label: 'Accumulated Depreciation',
    nfrsCategory: 'accum_depreciation',
    noteRef: '3.1',
    normalBalance: 'credit',
    synonyms: [
      'accumulated depreciation',
      'accumulated dep',
      'provision for depreciation',
      'depreciation reserve',
      'depreciation fund',
      'less depreciation',
      'acc. depreciation',
      'total depreciation',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INVESTMENTS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Investment in Listed Shares',
    nfrsCategory: 'investment_listed_trading',
    noteRef: '3.2',
    normalBalance: 'debit',
    synonyms: [
      'listed shares',
      'shares',
      'equity shares',
      'mutual fund',
      'stock investment',
      'nepse shares',
      'stock market investment',
      'shares of xyz ltd. (listed company)',
      'investment in listed shares',
      'listed equity',
      'trading securities',
    ],
  },
  {
    label: 'Investment in Unlisted Shares',
    nfrsCategory: 'investment_unlisted',
    noteRef: '3.2',
    normalBalance: 'debit',
    synonyms: [
      'unlisted shares',
      'private company shares',
      'unlisted equity',
      'investment in pvt company',
      'shares of pqr ltd. (unlisted company)',
      'investment in unlisted company',
      'strategic investment',
    ],
  },
  {
    label: 'Fixed Deposit (Long-term)',
    nfrsCategory: 'investment_fixed_deposit_noncurrent',
    noteRef: '3.2',
    normalBalance: 'debit',
    synonyms: [
      'fixed deposit',
      'fd',
      'term deposit long term',
      'recurring deposit',
      'fd more than 1 year',
      'long term fd',
      'term deposit noncurrent',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OTHER NON-CURRENT ASSETS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Deposits (Non-Current)',
    nfrsCategory: 'nca_deposits',
    noteRef: '3.4',
    normalBalance: 'debit',
    synonyms: [
      'security deposit',
      'electricity deposit',
      'telephone deposit',
      'rent deposit',
      'leasehold deposit',
      'security deposit landlord',
      'deposit given',
      'advance to landlord long term',
      'deposits',
    ],
  },
  {
    label: 'Loans & Advances (Non-Current)',
    nfrsCategory: 'nca_loans_advances',
    noteRef: '3.4',
    normalBalance: 'debit',
    synonyms: [
      'loan given',
      'advance given',
      'long term advance',
      'loan to subsidiary',
      'advance to directors long term',
      'loan to related party',
      'inter-company loan',
    ],
  },
  {
    label: 'Biological Assets',
    nfrsCategory: 'nca_other',
    noteRef: '3.5',
    normalBalance: 'debit',
    synonyms: [
      'biological assets',
      'livestock',
      'animals',
      'crops',
      'aquaculture',
      'timber',
      'orchards',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TRADE RECEIVABLES
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Sundry Debtors',
    nfrsCategory: 'trade_receivables',
    noteRef: '3.3',
    normalBalance: 'debit',
    bucket: 'sundry_debtors',
    synonyms: [
      'debtors',
      'accounts receivable',
      'trade debtors',
      'debtor control',
      'trade receivable',
      'receivable from customers',
      'customer receivable',
      'book debts',
      'debtor a',
      'debtor b',
      'debtor c',
      'debtor d',
      'bills receivable',
    ],
  },
  {
    label: 'Provision for Impairment on Debtors',
    nfrsCategory: 'provision_impairment_debtors',
    noteRef: '3.3',
    normalBalance: 'credit',
    synonyms: [
      'provision for bad debts',
      'provision for doubtful debts',
      'bad debt provision',
      'allowance for doubtful accounts',
      'provision impairment',
      'credit loss provision',
      'provision for impairment on debtors',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OTHER CURRENT ASSETS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Advance to Suppliers',
    nfrsCategory: 'other_receivables_advance_supplier',
    noteRef: '3.4',
    normalBalance: 'debit',
    synonyms: [
      'advance to supplier',
      'purchase advance',
      'supplier advance',
      'advance payment',
      'advance to vendors',
      'prepaid to supplier',
      'advance for goods',
      'advance to contractor',
    ],
  },
  {
    label: 'Prepayments',
    nfrsCategory: 'other_receivables_prepayments',
    noteRef: '3.4',
    normalBalance: 'debit',
    synonyms: [
      'prepaid expense',
      'prepaid',
      'advance rent',
      'prepaid insurance',
      'advance to landlord',
      'prepaid expenses',
      'payments in advance',
      'prepaid subscriptions',
      'prepaid maintenance',
    ],
  },
  {
    label: 'Staff Advance',
    nfrsCategory: 'other_receivables_staff_advance',
    noteRef: '3.4',
    normalBalance: 'debit',
    synonyms: [
      'staff advance',
      'employee advance',
      'advance to staff',
      'salary advance',
      'loan to employees',
      'advance to employees',
      'personal advance',
    ],
  },
  {
    label: 'TDS Receivable',
    nfrsCategory: 'other_receivables_tds',
    noteRef: '3.6',
    normalBalance: 'debit',
    synonyms: [
      'tds receivable',
      'tds credit',
      'tax deducted at source receivable',
      'withholding tax credit',
      'advance tax',
      'tds balance',
      'tds refundable',
      'advance income tax',
      'self-assessment tax paid',
      'tax paid in advance',
    ],
  },
  {
    label: 'Fixed Deposit (Current)',
    nfrsCategory: 'bank_fixed_deposit_current',
    noteRef: '3.8',
    normalBalance: 'debit',
    synonyms: [
      'fd current',
      'short term fd',
      'fixed deposit less than 1 year',
      'term deposit short term',
      'fd maturing within year',
      'call deposit',
      'short term fixed deposit',
    ],
  },
  {
    label: 'Loans & Advances (Current)',
    nfrsCategory: 'other_receivables_loans',
    noteRef: '3.4',
    normalBalance: 'debit',
    synonyms: [
      'short term advance',
      'loans and advances current',
      'loans & advances (asset)',
      'advance to third party',
      'advance to others',
      'miscellaneous advance',
    ],
  },
  {
    label: 'Non-Current Assets Held for Sale',
    nfrsCategory: 'other_receivables_other',
    noteRef: '3.6',
    normalBalance: 'debit',
    synonyms: [
      'assets held for sale',
      'asset held for sale',
      'non current assets held for sale',
      'disposal group',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CASH & BANK
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Cash in Hand',
    nfrsCategory: 'cash_in_hand',
    noteRef: '3.8',
    normalBalance: 'debit',
    synonyms: [
      'cash',
      'petty cash',
      'cash on hand',
      'imprest cash',
      'cash balance',
      'cash at hand',
      'cash in office',
      'vault cash',
    ],
  },
  {
    label: 'Bank Balance',
    nfrsCategory: 'bank_current_account',
    noteRef: '3.8',
    normalBalance: 'debit',
    bucket: 'bank_accounts',
    synonyms: [
      'bank',
      'current account',
      'ca',
      'bank balance',
      'bank account',
      'savings account',
      'nabil bank',
      'nic asia bank',
      'himalayan bank',
      'sbi bank',
      'standard chartered bank',
      'global ime bank',
      'kumari bank',
      'everest bank',
      'citizens bank',
      'bank of kathmandu',
      'sanima bank',
      'prabhu bank',
      'sunrise bank',
      'lumbini bank',
      'machhapuchchhre bank',
      'century bank',
      'prime bank',
      'megha bank',
      'civil bank',
      'siddhartha bank',
      'bank c',
      'bank d',
      'bank e',
      'rastriya banijya bank',
      'nepal bank',
      'agricultural development bank',
      'nepal investment bank',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Raw Materials',
    nfrsCategory: 'inventory_raw_materials',
    noteRef: '3.7',
    normalBalance: 'debit',
    synonyms: [
      'raw material',
      'materials',
      'stock raw material',
      'input material',
      'raw stock',
      'raw materials and consumables',
      'consumables',
      'store and spares',
    ],
  },
  {
    label: 'Work in Progress',
    nfrsCategory: 'ppe_cwip',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'capital work in progress',
      'cwip',
      'construction in progress',
      'work in progress fixed assets',
    ],
  },
  {
    label: 'Work in Progress (Inventory)',
    nfrsCategory: 'inventory_wip',
    noteRef: '3.7',
    normalBalance: 'debit',
    synonyms: [
      'wip',
      'semi-finished goods',
      'work-in-process',
      'goods in process',
      'work-in-progress',
      'inventory wip',
    ],
  },
  {
    label: 'Finished Goods',
    nfrsCategory: 'inventory_finished_goods',
    noteRef: '3.7',
    normalBalance: 'debit',
    synonyms: [
      'finished goods',
      'stock in trade',
      'goods for sale',
      'trading stock',
      'trading goods',
      'merchandise',
      'closing stock',
      'inventory',
      'stock',
      'finished goods and goods for resale',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REVENUE
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Sales Revenue',
    nfrsCategory: 'revenue_sales',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'sales',
      'revenue',
      'turnover',
      'net sales',
      'gross sales',
      'sale of goods',
      'product sales',
      'goods sold',
      'trading revenue',
      'domestic sales',
      'export sales',
    ],
  },
  {
    label: 'Service Income',
    nfrsCategory: 'revenue_services',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'service income',
      'service revenue',
      'service charge',
      'professional income',
      'consultancy income',
      'fee income',
      'service fees',
      'rendering of services',
    ],
  },
  {
    label: 'Interest Income',
    nfrsCategory: 'other_income_interest',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'interest income',
      'interest earned',
      'interest on fd',
      'bank interest',
      'interest received',
      'interest on loan given',
      'interest on deposit',
      'interest on call account',
    ],
  },
  {
    label: 'Dividend Income',
    nfrsCategory: 'other_income_dividend',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'dividend income',
      'dividend received',
      'dividend',
      'bonus share income',
      'cash dividend',
    ],
  },
  {
    label: 'Rental Income',
    nfrsCategory: 'other_income_rental',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'rental income',
      'rent received',
      'house rent income',
      'property rent',
      'income from rent',
      'lease income',
    ],
  },
  {
    label: 'Gain on Sale of Assets',
    nfrsCategory: 'other_income_disposal_gain',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'gain on disposal',
      'profit on sale of asset',
      'gain on sale of fixed asset',
      'profit on disposal',
      'gain on disposal of assets',
    ],
  },
  {
    label: 'Commission Income',
    nfrsCategory: 'other_income_misc',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'commission income',
      'commission received',
      'brokerage income',
      'agency income',
    ],
  },
  {
    label: 'Other Income',
    nfrsCategory: 'other_income_misc',
    noteRef: '3.17',
    normalBalance: 'credit',
    synonyms: [
      'other income',
      'miscellaneous income',
      'sundry income',
      'insurance claim income',
      'scrap sales',
      'rebate received',
      'discount received',
      'other indirect income',
      'gain on fv adjustment of listed share',
      'gain on fair value adjustment',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PURCHASES / COST OF GOODS SOLD
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Purchases',
    nfrsCategory: 'cogs_purchases',
    noteRef: '3.18',
    normalBalance: 'debit',
    synonyms: [
      'purchase',
      'goods purchased',
      'material purchased',
      'raw material purchased',
      'trading purchase',
      'import purchase',
      'local purchase',
      'net purchase',
      'purchase of goods',
    ],
  },
  {
    label: 'Opening Stock',
    nfrsCategory: 'cogs_opening_stock',
    noteRef: '3.18',
    normalBalance: 'debit',
    synonyms: [
      'opening stock',
      'opening inventory',
      'stock opening',
      'opening balance stock',
      'inventory opening',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DIRECT EXPENSES
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Direct Wages',
    nfrsCategory: 'direct_wages',
    noteRef: '3.19',
    normalBalance: 'debit',
    synonyms: [
      'wages',
      'factory wages',
      'production wages',
      'labour charges',
      'labour cost',
      'packing wages',
      'direct labour',
      'manufacturing labour',
    ],
  },
  {
    label: 'Direct Expenses',
    nfrsCategory: 'direct_expenses_other',
    noteRef: '3.19',
    normalBalance: 'debit',
    synonyms: [
      'direct expenses',
      'factory overhead',
      'production overhead',
      'manufacturing expenses',
      'direct cost',
      'packing charges',
      'carriage inward',
      'freight inward',
      'other direct expenses',
      'import duty',
      'clearing charges',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE BENEFIT EXPENSES
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Salaries',
    nfrsCategory: 'emp_expense_salaries',
    noteRef: '3.20',
    normalBalance: 'debit',
    synonyms: [
      'salary',
      'salaries',
      'staff salary',
      'office salary',
      'monthly salary',
      'management salary',
      'staff cost',
      'wages and salaries',
      'personnel cost',
      'salaries & wages',
      'staff remuneration',
    ],
  },
  {
    label: 'Provident Fund Expense',
    nfrsCategory: 'emp_expense_pf',
    noteRef: '3.20',
    normalBalance: 'debit',
    synonyms: [
      'provident fund expense',
      'pf contribution',
      'ssf contribution',
      'employer pf',
      'employer contribution pf',
      'social security contribution',
      'pf / ssf / cit',
      'ssf expense',
    ],
  },
  {
    label: 'Gratuity',
    nfrsCategory: 'emp_expense_gratuity',
    noteRef: '3.20',
    normalBalance: 'debit',
    synonyms: [
      'gratuity',
      'gratuity expense',
      'gratuity provision',
      'end of service benefit',
      'severance',
      'retirement benefit expense',
    ],
  },
  {
    label: 'Staff Welfare',
    nfrsCategory: 'emp_expense_welfare',
    noteRef: '3.20',
    normalBalance: 'debit',
    synonyms: [
      'staff welfare',
      'employee welfare',
      'medical expense',
      'staff medical',
      'uniform expense',
      'staff training',
      'employee benefit',
      'allowances',
      'leave encashment',
      'other employee related expenses',
    ],
  },
  {
    label: 'Staff Bonus',
    nfrsCategory: 'emp_expense_bonus',
    noteRef: '3.20',
    normalBalance: 'debit',
    synonyms: [
      'staff bonus',
      'bonus expense',
      'employee bonus expense',
      'profit bonus',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINANCE COSTS
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Interest Expense',
    nfrsCategory: 'finance_cost_interest',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'interest expense',
      'interest paid',
      'interest on loan',
      'bank interest expense',
      'finance charges',
      'interest on overdraft',
      'interest on cc',
      'loan interest',
      'interest on term loan',
      'borrowing cost',
      'interest costs',
    ],
  },
  {
    label: 'Bank Charges',
    nfrsCategory: 'finance_cost_bank_charges',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'bank charges',
      'bank commission',
      'bank fee',
      'loan processing fee',
      'service charge bank',
      'bank service fee',
      'dd commission',
      'swift charges',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ADMINISTRATIVE EXPENSES
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Rent',
    nfrsCategory: 'admin_rent',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'rent',
      'house rent',
      'office rent',
      'shop rent',
      'warehouse rent',
      'land rent',
      'lease rent',
      'monthly rent',
      'lease rentals',
    ],
  },
  {
    label: 'Rates & Taxes',
    nfrsCategory: 'admin_rates_taxes',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'rates and taxes',
      'local tax',
      'municipal tax',
      'property tax',
      'road tax',
      'vehicle tax',
      'professional tax',
      'renewal fee',
      'registration fee',
      'ird registration',
      'octroi',
      'dastur',
      'renew dastur',
      'renew charge',
      'company registrar office fee',
      'cro fee',
      'ird fine',
    ],
  },
  {
    label: 'Insurance',
    nfrsCategory: 'admin_insurance',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'insurance',
      'insurance premium',
      'vehicle insurance',
      'fire insurance',
      'asset insurance',
      'business insurance',
      'marine insurance',
      'insurance expenses',
    ],
  },
  {
    label: 'Repairs & Maintenance',
    nfrsCategory: 'admin_repairs',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'repairs',
      'maintenance',
      'repair and maintenance',
      'vehicle repair',
      'building repair',
      'machine repair',
      'electrical repair',
      'amc charges',
      'pool a',
      'pool b',
      'pool c',
      'pool d',
      'pool e',
      'annual maintenance charges',
    ],
  },
  {
    label: 'Electricity & Water',
    nfrsCategory: 'admin_electricity',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'electricity',
      'electricity expense',
      'power expense',
      'water expense',
      'nea bill',
      'electricity bill',
      'utility expense',
      'electricity and water',
      'water & electricity charges',
      'water & electricity expenses',
    ],
  },
  {
    label: 'Communication',
    nfrsCategory: 'admin_communication',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'telephone',
      'internet',
      'communication expense',
      'mobile bill',
      'telephone expense',
      'broadband',
      'ntc bill',
      'ncell bill',
      'isps',
      'internet & communication expense',
    ],
  },
  {
    label: 'Printing & Stationery',
    nfrsCategory: 'admin_printing',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'printing',
      'stationery',
      'printing and stationery',
      'office supplies',
      'paper expense',
      'photocopy expense',
      'printing & stationery',
    ],
  },
  {
    label: 'Legal & Professional',
    nfrsCategory: 'admin_legal_professional',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'legal fee',
      'professional fee',
      'consultancy fee',
      'advocate fee',
      'legal expenses',
      'professional charges',
      'advisory fee',
      'legal and professional',
      'consultancy charges',
    ],
  },
  {
    label: 'Audit Fee',
    nfrsCategory: 'admin_audit_fee',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'audit fee',
      'audit fees',
      'statutory audit fee',
      'external audit fee',
      'auditor remuneration',
      'audit fee and expenses',
    ],
  },
  {
    label: 'Traveling & Conveyance',
    nfrsCategory: 'admin_traveling',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'traveling',
      'conveyance',
      'travel expense',
      'ta da',
      'field allowance',
      'transportation expense',
      'fuel expense',
      'petrol expense',
      'vehicle expense',
      'tour expense',
      'fuel expenses',
      'travelling',
    ],
  },
  {
    label: 'Advertisement & Promotion',
    nfrsCategory: 'admin_other',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'advertisement',
      'advertising',
      'marketing expense',
      'promotion expense',
      'business promotion',
      'advertisement & business promotion',
      'advertisement expenses',
    ],
  },
  {
    label: 'Refreshment Expenses',
    nfrsCategory: 'admin_other',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'refreshment',
      'refreshment expense',
      'tea and snacks',
      'staff refreshment',
      'food expense',
      'refreshment expenses',
      'chiya kharcha',
      'staff chiya',
      'atithi satkar',
      'guest entertainment',
      'tea expense',
    ],
  },
  {
    label: 'Miscellaneous Expenses',
    nfrsCategory: 'admin_other',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'miscellaneous expenses',
      'misc expenses',
      'sundry expenses',
      'general expenses',
      'other overhead',
      'miscellaneous expense',
      'chanda',
      'donation',
      'pooja kharcha',
      'dashain kharcha',
      'tihar kharcha',
      'festival expense',
    ],
  },
  {
    label: 'CSR Expenses',
    nfrsCategory: 'admin_other',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'csr expenses',
      'corporate social responsibility',
      'csr expense',
      'social responsibility expense',
    ],
  },
  {
    label: 'AGM & Board Meeting Expenses',
    nfrsCategory: 'admin_other',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'agm expenses',
      'board meeting expenses',
      'annual general meeting expense',
      'board meeting fee',
      'board expenses',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEPRECIATION & IMPAIRMENT
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Depreciation Expense',
    nfrsCategory: 'depreciation_expense',
    noteRef: '3.1',
    normalBalance: 'debit',
    synonyms: [
      'depreciation',
      'depreciation expense',
      'depreciation charge',
      'depreciation on fixed assets',
      'amortization',
      'amortisation',
    ],
  },
  {
    label: 'Impairment Expense',
    nfrsCategory: 'impairment_expense',
    noteRef: '3.21',
    normalBalance: 'debit',
    synonyms: [
      'impairment',
      'impairment loss',
      'write off',
      'bad debt written off',
      'provision expense',
      'impairment on receivables',
      'impairment on unlisted shares',
      'loss on fair fv adjustment of listed share',
      'fair value loss',
      'loss on fair value adjustment',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // INCOME TAX
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Income Tax Expense',
    nfrsCategory: 'income_tax_expense',
    noteRef: '3.23',
    normalBalance: 'debit',
    synonyms: [
      'income tax',
      'corporate tax',
      'company tax',
      'income tax provision',
      'deferred tax expense',
      'current tax',
      'tax on profit',
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OTHER ADMIN / CATCH-ALL
  // ══════════════════════════════════════════════════════════════════════════

  {
    label: 'Other Administrative Expenses',
    nfrsCategory: 'admin_other',
    noteRef: '3.22',
    normalBalance: 'debit',
    synonyms: [
      'other expenses',
      'administrative expense',
      'office expense',
      'general overhead',
      'indirect expenses',
      'indirect expense',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup utility functions
// ---------------------------------------------------------------------------

/**
 * Normalises a raw account label for comparison:
 * lower-case, trim whitespace, collapse multiple spaces.
 */
function normalise(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * findAccountByLabel — exact canonical-label lookup (case-insensitive).
 *
 * Use this when you have confirmed the text matches a canonical NFRS label.
 *
 * @example findAccountByLabel('Sales Revenue')   // → ChartAccountEntry
 * @example findAccountByLabel('sales revenue')   // → same entry (normalised)
 */
export function findAccountByLabel(rawLabel: string): ChartAccountEntry | undefined {
  const key = normalise(rawLabel);
  return CHART_OF_ACCOUNTS.find((entry) => normalise(entry.label) === key);
}

/**
 * findAccountBySynonym — searches all synonym arrays for a match.
 *
 * This is the primary lookup used by the account matcher when the raw trial
 * balance label does not exactly match any canonical label.
 *
 * @example findAccountBySynonym('turnover')        // → Sales Revenue entry
 * @example findAccountBySynonym('nabil bank loan') // → Term Loan - Bank entry
 */
export function findAccountBySynonym(rawLabel: string): ChartAccountEntry | undefined {
  const key = normalise(rawLabel);
  return CHART_OF_ACCOUNTS.find((entry) =>
    entry.synonyms.some((syn) => normalise(syn) === key)
  );
}

/**
 * findAccount — convenience wrapper that tries exact label match first,
 * then synonym search.  Returns the first match found, or undefined.
 *
 * @example findAccount('bank loan')  // → Term Loan - Bank
 */
export function findAccount(rawLabel: string): ChartAccountEntry | undefined {
  return findAccountByLabel(rawLabel) ?? findAccountBySynonym(rawLabel);
}

/**
 * getAllLabels — returns all canonical labels from the chart of accounts,
 * sorted alphabetically.  Used to populate dropdowns in the review UI and
 * the SmartTrialBalanceImport mapping table.
 */
export function getAllLabels(): string[] {
  return CHART_OF_ACCOUNTS.map((entry) => entry.label).sort((a, b) =>
    a.localeCompare(b)
  );
}

/**
 * getAccountsByCategory — returns all accounts belonging to a given
 * NFRSCategory, sorted by label.  Useful for building grouped dropdowns.
 */
export function getAccountsByCategory(category: NFRSCategory): ChartAccountEntry[] {
  return CHART_OF_ACCOUNTS.filter((e) => e.nfrsCategory === category).sort(
    (a, b) => a.label.localeCompare(b.label)
  );
}

/**
 * getAccountsByNote — returns all accounts whose noteRef matches the
 * given note number string (e.g. "3.1").
 */
export function getAccountsByNote(noteRef: string): ChartAccountEntry[] {
  return CHART_OF_ACCOUNTS.filter((e) => e.noteRef === noteRef);
}
