// ===== chartOfAccounts.ts =====
// Auto-extracted fixed chart of accounts from "MEs Financials Format.xlsx" -> Trial Balance sheet.
// This is the SINGLE SOURCE OF TRUTH for what a raw/uploaded trial balance account name is allowed
// to resolve to. Nothing outside this list may ever be written to the Trial Balance sheet.
//
// IMPORTANT: `label` must match column A text in the real template EXACTLY (case-sensitive,
// including any existing typos in the template, e.g. "TDS - Aduit Fee", "TDS- Propritership").
// If your production template differs, edit the `label` fields below — do not touch the writer.
//
// `bucket` groups "repeatable sub-ledger slot" rows (Debtor A/B/C, Creditor A/B/C, Bank A-D,
// Director A-D, Pool A-E, generic TDS lines) so the matcher can offer "create as new slot N"
// behavior instead of forcing a fixed label match for accounts that are inherently open-ended.

export type TBColumnField =
  | "during_dr_cy"
  | "during_cr_cy"
  | "adjustment_dr_cy"
  | "adjustment_cr_cy"
  | "during_dr_py"
  | "during_cr_py";

export interface ChartAccount {
  /** Exact text as it appears in Trial Balance column A of the master template */
  label: string;
  /** Logical category, used for grouping in the review UI and for note-routing hints */
  category:
    | "equity"
    | "reserves"
    | "borrowings_noncurrent"
    | "borrowings_current"
    | "trade_payables"
    | "tds_statutory"
    | "employee_liability"
    | "provisions"
    | "related_party_liability"
    | "ppe"
    | "investments"
    | "other_noncurrent_assets"
    | "other_current_assets"
    | "trade_receivables"
    | "related_party_asset"
    | "cash_bank"
    | "inventory_check"
    | "revenue"
    | "other_income"
    | "direct_expense"
    | "employee_expense"
    | "finance_cost"
    | "admin_expense"
    | "impairment_expense"
    | "tax";
  /** If this row belongs to a repeatable sub-ledger slot family, name the bucket */
  bucket?:
    | "sundry_debtors"
    | "sundry_creditors"
    | "bank_accounts"
    | "related_party_director"
    | "related_party_director_recv"
    | "tds_generic"
    | "repair_pool";
  /** Common synonyms / alternate spellings seen in real-world bookkeeping exports */
  synonyms?: string[];
  /** Note this account ultimately routes into, for display purposes only (not used for writing) */
  noteHint?: string;
}

export const CHART_OF_ACCOUNTS: ChartAccount[] = [
  // ---- Equity ----
  { label: "Paid-up Capital", category: "equity", noteHint: "3.9",
    synonyms: ["share capital", "paid up capital", "capital", "equity share capital", "issued capital"] },
  { label: "Share Premium", category: "equity", noteHint: "3.10",
    synonyms: ["securities premium", "premium on shares"] },
  { label: "Reserves & Surplus", category: "reserves", noteHint: "3.10",
    synonyms: ["retained earnings", "general reserve", "reserve and surplus", "accumulated profit"] },

  // ---- Non-current borrowings (bank term loans - fixed slots) ----
  { label: "Bank A", category: "borrowings_noncurrent", bucket: "bank_accounts", noteHint: "3.11",
    synonyms: ["term loan bank a", "secured loan 1"] },
  { label: "Bank B", category: "borrowings_noncurrent", bucket: "bank_accounts", noteHint: "3.11",
    synonyms: ["term loan bank b", "secured loan 2"] },

  // ---- Current liabilities: trade payables (sub-ledger bucket) ----
  { label: "Creditor A", category: "trade_payables", bucket: "sundry_creditors", noteHint: "3.13" },
  { label: "Creditor B", category: "trade_payables", bucket: "sundry_creditors", noteHint: "3.13" },
  { label: "Creditor C", category: "trade_payables", bucket: "sundry_creditors", noteHint: "3.13" },

  // ---- Current borrowings ----
  { label: "Overdraft", category: "borrowings_current", noteHint: "3.11", synonyms: ["od", "bank overdraft"] },
  { label: "Cash Credit", category: "borrowings_current", noteHint: "3.11", synonyms: ["cc account", "cc loan"] },
  { label: "Working Capital Loan", category: "borrowings_current", noteHint: "3.11",
    synonyms: ["wc loan", "working capital"] },

  // ---- Statutory / payables ----
  { label: "Audit Fee Payable", category: "trade_payables", noteHint: "3.13",
    synonyms: ["audit fees payable", "provision for audit fee"] },
  { label: "Staff Bonus Payable", category: "employee_liability", noteHint: "3.12",
    synonyms: ["bonus payable", "employee bonus payable"] },
  { label: "Provident Fund Payable", category: "employee_liability", noteHint: "3.12",
    synonyms: ["pf payable", "provident fund", "ssf payable", "cit payable"] },
  { label: "TDS Payable", category: "tds_statutory", bucket: "tds_generic", noteHint: "3.13" },
  { label: "TDS - Aduit Fee", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds audit fee", "tds on audit fee"] },
  { label: "TDS - Ltd. Company", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds limited company", "tds ltd company"] },
  { label: "TDS- Propritership", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds proprietorship", "tds propriter"] },
  { label: "TDS - Pvt. Ltd", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds private limited", "tds pvt ltd"] },
  { label: "TDS- Salary", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds on salary", "tds salary payable"] },
  { label: "TDS - SST", category: "tds_statutory", noteHint: "3.13", synonyms: ["tds sst"] },
  { label: "TDS - Rental", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds on rent", "tds rental"] },
  { label: "TDS - Dividend", category: "tds_statutory", noteHint: "3.13",
    synonyms: ["tds on dividend", "dividend tds"] },
  { label: "VAT", category: "tds_statutory", noteHint: "3.13", synonyms: ["vat payable", "value added tax"] },
  { label: "Income Tax Payable", category: "tax", noteHint: "3.14",
    synonyms: ["provision for income tax", "income tax provision"] },
  { label: "Dividend Payable", category: "trade_payables", noteHint: "3.16",
    synonyms: ["proposed dividend", "unpaid dividend"] },

  // ---- Provisions ----
  { label: "Provision for expenses", category: "provisions", noteHint: "3.15",
    synonyms: ["outstanding expenses", "expenses payable"] },
  { label: "Provision for CSR", category: "provisions", noteHint: "3.15",
    synonyms: ["csr provision", "corporate social responsibility provision"] },

  // ---- Related party liability (director loans - bucket) ----
  { label: "Director A", category: "related_party_liability", bucket: "related_party_director", noteHint: "3.11" },
  { label: "Director B", category: "related_party_liability", bucket: "related_party_director", noteHint: "3.11" },

  // ---- Employee payable (name-based bucket) ----
  { label: "Employee A", category: "employee_liability", noteHint: "3.12" },
  { label: "Employee B", category: "employee_liability", noteHint: "3.12" },

  // ---- PPE (fixed classes - not sub-ledger, one row each) ----
  { label: "Land", category: "ppe", noteHint: "3.1" },
  { label: "Building", category: "ppe", noteHint: "3.1" },
  { label: "Furniture & Office Equipment", category: "ppe", noteHint: "3.1",
    synonyms: ["office equipment", "furniture and fixtures", "furniture"] },
  { label: "Vehicle", category: "ppe", noteHint: "3.1", synonyms: ["vehicles", "motor vehicle"] },
  { label: "Plant & Machinery", category: "ppe", noteHint: "3.1", synonyms: ["plant and machinery", "machinery"] },
  { label: "Tally Software", category: "ppe", noteHint: "3.1", synonyms: ["software", "accounting software"] },
  { label: "Leasehold", category: "ppe", noteHint: "3.1", synonyms: ["leasehold improvement", "leasehold assets"] },
  { label: "Work In Progress", category: "ppe", noteHint: "3.1",
    synonyms: ["capital work in progress", "cwip", "wip asset"] },
  { label: "Biological Assets", category: "other_noncurrent_assets", noteHint: "3.5",
    synonyms: ["livestock", "biological asset"] },
  { label: "Accumulated Depreciation", category: "ppe", noteHint: "3.1",
    synonyms: ["acc depreciation", "provision for depreciation"] },

  // ---- Investments ----
  { label: "Shares of XYZ Ltd. (Listed Company)", category: "investments", noteHint: "3.2",
    synonyms: ["listed shares", "investment in listed shares", "shares in listed company"] },
  { label: "Shares of PQR Ltd. (Unlisted Company)", category: "investments", noteHint: "3.2",
    synonyms: ["unlisted shares", "investment in unlisted shares", "shares in unlisted company"] },
  { label: "Provision for Impairment on Investment", category: "investments", noteHint: "3.2",
    synonyms: ["impairment on investment", "investment impairment provision"] },

  // ---- Other current assets ----
  { label: "Deposits", category: "other_current_assets", noteHint: "3.4",
    synonyms: ["security deposit", "deposits paid", "margin deposit"] },
  { label: "Prepayments", category: "other_current_assets", noteHint: "3.4",
    synonyms: ["prepaid expenses", "advance expenses"] },
  { label: "Loans & Advances (Asset)", category: "other_current_assets", noteHint: "3.4",
    synonyms: ["loans and advances", "advance to employees", "staff loan"] },
  { label: "Staff Advance", category: "other_current_assets", noteHint: "3.4",
    synonyms: ["advance to staff", "employee advance"] },

  // ---- Trade receivables (sub-ledger bucket) ----
  { label: "Debtor A", category: "trade_receivables", bucket: "sundry_debtors", noteHint: "3.3" },
  { label: "Debtor B", category: "trade_receivables", bucket: "sundry_debtors", noteHint: "3.3" },
  { label: "Debtor C", category: "trade_receivables", bucket: "sundry_debtors", noteHint: "3.3" },
  { label: "Provision for Impairment on debtors", category: "trade_receivables", noteHint: "3.3",
    synonyms: ["provision for doubtful debts", "impairment on trade receivables", "bad debt provision"] },

  // ---- Related party asset (bucket) ----
  { label: "Director C", category: "related_party_asset", bucket: "related_party_director_recv", noteHint: "3.4" },
  { label: "Director D", category: "related_party_asset", bucket: "related_party_director_recv", noteHint: "3.4" },

  // ---- Cash & Bank ----
  { label: "Petty Cash", category: "cash_bank", noteHint: "3.8",
    synonyms: ["cash in hand", "cash on hand", "petty cash account"] },
  { label: "Bank C", category: "cash_bank", bucket: "bank_accounts", noteHint: "3.8" },
  { label: "Bank D", category: "cash_bank", bucket: "bank_accounts", noteHint: "3.8" },

  // ---- Other assets ----
  { label: "Inventory", category: "inventory_check", noteHint: "3.7",
    synonyms: ["closing stock", "stock in hand"] },
  { label: "Advance Tax", category: "tax", noteHint: "3.14",
    synonyms: ["advance income tax", "tds receivable"] },
  { label: "Non Current Assets held for Sale", category: "other_current_assets", noteHint: "3.6",
    synonyms: ["assets held for sale", "asset held for sale"] },

  // ---- Income ----
  { label: "Sales Revenue", category: "revenue", noteHint: "3.17",
    synonyms: ["sales", "sale of goods", "revenue from sales", "turnover"] },
  { label: "Service Income", category: "revenue", noteHint: "3.17",
    synonyms: ["service revenue", "rendering of services", "consultancy income"] },
  { label: "Interest Income", category: "other_income", noteHint: "3.17",
    synonyms: ["interest received", "interest earned"] },
  { label: "Commission Income", category: "other_income", noteHint: "3.17",
    synonyms: ["commission received", "commission earned"] },
  { label: "Other Indirect Income", category: "other_income", noteHint: "3.17",
    synonyms: ["miscellaneous income", "sundry income", "other income"] },
  { label: "Rental Income", category: "other_income", noteHint: "3.17",
    synonyms: ["rent received", "rent income"] },
  { label: "Dividend Income", category: "other_income", noteHint: "3.17",
    synonyms: ["dividend received"] },
  { label: "Gain on Disposal of Assets", category: "other_income", noteHint: "3.17",
    synonyms: ["profit on sale of assets", "gain on sale of ppe"] },
  { label: "Insurance Claim Income", category: "other_income", noteHint: "3.17",
    synonyms: ["insurance claim received", "insurance recovery"] },
  { label: "Gain on FV adjustment of listed share", category: "other_income", noteHint: "3.17",
    synonyms: ["fair value gain", "gain on fair value adjustment"] },

  // ---- Direct expenses ----
  { label: "Purchase", category: "direct_expense", noteHint: "3.18",
    synonyms: ["purchases", "purchase of goods", "raw material purchase"] },
  { label: "Wages", category: "direct_expense", noteHint: "3.19", synonyms: ["direct wages", "factory wages"] },
  { label: "Other Direct Expenses", category: "direct_expense", noteHint: "3.19",
    synonyms: ["direct expenses", "other direct cost"] },

  // ---- Employee benefit expenses ----
  { label: "Salaries & Wages", category: "employee_expense", noteHint: "3.20",
    synonyms: ["salary expense", "salary and wages", "staff salary"] },
  { label: "Allowances", category: "employee_expense", noteHint: "3.20",
    synonyms: ["staff allowances", "employee allowances"] },
  { label: "PF / SSF / CIT", category: "employee_expense", noteHint: "3.20",
    synonyms: ["provident fund expense", "ssf expense", "cit expense"] },
  { label: "Staff Bonus", category: "employee_expense", noteHint: "3.20",
    synonyms: ["bonus expense", "employee bonus"] },
  { label: "Leave Encashment", category: "employee_expense", noteHint: "3.20",
    synonyms: ["leave encashment expense"] },
  { label: "Other employee related expenses", category: "employee_expense", noteHint: "3.20",
    synonyms: ["staff welfare", "employee welfare expense"] },

  // ---- Finance cost ----
  { label: "Interest expense", category: "finance_cost", noteHint: "IS-direct",
    synonyms: ["interest paid", "interest on loan", "finance cost"] },
  { label: "Bank Charges", category: "finance_cost", noteHint: "3.22",
    synonyms: ["bank commission", "bank service charge"] },

  // ---- Impairment ----
  { label: "Impairment on Receivables", category: "impairment_expense", noteHint: "3.21",
    synonyms: ["bad debts written off", "impairment loss on receivables"] },
  { label: "Impairment on Unlisted Shares", category: "impairment_expense", noteHint: "3.21",
    synonyms: ["impairment loss on investment"] },

  // ---- Repair pools (bucket) ----
  { label: "Pool A", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool B", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool C", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool D", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool E", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },

  // ---- Tax ----
  { label: "Income Tax Expense", category: "tax", noteHint: "3.23",
    synonyms: ["provision for tax", "tax expense", "current tax expense"] },

  // ---- Admin & other expenses ----
  { label: "Audit Fee", category: "admin_expense", noteHint: "3.22",
    synonyms: ["audit expense", "auditors remuneration"] },
  { label: "Advertisement & Business Promotion", category: "admin_expense", noteHint: "3.22",
    synonyms: ["advertisement expense", "marketing expense", "business promotion"] },
  { label: "Fuel Expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["fuel and lubricant", "petrol expense"] },
  { label: "House Rent", category: "admin_expense", noteHint: "3.22",
    synonyms: ["rent expense", "office rent", "lease rentals"] },
  { label: "Annual Maintenance Charges", category: "admin_expense", noteHint: "3.22",
    synonyms: ["amc charges", "annual maintenance"] },
  { label: "Internet & Communication Expense", category: "admin_expense", noteHint: "3.22",
    synonyms: ["telephone expense", "communication expense", "internet expense"] },
  { label: "Legal Expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["legal fees", "legal and professional charges"] },
  { label: "Consultancy Charges", category: "admin_expense", noteHint: "3.22",
    synonyms: ["professional fees", "consulting fees"] },
  { label: "Board Meeting Expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["board meeting fee", "board expenses"] },
  { label: "AGM Expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["annual general meeting expense"] },
  { label: "CSR Expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["corporate social responsibility expense"] },
  { label: "Insurance Premium", category: "admin_expense", noteHint: "3.22",
    synonyms: ["insurance expense", "insurance charges"] },
  { label: "Miscellaneous expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["misc expenses", "sundry expenses", "other expenses"] },
  { label: "Printing & Stationery", category: "admin_expense", noteHint: "3.22",
    synonyms: ["stationery expense", "printing expense"] },
  { label: "Refreshment Expenses", category: "admin_expense", noteHint: "3.22",
    synonyms: ["refreshment", "staff refreshment", "tea and snacks"] },
  { label: "Travelling", category: "admin_expense", noteHint: "3.22",
    synonyms: ["travel expense", "travelling and conveyance", "conveyance"] },
  { label: "Water & Electricity Charges", category: "admin_expense", noteHint: "3.22",
    synonyms: ["electricity expense", "water charges", "utilities"] },
  { label: "Loss on Fair FV adjustment of listed share", category: "admin_expense", noteHint: "3.22",
    synonyms: ["fair value loss", "loss on fair value adjustment"] },
];

/** Look up a chart account entry by its exact label (case-sensitive) */
export function findChartAccountByLabel(label: string): ChartAccount | undefined {
  return CHART_OF_ACCOUNTS.find((a) => a.label === label);
}

/** All labels belonging to a given repeatable sub-ledger bucket, in template order */
export function getBucketLabels(bucket: NonNullable<ChartAccount["bucket"]>): string[] {
  return CHART_OF_ACCOUNTS.filter((a) => a.bucket === bucket).map((a) => a.label);
}
