var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_vite = require("vite");
var import_url = require("url");
var import_exceljs2 = __toESM(require("exceljs"), 1);
var import_genai2 = require("@google/genai");

// tbImportParser.ts
var import_exceljs = __toESM(require("exceljs"), 1);
var HEADER_LABEL_HINTS = ["particular", "account", "ledger", "description", "head", "name"];
var HEADER_DEBIT_HINTS = ["debit", "dr", "dr.", "dr amount"];
var HEADER_CREDIT_HINTS = ["credit", "cr", "cr.", "cr amount"];
function normalizeHeader(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function toNumber(val) {
  if (val === null || val === void 0 || val === "") return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/,/g, "").replace(/\s/g, "");
  const isParenNegative = /^\(.*\)$/.test(cleaned);
  const stripped = cleaned.replace(/[()]/g, "");
  const num = parseFloat(stripped);
  if (isNaN(num)) return 0;
  return isParenNegative ? -num : num;
}
function detectColumns(matrix) {
  const scanLimit = Math.min(matrix.length, 10);
  for (let r = 0; r < scanLimit; r++) {
    const row = matrix[r] || [];
    const normalized = row.map((c) => normalizeHeader(String(c ?? "")));
    const labelCol = normalized.findIndex((c) => HEADER_LABEL_HINTS.some((hint) => c.includes(hint)));
    const debitCol = normalized.findIndex((c) => HEADER_DEBIT_HINTS.some((hint) => c === hint || c.includes(hint)));
    const creditCol = normalized.findIndex((c) => HEADER_CREDIT_HINTS.some((hint) => c === hint || c.includes(hint)));
    if (labelCol !== -1 && debitCol !== -1 && creditCol !== -1) {
      return { headerRowIndex: r, labelCol, debitCol, creditCol };
    }
  }
  return null;
}
async function parseRawTrialBalance(buffer, filename) {
  const warnings = [];
  let matrix = [];
  const isCsv = filename.toLowerCase().endsWith(".csv");
  if (isCsv) {
    const text = buffer.toString("utf-8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    matrix = lines.map((line) => {
      const cells = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cells.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      cells.push(current);
      return cells.map((c) => c.trim().replace(/^"|"$/g, ""));
    });
  } else {
    const workbook = new import_exceljs.default.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.worksheets[0];
    if (!ws) {
      return { rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true, difference: 0, warnings: ["Uploaded workbook has no worksheets."] };
    }
    ws.eachRow({ includeEmpty: true }, (row) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        if (v !== null && typeof v === "object" && "richText" in v) {
          rowValues.push(v.richText.map((t) => t.text).join(""));
        } else if (v !== null && typeof v === "object" && "result" in v) {
          rowValues.push(v.result);
        } else {
          rowValues.push(v);
        }
      });
      matrix.push(rowValues);
    });
  }
  const detected = detectColumns(matrix);
  let labelCol = 0, debitCol = 1, creditCol = 2, startRow = 0;
  if (detected) {
    labelCol = detected.labelCol;
    debitCol = detected.debitCol;
    creditCol = detected.creditCol;
    startRow = detected.headerRowIndex + 1;
  } else {
    warnings.push(
      "Could not confidently detect header row (expected columns like 'Particulars/Account', 'Debit', 'Credit'). Falling back to assuming column A = account name, column B = debit, column C = credit. Please verify results carefully."
    );
  }
  const rows = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (let r = startRow; r < matrix.length; r++) {
    const rowData = matrix[r] || [];
    const rawLabel = rowData[labelCol];
    const label = rawLabel === null || rawLabel === void 0 ? "" : String(rawLabel).trim();
    if (!label) continue;
    if (/^(total|grand total|sub ?total)\b/i.test(label)) continue;
    const debit = toNumber(rowData[debitCol]);
    const credit = toNumber(rowData[creditCol]);
    if (debit === 0 && credit === 0) continue;
    rows.push({ rowIndex: r, label, debit, credit });
    totalDebit += debit;
    totalCredit += credit;
  }
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = Math.abs(difference) < 1;
  if (!isBalanced) {
    warnings.push(
      `Trial balance does NOT foot: total debit ${totalDebit.toLocaleString()} vs total credit ${totalCredit.toLocaleString()} (difference ${difference.toLocaleString()}). Review the uploaded file before proceeding -- this must be resolved before financials can be generated.`
    );
  }
  if (rows.length === 0) {
    warnings.push("No usable account rows were found in the uploaded file.");
  }
  return {
    rows,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced,
    difference,
    warnings
  };
}

// chartOfAccounts.ts
var CHART_OF_ACCOUNTS = [
  // ---- Equity ----
  {
    label: "Paid-up Capital",
    category: "equity",
    noteHint: "3.9",
    synonyms: ["share capital", "paid up capital", "capital", "equity share capital", "issued capital"]
  },
  {
    label: "Share Premium",
    category: "equity",
    noteHint: "3.10",
    synonyms: ["securities premium", "premium on shares"]
  },
  {
    label: "Reserves & Surplus",
    category: "reserves",
    noteHint: "3.10",
    synonyms: ["retained earnings", "general reserve", "reserve and surplus", "accumulated profit"]
  },
  // ---- Non-current borrowings (bank term loans - fixed slots) ----
  {
    label: "Bank A",
    category: "borrowings_noncurrent",
    bucket: "bank_accounts",
    noteHint: "3.11",
    synonyms: ["term loan bank a", "secured loan 1"]
  },
  {
    label: "Bank B",
    category: "borrowings_noncurrent",
    bucket: "bank_accounts",
    noteHint: "3.11",
    synonyms: ["term loan bank b", "secured loan 2"]
  },
  // ---- Current liabilities: trade payables (sub-ledger bucket) ----
  { label: "Creditor A", category: "trade_payables", bucket: "sundry_creditors", noteHint: "3.13" },
  { label: "Creditor B", category: "trade_payables", bucket: "sundry_creditors", noteHint: "3.13" },
  { label: "Creditor C", category: "trade_payables", bucket: "sundry_creditors", noteHint: "3.13" },
  // ---- Current borrowings ----
  { label: "Overdraft", category: "borrowings_current", noteHint: "3.11", synonyms: ["od", "bank overdraft"] },
  { label: "Cash Credit", category: "borrowings_current", noteHint: "3.11", synonyms: ["cc account", "cc loan"] },
  {
    label: "Working Capital Loan",
    category: "borrowings_current",
    noteHint: "3.11",
    synonyms: ["wc loan", "working capital"]
  },
  // ---- Statutory / payables ----
  {
    label: "Audit Fee Payable",
    category: "trade_payables",
    noteHint: "3.13",
    synonyms: ["audit fees payable", "provision for audit fee"]
  },
  {
    label: "Staff Bonus Payable",
    category: "employee_liability",
    noteHint: "3.12",
    synonyms: ["bonus payable", "employee bonus payable"]
  },
  {
    label: "Provident Fund Payable",
    category: "employee_liability",
    noteHint: "3.12",
    synonyms: ["pf payable", "provident fund", "ssf payable", "cit payable"]
  },
  { label: "TDS Payable", category: "tds_statutory", bucket: "tds_generic", noteHint: "3.13" },
  {
    label: "TDS - Aduit Fee",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds audit fee", "tds on audit fee"]
  },
  {
    label: "TDS - Ltd. Company",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds limited company", "tds ltd company"]
  },
  {
    label: "TDS- Propritership",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds proprietorship", "tds propriter"]
  },
  {
    label: "TDS - Pvt. Ltd",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds private limited", "tds pvt ltd"]
  },
  {
    label: "TDS- Salary",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds on salary", "tds salary payable"]
  },
  { label: "TDS - SST", category: "tds_statutory", noteHint: "3.13", synonyms: ["tds sst"] },
  {
    label: "TDS - Rental",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds on rent", "tds rental"]
  },
  {
    label: "TDS - Dividend",
    category: "tds_statutory",
    noteHint: "3.13",
    synonyms: ["tds on dividend", "dividend tds"]
  },
  { label: "VAT", category: "tds_statutory", noteHint: "3.13", synonyms: ["vat payable", "value added tax"] },
  {
    label: "Income Tax Payable",
    category: "tax",
    noteHint: "3.14",
    synonyms: ["provision for income tax", "income tax provision"]
  },
  {
    label: "Dividend Payable",
    category: "trade_payables",
    noteHint: "3.16",
    synonyms: ["proposed dividend", "unpaid dividend"]
  },
  // ---- Provisions ----
  {
    label: "Provision for expenses",
    category: "provisions",
    noteHint: "3.15",
    synonyms: ["outstanding expenses", "expenses payable"]
  },
  {
    label: "Provision for CSR",
    category: "provisions",
    noteHint: "3.15",
    synonyms: ["csr provision", "corporate social responsibility provision"]
  },
  // ---- Related party liability (director loans - bucket) ----
  { label: "Director A", category: "related_party_liability", bucket: "related_party_director", noteHint: "3.11" },
  { label: "Director B", category: "related_party_liability", bucket: "related_party_director", noteHint: "3.11" },
  // ---- Employee payable (name-based bucket) ----
  { label: "Employee A", category: "employee_liability", noteHint: "3.12" },
  { label: "Employee B", category: "employee_liability", noteHint: "3.12" },
  // ---- PPE (fixed classes - not sub-ledger, one row each) ----
  { label: "Land", category: "ppe", noteHint: "3.1" },
  { label: "Building", category: "ppe", noteHint: "3.1" },
  {
    label: "Furniture & Office Equipment",
    category: "ppe",
    noteHint: "3.1",
    synonyms: ["office equipment", "furniture and fixtures", "furniture"]
  },
  { label: "Vehicle", category: "ppe", noteHint: "3.1", synonyms: ["vehicles", "motor vehicle"] },
  { label: "Plant & Machinery", category: "ppe", noteHint: "3.1", synonyms: ["plant and machinery", "machinery"] },
  { label: "Tally Software", category: "ppe", noteHint: "3.1", synonyms: ["software", "accounting software"] },
  { label: "Leasehold", category: "ppe", noteHint: "3.1", synonyms: ["leasehold improvement", "leasehold assets"] },
  {
    label: "Work In Progress",
    category: "ppe",
    noteHint: "3.1",
    synonyms: ["capital work in progress", "cwip", "wip asset"]
  },
  {
    label: "Biological Assets",
    category: "other_noncurrent_assets",
    noteHint: "3.5",
    synonyms: ["livestock", "biological asset"]
  },
  {
    label: "Accumulated Depreciation",
    category: "ppe",
    noteHint: "3.1",
    synonyms: ["acc depreciation", "provision for depreciation"]
  },
  // ---- Investments ----
  {
    label: "Shares of XYZ Ltd. (Listed Company)",
    category: "investments",
    noteHint: "3.2",
    synonyms: ["listed shares", "investment in listed shares", "shares in listed company"]
  },
  {
    label: "Shares of PQR Ltd. (Unlisted Company)",
    category: "investments",
    noteHint: "3.2",
    synonyms: ["unlisted shares", "investment in unlisted shares", "shares in unlisted company"]
  },
  {
    label: "Provision for Impairment on Investment",
    category: "investments",
    noteHint: "3.2",
    synonyms: ["impairment on investment", "investment impairment provision"]
  },
  // ---- Other current assets ----
  {
    label: "Deposits",
    category: "other_current_assets",
    noteHint: "3.4",
    synonyms: ["security deposit", "deposits paid", "margin deposit"]
  },
  {
    label: "Prepayments",
    category: "other_current_assets",
    noteHint: "3.4",
    synonyms: ["prepaid expenses", "advance expenses"]
  },
  {
    label: "Loans & Advances (Asset)",
    category: "other_current_assets",
    noteHint: "3.4",
    synonyms: ["loans and advances", "advance to employees", "staff loan"]
  },
  {
    label: "Staff Advance",
    category: "other_current_assets",
    noteHint: "3.4",
    synonyms: ["advance to staff", "employee advance"]
  },
  // ---- Trade receivables (sub-ledger bucket) ----
  { label: "Debtor A", category: "trade_receivables", bucket: "sundry_debtors", noteHint: "3.3" },
  { label: "Debtor B", category: "trade_receivables", bucket: "sundry_debtors", noteHint: "3.3" },
  { label: "Debtor C", category: "trade_receivables", bucket: "sundry_debtors", noteHint: "3.3" },
  {
    label: "Provision for Impairment on debtors",
    category: "trade_receivables",
    noteHint: "3.3",
    synonyms: ["provision for doubtful debts", "impairment on trade receivables", "bad debt provision"]
  },
  // ---- Related party asset (bucket) ----
  { label: "Director C", category: "related_party_asset", bucket: "related_party_director_recv", noteHint: "3.4" },
  { label: "Director D", category: "related_party_asset", bucket: "related_party_director_recv", noteHint: "3.4" },
  // ---- Cash & Bank ----
  {
    label: "Petty Cash",
    category: "cash_bank",
    noteHint: "3.8",
    synonyms: ["cash in hand", "cash on hand", "petty cash account"]
  },
  { label: "Bank C", category: "cash_bank", bucket: "bank_accounts", noteHint: "3.8" },
  { label: "Bank D", category: "cash_bank", bucket: "bank_accounts", noteHint: "3.8" },
  // ---- Other assets ----
  {
    label: "Inventory",
    category: "inventory_check",
    noteHint: "3.7",
    synonyms: ["closing stock", "stock in hand"]
  },
  {
    label: "Advance Tax",
    category: "tax",
    noteHint: "3.14",
    synonyms: ["advance income tax", "tds receivable"]
  },
  {
    label: "Non Current Assets held for Sale",
    category: "other_current_assets",
    noteHint: "3.6",
    synonyms: ["assets held for sale", "asset held for sale"]
  },
  // ---- Income ----
  {
    label: "Sales Revenue",
    category: "revenue",
    noteHint: "3.17",
    synonyms: ["sales", "sale of goods", "revenue from sales", "turnover"]
  },
  {
    label: "Service Income",
    category: "revenue",
    noteHint: "3.17",
    synonyms: ["service revenue", "rendering of services", "consultancy income"]
  },
  {
    label: "Interest Income",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["interest received", "interest earned"]
  },
  {
    label: "Commission Income",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["commission received", "commission earned"]
  },
  {
    label: "Other Indirect Income",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["miscellaneous income", "sundry income", "other income"]
  },
  {
    label: "Rental Income",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["rent received", "rent income"]
  },
  {
    label: "Dividend Income",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["dividend received"]
  },
  {
    label: "Gain on Disposal of Assets",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["profit on sale of assets", "gain on sale of ppe"]
  },
  {
    label: "Insurance Claim Income",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["insurance claim received", "insurance recovery"]
  },
  {
    label: "Gain on FV adjustment of listed share",
    category: "other_income",
    noteHint: "3.17",
    synonyms: ["fair value gain", "gain on fair value adjustment"]
  },
  // ---- Direct expenses ----
  {
    label: "Purchase",
    category: "direct_expense",
    noteHint: "3.18",
    synonyms: ["purchases", "purchase of goods", "raw material purchase"]
  },
  { label: "Wages", category: "direct_expense", noteHint: "3.19", synonyms: ["direct wages", "factory wages"] },
  {
    label: "Other Direct Expenses",
    category: "direct_expense",
    noteHint: "3.19",
    synonyms: ["direct expenses", "other direct cost"]
  },
  // ---- Employee benefit expenses ----
  {
    label: "Salaries & Wages",
    category: "employee_expense",
    noteHint: "3.20",
    synonyms: ["salary expense", "salary and wages", "staff salary"]
  },
  {
    label: "Allowances",
    category: "employee_expense",
    noteHint: "3.20",
    synonyms: ["staff allowances", "employee allowances"]
  },
  {
    label: "PF / SSF / CIT",
    category: "employee_expense",
    noteHint: "3.20",
    synonyms: ["provident fund expense", "ssf expense", "cit expense"]
  },
  {
    label: "Staff Bonus",
    category: "employee_expense",
    noteHint: "3.20",
    synonyms: ["bonus expense", "employee bonus"]
  },
  {
    label: "Leave Encashment",
    category: "employee_expense",
    noteHint: "3.20",
    synonyms: ["leave encashment expense"]
  },
  {
    label: "Other employee related expenses",
    category: "employee_expense",
    noteHint: "3.20",
    synonyms: ["staff welfare", "employee welfare expense"]
  },
  // ---- Finance cost ----
  {
    label: "Interest expense",
    category: "finance_cost",
    noteHint: "IS-direct",
    synonyms: ["interest paid", "interest on loan", "finance cost"]
  },
  {
    label: "Bank Charges",
    category: "finance_cost",
    noteHint: "3.22",
    synonyms: ["bank commission", "bank service charge"]
  },
  // ---- Impairment ----
  {
    label: "Impairment on Receivables",
    category: "impairment_expense",
    noteHint: "3.21",
    synonyms: ["bad debts written off", "impairment loss on receivables"]
  },
  {
    label: "Impairment on Unlisted Shares",
    category: "impairment_expense",
    noteHint: "3.21",
    synonyms: ["impairment loss on investment"]
  },
  // ---- Repair pools (bucket) ----
  { label: "Pool A", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool B", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool C", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool D", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  { label: "Pool E", category: "admin_expense", bucket: "repair_pool", noteHint: "3.22" },
  // ---- Tax ----
  {
    label: "Income Tax Expense",
    category: "tax",
    noteHint: "3.23",
    synonyms: ["provision for tax", "tax expense", "current tax expense"]
  },
  // ---- Admin & other expenses ----
  {
    label: "Audit Fee",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["audit expense", "auditors remuneration"]
  },
  {
    label: "Advertisement & Business Promotion",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["advertisement expense", "marketing expense", "business promotion"]
  },
  {
    label: "Fuel Expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["fuel and lubricant", "petrol expense"]
  },
  {
    label: "House Rent",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["rent expense", "office rent", "lease rentals"]
  },
  {
    label: "Annual Maintenance Charges",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["amc charges", "annual maintenance"]
  },
  {
    label: "Internet & Communication Expense",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["telephone expense", "communication expense", "internet expense"]
  },
  {
    label: "Legal Expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["legal fees", "legal and professional charges"]
  },
  {
    label: "Consultancy Charges",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["professional fees", "consulting fees"]
  },
  {
    label: "Board Meeting Expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["board meeting fee", "board expenses"]
  },
  {
    label: "AGM Expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["annual general meeting expense"]
  },
  {
    label: "CSR Expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["corporate social responsibility expense"]
  },
  {
    label: "Insurance Premium",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["insurance expense", "insurance charges"]
  },
  {
    label: "Miscellaneous expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["misc expenses", "sundry expenses", "other expenses"]
  },
  {
    label: "Printing & Stationery",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["stationery expense", "printing expense"]
  },
  {
    label: "Refreshment Expenses",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["refreshment", "staff refreshment", "tea and snacks"]
  },
  {
    label: "Travelling",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["travel expense", "travelling and conveyance", "conveyance"]
  },
  {
    label: "Water & Electricity Charges",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["electricity expense", "water charges", "utilities"]
  },
  {
    label: "Loss on Fair FV adjustment of listed share",
    category: "admin_expense",
    noteHint: "3.22",
    synonyms: ["fair value loss", "loss on fair value adjustment"]
  }
];
function findChartAccountByLabel(label) {
  return CHART_OF_ACCOUNTS.find((a) => a.label === label);
}
function getBucketLabels(bucket) {
  return CHART_OF_ACCOUNTS.filter((a) => a.bucket === bucket).map((a) => a.label);
}

// accountMatcher.ts
function normalize(s) {
  return s.toLowerCase().replace(/[.,()&\-_/]/g, " ").replace(/\s+/g, " ").trim();
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}
function similarityScore(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.length === 0 || nb.length === 0) return 0;
  const tokensA = na.split(" ").filter(Boolean);
  const tokensB = nb.split(" ").filter(Boolean);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longerSet = new Set(tokensA.length <= tokensB.length ? tokensB : tokensA);
  const overlap = shorter.filter((t) => longerSet.has(t)).length;
  const tokenScore = shorter.length > 0 ? overlap / shorter.length * 100 : 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const editScore = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;
  return Math.round(0.65 * tokenScore + 0.35 * editScore);
}
var BUCKET_PATTERNS = [
  { bucket: "sundry_debtors", regex: /\bdebtor\b/i, category: "trade_receivables", noteHint: "3.3" },
  { bucket: "sundry_creditors", regex: /\bcreditor\b/i, category: "trade_payables", noteHint: "3.13" },
  { bucket: "bank_accounts", regex: /\bbank\b/i, category: "cash_bank", noteHint: "3.8" },
  { bucket: "related_party_director", regex: /\bdirector\b.*(payable|loan)/i, category: "related_party_liability", noteHint: "3.11" },
  { bucket: "related_party_director_recv", regex: /\bdirector\b.*(receivable|advance)/i, category: "related_party_asset", noteHint: "3.4" }
];
function matchAccount(rawLabel) {
  const trimmed = rawLabel.trim();
  if (!trimmed) {
    return { rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched", candidates: [] };
  }
  const exact = CHART_OF_ACCOUNTS.find((a) => normalize(a.label) === normalize(trimmed));
  if (exact) {
    return {
      rawLabel,
      matchedLabel: exact.label,
      category: exact.category,
      confidence: 100,
      method: "exact",
      candidates: [{ label: exact.label, confidence: 100 }]
    };
  }
  const synonymHit = CHART_OF_ACCOUNTS.find(
    (a) => (a.synonyms || []).some((syn) => normalize(syn) === normalize(trimmed))
  );
  if (synonymHit) {
    return {
      rawLabel,
      matchedLabel: synonymHit.label,
      category: synonymHit.category,
      confidence: 95,
      method: "synonym",
      candidates: [{ label: synonymHit.label, confidence: 95 }]
    };
  }
  for (const pattern of BUCKET_PATTERNS) {
    if (pattern.regex.test(trimmed)) {
      const existingSlots = getBucketLabels(pattern.bucket);
      const scored2 = existingSlots.map((label) => ({ label, confidence: similarityScore(trimmed, label) })).sort((a, b) => b.confidence - a.confidence);
      const best = scored2[0];
      return {
        rawLabel,
        matchedLabel: best && best.confidence >= 55 ? best.label : null,
        category: pattern.category,
        confidence: best ? best.confidence : 40,
        method: "bucket_slot",
        candidates: scored2.slice(0, 5)
      };
    }
  }
  const scored = CHART_OF_ACCOUNTS.map((a) => {
    const labelScore = similarityScore(trimmed, a.label);
    const synScores = (a.synonyms || []).map((s) => similarityScore(trimmed, s));
    const best = Math.max(labelScore, ...synScores, 0);
    return { label: a.label, category: a.category, confidence: best };
  }).sort((a, b) => b.confidence - a.confidence);
  const top = scored[0];
  const candidates = scored.slice(0, 5).map((s) => ({ label: s.label, confidence: s.confidence }));
  if (top && top.confidence >= 80) {
    return { rawLabel, matchedLabel: top.label, category: top.category, confidence: top.confidence, method: "fuzzy", candidates };
  }
  return {
    rawLabel,
    matchedLabel: null,
    category: top ? top.category : null,
    confidence: top ? top.confidence : 0,
    method: "unmatched",
    candidates
  };
}
function matchAllAccounts(rawLabels) {
  return rawLabels.map((label) => matchAccount(label));
}

// aiMatcher.ts
var import_genai = require("@google/genai");
var geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required.");
    geminiClient = new import_genai.GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}
async function aiMatchUnresolved(rawLabels) {
  if (rawLabels.length === 0) return [];
  const ai = getGeminiClient();
  const taxonomyList = CHART_OF_ACCOUNTS.map((a) => `- "${a.label}" (category: ${a.category})`).join("\n");
  const prompt = `You are classifying raw trial balance account names from a client's bookkeeping export into a FIXED chart of accounts used by an audit firm's Nepal NAS-for-MEs financial statement template.

You may ONLY select from this exact closed list of valid destination labels (copy the label text EXACTLY, character for character, including capitalization and punctuation):
${taxonomyList}

If NONE of these labels are a reasonable match for a raw account name, return best_match_label as null. Do not invent new labels. Do not paraphrase a label. Do not select a label that is not letter-for-letter present in the list above.

Raw account names to classify:
${JSON.stringify(rawLabels, null, 2)}

Respond with ONLY a JSON array (no markdown fences, no commentary), one object per raw account name, in the same order, in this exact shape:
[{"raw_label": "...", "best_match_label": "..." | null, "confidence": 0-100, "reasoning": "one short sentence"}]`;
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt
  });
  const text = (response.text || "").trim();
  let parsed = [];
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("aiMatchUnresolved: failed to parse Gemini JSON response", err, text);
    return rawLabels.map((rawLabel) => ({
      rawLabel,
      matchedLabel: null,
      category: null,
      confidence: 0,
      method: "unmatched",
      candidates: []
    }));
  }
  return rawLabels.map((rawLabel) => {
    const suggestion = parsed.find((p) => p.raw_label === rawLabel);
    if (!suggestion || !suggestion.best_match_label) {
      return { rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched", candidates: [] };
    }
    const validated = findChartAccountByLabel(suggestion.best_match_label);
    if (!validated) {
      console.warn(
        `aiMatchUnresolved: Gemini suggested non-existent label "${suggestion.best_match_label}" for raw account "${rawLabel}" -- rejecting and forcing manual review.`
      );
      return { rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched", candidates: [] };
    }
    const confidence = Math.min(Math.max(Math.round(suggestion.confidence), 0), 99);
    return {
      rawLabel,
      matchedLabel: validated.label,
      category: validated.category,
      confidence,
      method: "ai",
      candidates: [{ label: validated.label, confidence }]
    };
  });
}

// server.ts
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
var upload = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
  // 50MB limit
});
var geminiClient2 = null;
function getGeminiClient2() {
  if (!geminiClient2) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in AI Studio Secrets.");
    }
    geminiClient2 = new import_genai2.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient2;
}
var CELL_REF_RE = /(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?[A-Za-z]{1,3})(\$?\d+)(?::(\$?[A-Za-z]{1,3})(\$?\d+))?/g;
var GREEN_FILL_HINTS = /* @__PURE__ */ new Set([
  "FF92D050",
  "FFC6E0B4",
  "FF00B050",
  "FFA9D08E",
  "FFE2EFDA",
  "FF375623"
]);
function isGreenish(rgb) {
  if (!rgb || typeof rgb !== "string" || rgb.length !== 8) {
    return false;
  }
  if (GREEN_FILL_HINTS.has(rgb.toUpperCase())) {
    return true;
  }
  try {
    const r = parseInt(rgb.substring(2, 4), 16);
    const g = parseInt(rgb.substring(4, 6), 16);
    const b = parseInt(rgb.substring(6, 8), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    return g > r + 15 && g > b + 15 && g > 100;
  } catch (e) {
    return false;
  }
}
function columnLetterToIndex(col) {
  let index = 0;
  const cleaned = col.replace(/\$/g, "").toUpperCase();
  for (let i = 0; i < cleaned.length; i++) {
    index = index * 26 + (cleaned.charCodeAt(i) - 64);
  }
  return index;
}
function indexToColumnLetter(index) {
  let letter = "";
  while (index > 0) {
    const temp = (index - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    index = Math.floor((index - temp - 1) / 26);
  }
  return letter;
}
function expandRangeIfSmall(sheetName, coord, maxCells = 200) {
  if (!coord.includes(":")) {
    return [coord];
  }
  const parts = coord.split(":");
  if (parts.length !== 2) return [coord];
  const cell1 = parts[0];
  const cell2 = parts[1];
  const match1 = cell1.match(/^([A-Za-z]+)(\d+)$/);
  const match2 = cell2.match(/^([A-Za-z]+)(\d+)$/);
  if (!match1 || !match2) return [coord];
  const col1 = columnLetterToIndex(match1[1]);
  const row1 = parseInt(match1[2], 10);
  const col2 = columnLetterToIndex(match2[1]);
  const row2 = parseInt(match2[2], 10);
  const minCol = Math.min(col1, col2);
  const maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2);
  const maxRow = Math.max(row1, row2);
  const totalCells = (maxCol - minCol + 1) * (maxRow - minRow + 1);
  if (totalCells > maxCells) {
    return [coord];
  }
  const cells = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push(`${indexToColumnLetter(c)}${r}`);
    }
  }
  return cells;
}
function findRefsInFormula(formula, currentSheet) {
  const refs = [];
  CELL_REF_RE.lastIndex = 0;
  let match;
  while ((match = CELL_REF_RE.exec(formula)) !== null) {
    const col1 = match[3];
    const row1 = match[4];
    if (!col1 || !row1) continue;
    const quotedSheet = match[1];
    const bareSheet = match[2];
    let sheetName = quotedSheet || bareSheet || currentSheet;
    if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
      sheetName = sheetName.substring(1, sheetName.length - 1).replace(/''/g, "'");
    }
    const col2 = match[5];
    const row2 = match[6];
    let coord = "";
    if (col2 && row2) {
      coord = `${col1.replace(/\$/g, "")}${row1.replace(/\$/g, "")}:${col2.replace(/\$/g, "")}${row2.replace(/\$/g, "")}`;
    } else {
      coord = `${col1.replace(/\$/g, "")}${row1.replace(/\$/g, "")}`;
    }
    refs.push({ sheet: sheetName, coord });
  }
  return refs;
}
function getRowLabel(ws, rowIndex) {
  const cols = [1, 2];
  for (const col of cols) {
    const cell = ws.getRow(rowIndex).getCell(col);
    if (cell && cell.value !== null && cell.value !== void 0 && cell.value !== "") {
      const val = cell.value;
      if (typeof val === "object" && val !== null) {
        if ("richText" in val) {
          return val.richText.map((t) => t.text).join("");
        }
        if ("result" in val) {
          return String(val.result || "");
        }
        if ("formula" in val) {
          return String(val.result || "");
        }
      }
      return String(val);
    }
  }
  return null;
}
function getRawFormula(cell) {
  if (!cell || cell.value === null || cell.value === void 0) return null;
  const val = cell.value;
  if (typeof val === "string" && val.startsWith("=")) {
    return val;
  }
  if (typeof val === "object" && val !== null && "formula" in val) {
    const f = val.formula;
    return f.startsWith("=") ? f : `=${f}`;
  }
  return null;
}
function resolveToSource(sheetsData, sheet, cell, visited = /* @__PURE__ */ new Set()) {
  const key = `${sheet}!${cell}`;
  if (visited.has(key)) {
    return [`${sheet}!${cell} (CYCLE)`];
  }
  const nextVisited = new Set(visited);
  nextVisited.add(key);
  const sheetCells = sheetsData.get(sheet);
  if (!sheetCells) {
    return [`${sheet}!${cell} (SHEET NOT FOUND)`];
  }
  const singleCell = cell.split(":")[0];
  const cellData = sheetCells.get(singleCell);
  if (!cellData) {
    return [`${sheet}!${cell}`];
  }
  if (!cellData.isFormula || !cellData.formula) {
    return [`${sheet}!${cell}`];
  }
  const refs = findRefsInFormula(cellData.formula, sheet);
  if (refs.length === 0) {
    return [`${sheet}!${cell} (FORMULA WITH NO RESOLVABLE REFS: ${cellData.formula})`];
  }
  const leaves = [];
  for (const ref of refs) {
    const expanded = expandRangeIfSmall(ref.sheet, ref.coord);
    for (const singleRefCell of expanded) {
      leaves.push(...resolveToSource(sheetsData, ref.sheet, singleRefCell, nextVisited));
    }
  }
  return leaves;
}
async function parseExcelWorkbook(buffer) {
  const workbook = new import_exceljs2.default.Workbook();
  await workbook.xlsx.load(buffer);
  const sheetsData = /* @__PURE__ */ new Map();
  const merged_cell_ranges = {};
  workbook.eachSheet((ws) => {
    const sheetName = ws.name;
    const cellMap = /* @__PURE__ */ new Map();
    sheetsData.set(sheetName, cellMap);
    const mergedRanges = [];
    if (ws.model && ws.model.merges) {
      ws.model.merges.forEach((m) => {
        mergedRanges.push(m);
      });
    }
    merged_cell_ranges[sheetName] = mergedRanges;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const formula = getRawFormula(cell);
        cellMap.set(cell.address, {
          formula,
          isFormula: formula !== null
        });
      });
    });
  });
  const dependency_graph = {};
  workbook.eachSheet((ws) => {
    const sheetName = ws.name;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const addr = cell.address;
        const entryKey = `${sheetName}!${addr}`;
        const formula = getRawFormula(cell);
        const isFormula = formula !== null;
        let fillRgb = null;
        if (cell.fill && cell.fill.type === "pattern" && cell.fill.fgColor && cell.fill.fgColor.argb) {
          fillRgb = cell.fill.fgColor.argb;
        }
        const rowLabel = getRowLabel(ws, cell.row);
        let directRefs = [];
        let sourceRefs = [];
        if (isFormula && formula) {
          directRefs = findRefsInFormula(formula, sheetName).map(
            (ref) => `${ref.sheet}!${ref.coord}`
          );
          try {
            sourceRefs = resolveToSource(sheetsData, sheetName, addr);
          } catch (e) {
            sourceRefs = ["UNRESOLVED (recursion or processing limit)"];
          }
        }
        let rawValue = null;
        if (!isFormula) {
          const val = cell.value;
          if (val !== null && val !== void 0) {
            if (typeof val === "object" && "richText" in val) {
              rawValue = val.richText.map((t) => t.text).join("");
            } else if (typeof val === "object" && "result" in val) {
              rawValue = val.result;
            } else {
              rawValue = val;
            }
          }
        }
        dependency_graph[entryKey] = {
          sheet: sheetName,
          raw_value: rawValue,
          raw_formula: formula,
          is_formula: isFormula,
          direct_refs: directRefs,
          resolved_source_cells: sourceRefs,
          row_label: rowLabel,
          fill_rgb: fillRgb,
          is_green_input_candidate: isGreenish(fillRgb || void 0)
        };
      });
    });
  });
  return {
    dependency_graph,
    merged_cell_ranges
  };
}
var lastUploadedBuffer = null;
var lastUploadedFilename = "Sample.xlsx";
var lastDependencyGraph = null;
var pendingImport = null;
function findRowByLabel(ws, labelText, searchCols = ["A", "B"], startRow = 1, endRow, exact = true) {
  const maxRow = endRow || ws.rowCount;
  for (let r = startRow; r <= maxRow; r++) {
    for (const col of searchCols) {
      const cell = ws.getCell(`${col}${r}`);
      if (cell && cell.value !== null && cell.value !== void 0) {
        let valStr = "";
        if (typeof cell.value === "object" && cell.value !== null) {
          if ("richText" in cell.value) {
            valStr = cell.value.richText.map((t) => t.text).join("");
          } else if ("result" in cell.value) {
            valStr = String(cell.value.result || "");
          } else {
            valStr = String(cell.value.formula || "");
          }
        } else {
          valStr = String(cell.value);
        }
        valStr = valStr.trim();
        if (exact && valStr === labelText.trim()) {
          return r;
        }
        if (!exact && valStr.toLowerCase().includes(labelText.trim().toLowerCase())) {
          return r;
        }
      }
    }
  }
  return null;
}
function findRowByLabelAfter(ws, labelText, afterRow, searchCols = ["A", "B"], windowSize = 40) {
  return findRowByLabel(ws, labelText, searchCols, afterRow, afterRow + windowSize, true);
}
function safeWriteCell(ws, coord, value, sheetName, whitelist) {
  const key = `${sheetName}!${coord}`;
  if (whitelist.size > 0 && !whitelist.has(key)) {
    throw new Error(`Illegal write blocked: '${key}' is not in the input whitelist. Only green input cells can be modified.`);
  }
  ws.getCell(coord).value = value;
}
var SHEET_ENTER_DETAILS = "Enter Details";
var SHEET_TRIAL_BALANCE = "Trial Balance";
var SHEET_NOTES_2_23 = "Notes 3.2 to 3.23";
var ENTER_DETAILS_LABEL_COL = "B";
var ENTER_DETAILS_VALUE_COL = "C";
var ENTER_DETAILS_SIMPLE_LABELS = {
  name_of_entity: "Name of Entity",
  address: "Address",
  type_of_entity: "Type of Entity",
  chairperson: "Chairperson",
  director: "Director",
  accounts_head: "Accounts Head",
  auditor: "Auditor",
  auditor_position: "Auditor Position",
  audit_firm_name: "Name of Audit Firm",
  audit_firm_type: "Type of Audit Firm"
};
var ENTER_DETAILS_EMPLOYEE_COUNT_LABEL = "No. of Employees";
var ENTER_DETAILS_BONUS_RATE_LABEL = "Employee Bonus Rate";
var ENTER_DETAILS_TAX_RATE_LABEL = "Income Tax Rate";
var ENTER_DETAILS_INVENTORY_HEADER_LABEL = "Inventory Details";
var ENTER_DETAILS_INVENTORY_LINES = {
  raw_materials: "Raw materials and consumables",
  work_in_progress: "Work-in-progress",
  finished_goods: "Finished goods and goods for resale"
};
var ENTER_DETAILS_INVENTORY_COL_CY = "C";
var ENTER_DETAILS_INVENTORY_COL_PY = "D";
var NOTE_3_12_LABEL = "Liability for Employee Benefits";
var NOTE_3_12_CURRENT_LABEL = "Due within one year or less";
var NOTE_3_12_NONCURRENT_LABEL = "Due after more than one year";
var NOTE_3_2_CURRENT_LABEL = "Current Portion";
var NOTE_3_2_NONCURRENT_LABEL = "Less: Non-Current portion";
var NOTE_3_4_CURRENT_LABEL = "Current Portion";
var NOTE_3_4_NONCURRENT_LABEL = "Less: Non-Current portion";
var NOTES_VALUE_COL_CY = "E";
var NOTES_VALUE_COL_PY = "F";
var TB_COL_PARTICULARS = "A";
var TB_COL_DURING_DR_CY = "D";
var TB_COL_DURING_CR_CY = "E";
var TB_COL_ADJ_DR_CY = "F";
var TB_COL_ADJ_CR_CY = "G";
var TB_COL_DURING_DR_PY = "N";
var TB_COL_DURING_CR_PY = "O";
function _writeEnterDetails(workbook, company, inventory, employees, income_tax_rate, whitelist) {
  const ws = workbook.getWorksheet(SHEET_ENTER_DETAILS);
  if (!ws) return;
  if (company) {
    for (const [fieldName, label] of Object.entries(ENTER_DETAILS_SIMPLE_LABELS)) {
      const value = company[fieldName];
      if (value === void 0 || value === null || value === "") continue;
      const row = findRowByLabel(ws, label, [ENTER_DETAILS_LABEL_COL]);
      if (row === null) continue;
      safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, value, SHEET_ENTER_DETAILS, whitelist);
    }
  }
  if (employees) {
    if (employees.employee_count !== void 0 && employees.employee_count !== null && employees.employee_count !== "") {
      const row = findRowByLabel(ws, ENTER_DETAILS_EMPLOYEE_COUNT_LABEL, [ENTER_DETAILS_LABEL_COL]);
      if (row) {
        safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, Number(employees.employee_count), SHEET_ENTER_DETAILS, whitelist);
      }
    }
    if (employees.bonus_rate !== void 0 && employees.bonus_rate !== null && employees.bonus_rate !== "") {
      const row = findRowByLabel(ws, ENTER_DETAILS_BONUS_RATE_LABEL, [ENTER_DETAILS_LABEL_COL]);
      if (row) {
        safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, Number(employees.bonus_rate), SHEET_ENTER_DETAILS, whitelist);
      }
    }
  }
  if (income_tax_rate !== void 0 && income_tax_rate !== null && income_tax_rate !== "") {
    const row = findRowByLabel(ws, ENTER_DETAILS_TAX_RATE_LABEL, [ENTER_DETAILS_LABEL_COL]);
    if (row) {
      safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, Number(income_tax_rate), SHEET_ENTER_DETAILS, whitelist);
    }
  }
  if (inventory) {
    const headerRow = findRowByLabel(ws, ENTER_DETAILS_INVENTORY_HEADER_LABEL, [ENTER_DETAILS_LABEL_COL]);
    if (headerRow !== null) {
      for (const [fieldName, label] of Object.entries(ENTER_DETAILS_INVENTORY_LINES)) {
        const row = findRowByLabelAfter(ws, label, headerRow, [ENTER_DETAILS_LABEL_COL]);
        if (row === null) continue;
        const cy_val = inventory.current_year ? inventory.current_year[fieldName] : null;
        const py_val = inventory.previous_year ? inventory.previous_year[fieldName] : null;
        if (cy_val !== null && cy_val !== void 0 && cy_val !== "") {
          safeWriteCell(ws, `${ENTER_DETAILS_INVENTORY_COL_CY}${row}`, Number(cy_val), SHEET_ENTER_DETAILS, whitelist);
        }
        if (py_val !== null && py_val !== void 0 && py_val !== "") {
          safeWriteCell(ws, `${ENTER_DETAILS_INVENTORY_COL_PY}${row}`, Number(py_val), SHEET_ENTER_DETAILS, whitelist);
        }
      }
    }
  }
}
function _writeTrialBalanceMovements(workbook, movements, whitelist) {
  const ws = workbook.getWorksheet(SHEET_TRIAL_BALANCE);
  if (!ws) return;
  const fieldToCol = {
    during_dr_cy: TB_COL_DURING_DR_CY,
    during_cr_cy: TB_COL_DURING_CR_CY,
    adjustment_dr_cy: TB_COL_ADJ_DR_CY,
    adjustment_cr_cy: TB_COL_ADJ_CR_CY,
    during_dr_py: TB_COL_DURING_DR_PY,
    during_cr_py: TB_COL_DURING_CR_PY
  };
  for (const mv of movements) {
    if (!mv.account_label) continue;
    const row = findRowByLabel(ws, mv.account_label, [TB_COL_PARTICULARS], 1, void 0, true);
    if (row === null) {
      throw new Error(`Trial Balance account "${mv.account_label}" not found. This writer does not auto-insert new rows. Please ensure the row is present in your uploaded template first.`);
    }
    for (const [fieldName, col] of Object.entries(fieldToCol)) {
      const value = mv[fieldName];
      if (value === void 0 || value === null || value === "") continue;
      safeWriteCell(ws, `${col}${row}`, Number(value), SHEET_TRIAL_BALANCE, whitelist);
    }
  }
}
function _writeNote312Split(workbook, split, whitelist) {
  if (!split) return;
  const ws = workbook.getWorksheet(SHEET_NOTES_2_23);
  if (!ws) return;
  const anchorRow = findRowByLabel(ws, NOTE_3_12_LABEL, ["A", "B"], 1, void 0, false);
  if (anchorRow === null) return;
  const currentRow = findRowByLabelAfter(ws, NOTE_3_12_CURRENT_LABEL, anchorRow, ["A", "B"]);
  const noncurrentRow = findRowByLabelAfter(ws, NOTE_3_12_NONCURRENT_LABEL, anchorRow, ["A", "B"]);
  if (currentRow) {
    if (split.current_portion_cy !== void 0 && split.current_portion_cy !== null && split.current_portion_cy !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${currentRow}`, Number(split.current_portion_cy), SHEET_NOTES_2_23, whitelist);
    }
    if (split.current_portion_py !== void 0 && split.current_portion_py !== null && split.current_portion_py !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${currentRow}`, Number(split.current_portion_py), SHEET_NOTES_2_23, whitelist);
    }
  }
  if (noncurrentRow) {
    if (split.noncurrent_portion_cy !== void 0 && split.noncurrent_portion_cy !== null && split.noncurrent_portion_cy !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${noncurrentRow}`, Number(split.noncurrent_portion_cy), SHEET_NOTES_2_23, whitelist);
    }
    if (split.noncurrent_portion_py !== void 0 && split.noncurrent_portion_py !== null && split.noncurrent_portion_py !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${noncurrentRow}`, Number(split.noncurrent_portion_py), SHEET_NOTES_2_23, whitelist);
    }
  }
}
function _writeUnverifiedNoteSplits(workbook, splits, whitelist) {
  if (!splits || splits.length === 0) return;
  const ws = workbook.getWorksheet(SHEET_NOTES_2_23);
  if (!ws) return;
  for (const split of splits) {
    let headingSearch = "";
    let currentLabel = "";
    let noncurrentLabel = "";
    if (split.note_number === "3.2") {
      headingSearch = "Investments";
      currentLabel = NOTE_3_2_CURRENT_LABEL;
      noncurrentLabel = NOTE_3_2_NONCURRENT_LABEL;
    } else if (split.note_number === "3.4") {
      headingSearch = "Other Receivables";
      currentLabel = NOTE_3_4_CURRENT_LABEL;
      noncurrentLabel = NOTE_3_4_NONCURRENT_LABEL;
    } else {
      continue;
    }
    const anchorRow = findRowByLabel(ws, headingSearch, ["A", "B"], 1, void 0, false);
    if (anchorRow === null) continue;
    const currentRow = findRowByLabelAfter(ws, currentLabel, anchorRow, ["A", "B"]);
    const noncurrentRow = findRowByLabelAfter(ws, noncurrentLabel, anchorRow, ["A", "B"]);
    try {
      if (currentRow) {
        if (split.current_portion_cy !== void 0 && split.current_portion_cy !== null && split.current_portion_cy !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${currentRow}`, Number(split.current_portion_cy), SHEET_NOTES_2_23, whitelist);
        }
        if (split.current_portion_py !== void 0 && split.current_portion_py !== null && split.current_portion_py !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${currentRow}`, Number(split.current_portion_py), SHEET_NOTES_2_23, whitelist);
        }
      }
      if (noncurrentRow) {
        if (split.noncurrent_portion_cy !== void 0 && split.noncurrent_portion_cy !== null && split.noncurrent_portion_cy !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${noncurrentRow}`, Number(split.noncurrent_portion_cy), SHEET_NOTES_2_23, whitelist);
        }
        if (split.noncurrent_portion_py !== void 0 && split.noncurrent_portion_py !== null && split.noncurrent_portion_py !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${noncurrentRow}`, Number(split.noncurrent_portion_py), SHEET_NOTES_2_23, whitelist);
        }
      }
    } catch (e) {
      console.warn(`Unverified Note ${split.note_number} split write rejected: ${e.message}`);
    }
  }
}
function buildWhitelist() {
  const whitelist = /* @__PURE__ */ new Set();
  if (!lastDependencyGraph) return whitelist;
  for (const [key, cell] of Object.entries(lastDependencyGraph)) {
    if (cell.is_green_input_candidate && !cell.is_formula) {
      whitelist.add(key);
    }
  }
  return whitelist;
}
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No Excel file uploaded." });
    }
    const result = await parseExcelWorkbook(req.file.buffer);
    lastUploadedBuffer = req.file.buffer;
    lastUploadedFilename = req.file.originalname;
    lastDependencyGraph = result.dependency_graph;
    return res.json(result);
  } catch (error) {
    console.error("Upload parsing error:", error);
    return res.status(500).json({ error: error.message || "Failed to parse Excel file." });
  }
});
app.post("/api/import/trial-balance", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No trial balance file uploaded." });
    }
    if (!lastUploadedBuffer) {
      return res.status(400).json({
        error: "No active master template loaded. Please upload the MEs Financials Format workbook first (Lineage Auditor tab), then upload the raw trial balance here."
      });
    }
    const parseResult = await parseRawTrialBalance(req.file.buffer, req.file.originalname);
    if (parseResult.rows.length === 0) {
      return res.status(400).json({
        error: "No usable account rows detected in the uploaded file.",
        warnings: parseResult.warnings
      });
    }
    const rawLabels = parseResult.rows.map((r) => r.label);
    const deterministicMatches = matchAllAccounts(rawLabels);
    const unresolvedLabels = deterministicMatches.filter((m) => m.method === "unmatched" && m.confidence < 60).map((m) => m.rawLabel);
    let finalMatches = deterministicMatches;
    if (unresolvedLabels.length > 0) {
      try {
        const aiResults = await aiMatchUnresolved(unresolvedLabels);
        const aiByLabel = new Map(aiResults.map((r) => [r.rawLabel, r]));
        finalMatches = deterministicMatches.map(
          (m) => unresolvedLabels.includes(m.rawLabel) && aiByLabel.has(m.rawLabel) ? aiByLabel.get(m.rawLabel) : m
        );
      } catch (aiErr) {
        console.warn("AI fallback matching failed, leaving those rows for manual review:", aiErr.message);
      }
    }
    const reviewRows = parseResult.rows.map((row, idx) => ({
      ...finalMatches[idx],
      debit: row.debit,
      credit: row.credit
    }));
    pendingImport = { matches: finalMatches, parsedAt: Date.now() };
    return res.json({
      totalDebit: parseResult.totalDebit,
      totalCredit: parseResult.totalCredit,
      isBalanced: parseResult.isBalanced,
      difference: parseResult.difference,
      warnings: parseResult.warnings,
      rows: reviewRows,
      summary: {
        totalRows: reviewRows.length,
        autoMatched: reviewRows.filter((r) => r.confidence >= 80).length,
        needsReview: reviewRows.filter((r) => r.confidence < 80 && r.confidence >= 40).length,
        unmatched: reviewRows.filter((r) => r.confidence < 40).length
      }
    });
  } catch (error) {
    console.error("Trial balance import error:", error);
    return res.status(500).json({ error: error.message || "Failed to import trial balance." });
  }
});
app.post("/api/import/trial-balance/confirm", async (req, res) => {
  try {
    if (!lastUploadedBuffer) {
      return res.status(400).json({ error: "No active master template loaded." });
    }
    const { rows, isPreviousYear } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No confirmed rows supplied." });
    }
    const workbook = new import_exceljs2.default.Workbook();
    await workbook.xlsx.load(lastUploadedBuffer);
    const whitelist = buildWhitelist();
    const ws = workbook.getWorksheet(SHEET_TRIAL_BALANCE);
    if (!ws) {
      return res.status(500).json({ error: `Master template has no '${SHEET_TRIAL_BALANCE}' sheet.` });
    }
    const skipped = [];
    let written = 0;
    const aggregated = /* @__PURE__ */ new Map();
    for (const row of rows) {
      if (!row.matchedLabel) {
        skipped.push({ rawLabel: row.rawLabel, reason: "No confirmed mapping supplied." });
        continue;
      }
      const existing = aggregated.get(row.matchedLabel) || { debit: 0, credit: 0, sources: [] };
      existing.debit += Number(row.debit) || 0;
      existing.credit += Number(row.credit) || 0;
      existing.sources.push(row.rawLabel);
      aggregated.set(row.matchedLabel, existing);
    }
    const duringDrCol = isPreviousYear ? TB_COL_DURING_DR_PY : TB_COL_DURING_DR_CY;
    const duringCrCol = isPreviousYear ? TB_COL_DURING_CR_PY : TB_COL_DURING_CR_CY;
    for (const [matchedLabel, agg] of aggregated.entries()) {
      const rowIndex = findRowByLabel(ws, matchedLabel, [TB_COL_PARTICULARS], 1, void 0, true);
      if (rowIndex === null) {
        skipped.push({
          rawLabel: agg.sources.join(", "),
          reason: `Template row for "${matchedLabel}" not found in Trial Balance sheet column A. This writer never inserts new rows.`
        });
        continue;
      }
      try {
        if (agg.debit !== 0) {
          safeWriteCell(ws, `${duringDrCol}${rowIndex}`, agg.debit, SHEET_TRIAL_BALANCE, whitelist);
          written++;
        }
        if (agg.credit !== 0) {
          safeWriteCell(ws, `${duringCrCol}${rowIndex}`, agg.credit, SHEET_TRIAL_BALANCE, whitelist);
          written++;
        }
      } catch (writeErr) {
        skipped.push({ rawLabel: agg.sources.join(", "), reason: writeErr.message });
      }
    }
    const outputBuffer = await workbook.xlsx.writeBuffer();
    lastUploadedBuffer = Buffer.from(outputBuffer);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=TB_Imported_${lastUploadedFilename}`);
    res.setHeader("X-Import-Written-Count", String(written));
    res.setHeader("X-Import-Skipped-Count", String(skipped.length));
    if (skipped.length > 0) {
      res.setHeader("X-Import-Skipped-Detail", encodeURIComponent(JSON.stringify(skipped.slice(0, 20))));
    }
    return res.send(outputBuffer);
  } catch (error) {
    console.error("Trial balance confirm-write error:", error);
    return res.status(500).json({ error: error.message || "Failed to write trial balance into workbook." });
  }
});
app.post("/api/analyze", async (req, res) => {
  try {
    const { sheet, coordinate, formula, value, row_label, direct_refs, resolved_source_cells } = req.body;
    if (!coordinate || !formula) {
      return res.status(400).json({ error: "Missing required cell parameters: coordinate and formula." });
    }
    const ai = getGeminiClient2();
    const prompt = `You are an expert financial model auditor and Excel formula developer. Analyze the following cell from a complex financial workbook:
Sheet: ${sheet}
Cell coordinate: ${coordinate}
Formula: ${formula}
Current cell value: ${value || "N/A"}
Row label context: ${row_label || "None"}
Direct precedent references (direct cell links): ${JSON.stringify(direct_refs || [])}
Resolved source cells (ultimate leaves / input cells): ${JSON.stringify(resolved_source_cells || [])}

Please provide a structured, professional review of this formula in beautiful markdown with the following clear sections:
1. **Formula Explanation**: Explain what this cell is calculating, what its input components represent, and why they are being computed this way, described in clear financial/business terms.
2. **Formula Quality & Risk Assessment**: Audit the formula carefully. Highlight any risks, inefficiencies, or bad practices like:
   - Hardcoded magic numbers inside the formula (e.g. \`* 0.12\` instead of linking to a Tax Rate input cell).
   - Complex nested \`IF\` loops that could be simplified using \`IFS\`, \`CHOOSE\`, or a lookup table (\`INDEX/MATCH\`, \`XLOOKUP\`).
   - Risk of errors like \`#DIV/0!\`, \`#N/A\`, or \`#VALUE!\`, and how to prevent them (e.g., using \`IFERROR\` or safe checks).
3. **Optimized Recommendations**: Provide a rewritten or optimized version of the formula to make it cleaner, safer, more dynamic, or more audit-friendly.

Be highly professional, concrete, actionable, and succinct. No conversational fluff or meta-announcements. Go straight to the review.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    const markdownText = response.text || "No response generated from Gemini.";
    return res.json({ audit: markdownText });
  } catch (error) {
    console.error("AI Analysis error:", error);
    return res.status(500).json({ error: error.message || "Failed to perform AI analysis. Please make sure GEMINI_API_KEY is configured." });
  }
});
app.post("/api/generate/statement", async (req, res) => {
  try {
    if (!lastUploadedBuffer) {
      return res.status(400).json({
        error: "No active Excel workbook. Please upload a valid Excel workbook (.xlsx) first so that inputs can be written to it."
      });
    }
    const { company, inventory, employees, income_tax_rate, trial_balance_movements, note_3_12_split, unverified_note_splits } = req.body;
    const workbook = new import_exceljs2.default.Workbook();
    await workbook.xlsx.load(lastUploadedBuffer);
    const whitelist = buildWhitelist();
    _writeEnterDetails(workbook, company, inventory, employees, income_tax_rate, whitelist);
    _writeTrialBalanceMovements(workbook, trial_balance_movements || [], whitelist);
    _writeNote312Split(workbook, note_3_12_split, whitelist);
    _writeUnverifiedNoteSplits(workbook, unverified_note_splits || [], whitelist);
    const outputBuffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Generated_${lastUploadedFilename}`);
    return res.send(outputBuffer);
  } catch (error) {
    console.error("Statement generation error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate Excel statement." });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
