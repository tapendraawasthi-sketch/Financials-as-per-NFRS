// server/server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

// server/routes/company.ts
import { Router } from "express";

// server/middleware/errorHandler.ts
var asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
function errorMiddleware(err, _req, res, _next) {
  const status = err.status ?? 500;
  const message = err.message ?? "An unexpected server error occurred.";
  console.error(`[Server Error ${status}]`, err.message, err.stack?.split("\n")[1]);
  res.status(status).json({ success: false, error: message, code: err.code });
}

// server/store/sessionStore.ts
import { randomUUID } from "crypto";
var SESSION_TTL_MS = 4 * 60 * 60 * 1e3;
var SessionStore = class {
  store = /* @__PURE__ */ new Map();
  generateSessionId() {
    return randomUUID();
  }
  get(id) {
    const session = this.store.get(id);
    if (!session) return void 0;
    if (Date.now() - session.lastAccessAt.getTime() > SESSION_TTL_MS) {
      this.store.delete(id);
      return void 0;
    }
    session.lastAccessAt = /* @__PURE__ */ new Date();
    return session;
  }
  set(id, data) {
    const existing = this.store.get(id);
    const session = {
      createdAt: existing?.createdAt ?? /* @__PURE__ */ new Date(),
      lastAccessAt: /* @__PURE__ */ new Date(),
      ...existing,
      ...data
    };
    this.store.set(id, session);
    return session;
  }
  updateSession(id, updater) {
    const current = this.get(id);
    if (!current) return void 0;
    return this.set(id, updater(current));
  }
  clearSession(id) {
    return this.store.delete(id);
  }
  delete(id) {
    return this.clearSession(id);
  }
  has(id) {
    return this.get(id) !== void 0;
  }
  /** Removes sessions older than maxAgeHours. Returns count removed. */
  cleanup(maxAgeHours = 4) {
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1e3;
    let removed = 0;
    for (const [id, session] of this.store.entries()) {
      if (session.lastAccessAt.getTime() < cutoff) {
        this.store.delete(id);
        removed++;
      }
    }
    return removed;
  }
  size() {
    return this.store.size;
  }
  all() {
    return this.store;
  }
};
var sessionStore = new SessionStore();

// server/routes/company.ts
import crypto from "crypto";

// src/utils/validation.ts
function validateTrialBalanceTotals(rows) {
  const errors = [];
  const warnings = [];
  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;
  for (const row of rows) {
    if (row.isGroupRow) continue;
    totalOpeningDr += row.openingDr ?? 0;
    totalOpeningCr += row.openingCr ?? 0;
    totalClosingDr += row.closingDr ?? 0;
    totalClosingCr += row.closingCr ?? 0;
  }
  totalClosingDr = Math.round(totalClosingDr * 100) / 100;
  totalClosingCr = Math.round(totalClosingCr * 100) / 100;
  const difference = Math.abs(totalClosingDr - totalClosingCr);
  const isBalanced = difference < 1;
  if (!isBalanced) {
    errors.push(
      `Trial balance is not balanced. Closing Dr: ${totalClosingDr.toLocaleString("en-IN")}, Closing Cr: ${totalClosingCr.toLocaleString("en-IN")}. Difference: ${difference.toLocaleString("en-IN")}.`
    );
  }
  const unmapped = rows.filter((r) => !r.isGroupRow && (!r.nfrsCategory || r.nfrsCategory === "unclassified"));
  if (unmapped.length > 0) {
    warnings.push(`${unmapped.length} account(s) are not yet classified to an NFRS category.`);
  }
  const lowConfidence = rows.filter((r) => !r.isGroupRow && (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80);
  if (lowConfidence.length > 0) {
    warnings.push(`${lowConfidence.length} account(s) have low-confidence mappings that should be reviewed.`);
  }
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalClosingDr,
    totalClosingCr,
    totalDebitBalance: totalClosingDr,
    totalCreditBalance: totalClosingCr,
    openingDebitTotal: Math.round(totalOpeningDr * 100) / 100,
    openingCreditTotal: Math.round(totalOpeningCr * 100) / 100,
    closingDebitTotal: totalClosingDr,
    closingCreditTotal: totalClosingCr,
    isBalanced
  };
}
function validateCompanyProfile(data) {
  const errors = [];
  const warnings = [];
  if (!data.companyName?.trim()) errors.push("Company name is required.");
  if (!data.fiscalYear) errors.push("Fiscal year must be selected.");
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalClosingDr: 0,
    totalClosingCr: 0,
    isBalanced: true
  };
}
function validateAccountingPolicies(data) {
  const errors = [];
  const warnings = [];
  if (data.incomeTaxRatePercent !== void 0) {
    if (data.incomeTaxRatePercent < 0 || data.incomeTaxRatePercent > 100) {
      errors.push("Income tax rate must be between 0% and 100%.");
    }
  }
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalClosingDr: 0,
    totalClosingCr: 0,
    isBalanced: true
  };
}

// src/data/fiscalYears.ts
var AD_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
function excelSerialToAD(serial) {
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 864e5);
}
function formatADDate(d) {
  return `${d.getUTCDate()} ${AD_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function endYearFromFY(bsFY) {
  const parts = bsFY.split("/");
  return parseInt(parts[1] ?? "0", 10) + 2e3;
}
function startYearFromFY(bsFY) {
  const parts = bsFY.split("/");
  return parseInt(parts[0] ?? "0", 10);
}
function buildEntry(bsFY, startSerial, endSerial, endBS, prevEndBS) {
  const startAD = excelSerialToAD(startSerial);
  const endAD = excelSerialToAD(endSerial);
  const prevEndAD = excelSerialToAD(endSerial - 365);
  return {
    bsFY,
    bsYear: endYearFromFY(bsFY),
    startBS: `1 Shrawan ${startYearFromFY(bsFY)}`,
    endBS,
    startAD,
    endAD,
    startExcelSerial: startSerial,
    endExcelSerial: endSerial,
    reportingDateBS: endBS,
    reportingDateAD: formatADDate(endAD),
    previousReportingDateBS: prevEndBS,
    previousReportingDateAD: formatADDate(prevEndAD),
    // Legacy aliases
    startDateBS: `1 Shrawan ${startYearFromFY(bsFY)}`,
    endDateBS: endBS,
    startDateAD: formatADDate(startAD),
    endDateAD: formatADDate(endAD),
    startYear: startAD.getUTCFullYear(),
    endYear: endAD.getUTCFullYear(),
    isLeapYear: endBS.startsWith("32")
  };
}
var FY_SERIALS = [
  { bsFY: "2078/79", start: 44393, end: 44758, endBS: "31 Ashadh 2079" },
  { bsFY: "2079/80", start: 44759, end: 45123, endBS: "31 Ashadh 2080" },
  { bsFY: "2080/81", start: 45124, end: 45488, endBS: "31 Ashadh 2081" },
  { bsFY: "2081/82", start: 45489, end: 45853, endBS: "31 Ashadh 2082" },
  { bsFY: "2082/83", start: 45854, end: 46219, endBS: "32 Ashadh 2083" },
  { bsFY: "2083/84", start: 46220, end: 46584, endBS: "31 Ashadh 2084" },
  { bsFY: "2084/85", start: 46585, end: 46980, endBS: "31 Ashadh 2085" },
  { bsFY: "2085/86", start: 46981, end: 47314, endBS: "32 Ashadh 2086" },
  { bsFY: "2086/87", start: 47315, end: 47680, endBS: "31 Ashadh 2087" },
  { bsFY: "2087/88", start: 47681, end: 48046, endBS: "31 Ashadh 2088" },
  { bsFY: "2088/89", start: 48047, end: 48411, endBS: "32 Ashadh 2089" },
  { bsFY: "2089/90", start: 48412, end: 48776, endBS: "31 Ashadh 2090" }
];
var FISCAL_YEARS = FY_SERIALS.map((fy, i) => {
  const prevEndBS = i > 0 ? FY_SERIALS[i - 1].endBS : "31 Ashadh 2078";
  const entry = buildEntry(fy.bsFY, fy.start, fy.end, fy.endBS, prevEndBS);
  if (i > 0) {
    const prevEndAD = excelSerialToAD(FY_SERIALS[i - 1].end);
    entry.previousReportingDateAD = formatADDate(prevEndAD);
  }
  return entry;
});
function getFiscalYear(bsFY) {
  return FISCAL_YEARS.find((fy) => fy.bsFY === bsFY);
}
function getFiscalYearOptions() {
  return FISCAL_YEARS.map((fy) => ({
    value: fy.bsFY,
    label: `${fy.bsFY}  (${formatADDate(fy.startAD)} \u2013 ${formatADDate(fy.endAD)})`
  }));
}

// server/routes/company.ts
var router = Router();
router.post("/ensure", asyncHandler(async (req, res) => {
  const body = req.body;
  const incomingId = body.id && !String(body.id).startsWith("local-") ? body.id : void 0;
  const id = incomingId ?? crypto.randomUUID();
  const existing = sessionStore.get(id);
  const company = {
    ...existing?.company,
    ...body,
    id,
    createdAt: existing?.company?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  sessionStore.set(id, { company });
  return res.json(company);
}));
router.post("/", asyncHandler(async (req, res) => {
  const body = req.body;
  const validation = validateCompanyProfile(body);
  if (!validation.isValid) {
    return res.status(400).json({ error: "Validation failed", errors: validation.errors });
  }
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const company = {
    ...body,
    id,
    createdAt: now,
    updatedAt: now
  };
  sessionStore.set(id, { company });
  return res.status(201).json(company);
}));
router.get("/:companyId", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.company) return res.status(404).json({ error: "Company not found." });
  return res.json(session.company);
}));
router.put("/:companyId", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const body = req.body;
  const validation = validateCompanyProfile(body);
  if (!validation.isValid) {
    return res.status(400).json({ error: "Validation failed", errors: validation.errors });
  }
  const updated = sessionStore.set(req.params.companyId, {
    company: { ...session.company, ...body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  });
  return res.json(updated?.company);
}));
router.post("/:companyId/policies", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const validation = validateAccountingPolicies(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: "Validation failed", errors: validation.errors });
  }
  const updatedCompany = { ...session.company, accountingPolicies: req.body };
  sessionStore.set(req.params.companyId, { company: updatedCompany });
  return res.json({ message: "Accounting policies saved.", policies: req.body });
}));
router.put("/:companyId/previous-year", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const updatedCompany = { ...session.company, previousYearData: req.body, updatedAt: /* @__PURE__ */ new Date() };
  sessionStore.set(req.params.companyId, { company: updatedCompany });
  return res.json(updatedCompany);
}));
router.get("/fiscal-years/options", asyncHandler(async (_req, res) => {
  return res.json(getFiscalYearOptions());
}));
var company_default = router;

// server/routes/trialBalance.ts
import { Router as Router2 } from "express";

// server/middleware/upload.ts
import multer from "multer";
var ACCEPTED_MIME_TYPES = /* @__PURE__ */ new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // .xlsx
  "application/vnd.ms-excel",
  // .xls
  "text/csv",
  "application/csv",
  "text/plain"
  // some browsers send CSV with this type
]);
var ACCEPTED_EXTENSIONS = /* @__PURE__ */ new Set([".xlsx", ".xls", ".csv"]);
function fileFilter(_req, file, cb) {
  const originalName = file.originalname?.toLowerCase() ?? "";
  const ext = originalName.slice(originalName.lastIndexOf("."));
  const mimeOk = ACCEPTED_MIME_TYPES.has(file.mimetype);
  const extOk = ACCEPTED_EXTENSIONS.has(ext);
  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Only Excel (.xlsx, .xls) and CSV (.csv) files are accepted. Received: "${file.originalname}" (${file.mimetype}).`
      )
    );
  }
}
var uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter
});
var tbUploadMiddleware = uploadMiddleware.single("trialbalance");

// server/services/tbParser.ts
import ExcelJS from "exceljs";
var COL_HINTS = {
  label: [
    "particular",
    "account",
    "ledger",
    "description",
    "head",
    "name",
    "title",
    "narration",
    "particulars",
    "ledger name",
    "account name",
    "account head"
  ],
  openingDr: [
    "opening dr",
    "op dr",
    "opening debit",
    "op debit",
    "opening balance dr",
    "opn dr",
    "opening balance dr",
    "op balance dr",
    "opening bal dr",
    "ob dr",
    "opening",
    "open dr",
    "open debit",
    "opening dr balance"
  ],
  openingCr: [
    "opening cr",
    "op cr",
    "opening credit",
    "op credit",
    "opening balance cr",
    "opn cr",
    "opening balance cr",
    "op balance cr",
    "opening bal cr",
    "ob cr",
    "open cr",
    "open credit",
    "opening cr balance"
  ],
  duringDr: [
    "during dr",
    "transaction dr",
    "dur dr",
    "movement dr",
    "during year dr",
    "receipt",
    "dr total",
    "transaction debit",
    "total debit",
    "transactions dr",
    "during period dr",
    "period dr"
    // bare 'debit' / 'dr' intentionally omitted — too ambiguous with closing columns
  ],
  duringCr: [
    "during cr",
    "transaction cr",
    "dur cr",
    "movement cr",
    "during year cr",
    "payment",
    "cr total",
    "transaction credit",
    "total credit",
    "transactions cr",
    "during period cr",
    "period cr"
    // bare 'credit' / 'cr' intentionally omitted — too ambiguous with closing columns
  ],
  adjustmentDr: [
    "adj dr",
    "adjustment dr",
    "year end adj dr",
    "adjustment debit",
    "jv dr",
    "adjustments dr",
    "year-end dr"
  ],
  adjustmentCr: [
    "adj cr",
    "adjustment cr",
    "year end adj cr",
    "adjustment credit",
    "jv cr",
    "adjustments cr",
    "year-end cr"
  ],
  closingDr: [
    "closing dr",
    "balance dr",
    "closing debit",
    "net dr",
    "closing balance dr",
    "closing balance dr",
    "cl balance dr",
    "closing bal dr",
    "cb dr",
    "balance dr",
    "close dr",
    "closing debit balance",
    "cl dr",
    "debit balance"
  ],
  closingCr: [
    "closing cr",
    "balance cr",
    "closing credit",
    "net cr",
    "closing balance cr",
    "closing balance cr",
    "cl balance cr",
    "closing bal cr",
    "cb cr",
    "balance cr",
    "close cr",
    "closing credit balance",
    "cl cr",
    "credit balance"
  ]
};
var SUBTOTAL_PATTERNS = /^(total|grand total|sum|sub.?total|net total|account total)/i;
function toNumber(val) {
  if (val === null || val === void 0 || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  const isNeg = /^\(.*\)$/.test(str);
  const cleaned = str.replace(/,/g, "").replace(/\s/g, "").replace(/[()]/g, "").replace(/NPR/gi, "").replace(/Rs\.?/gi, "").replace(/\s*(dr|cr)\.?$/i, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNeg ? -Math.abs(num) : num;
}
function parseDrCrBalance(val) {
  if (val === null || val === void 0 || val === "") return { dr: 0, cr: 0 };
  if (typeof val === "number") {
    return val >= 0 ? { dr: val, cr: 0 } : { dr: 0, cr: Math.abs(val) };
  }
  const str = String(val).trim();
  if (!str) return { dr: 0, cr: 0 };
  const isCr = /\bcr\.?\s*$/i.test(str);
  const isDr = /\bdr\.?\s*$/i.test(str);
  const num = toNumber(str);
  if (isCr) return { dr: 0, cr: num };
  if (isDr) return { dr: num, cr: 0 };
  return num >= 0 ? { dr: num, cr: 0 } : { dr: 0, cr: Math.abs(num) };
}
function normCell(val) {
  if (val === null || val === void 0) return "";
  return String(val).toLowerCase().trim().replace(/\s+/g, " ");
}
function countLeadingSpaces(label) {
  const match = label.match(/^(\s+)/);
  if (!match) return 0;
  return match[1].replace(/\t/g, "    ").length;
}
function detectRowLevel(label, amounts, isBold = false) {
  const rawIndentSpaces = countLeadingSpaces(label);
  const trimmed = label.trim();
  const hasAnyAmount = amounts.some((a) => a !== 0);
  const isGroupRow = rawIndentSpaces === 0 && !hasAnyAmount || KNOWN_GROUP_NAMES.test(trimmed) || isBold && !hasAnyAmount;
  const rowLevel = isGroupRow ? 0 : rawIndentSpaces > 0 ? 1 : 2;
  return { rowLevel, isGroupRow, rawIndentSpaces };
}
var MAX_HEADER_SCAN = 25;
var KNOWN_GROUP_NAMES = /^(capital account|non.?current liabilities?|current liabilities?|property.? plant|direct income|indirect income|employee benefit|administrative expenses?|sundry debtors?|sundry creditors?|fixed assets?|current assets?|equity|expenses?|income|loans?|investments?|provisions?)/i;
function resolveAmbiguousClosingColumns(row, colMap) {
  const cells = row.map((c) => normCell(c));
  const resolved = { ...colMap };
  const hasClosing = resolved.closingDr !== void 0 || resolved.closingCr !== void 0;
  const hasDuring = resolved.duringDr !== void 0 || resolved.duringCr !== void 0;
  const hasOpening = resolved.openingDr !== void 0 || resolved.openingCr !== void 0;
  const hasAdjustment = resolved.adjustmentDr !== void 0 || resolved.adjustmentCr !== void 0;
  if (!hasClosing && hasDuring && !hasOpening && !hasAdjustment) {
    const amountFields = ["duringDr", "duringCr"];
    const amountCount = amountFields.filter((f) => resolved[f] !== void 0).length;
    if (amountCount === 2) {
      resolved.closingDr = resolved.duringDr;
      resolved.closingCr = resolved.duringCr;
      delete resolved.duringDr;
      delete resolved.duringCr;
      return resolved;
    }
  }
  if (!hasClosing) {
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const isDebit = cell === "debit" || cell === "dr" || cell === "dr." || cell.endsWith(" dr");
      const isCredit = cell === "credit" || cell === "cr" || cell === "cr." || cell.endsWith(" cr");
      if (isDebit && resolved.closingDr === void 0 && resolved.duringDr === void 0) {
        resolved.closingDr = c;
      } else if (isCredit && resolved.closingCr === void 0 && resolved.duringCr === void 0) {
        resolved.closingCr = c;
      }
    }
  }
  return resolved;
}
function detectColumns(matrix) {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const row = matrix[r] ?? [];
    const colMap = {};
    for (let c = 0; c < row.length; c++) {
      const cell = normCell(row[c]);
      for (const [fieldName, hints] of Object.entries(COL_HINTS)) {
        if (colMap[fieldName] !== void 0) continue;
        for (const hint of hints) {
          if (cell === hint || cell.includes(hint)) {
            colMap[fieldName] = c;
            break;
          }
        }
      }
    }
    const resolvedMap = resolveAmbiguousClosingColumns(row, colMap);
    if (resolvedMap["label"] !== void 0) {
      const amountCols = Object.keys(resolvedMap).filter((k) => k !== "label");
      if (amountCols.length >= 1) {
        return { colMap: resolvedMap, headerRowIndex: r };
      }
    }
  }
  return null;
}
function detectTallyPrimeFormat(matrix) {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const row = matrix[r] ?? [];
    const cells = row.map((c) => normCell(c));
    const hasParticulars = cells.some((c) => c === "particulars" || c === "ledger" || c === "account");
    const hasDebit = cells.some((c) => c === "debit");
    const hasCredit = cells.some((c) => c === "credit");
    const hasClosingDr = cells.some(
      (c) => c.includes("closing") && (c.includes("dr") || c.includes("debit"))
    );
    const hasClosingCr = cells.some(
      (c) => c.includes("closing") && (c.includes("cr") || c.includes("credit"))
    );
    if (hasParticulars && hasDebit && hasCredit && (hasClosingDr || hasClosingCr)) {
      const colMap = {};
      cells.forEach((cell, i) => {
        if (cell === "particulars" || cell === "ledger" || cell === "account") colMap["label"] = i;
        else if (cell === "opening" || cell.includes("opening") && cell.includes("dr")) colMap["openingDr"] = i;
        else if (cell.includes("opening") && cell.includes("cr")) colMap["openingCr"] = i;
        else if (cell === "debit" && colMap["duringDr"] === void 0) colMap["duringDr"] = i;
        else if (cell === "credit" && colMap["duringCr"] === void 0) colMap["duringCr"] = i;
        else if (cell.includes("closing") && (cell.includes("dr") || cell.includes("debit"))) colMap["closingDr"] = i;
        else if (cell.includes("closing") && (cell.includes("cr") || cell.includes("credit"))) colMap["closingCr"] = i;
      });
      if (colMap["label"] !== void 0) {
        return { isTallyPrime: true, headerRowIndex: r, colMap };
      }
    }
  }
  return { isTallyPrime: false, headerRowIndex: -1, colMap: {} };
}
function detectTallyGroupedExport(matrix) {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const cells = (matrix[r] ?? []).map(normCell);
    const labelCol = cells.findIndex(
      (c) => c.includes("account") && c.includes("group") || c === "particulars" || c.includes("ledger name") || c === "account name"
    );
    const openingCol = cells.findIndex((c) => c.includes("opening") && c.includes("bal"));
    const closingCol = cells.findIndex((c) => c.includes("closing") && c.includes("bal"));
    const debitCol = cells.findIndex((c) => c === "debit");
    const creditCol = cells.findIndex((c) => c === "credit");
    if (labelCol >= 0 && openingCol >= 0 && closingCol >= 0 && debitCol >= 0 && creditCol >= 0) {
      return {
        isGrouped: true,
        headerRowIndex: r,
        colMap: {
          label: labelCol,
          openingBal: openingCol,
          duringDr: debitCol,
          duringCr: creditCol,
          closingBal: closingCol
        }
      };
    }
  }
  return { isGrouped: false, headerRowIndex: -1, colMap: {} };
}
function markGroupRowsByIndentation(rows) {
  return rows.map((row, i) => {
    let hasDeeperDescendant = false;
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces <= row.rawIndentSpaces) break;
      hasDeeperDescendant = true;
      break;
    }
    return {
      ...row,
      isGroupRow: hasDeeperDescendant,
      rowLevel: hasDeeperDescendant ? 0 : row.rawIndentSpaces > 4 ? 2 : 1
    };
  });
}
function markTallyShorthandAggregates(rows) {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    const peers = [];
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces < row.rawIndentSpaces) break;
      if (rows[j].rawIndentSpaces === row.rawIndentSpaces) {
        peers.push(rows[j].rawLabel.trim());
      }
    }
    const isShorthandAggregate = peers.some(
      (peer) => (peer.startsWith(`${row.rawLabel.trim()}:`) || peer.startsWith(`${row.rawLabel.trim()} `)) && peer.length > row.rawLabel.trim().length
    );
    return { ...row, isGroupRow: isShorthandAggregate };
  });
}
function postProcessTallyGroupedRows(rows) {
  return markTallyShorthandAggregates(markGroupRowsByIndentation(rows));
}
function detectFormat(matrix, detection) {
  const groupedCheck = detectTallyGroupedExport(matrix);
  if (groupedCheck.isGrouped) {
    return {
      format: "tally_grouped",
      colMap: groupedCheck.colMap,
      headerRowIndex: groupedCheck.headerRowIndex
    };
  }
  const tallyCheck = detectTallyPrimeFormat(matrix);
  if (tallyCheck.isTallyPrime) {
    return {
      format: "tally_prime",
      colMap: tallyCheck.colMap,
      headerRowIndex: tallyCheck.headerRowIndex
    };
  }
  if (detection) {
    return { format: "full", colMap: detection.colMap, headerRowIndex: detection.headerRowIndex };
  }
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN + 5); r++) {
    const row = (matrix[r] ?? []).filter(
      (c) => c !== null && c !== void 0 && c !== ""
    );
    if (row.length === 3) {
      const secondIsNum = typeof row[1] === "number" || !isNaN(parseFloat(String(row[1] ?? "")));
      const thirdIsNum = typeof row[2] === "number" || !isNaN(parseFloat(String(row[2] ?? "")));
      if (secondIsNum && thirdIsNum) {
        return {
          format: "3col",
          colMap: { label: 0, closingDr: 1, closingCr: 2 },
          headerRowIndex: 0
        };
      }
    }
    if (row.length === 2) {
      const secondIsNum = typeof row[1] === "number" || !isNaN(parseFloat(String(row[1] ?? "")));
      if (secondIsNum) {
        return {
          format: "2col",
          colMap: { label: 0, closingDr: 1 },
          headerRowIndex: 0
        };
      }
    }
    if (row.length === 2 || row.length === 3) {
      const labelCell = normCell(row[0]);
      const hasLabel = COL_HINTS.label.some((h) => labelCell === h || labelCell.includes(h));
      if (!hasLabel && row.length === 2) {
        const secondIsNum = typeof row[1] === "number" || !isNaN(parseFloat(String(row[1] ?? "")));
        if (secondIsNum) {
          return {
            format: "1col",
            colMap: { label: 0, closingDr: 1 },
            headerRowIndex: 0
          };
        }
      }
    }
  }
  return {
    format: "3col",
    colMap: { label: 0, closingDr: 1, closingCr: 2 },
    headerRowIndex: 0
  };
}
function extractRow(matRow, rowIndex, colMap, format) {
  const g = (key) => {
    const idx = colMap[key];
    return idx !== void 0 ? toNumber(matRow[idx]) : 0;
  };
  const rawLabelCell = String(matRow[colMap["label"] ?? 0] ?? "");
  const rawLabel = rawLabelCell.trim();
  const rawIndentSpaces = countLeadingSpaces(rawLabelCell);
  let openingDr = 0, openingCr = 0, duringDr = 0, duringCr = 0;
  let adjustmentDr = 0, adjustmentCr = 0, closingDr = 0, closingCr = 0;
  switch (format) {
    case "tally_prime": {
      openingDr = g("openingDr");
      openingCr = g("openingCr");
      duringDr = g("duringDr");
      duringCr = g("duringCr");
      adjustmentDr = 0;
      adjustmentCr = 0;
      const hasClosingDr = colMap["closingDr"] !== void 0;
      const hasClosingCr = colMap["closingCr"] !== void 0;
      if (hasClosingDr || hasClosingCr) {
        closingDr = g("closingDr");
        closingCr = g("closingCr");
      } else {
        const balanceAmt = g("closingDr") || g("closingCr") || g("duringDr");
        const drCrIdx = colMap["drCr"];
        const drCrVal = drCrIdx !== void 0 ? normCell(matRow[drCrIdx]) : "";
        if (drCrVal.includes("cr") || drCrVal === "c") {
          closingCr = Math.abs(balanceAmt);
          closingDr = 0;
        } else {
          closingDr = Math.abs(balanceAmt);
          closingCr = 0;
        }
      }
      break;
    }
    case "tally_grouped": {
      const openingIdx = colMap["openingBal"];
      const closingIdx = colMap["closingBal"];
      if (openingIdx !== void 0) {
        const opening = parseDrCrBalance(matRow[openingIdx]);
        openingDr = opening.dr;
        openingCr = opening.cr;
      }
      duringDr = g("duringDr");
      duringCr = g("duringCr");
      if (closingIdx !== void 0) {
        const closing = parseDrCrBalance(matRow[closingIdx]);
        closingDr = closing.dr;
        closingCr = closing.cr;
      }
      if (closingDr === 0 && closingCr === 0) {
        const net = openingDr - openingCr + (duringDr - duringCr);
        if (net >= 0) closingDr = net;
        else closingCr = Math.abs(net);
      }
      break;
    }
    case "3col": {
      closingDr = g("closingDr");
      closingCr = g("closingCr");
      break;
    }
    case "2col": {
      const amt = g("closingDr");
      if (amt >= 0) {
        closingDr = amt;
        closingCr = 0;
      } else {
        closingDr = 0;
        closingCr = Math.abs(amt);
      }
      break;
    }
    case "1col": {
      const amt = g("closingDr");
      if (amt >= 0) {
        closingDr = amt;
      } else {
        closingCr = Math.abs(amt);
      }
      break;
    }
    case "full":
    default: {
      openingDr = g("openingDr");
      openingCr = g("openingCr");
      duringDr = g("duringDr");
      duringCr = g("duringCr");
      adjustmentDr = g("adjustmentDr");
      adjustmentCr = g("adjustmentCr");
      const hasClosingDr = colMap["closingDr"] !== void 0;
      const hasClosingCr = colMap["closingCr"] !== void 0;
      closingDr = hasClosingDr ? g("closingDr") : openingDr + duringDr + adjustmentDr;
      closingCr = hasClosingCr ? g("closingCr") : openingCr + duringCr + adjustmentCr;
      break;
    }
  }
  const amounts = [openingDr, openingCr, duringDr, duringCr, adjustmentDr, adjustmentCr, closingDr, closingCr];
  const { rowLevel, isGroupRow } = detectRowLevel(rawLabelCell, amounts);
  return {
    rowIndex,
    rawLabel,
    openingDr,
    openingCr,
    duringDr,
    duringCr,
    adjustmentDr,
    adjustmentCr,
    closingDr,
    closingCr,
    rowLevel,
    isGroupRow,
    parentGroup: "",
    // filled in during the parent-tracking pass
    rawIndentSpaces
  };
}
function parseCSVText(text) {
  const lines = text.split(/\r?\n/);
  return lines.map((line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }).filter((row) => row.some((c) => c !== ""));
}
function assignParentGroups(rows) {
  const groupStack = [];
  return rows.map((row) => {
    if (row.isGroupRow) {
      while (groupStack.length > 0 && groupStack[groupStack.length - 1].indentSpaces >= row.rawIndentSpaces) {
        groupStack.pop();
      }
      groupStack.push({
        label: row.rawLabel,
        indentSpaces: row.rawIndentSpaces,
        level: row.rowLevel
      });
      return { ...row, parentGroup: groupStack.length > 1 ? groupStack[groupStack.length - 2].label : "" };
    } else {
      const parentGroup = groupStack.length > 0 ? groupStack[groupStack.length - 1].label : "";
      return { ...row, parentGroup };
    }
  });
}
function worksheetToMatrix(ws) {
  const matrix = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v !== null && typeof v === "object") {
        if ("richText" in v)
          cells.push(v.richText.map((t) => t.text).join(""));
        else if ("result" in v)
          cells.push(v.result);
        else
          cells.push(v);
      } else {
        cells.push(v);
      }
    });
    matrix.push(cells);
  });
  return matrix;
}
function isSecondarySheetName(name) {
  const n = name.trim().toLowerCase();
  if (/\bpy\b/.test(n)) return true;
  if (/previous\s*year/.test(n)) return true;
  if (/last\s*year/.test(n)) return true;
  if (/2080/.test(n)) return true;
  if (/\b20\d{2}\b/.test(name)) return true;
  if (/\b20[6-8]\d\b/.test(name)) return true;
  if (/\d{4}\s*[-–]\s*\d{2,4}/.test(name)) return true;
  return false;
}
function findSecondaryWorksheet(workbook, primaryName) {
  const candidates = [];
  for (const ws of workbook.worksheets) {
    if (ws.name === primaryName) continue;
    if (!isSecondarySheetName(ws.name)) continue;
    const n = ws.name.trim().toLowerCase();
    let score = 0;
    if (/\bpy\b/.test(n) || n === "py") score += 50;
    if (/previous\s*year/.test(n)) score += 45;
    if (/last\s*year/.test(n)) score += 40;
    if (/2080/.test(n)) score += 35;
    if (/\b20\d{2}\b/.test(ws.name)) score += 20;
    if (/\b20[6-8]\d\b/.test(ws.name)) score += 15;
    if (/\d{4}\s*[-–]\s*\d{2,4}/.test(ws.name)) score += 10;
    candidates.push({ ws, score });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].ws;
}
function parseSecondaryMatrix(matrix) {
  try {
    return parseMatrix(matrix).rows;
  } catch {
    return null;
  }
}
function buildColMapInRange(row, labelCol, startCol, endCol) {
  const colMap = { label: labelCol };
  for (let c = startCol; c <= endCol; c++) {
    const cell = normCell(row[c]);
    for (const [fieldName, hints] of Object.entries(COL_HINTS)) {
      if (fieldName === "label" || colMap[fieldName] !== void 0) continue;
      for (const hint of hints) {
        if (cell === hint || cell.includes(hint)) {
          colMap[fieldName] = c;
          break;
        }
      }
    }
  }
  return resolveAmbiguousClosingColumns(row, colMap);
}
function detectDualYearColumns(matrix) {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const row = matrix[r] ?? [];
    const cells = row.map((c) => normCell(c));
    const labelCol = cells.findIndex(
      (c) => COL_HINTS.label.some((h) => c === h || c.includes(h))
    );
    if (labelCol === -1) continue;
    const hasPY = cells.some(
      (c) => c.includes("previous year") || c.includes("last year") || c === "py"
    );
    const hasCY = cells.some((c) => c.includes("current year") || c === "cy");
    const openingDrCols = [];
    for (let c = labelCol + 1; c < row.length; c++) {
      const cell = cells[c];
      if (cell.includes("opening") && (cell.includes("dr") || cell.includes("debit"))) {
        openingDrCols.push(c);
      }
    }
    if (openingDrCols.length < 2) {
      const closingDrCols = [];
      for (let c = labelCol + 1; c < row.length; c++) {
        const cell = cells[c];
        if (cell.includes("closing") && (cell.includes("dr") || cell.includes("debit"))) {
          closingDrCols.push(c);
        }
      }
      if (closingDrCols.length >= 2 && (hasPY || hasCY)) {
        openingDrCols.push(...closingDrCols);
      }
    }
    if (openingDrCols.length < 2) continue;
    const cyStart = openingDrCols[0];
    const pyStart = openingDrCols[1];
    const cyEnd = pyStart - 1;
    const pyEnd = row.length - 1;
    const cyColMap = buildColMapInRange(row, labelCol, cyStart, cyEnd);
    const pyColMap = buildColMapInRange(row, labelCol, pyStart, pyEnd);
    const cyAmounts = Object.keys(cyColMap).filter((k) => k !== "label");
    const pyAmounts = Object.keys(pyColMap).filter((k) => k !== "label");
    if (cyAmounts.length >= 1 && pyAmounts.length >= 1) {
      return { cyColMap, pyColMap, headerRowIndex: r };
    }
  }
  return null;
}
function parseMatrixWithColMap(matrix, colMap, headerRowIndex, mode, warningsPrefix = []) {
  const warnings = [...warningsPrefix];
  const rows = [];
  const skippedSubtotals = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const matRow = matrix[r] ?? [];
    const labelVal = matRow[colMap["label"] ?? 0];
    const label = String(labelVal ?? "").trim();
    if (!label) continue;
    if (SUBTOTAL_PATTERNS.test(label)) {
      skippedSubtotals.push(label);
      continue;
    }
    const row = extractRow(matRow, r, colMap, mode);
    if (!row.rawLabel) continue;
    if (!row.isGroupRow && row.closingDr === 0 && row.closingCr === 0 && row.openingDr === 0 && row.openingCr === 0) {
      warnings.push(`Zero-amount leaf row skipped or flagged: "${row.rawLabel}"`);
    }
    rows.push(row);
  }
  if (skippedSubtotals.length > 0) {
    warnings.push(`${skippedSubtotals.length} subtotal row(s) skipped.`);
  }
  const rowsWithParents = assignParentGroups(
    mode === "tally_grouped" ? postProcessTallyGroupedRows(rows) : rows
  );
  const leafRows = rowsWithParents.filter((r) => !r.isGroupRow);
  if (leafRows.length === 0) {
    throw Object.assign(new Error("No data rows found."), { status: 400, code: "NO_DATA_ROWS" });
  }
  let totalOpeningDr = 0, totalOpeningCr = 0, totalDuringDr = 0, totalDuringCr = 0;
  let totalClosingDr = 0, totalClosingCr = 0;
  for (const row of rowsWithParents) {
    if (row.isGroupRow) continue;
    totalOpeningDr += row.openingDr;
    totalOpeningCr += row.openingCr;
    totalDuringDr += row.duringDr;
    totalDuringCr += row.duringCr;
    totalClosingDr += row.closingDr;
    totalClosingCr += row.closingCr;
  }
  const round23 = (n) => Math.round(n * 100) / 100;
  totalClosingDr = round23(totalClosingDr);
  totalClosingCr = round23(totalClosingCr);
  const difference = round23(totalClosingDr - totalClosingCr);
  const isBalanced = Math.abs(difference) < 1;
  if (!isBalanced) {
    warnings.push(
      `Trial Balance not balanced. Difference: ${Math.abs(difference).toLocaleString("en-IN")}.`
    );
  }
  if (mode === "tally_grouped") {
    const duringDiff = Math.abs(round23(totalDuringDr) - round23(totalDuringCr));
    if (!isBalanced && duringDiff < 1e3) {
      warnings.push(
        "Closing totals differ but during-period movement is balanced (common in Tally/Busy grouped exports)."
      );
    }
  }
  return {
    rows: rowsWithParents,
    totalOpeningDr: round23(totalOpeningDr),
    totalOpeningCr: round23(totalOpeningCr),
    totalDuringDr: round23(totalDuringDr),
    totalDuringCr: round23(totalDuringCr),
    totalClosingDr,
    totalClosingCr,
    isBalanced,
    difference,
    warnings,
    detectedColumns: colMap,
    headerRowIndex,
    detectedFormat: mode
  };
}
function parseMatrix(matrix) {
  const warnings = [];
  const headerDetection = detectColumns(matrix);
  const { format, colMap, headerRowIndex } = detectFormat(matrix, headerDetection);
  const mode = format;
  if (mode === "3col") {
    warnings.push("Treating file as 3-column (label, debit, credit) layout.");
  } else if (mode === "2col") {
    warnings.push("Treating file as 2-column net balance layout (positive=Dr, negative=Cr).");
  } else if (mode === "1col") {
    warnings.push("Treating file as single balance column layout.");
  } else if (mode === "tally_grouped") {
    warnings.push("Detected Tally/Busy grouped trial balance (Opening Bal | Debit | Credit | Closing Bal).");
  }
  if (mode === "full" && colMap["label"] === void 0) {
    throw Object.assign(
      new Error("Could not detect column headers."),
      { status: 400, code: "NO_HEADERS" }
    );
  }
  return parseMatrixWithColMap(matrix, colMap, headerRowIndex, mode, warnings);
}
function parseDualYearMatrix(matrix) {
  const dual = detectDualYearColumns(matrix);
  if (!dual) return null;
  const warnings = [
    "Detected Current Year and Previous Year columns side-by-side on one sheet."
  ];
  const currentYear = parseMatrixWithColMap(
    matrix,
    dual.cyColMap,
    dual.headerRowIndex,
    "full",
    warnings
  );
  const previousYear = parseMatrixWithColMap(
    matrix,
    dual.pyColMap,
    dual.headerRowIndex,
    "full",
    []
  ).rows;
  return { currentYear, previousYear };
}
function cellPlainValue(val) {
  if (val === null || val === void 0) return "";
  if (typeof val === "object" && val !== null && "result" in val) {
    return String(val.result ?? "").trim();
  }
  return String(val).trim();
}
function extractSheetHeaderMetadata(matrix) {
  const row1 = cellPlainValue(matrix[0]?.[0]);
  if (!row1 || row1.toLowerCase() === "trial balance") return null;
  const fyFromName = row1.match(/\((\d{4})[-/](\d{2,3})\)/);
  let fiscalYear;
  if (fyFromName) {
    const startYear = fyFromName[1];
    const endPart = fyFromName[2].padStart(2, "0").slice(-2);
    fiscalYear = `${startYear}/${endPart}`;
  }
  for (const row of matrix.slice(0, 8)) {
    for (const cell of row) {
      const text = cellPlainValue(cell);
      const fromMatch = text.match(/from\s+(\d{4})\//i);
      if (fromMatch) {
        const start = parseInt(fromMatch[1], 10);
        fiscalYear = `${start}/${String(start + 1).slice(-2)}`;
        break;
      }
    }
  }
  const companyName = row1.replace(/\s*\(\d{4}[-/]\d{2,3}\)\s*$/i, "").trim();
  const addressParts = [matrix[1]?.[0], matrix[2]?.[0]].map((v) => cellPlainValue(v)).filter(Boolean);
  return {
    format: "generic",
    companyName: companyName || void 0,
    fullAddress: addressParts.join(", ") || void 0,
    fiscalYear
  };
}
function extractMesWorkbookMetadata(workbook) {
  const enterDetails = workbook.getWorksheet("Enter Details");
  if (!enterDetails) return null;
  const fields = /* @__PURE__ */ new Map();
  enterDetails.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values;
    const label = normCell(vals[2]);
    const value = cellPlainValue(vals[3]);
    if (label && value) fields.set(label, value);
  });
  if (fields.size === 0) return null;
  return {
    format: "mes_template",
    companyName: fields.get("name of entity"),
    fullAddress: fields.get("address"),
    fiscalYear: fields.get("this year"),
    chairperson: fields.get("chairperson"),
    director: fields.get("director"),
    accountsHead: fields.get("accounts head"),
    auditorName: fields.get("auditor"),
    auditFirmName: fields.get("name of audit firm")
  };
}
function extractWorkbookMetadata(workbook) {
  const mesMeta = extractMesWorkbookMetadata(workbook);
  if (mesMeta) return mesMeta;
  const primaryWs = workbook.getWorksheet("Trial Balance") ?? workbook.getWorksheet("TB") ?? workbook.worksheets[0];
  if (!primaryWs) return null;
  return extractSheetHeaderMetadata(worksheetToMatrix(primaryWs));
}
function parseCsv(buffer) {
  let text = buffer.toString("utf-8");
  if (text.includes("\uFFFD")) {
    text = buffer.toString("latin1");
  }
  return { ...parseMatrix(parseCSVText(text)), previousYearData: null };
}
async function parseTrialBalance(buffer, filename) {
  if (!buffer || buffer.length === 0) {
    throw Object.assign(
      new Error("The uploaded file is empty. Please upload a valid Excel or CSV file."),
      { status: 400, code: "EMPTY_FILE" }
    );
  }
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (ext === ".csv") {
    return parseCsv(buffer);
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      "Could not read the uploaded file as an Excel workbook. If the file is in .xls (old format), please re-save it as .xlsx in Excel first."
    );
  }
  const primaryWs = workbook.getWorksheet("Trial Balance") ?? workbook.getWorksheet("TB") ?? workbook.worksheets[0];
  if (!primaryWs) {
    throw new Error("The uploaded workbook has no worksheets.");
  }
  const matrix = worksheetToMatrix(primaryWs);
  if (matrix.length === 0) {
    throw new Error("The uploaded file appears to be empty.");
  }
  const dualYear = parseDualYearMatrix(matrix);
  let result;
  let previousYearData = null;
  if (dualYear) {
    result = dualYear.currentYear;
    previousYearData = dualYear.previousYear;
    result.warnings.push(
      `Previous year data extracted from side-by-side columns (${previousYearData.length} rows).`
    );
  } else {
    result = parseMatrix(matrix);
  }
  if (!previousYearData) {
    const secondaryWs = findSecondaryWorksheet(workbook, primaryWs.name);
    if (secondaryWs) {
      const secondaryMatrix = worksheetToMatrix(secondaryWs);
      previousYearData = parseSecondaryMatrix(secondaryMatrix);
      if (previousYearData) {
        result.warnings.push(
          `Previous year data loaded from sheet "${secondaryWs.name}" (${previousYearData.length} rows).`
        );
      }
    }
  }
  const workbookMetadata = extractWorkbookMetadata(workbook);
  if (workbookMetadata) {
    result.warnings.push(
      `Detected ICAN MEs workbook template for "${workbookMetadata.companyName ?? "entity"}".`
    );
  }
  return { ...result, previousYearData, workbookMetadata };
}

// src/data/chartOfAccounts.ts
var CHART_OF_ACCOUNTS = [
  {
    category: "share_capital",
    displayLabel: "Share Capital",
    statementLine: "BS Equity",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["share capital", "paid up capital", "paid-up capital", "issued capital", "subscribed capital", "equity share", "ordinary shares", "common stock", "authorized capital paid", "share money", "capital account", "registered capital", "equity capital", "share fund", "capital stock", "shareholders capital", "company capital", "stated capital"],
    synonyms: ["paid up capital", "issued share capital", "equity share capital", "ordinary share capital", "subscribed share capital", "capital", "share money", "registered share capital"],
    nepaliRomanized: ["sheyer kapital", "punji", "share punji", "darta kapital", "sheyer dhan"],
    exclusionKeywords: []
  },
  {
    category: "share_premium",
    displayLabel: "Share Premium",
    statementLine: "BS Equity",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["share premium", "securities premium", "premium on shares", "capital premium", "share issue premium", "additional paid in", "share premium account", "premium reserve", "issue premium", "share premium reserve", "excess over par", "premium on issue", "share premium fund"],
    synonyms: ["securities premium account", "premium on share issue", "additional paid-in capital", "share premium reserve", "capital surplus"],
    nepaliRomanized: ["share premium", "adhik premium", "sheyer premium"],
    exclusionKeywords: []
  },
  {
    category: "general_reserve",
    displayLabel: "General Reserve",
    statementLine: "BS Equity",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["general reserve", "reserve fund", "general fund", "free reserve", "revenue reserve", "statutory reserve", "accumulated reserve", "general reserves", "reserve account", "appropriation reserve", "retained reserve", "general reserve fund", "reserve and surplus", "other reserve general"],
    synonyms: ["reserve fund", "free reserves", "general fund", "revenue reserves", "statutory reserves", "appropriated profits"],
    nepaliRomanized: ["sadharan jama", "jama khata", "reserve khata", "sadharan reserve"],
    exclusionKeywords: []
  },
  {
    category: "retained_earnings",
    displayLabel: "Retained Earnings",
    statementLine: "BS Equity",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["retained earnings", "retained profit", "accumulated profit", "profit and loss", "p and l", "surplus", "accumulated surplus", "unappropriated profit", "profit brought forward", "balance of profit", "undistributed profit", "profit loss account", "pl account", "retained income", "accumulated deficit", "profit reserve"],
    synonyms: ["profit and loss account", "accumulated profits", "retained profits", "p&l balance", "surplus account", "unappropriated profits"],
    nepaliRomanized: ["nafaa khata", "naafaa", "afi ko nafaa", "profit loss", "baki nafaa"],
    exclusionKeywords: []
  },
  {
    category: "capital_reserve",
    displayLabel: "Capital Reserve",
    statementLine: "BS Equity",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["capital reserve", "capital redemption reserve", "revaluation surplus capital", "capital reserves", "reserve on revaluation", "capital reserve account", "share forfeiture reserve", "capital reserve fund", "premium reserve capital", "capital gain reserve"],
    synonyms: ["capital redemption reserve", "capital reserve account", "capital reserve fund"],
    nepaliRomanized: ["punji jama", "capital jama", "punji reserve"],
    exclusionKeywords: []
  },
  {
    category: "revaluation_reserve",
    displayLabel: "Revaluation Reserve",
    statementLine: "BS Equity",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["revaluation reserve", "asset revaluation reserve", "revaluation surplus", "revaluation reserve account", "property revaluation", "land revaluation reserve", "building revaluation", "revaluation gain reserve", "fair value reserve equity", "revaluation reserve fund"],
    synonyms: ["asset revaluation reserve", "revaluation surplus account", "property revaluation reserve"],
    nepaliRomanized: ["punarmulyankan jama", "revaluation jama", "punarmulyan reserve"],
    exclusionKeywords: []
  },
  {
    category: "borrowings_noncurrent_bank",
    displayLabel: "Long-term Bank Borrowings",
    statementLine: "BS NCL Borrowings",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["term loan", "long term loan", "bank loan long", "secured loan", "loan from bank ncl", "non current bank loan", "term borrowing", "long term borrowing", "bank term loan", "loan bank a", "loan bank b", "nabil term", "hbl term loan", "nic asia term", "loan payable long term", "mortgage loan", "housing loan long"],
    synonyms: ["term loan from bank", "long-term bank loan", "secured term loan", "bank borrowing non-current"],
    nepaliRomanized: ["dirghkalin bank loan", "bank bata loan", "rinn"],
    exclusionKeywords: []
  },
  {
    category: "borrowings_noncurrent_related",
    displayLabel: "Related Party Loan (NCL)",
    statementLine: "BS NCL Borrowings",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["loan from director long", "loan from shareholder", "related party loan ncl", "director loan long term", "loan from partner long", "loan from proprietor long", "unsecured loan related", "loan from holding company", "intercompany loan long", "loan from associate long"],
    synonyms: ["loan from director", "director loan long-term", "loan from shareholder long-term"],
    nepaliRomanized: ["sanchalak bata loan", "sambandhit party loan"],
    exclusionKeywords: []
  },
  {
    category: "employee_benefit_noncurrent",
    displayLabel: "Employee Benefit Liability (NCL)",
    statementLine: "BS NCL Employee Benefits",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["gratuity provision long", "gratuity liability ncl", "employee benefit ncl", "long term gratuity", "gratuity fund liability", "post employment benefit", "defined benefit obligation", "gratuity payable long", "leave encashment ncl", "employee benefit obligation"],
    synonyms: ["gratuity liability non-current", "long-term employee benefits", "post-employment benefit obligation"],
    nepaliRomanized: ["dirghkalin upadhan", "karmachari labh dayitwa"],
    exclusionKeywords: []
  },
  {
    category: "deferred_tax_liability",
    displayLabel: "Deferred Tax Liability",
    statementLine: "BS NCL",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["deferred tax liability", "dtl", "deferred taxation", "deferred tax provision", "timing difference liability", "deferred income tax", "deferred tax payable", "tax timing difference", "deferred tax credit liability"],
    synonyms: ["deferred tax", "deferred income tax liability", "DTL account"],
    nepaliRomanized: ["sthir kar dayitwa", "deferred kar"],
    exclusionKeywords: []
  },
  {
    category: "provisions_noncurrent",
    displayLabel: "Non-current Provisions",
    statementLine: "BS NCL Provisions",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["provision non current", "long term provision", "warranty provision long", "decommissioning provision", "provision for claims long", "litigation provision", "environmental provision", "restructuring provision long", "provision ncl"],
    synonyms: ["non-current provisions", "long-term provision", "provision for liabilities long-term"],
    nepaliRomanized: ["dirghkalin prabandhan", "sthir prabandhan"],
    exclusionKeywords: []
  },
  {
    category: "trade_payables",
    displayLabel: "Trade Payables",
    statementLine: "BS CL Trade Payables",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["trade payable", "trade creditor", "sundry creditor", "accounts payable", "creditor a", "creditor b", "creditor c", "supplier payable", "bills payable trade", "trade accounts payable", "local supplier", "foreign supplier payable", "purchase creditor", "vendor payable", "payable to supplier", "trade dues", "commercial creditor"],
    synonyms: ["sundry creditors", "trade creditors", "accounts payable", "creditors", "supplier dues"],
    nepaliRomanized: ["lenidar", "byapari lenidar", "karidar", "supplier tirnu"],
    exclusionKeywords: []
  },
  {
    category: "borrowings_current_overdraft",
    displayLabel: "Overdraft / Cash Credit",
    statementLine: "BS CL Borrowings",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["overdraft", "od account", "cash credit", "cc account", "bank od", "over draft", "od facility", "cash credit limit", "od bank", "cc limit", "overdraft facility", "bank overdraft", "cc bank", "od nabil", "od hbl", "cash credit working"],
    synonyms: ["bank overdraft", "cash credit account", "OD facility", "CC limit"],
    nepaliRomanized: ["overdraft", "cash credit", "bank od"],
    exclusionKeywords: []
  },
  {
    category: "borrowings_current_working",
    displayLabel: "Working Capital Loan",
    statementLine: "BS CL Borrowings",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["working capital loan", "wc loan", "working capital facility", "short term wc", "working capital borrowing", "wc limit", "working capital bank loan", "demand loan wc", "packing credit", "export finance short"],
    synonyms: ["WC loan", "working capital facility", "short-term working capital loan"],
    nepaliRomanized: ["working capital loan", "chalu punji rin"],
    exclusionKeywords: []
  },
  {
    category: "borrowings_current_bank",
    displayLabel: "Short-term Bank Loans",
    statementLine: "BS CL Borrowings",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["short term loan", "bank loan current", "loan payable current", "current portion term loan", "bank loan due 12 months", "demand loan", "short term borrowing", "loan bank current", "bridge loan", "loan repayment current", "installment due current", "bank loan cl"],
    synonyms: ["short-term bank loan", "current portion of long-term debt", "demand loan"],
    nepaliRomanized: ["chalu bank loan", "chhoto mudati loan"],
    exclusionKeywords: []
  },
  {
    category: "borrowings_related_current",
    displayLabel: "Related Party Loan (CL)",
    statementLine: "BS CL Borrowings",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["loan from director current", "loan from partner current", "director loan short", "related party loan current", "loan from shareholder current", "loan from proprietor", "unsecured loan director", "loan payable director", "loan from md", "loan from chairman"],
    synonyms: ["director loan current", "loan from director", "related party borrowing current"],
    nepaliRomanized: ["sanchalak loan chalu", "sambandhit rin"],
    exclusionKeywords: []
  },
  {
    category: "tds_payable",
    displayLabel: "TDS Payable",
    statementLine: "BS CL Tax",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["tds payable", "tds on salary", "tds on rent", "tds on service", "tds on commission", "tds on professional", "tds audit fee", "tds dividend", "tax deducted payable", "tds liability", "tds withheld payable", "tds contractor", "tds interest", "tds ird payable", "withholding tax payable"],
    synonyms: ["TDS payable account", "tax deducted at source payable", "withholding tax liability"],
    nepaliRomanized: ["tds tirnu", "kata gareko kar", "source ma kata"],
    exclusionKeywords: []
  },
  {
    category: "vat_payable",
    displayLabel: "VAT Payable",
    statementLine: "BS CL Tax",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["vat payable", "output vat", "vat liability", "vat on sales", "sales tax payable", "vat 13 percent", "value added tax payable", "vat return payable", "ird vat payable", "vat collected", "output tax payable", "vat due", "hulak tirnu"],
    synonyms: ["output VAT", "VAT liability", "value added tax payable"],
    nepaliRomanized: ["vat tirnu", "hulak khata", "output vat"],
    exclusionKeywords: []
  },
  {
    category: "income_tax_payable",
    displayLabel: "Income Tax Payable",
    statementLine: "BS CL Tax",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["income tax payable", "tax payable", "corporate tax payable", "provision for tax", "income tax liability", "tax provision current", "ird tax payable", "current tax payable", "tax due ird", "provision income tax", "income tax due", "net tax payable"],
    synonyms: ["income tax liability", "corporate tax payable", "tax provision"],
    nepaliRomanized: ["aaykar tirnu", "kar dayitwa", "income tax"],
    exclusionKeywords: []
  },
  {
    category: "advance_tax",
    displayLabel: "Advance Tax Paid",
    statementLine: "BS CA Tax",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["advance tax", "advance income tax", "advance tax paid", "tax paid in advance", "advance ird", "advance corporate tax", "prepaid income tax", "tax advance asset", "advance tax recoverable", "quarterly advance tax", "advance tax q1", "advance tax q2", "advance tax q3"],
    synonyms: ["advance income tax paid", "prepaid tax", "advance corporate tax"],
    nepaliRomanized: ["agadi tireko kar", "advance kar"],
    exclusionKeywords: []
  },
  {
    category: "salary_payable",
    displayLabel: "Salary Payable",
    statementLine: "BS CL Employee",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["salary payable", "wages payable", "employee payable", "staff salary due", "salary due", "net salary payable", "employee a", "employee b", "employee c", "unpaid salary", "salary outstanding", "payroll payable", "remuneration payable", "salary accrual", "staff dues"],
    synonyms: ["salaries payable", "wages payable", "staff salary payable", "payroll liability"],
    nepaliRomanized: ["tankha tirnu", "tanabu baki", "karmachari tirnu"],
    exclusionKeywords: []
  },
  {
    category: "bonus_payable",
    displayLabel: "Staff Bonus Payable",
    statementLine: "BS CL Employee",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["bonus payable", "staff bonus payable", "employee bonus due", "festival bonus payable", "dashain bonus payable", "bonus accrual", "bonus provision payable", "staff bonus due", "year end bonus payable", "bonus liability"],
    synonyms: ["staff bonus payable", "employee bonus payable", "bonus due to staff"],
    nepaliRomanized: ["bonus tirnu", "karmachari bonus"],
    exclusionKeywords: []
  },
  {
    category: "pf_ssf_payable",
    displayLabel: "PF / SSF / CIT Payable",
    statementLine: "BS CL Employee",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["pf payable", "provident fund payable", "ssf payable", "cit payable", "epf payable", "pf contribution payable", "ssf contribution", "cit contribution", "employee pf payable", "employer pf payable", "pf ssf payable", "social security fund", "cit fund payable"],
    synonyms: ["provident fund payable", "SSF payable", "CIT payable", "EPF payable"],
    nepaliRomanized: ["pf tirnu", "ssf tirnu", "cit tirnu", "provident fund"],
    exclusionKeywords: []
  },
  {
    category: "audit_fee_payable",
    displayLabel: "Audit Fee Payable",
    statementLine: "BS CL",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["audit fee payable", "statutory audit fee payable", "auditor fee due", "audit fee accrued", "audit fee outstanding", "audit remuneration payable", "audit fee liability", "professional audit fee payable"],
    synonyms: ["statutory audit fee payable", "auditor fee payable", "audit fee due"],
    nepaliRomanized: ["audit fee tirnu", "audit kharcha tirnu"],
    exclusionKeywords: []
  },
  {
    category: "dividend_payable",
    displayLabel: "Dividend Payable",
    statementLine: "BS CL",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["dividend payable", "proposed dividend", "interim dividend payable", "final dividend payable", "dividend declared", "dividend due shareholders", "unpaid dividend", "dividend liability", "tds dividend payable", "dividend distribution payable"],
    synonyms: ["proposed dividend payable", "dividend declared payable", "unpaid dividend"],
    nepaliRomanized: ["dividend tirnu", "labhansh tirnu"],
    exclusionKeywords: []
  },
  {
    category: "advance_from_customers",
    displayLabel: "Advance from Customers",
    statementLine: "BS CL",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["advance from customer", "advance from customers", "customer advance", "advance receipt", "booking advance", "order advance", "advance against order", "security from customer", "customer deposit liability", "advance sales", "unearned revenue advance"],
    synonyms: ["customer advance", "advance received from customers", "booking money received"],
    nepaliRomanized: ["grahak bata advance", "advance prapti"],
    exclusionKeywords: []
  },
  {
    category: "provisions_csr",
    displayLabel: "CSR Provision",
    statementLine: "BS CL Provisions",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["csr provision", "provision for csr", "corporate social responsibility", "csr fund provision", "csr liability", "csr expense provision", "social responsibility provision", "csr reserve provision"],
    synonyms: ["provision for CSR", "CSR fund", "corporate social responsibility provision"],
    nepaliRomanized: ["csr prabandhan", "samajik dayitwa"],
    exclusionKeywords: []
  },
  {
    category: "provisions_current",
    displayLabel: "Current Provisions",
    statementLine: "BS CL Provisions",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["provision current", "provision for expenses", "general provision", "warranty provision", "provision for claims", "litigation provision current", "provision for doubtful", "expense provision", "year end provision", "provision cl", "contingent provision current"],
    synonyms: ["current provisions", "provision for expenses", "general provision"],
    nepaliRomanized: ["chalu prabandhan", "prabandhan kharcha"],
    exclusionKeywords: []
  },
  {
    category: "other_current_liabilities",
    displayLabel: "Other Current Liabilities",
    statementLine: "BS CL Other",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["other current liability", "sundry payable", "miscellaneous payable", "other payable cl", "accrued expenses", "accrued liability", "other cl", "suspense credit", "unallocated credit", "other dues current", "outstanding expenses"],
    synonyms: ["sundry payables", "miscellaneous payables", "accrued liabilities"],
    nepaliRomanized: ["anya chalu dayitwa", "anya tirnu"],
    exclusionKeywords: []
  },
  {
    category: "ppe_land",
    displayLabel: "Land",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["land", "plot", "land and building land", "freehold land", "leasehold land", "land cost", "land asset", "agricultural land", "industrial land", "commercial plot", "residential plot", "land at cost", "land property", "jagga", "bhoomi", "land bank"],
    synonyms: ["freehold land", "land and site", "plot of land", "land property"],
    nepaliRomanized: ["bhoomi", "jagga", "jamin", "jameen", "sthal"],
    exclusionKeywords: []
  },
  {
    category: "ppe_buildings",
    displayLabel: "Buildings",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["building", "factory building", "office building", "warehouse", "godown", "structure", "industrial shed", "commercial building", "residential building", "building at cost", "premises", "plant building", "workshop building", "building improvement"],
    synonyms: ["factory building", "office premises", "godown", "warehouse building"],
    nepaliRomanized: ["bhawan", "imarat", "ghar", "karkhana bhawan"],
    exclusionKeywords: []
  },
  {
    category: "ppe_vehicles",
    displayLabel: "Vehicles",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["vehicle", "motor vehicle", "car", "truck", "van", "jeep", "bus", "motorcycle", "bike", "transport vehicle", "company vehicle", "delivery van", "forklift", "loader vehicle", "automobile"],
    synonyms: ["motor car", "company car", "truck", "delivery vehicle"],
    nepaliRomanized: ["gadi", "sawari", "motor", "gaadi"],
    exclusionKeywords: []
  },
  {
    category: "ppe_office_equipment",
    displayLabel: "Office Equipment",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["office equipment", "furniture and fixture", "furniture office", "fixture fitting", "office fixture", "equipment office", "photocopier", "printer asset", "scanner asset", "ac unit asset", "air conditioner asset", "generator asset", "ups asset", "office machines"],
    synonyms: ["furniture and fixtures", "office fixtures", "furniture & office equipment"],
    nepaliRomanized: ["office saman", "furniture", "sajawat"],
    exclusionKeywords: []
  },
  {
    category: "ppe_computers",
    displayLabel: "Computers & IT Equipment",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["computer", "laptop", "desktop", "server hardware", "it equipment", "network equipment", "router asset", "switch asset", "monitor asset", "computer hardware", "pc asset", "notebook computer", "workstation", "tablet asset", "peripheral"],
    synonyms: ["computer equipment", "IT hardware", "laptop computer", "desktop computer"],
    nepaliRomanized: ["computer", "laptop", "pc"],
    exclusionKeywords: []
  },
  {
    category: "ppe_furniture",
    displayLabel: "Furniture",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["furniture", "office furniture", "chair", "table asset", "desk", "cabinet", "sofa asset", "almirah", "rack", "shelf asset", "wooden furniture", "steel furniture", "furnishing asset", "interior furniture"],
    synonyms: ["office furniture", "furnishings", "furniture and fittings"],
    nepaliRomanized: ["furniture", "mej kursi", "sajawat"],
    exclusionKeywords: []
  },
  {
    category: "ppe_plant_machinery",
    displayLabel: "Plant & Machinery",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["plant machinery", "plant and machinery", "machinery", "production machine", "manufacturing equipment", "industrial machine", "boiler", "turbine", "compressor", "generator plant", "pm asset", "factory machine", "processing equipment", "heavy machinery"],
    synonyms: ["plant & machinery", "P&M", "production machinery", "industrial machinery"],
    nepaliRomanized: ["yantra", "machine", "plant machinery"],
    exclusionKeywords: []
  },
  {
    category: "ppe_intangibles",
    displayLabel: "Intangible Assets",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["intangible", "tally software", "computer software", "leasehold improvement", "trademark", "goodwill", "patent", "copyright", "license asset", "erp software", "accounting software", "software license", "brand asset", "franchise asset", "intellectual property"],
    synonyms: ["software", "Tally software", "leasehold", "intangible assets", "goodwill"],
    nepaliRomanized: ["software", "abhilekh sampatti", "intangible"],
    exclusionKeywords: []
  },
  {
    category: "ppe_cwip",
    displayLabel: "Capital Work in Progress",
    statementLine: "BS NCA PPE",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["cwip", "capital wip", "work in progress asset", "under construction", "construction in progress", "capital work progress", "asset under construction", "building under construction", "plant under installation", "project wip", "capitalized wip"],
    synonyms: ["capital WIP", "work in progress capital", "under construction asset"],
    nepaliRomanized: ["nirman adhura", "cwip", "kaam adhura"],
    exclusionKeywords: []
  },
  {
    category: "accum_depreciation",
    displayLabel: "Accumulated Depreciation",
    statementLine: "BS NCA PPE Contra",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["accumulated depreciation", "accum depreciation", "depreciation accumulated", "less depreciation", "provision depreciation", "depreciation reserve asset", "accum depn", "total depreciation", "depreciation till date", "written down accumulated"],
    synonyms: ["accumulated depn", "less: accumulated depreciation", "depreciation provision"],
    nepaliRomanized: ["jamma mur", "mur jamma", "depreciation jamma"],
    exclusionKeywords: []
  },
  {
    category: "investment_listed_trading",
    displayLabel: "Listed Share Investments",
    statementLine: "BS NCA/CA Investments",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["listed shares", "shares listed", "nepse shares", "trading securities", "equity shares listed", "demat shares", "share investment listed", "quoted shares", "marketable securities", "shares of ltd listed", "stock investment listed", "nepse investment"],
    synonyms: ["listed equity shares", "NEPSE shares", "trading investment"],
    nepaliRomanized: ["sheyar lagani listed", "nepse share"],
    exclusionKeywords: []
  },
  {
    category: "investment_unlisted",
    displayLabel: "Unlisted Investments",
    statementLine: "BS NCA Investments",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["unlisted shares", "private ltd investment", "investment in pvt ltd", "unquoted shares", "associate investment", "subsidiary investment", "investment in company", "share of pqr ltd", "long term investment unlisted", "equity investment unlisted", "partnership investment"],
    synonyms: ["unlisted equity", "investment in private company", "shares unlisted"],
    nepaliRomanized: ["unlisted lagani", "private company share"],
    exclusionKeywords: []
  },
  {
    category: "investment_fixed_deposit_noncurrent",
    displayLabel: "Fixed Deposit (NCA)",
    statementLine: "BS NCA",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["fixed deposit long", "fd more than 12 months", "fixed deposit nca", "term deposit long", "bank fd long term", "fixed deposit over 1 year", "long term fd", "fd investment", "fixed deposit non current"],
    synonyms: ["long-term fixed deposit", "FD > 12 months", "term deposit non-current"],
    nepaliRomanized: ["dirghkalin fd", "fixed deposit"],
    exclusionKeywords: []
  },
  {
    category: "nca_deposits",
    displayLabel: "Security Deposits (NCA)",
    statementLine: "BS NCA",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["security deposit", "deposits long term", "caution money", "refundable deposit", "tenant deposit", "rent deposit", "utility deposit", "margin deposit long", "earnest money deposit", "performance deposit"],
    synonyms: ["security deposits", "caution money", "refundable deposits"],
    nepaliRomanized: ["dhilauni", "security deposit", "jamanat"],
    exclusionKeywords: []
  },
  {
    category: "nca_loans_advances",
    displayLabel: "Loans & Advances (NCA)",
    statementLine: "BS NCA",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["loans advances nca", "long term advance", "loan receivable long", "advance recoverable long", "staff loan long", "director loan asset long", "intercompany advance long", "deposit long term receivable"],
    synonyms: ["long-term loans and advances", "non-current loans receivable"],
    nepaliRomanized: ["dirghkalin advance", "rin prapta"],
    exclusionKeywords: []
  },
  {
    category: "biological_assets",
    displayLabel: "Biological Assets",
    statementLine: "BS NCA",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["biological asset", "livestock", "poultry", "plantation", "crops standing", "aquaculture", "dairy cattle", "goat farm asset", "fish pond asset", "nursery plants", "tea plantation"],
    synonyms: ["livestock assets", "poultry farm", "plantation assets"],
    nepaliRomanized: ["jeevit sampatti", "pashu palan", "kukhura farm"],
    exclusionKeywords: []
  },
  {
    category: "provision_impairment_investments",
    displayLabel: "Provision on Investments",
    statementLine: "BS NCA Contra",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["provision impairment investment", "impairment on investment", "provision for diminution investment", "investment provision", "provision unlisted shares", "impairment provision investment"],
    synonyms: ["provision for impairment on investments", "investment impairment provision"],
    nepaliRomanized: ["lagani mur prabandhan"],
    exclusionKeywords: []
  },
  {
    category: "other_noncurrent_assets",
    displayLabel: "Other Non-current Assets",
    statementLine: "BS NCA Other",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["other nca", "non current asset other", "assets held for sale nca", "deferred tax asset long", "prepaid expense long", "other long term asset", "nca miscellaneous", "long term receivable other"],
    synonyms: ["other non-current assets", "miscellaneous NCA"],
    nepaliRomanized: ["anya sthir sampatti"],
    exclusionKeywords: []
  },
  {
    category: "inventory_raw_materials",
    displayLabel: "Raw Materials",
    statementLine: "BS CA Inventory",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["raw material", "raw materials stock", "rm stock", "material stock", "inventory raw", "opening raw material", "closing raw material", "raw material inventory", "stores raw", "components stock", "packing material stock"],
    synonyms: ["raw materials", "RM inventory", "materials stock"],
    nepaliRomanized: ["kachcha saman", "raw material stock"],
    exclusionKeywords: []
  },
  {
    category: "inventory_wip",
    displayLabel: "Work in Progress",
    statementLine: "BS CA Inventory",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["work in progress inventory", "wip stock", "semi finished goods", "goods in process", "production wip", "manufacturing wip", "wip inventory", "work in process stock", "job in progress"],
    synonyms: ["WIP", "work-in-progress", "semi-finished goods"],
    nepaliRomanized: ["adhura kaam", "wip stock"],
    exclusionKeywords: []
  },
  {
    category: "inventory_finished_goods",
    displayLabel: "Finished Goods",
    statementLine: "BS CA Inventory",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["finished goods", "trading stock", "closing stock", "stock in trade", "stock in hand", "inventory finished", "fg stock", "merchandise inventory", "goods for sale", "closing inventory", "trading inventory", "manufactured goods stock"],
    synonyms: ["closing stock", "stock in trade", "finished goods inventory", "trading stock"],
    nepaliRomanized: ["tayar saman", "stock", "inventory"],
    exclusionKeywords: []
  },
  {
    category: "trade_receivables",
    displayLabel: "Trade Receivables",
    statementLine: "BS CA Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["trade receivable", "trade debtor", "sundry debtor", "accounts receivable", "debtor a", "debtor b", "debtor c", "customer receivable", "bills receivable trade", "sales debtor", "receivable from customer", "commercial debtor", "trade dues receivable"],
    synonyms: ["sundry debtors", "trade debtors", "accounts receivable", "debtors"],
    nepaliRomanized: ["dhani", "paune", "byapari dhani", "receivable"],
    exclusionKeywords: []
  },
  {
    category: "provision_impairment_debtors",
    displayLabel: "Provision on Debtors",
    statementLine: "BS CA Contra",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["provision impairment debtors", "provision bad debts", "provision doubtful debts", "impairment receivables", "bad debt provision", "doubtful debt provision", "provision for debtors", "allowance bad debts"],
    synonyms: ["provision for bad debts", "provision for doubtful debts", "impairment on receivables"],
    nepaliRomanized: ["dhani mur prabandhan", "doubtful debt"],
    exclusionKeywords: []
  },
  {
    category: "related_party_receivable",
    displayLabel: "Related Party Receivable",
    statementLine: "BS CA Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["director receivable", "loan to director", "receivable related party", "director c", "director d", "shareholder receivable", "loan to partner", "advance to director", "due from director", "intercompany receivable", "associate receivable"],
    synonyms: ["receivable from related party", "loan to director", "director advance"],
    nepaliRomanized: ["sanchalak bata paune", "sambandhit paune"],
    exclusionKeywords: []
  },
  {
    category: "other_receivables_advance_supplier",
    displayLabel: "Advance to Suppliers",
    statementLine: "BS CA Other Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["advance to supplier", "advance supplier", "prepaid supplier", "supplier advance", "purchase advance", "advance against purchase", "vendor advance", "advance payment supplier", "import advance"],
    synonyms: ["advance to suppliers", "prepayment to supplier", "vendor advance"],
    nepaliRomanized: ["supplier lai advance", "karidar advance"],
    exclusionKeywords: []
  },
  {
    category: "other_receivables_prepayments",
    displayLabel: "Prepayments",
    statementLine: "BS CA Other Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["prepayment", "prepaid expense", "prepaid rent", "prepaid insurance", "prepaid license", "advance expense", "prepaid subscription", "prepaid annual", "deferred expense prepaid"],
    synonyms: ["prepaid expenses", "prepaid rent", "prepaid insurance"],
    nepaliRomanized: ["agadi tireko kharcha", "prepaid"],
    exclusionKeywords: []
  },
  {
    category: "other_receivables_staff_advance",
    displayLabel: "Staff Advance",
    statementLine: "BS CA Other Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["staff advance", "employee advance", "salary advance", "advance to staff", "advance to employee", "staff loan short", "imprest advance", "travel advance staff"],
    synonyms: ["employee advance", "salary advance", "staff loan"],
    nepaliRomanized: ["karmachari advance", "staff advance"],
    exclusionKeywords: []
  },
  {
    category: "other_receivables_tds",
    displayLabel: "TDS Receivable",
    statementLine: "BS CA Other Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["tds receivable", "tds deducted at source", "tds asset", "tds recoverable", "withholding tax receivable", "tds credit receivable", "tds on income received", "input tds"],
    synonyms: ["TDS recoverable", "tax deducted at source receivable", "TDS asset"],
    nepaliRomanized: ["tds paune", "kata prapta"],
    exclusionKeywords: []
  },
  {
    category: "other_receivables_loans",
    displayLabel: "Loans & Advances (CA)",
    statementLine: "BS CA Other Receivables",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["loans advances current", "short term loan given", "advance recoverable", "loan receivable current", "staff loan current", "deposit receivable short", "advance other current"],
    synonyms: ["current loans and advances", "short-term advances"],
    nepaliRomanized: ["chalu advance", "rin dinu"],
    exclusionKeywords: []
  },
  {
    category: "bank_current_account",
    displayLabel: "Bank Current/Savings",
    statementLine: "BS CA Cash",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["bank current", "current account", "savings account", "bank a", "bank b", "bank c", "bank d", "nabil bank", "hbl account", "nic asia", "himalayan bank", "everest bank", "global ime", "kumari bank", "sanima bank", "nmb bank", "prabhu bank", "siddhartha bank", "mega bank", "civil bank", "bank balance"],
    synonyms: ["current account", "savings account", "bank account", "CA account"],
    nepaliRomanized: ["bank khata", "current khata", "bank balance"],
    exclusionKeywords: []
  },
  {
    category: "bank_fixed_deposit_current",
    displayLabel: "Fixed Deposit (CA)",
    statementLine: "BS CA Cash",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["fixed deposit current", "fd short term", "fd within 12 months", "fixed deposit ca", "term deposit current", "bank fd current", "fd maturing within year"],
    synonyms: ["short-term FD", "FD \u2264 12 months", "current fixed deposit"],
    nepaliRomanized: ["chalu fd", "short fd"],
    exclusionKeywords: []
  },
  {
    category: "cash_in_hand",
    displayLabel: "Cash in Hand",
    statementLine: "BS CA Cash",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["cash in hand", "petty cash", "cash", "cash book", "cash at office", "cash drawer", "imprest cash", "cash float", "khajana", "nakad", "physical cash", "cash balance"],
    synonyms: ["petty cash", "cash", "cash at bank and in hand"],
    nepaliRomanized: ["nakad", "khajana", "haat ma nakad", "petty cash"],
    exclusionKeywords: []
  },
  {
    category: "lc_bg_margin",
    displayLabel: "LC/BG Margin",
    statementLine: "BS CA Other",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["lc margin", "bg margin", "letter of credit margin", "bank guarantee margin", "guarantee margin", "lc deposit", "bg deposit", "margin money lc", "margin money bg", "bid bond margin"],
    synonyms: ["LC margin", "BG margin", "guarantee margin deposit"],
    nepaliRomanized: ["lc margin", "bg jamanat"],
    exclusionKeywords: []
  },
  {
    category: "other_current_assets",
    displayLabel: "Other Current Assets",
    statementLine: "BS CA Other",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["other current asset", "miscellaneous current asset", "suspense debit", "unallocated debit", "other ca", "prepaid current other", "input vat asset", "assets held for sale current"],
    synonyms: ["miscellaneous current assets", "other CA"],
    nepaliRomanized: ["anya chalu sampatti"],
    exclusionKeywords: []
  },
  {
    category: "revenue_sales",
    displayLabel: "Sales Revenue",
    statementLine: "IS Revenue",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["sales", "sales revenue", "revenue from sales", "turnover", "gross sales", "net sales", "sales account", "sales income", "product sales", "goods sold revenue", "domestic sales", "export sales", "trading income sales"],
    synonyms: ["sales", "revenue", "turnover", "sales income"],
    nepaliRomanized: ["bikri", "sales aamdani", "byapar"],
    exclusionKeywords: []
  },
  {
    category: "revenue_services",
    displayLabel: "Service Revenue",
    statementLine: "IS Revenue",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["service income", "service revenue", "rendering of services", "professional fees income", "consultancy income", "service charges", "fees income service", "contract revenue service", "commission service income"],
    synonyms: ["service income", "services rendered", "fee income"],
    nepaliRomanized: ["sewa aamdani", "service income"],
    exclusionKeywords: []
  },
  {
    category: "interest_income",
    displayLabel: "Interest Income",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["interest income", "interest received", "interest on fd", "interest on deposit", "bank interest income", "interest earned", "finance income interest", "interest on loan given"],
    synonyms: ["interest received", "interest earned", "bank interest"],
    nepaliRomanized: ["byaj aamdani", "interest"],
    exclusionKeywords: []
  },
  {
    category: "dividend_income",
    displayLabel: "Dividend Income",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["dividend income", "dividend received", "income from dividend", "share dividend", "investment dividend", "dividend on shares"],
    synonyms: ["dividend received", "income from dividends"],
    nepaliRomanized: ["dividend aamdani"],
    exclusionKeywords: []
  },
  {
    category: "commission_income",
    displayLabel: "Commission Income",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["commission income", "commission received", "brokerage income", "agency commission", "sales commission income", "referral income"],
    synonyms: ["commission received", "brokerage income"],
    nepaliRomanized: ["commission aamdani"],
    exclusionKeywords: []
  },
  {
    category: "rental_income",
    displayLabel: "Rental Income",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["rental income", "rent received", "lease income", "property rent income", "building rent received", "hire income"],
    synonyms: ["rent received", "lease income", "rental revenue"],
    nepaliRomanized: ["bhada aamdani", "kiraya prapti"],
    exclusionKeywords: []
  },
  {
    category: "gain_on_disposal",
    displayLabel: "Gain on Disposal",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["gain on disposal", "profit on sale of asset", "gain on sale ppe", "profit on disposal", "gain on asset sale", "surplus on disposal", "gain on sale of vehicle", "gain on sale building"],
    synonyms: ["profit on disposal of assets", "gain on sale of fixed assets"],
    nepaliRomanized: ["bikri bata nafaa"],
    exclusionKeywords: []
  },
  {
    category: "insurance_claim_income",
    displayLabel: "Insurance Claim Income",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["insurance claim", "insurance recovery", "claim received insurance", "insurance compensation", "insurance settlement income"],
    synonyms: ["insurance claim received", "insurance recovery income"],
    nepaliRomanized: ["bima dabi aamdani"],
    exclusionKeywords: []
  },
  {
    category: "fv_gain_listed",
    displayLabel: "FV Gain on Listed Shares",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["fair value gain listed", "fv gain listed", "gain on revaluation listed shares", "market value gain shares", "nepse gain", "unrealized gain listed"],
    synonyms: ["fair value gain on listed shares", "FV adjustment gain"],
    nepaliRomanized: ["listed share gain"],
    exclusionKeywords: []
  },
  {
    category: "other_income",
    displayLabel: "Other Income",
    statementLine: "IS Other Income",
    normalBalance: "Cr",
    isGroup: false,
    keywords: ["other income", "miscellaneous income", "indirect income", "sundry income", "other operating income", "misc income", "non operating income other", "scrap sales income", "exchange gain"],
    synonyms: ["miscellaneous income", "indirect income", "sundry income"],
    nepaliRomanized: ["anya aamdani", "bibhinna aamdani"],
    exclusionKeywords: []
  },
  {
    category: "purchase",
    displayLabel: "Purchases",
    statementLine: "IS COGS",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["purchase", "purchases", "goods purchased", "purchase account", "trading purchase", "raw material purchase", "import purchase", "local purchase", "purchase of goods", "cost of goods purchased", "merchandise purchase"],
    synonyms: ["purchases", "goods purchased", "purchase of stock"],
    nepaliRomanized: ["kharid", "kinmel", "purchase"],
    exclusionKeywords: []
  },
  {
    category: "wages_direct",
    displayLabel: "Direct Wages",
    statementLine: "IS COGS",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["direct wages", "factory wages", "production wages", "labour direct", "direct labour", "wages production", "manufacturing wages", "shop floor wages", "piece rate wages"],
    synonyms: ["direct labour", "factory wages", "production labour"],
    nepaliRomanized: ["pratyaksh masanga", "direct wages"],
    exclusionKeywords: []
  },
  {
    category: "other_direct_expenses",
    displayLabel: "Other Direct Expenses",
    statementLine: "IS COGS",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["other direct expense", "factory overhead", "direct expenses other", "production overhead", "manufacturing overhead", "job work charges direct", "packing direct", "freight inward"],
    synonyms: ["factory overhead", "direct overheads", "production expenses"],
    nepaliRomanized: ["anya pratyaksh kharcha"],
    exclusionKeywords: []
  },
  {
    category: "materials_consumed",
    displayLabel: "Materials Consumed",
    statementLine: "IS COGS",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["materials consumed", "material consumed", "raw material consumed", "consumption of materials", "cost of materials used", "material usage", "stores consumed"],
    synonyms: ["material consumed", "raw materials consumed", "cost of materials"],
    nepaliRomanized: ["kharcha saman", "material consumed"],
    exclusionKeywords: []
  },
  {
    category: "salary_wages_expense",
    displayLabel: "Salaries & Wages",
    statementLine: "IS Employee Benefits",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["salary expense", "salaries wages", "staff salary", "employee salary", "wages expense", "remuneration expense", "payroll expense", "salaries and wages", "staff cost salary", "gross salary expense"],
    synonyms: ["salaries & wages", "staff salaries", "wages and salaries"],
    nepaliRomanized: ["tankha kharcha", "tanabu", "salary expense"],
    exclusionKeywords: []
  },
  {
    category: "allowances_expense",
    displayLabel: "Allowances",
    statementLine: "IS Employee Benefits",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["allowance expense", "hra", "house rent allowance", "ta travelling allowance", "da dearness", "medical allowance", "conveyance allowance", "special allowance", "overtime allowance"],
    synonyms: ["HRA", "TA", "DA", "staff allowances"],
    nepaliRomanized: ["bhatta kharcha", "allowance"],
    exclusionKeywords: []
  },
  {
    category: "pf_ssf_expense",
    displayLabel: "PF/SSF Expense",
    statementLine: "IS Employee Benefits",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["pf expense", "ssf expense", "cit expense", "provident fund expense", "employer pf contribution", "ssf contribution expense", "epf expense", "retirement benefit expense"],
    synonyms: ["PF contribution expense", "SSF expense", "CIT expense"],
    nepaliRomanized: ["pf kharcha", "ssf kharcha"],
    exclusionKeywords: []
  },
  {
    category: "staff_bonus_expense",
    displayLabel: "Staff Bonus Expense",
    statementLine: "IS Employee Benefits",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["staff bonus expense", "bonus expense", "employee bonus expense", "festival bonus expense", "dashain bonus expense", "year end bonus expense", "profit bonus expense"],
    synonyms: ["bonus expense", "staff bonus", "employee bonus"],
    nepaliRomanized: ["bonus kharcha"],
    exclusionKeywords: []
  },
  {
    category: "leave_encashment_expense",
    displayLabel: "Leave Encashment",
    statementLine: "IS Employee Benefits",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["leave encashment", "leave encashment expense", "unused leave payment", "leave salary expense", "annual leave encashment"],
    synonyms: ["leave encashment expense", "leave salary"],
    nepaliRomanized: ["bida rupantaran kharcha"],
    exclusionKeywords: []
  },
  {
    category: "other_employee_expense",
    displayLabel: "Other Employee Expense",
    statementLine: "IS Employee Benefits",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["other employee expense", "staff welfare", "employee welfare", "training expense staff", "recruitment expense", "staff insurance", "uniform expense", "canteen expense staff"],
    synonyms: ["staff welfare", "employee welfare", "other HR expenses"],
    nepaliRomanized: ["anya karmachari kharcha"],
    exclusionKeywords: []
  },
  {
    category: "interest_expense",
    displayLabel: "Interest Expense",
    statementLine: "IS Finance Costs",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["interest expense", "interest on loan", "finance cost interest", "bank interest paid", "loan interest expense", "borrowing cost", "interest on overdraft", "interest on term loan", "finance charges interest"],
    synonyms: ["interest on borrowings", "loan interest", "finance cost"],
    nepaliRomanized: ["byaj kharcha", "interest kharcha"],
    exclusionKeywords: []
  },
  {
    category: "bank_charges",
    displayLabel: "Bank Charges",
    statementLine: "IS Finance Costs",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["bank charges", "bank commission", "bank fees", "bank service charge", "swift charges", "lc charges bank", "collection charges", "remittance charges"],
    synonyms: ["bank commission", "bank fees", "bank service charges"],
    nepaliRomanized: ["bank charge", "bank commission"],
    exclusionKeywords: []
  },
  {
    category: "depreciation_expense",
    displayLabel: "Depreciation Expense",
    statementLine: "IS Depreciation",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["depreciation expense", "depreciation charged", "depreciation for year", "depreciation ppe", "annual depreciation", "depreciation building", "depreciation vehicle", "depreciation machinery", "mur kharcha"],
    synonyms: ["depreciation", "depreciation for the year", "depreciation charge"],
    nepaliRomanized: ["mur kharcha", "depreciation"],
    exclusionKeywords: []
  },
  {
    category: "impairment_on_debtors",
    displayLabel: "Impairment on Debtors",
    statementLine: "IS Impairment",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["impairment debtors", "bad debts written off", "impairment receivables", "doubtful debts expense", "bad debt expense", "provision expense debtors"],
    synonyms: ["bad debts", "impairment on receivables", "doubtful debts"],
    nepaliRomanized: ["dhani mur kharcha"],
    exclusionKeywords: []
  },
  {
    category: "impairment_on_investments",
    displayLabel: "Impairment on Investments",
    statementLine: "IS Impairment",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["impairment investment", "impairment unlisted shares", "investment impairment loss", "diminution in value investment", "write down investment"],
    synonyms: ["impairment on investments", "investment write-down"],
    nepaliRomanized: ["lagani mur kharcha"],
    exclusionKeywords: []
  },
  {
    category: "fv_loss_listed",
    displayLabel: "FV Loss on Listed Shares",
    statementLine: "IS Impairment",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["fair value loss listed", "fv loss listed", "loss on revaluation listed shares", "market value loss shares", "nepse loss", "unrealized loss listed"],
    synonyms: ["fair value loss on listed shares", "FV adjustment loss"],
    nepaliRomanized: ["listed share loss"],
    exclusionKeywords: []
  },
  {
    category: "admin_audit_fee",
    displayLabel: "Audit Fee",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["audit fee", "statutory audit fee", "auditor remuneration", "audit expense", "audit charges", "external audit fee", "annual audit fee"],
    synonyms: ["statutory audit fee", "auditor fee", "audit expenses"],
    nepaliRomanized: ["audit kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_advertisement",
    displayLabel: "Advertisement",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["advertisement", "advertising", "marketing expense", "promotion expense", "business promotion", "publicity expense", "media advertisement", "digital marketing"],
    synonyms: ["advertising", "marketing", "business promotion"],
    nepaliRomanized: ["bijnapam kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_fuel",
    displayLabel: "Fuel",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["fuel expense", "petrol", "diesel", "lubricant", "vehicle fuel", "fuel cost", "gasoline expense"],
    synonyms: ["petrol", "diesel", "fuel costs"],
    nepaliRomanized: ["petrol diesel", "fuel"],
    exclusionKeywords: []
  },
  {
    category: "admin_rent",
    displayLabel: "Rent",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["rent expense", "house rent", "office rent", "rent paid", "lease rent expense", "building rent expense", "shop rent"],
    synonyms: ["office rent", "house rent", "rent"],
    nepaliRomanized: ["bhada kharcha", "kiraya"],
    exclusionKeywords: []
  },
  {
    category: "admin_amc",
    displayLabel: "AMC",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["amc", "annual maintenance charge", "maintenance contract", "service contract annual", "amc expense", "annual maintenance contract"],
    synonyms: ["AMC", "annual maintenance charges", "maintenance contract"],
    nepaliRomanized: ["amc kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_communication",
    displayLabel: "Communication",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["communication expense", "telephone", "mobile", "internet", "postage", "courier", "fax", "communication charges", "telecom expense"],
    synonyms: ["telephone", "internet", "mobile charges"],
    nepaliRomanized: ["sanchar kharcha", "telephone internet"],
    exclusionKeywords: []
  },
  {
    category: "admin_legal",
    displayLabel: "Legal Expenses",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["legal expense", "legal fee", "lawyer fee", "litigation expense", "court fee", "legal consultancy", "advocate fee"],
    synonyms: ["legal fees", "lawyer fees", "legal charges"],
    nepaliRomanized: ["kanuni kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_consultancy",
    displayLabel: "Consultancy",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["consultancy fee", "professional fee", "consulting charges", "advisory fee", "management consultancy", "technical consultancy"],
    synonyms: ["consultancy", "professional fees", "consulting fees"],
    nepaliRomanized: ["salha kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_board_agm",
    displayLabel: "Board/AGM Expenses",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["board meeting expense", "agm expense", "meeting expenses", "directors meeting", "shareholders meeting", "board sitting fee expense", "annual general meeting"],
    synonyms: ["board meeting", "AGM expenses", "meeting expenses"],
    nepaliRomanized: ["board baithak kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_csr",
    displayLabel: "CSR Expenses",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["csr expense", "corporate social responsibility expense", "csr contribution", "social welfare expense", "donation csr", "community development expense"],
    synonyms: ["CSR expenses", "corporate social responsibility"],
    nepaliRomanized: ["csr kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_insurance",
    displayLabel: "Insurance",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["insurance premium", "insurance expense", "fire insurance", "vehicle insurance", "asset insurance", "liability insurance", "insurance charges"],
    synonyms: ["insurance", "insurance premium"],
    nepaliRomanized: ["bima kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_miscellaneous",
    displayLabel: "Miscellaneous",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["miscellaneous expense", "sundry expense", "misc admin", "general expense", "petty expenses admin", "other admin expense"],
    synonyms: ["miscellaneous", "sundry expenses"],
    nepaliRomanized: ["bibhinna kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_printing_stationery",
    displayLabel: "Printing & Stationery",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["printing expense", "stationery", "stationary", "printing and stationery", "office supplies", "paper expense", "toner cartridge"],
    synonyms: ["printing", "stationery", "office stationery"],
    nepaliRomanized: ["chapai kharcha", "stationery"],
    exclusionKeywords: []
  },
  {
    category: "admin_refreshment",
    displayLabel: "Refreshment",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["refreshment", "tea coffee expense", "entertainment staff", "hospitality expense", "snacks expense", "canteen refreshment"],
    synonyms: ["refreshments", "tea and snacks", "hospitality"],
    nepaliRomanized: ["refreshment kharcha"],
    exclusionKeywords: []
  },
  {
    category: "admin_travelling",
    displayLabel: "Travelling",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["travelling expense", "travel expense", "tour expense", "conveyance", "mileage", "air fare", "hotel expense travel", "ta da travel"],
    synonyms: ["travel", "travelling", "tour expenses"],
    nepaliRomanized: ["yatra kharcha", "travel"],
    exclusionKeywords: []
  },
  {
    category: "admin_water_electricity",
    displayLabel: "Water & Electricity",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["electricity expense", "water expense", "utility expense", "power bill", "nea bill", "kukl water", "utilities expense", "electricity water"],
    synonyms: ["electricity", "water", "utilities"],
    nepaliRomanized: ["bijuli pani kharcha", "widyut"],
    exclusionKeywords: []
  },
  {
    category: "admin_repair_maintenance",
    displayLabel: "Repair & Maintenance",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["repair maintenance", "repairs and maintenance", "maintenance expense", "r&m expense", "pool a repair", "pool b repair", "pool c repair", "annual repair", "breakdown maintenance"],
    synonyms: ["repairs & maintenance", "R&M", "maintenance"],
    nepaliRomanized: ["marammat kharcha", "repair"],
    exclusionKeywords: []
  },
  {
    category: "admin_others",
    displayLabel: "Other Admin Expenses",
    statementLine: "IS Admin",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["other administrative expense", "admin expense other", "general administrative", "office expense other", "sundry admin"],
    synonyms: ["other admin expenses", "general admin"],
    nepaliRomanized: ["anya prashasan kharcha"],
    exclusionKeywords: []
  },
  {
    category: "income_tax_expense",
    displayLabel: "Income Tax Expense",
    statementLine: "IS Tax",
    normalBalance: "Dr",
    isGroup: false,
    keywords: ["income tax expense", "tax expense", "corporate tax expense", "current tax expense", "provision for income tax expense", "tax on profit", "ird tax expense"],
    synonyms: ["income tax", "tax expense", "corporate tax"],
    nepaliRomanized: ["aaykar kharcha"],
    exclusionKeywords: []
  },
  {
    category: "unclassified",
    displayLabel: "Unclassified",
    statementLine: "N/A",
    normalBalance: "Dr",
    isGroup: true,
    keywords: ["unclassified", "unknown", "suspense", "unmapped", "temporary", "opening balance equity"],
    synonyms: ["suspense account", "unallocated"],
    nepaliRomanized: ["anklassified"],
    exclusionKeywords: []
  }
];
var NFRS_CATEGORIES = CHART_OF_ACCOUNTS.filter((e) => !e.isGroup).map((e) => e.category);

// server/services/accountMatcher.ts
var CATEGORY_ALIAS_MAP = {
  bank_charges: "finance_cost_bank_charges",
  admin_travelling: "admin_traveling",
  admin_repair_maintenance: "admin_repairs",
  admin_printing_stationery: "admin_printing",
  admin_legal: "admin_legal_professional",
  admin_others: "admin_other",
  admin_miscellaneous: "admin_other",
  borrowings_current_overdraft: "borrowings_current_od",
  borrowings_current_working: "borrowings_current_wc",
  salary_payable: "employee_payables_salary",
  bonus_payable: "employee_payables_bonus",
  pf_ssf_payable: "employee_payables_pf",
  impairment_on_debtors: "impairment_expense",
  trade_payables: "trade_payables_creditors",
  advance_from_customers: "trade_payables_advance_customers",
  other_current_liabilities: "other_payables",
  employee_benefit_noncurrent: "employee_benefit_gratuity",
  borrowings_noncurrent_related: "borrowings_noncurrent_other",
  salary_wages_expense: "emp_expense_salaries",
  pf_ssf_expense: "emp_expense_pf",
  staff_bonus_expense: "emp_expense_bonus",
  leave_encashment_expense: "emp_expense_leave",
  other_employee_expense: "emp_expense_welfare",
  purchase: "cogs_purchases",
  wages_direct: "direct_wages",
  other_direct_expenses: "direct_expenses_other",
  interest_income: "other_income_interest",
  dividend_income: "other_income_dividend",
  rental_income: "other_income_rental",
  gain_on_disposal: "other_income_disposal_gain",
  other_income: "other_income_misc",
  interest_expense: "finance_cost_interest",
  advance_tax: "advance_tax_paid",
  admin_water_electricity: "admin_electricity",
  provision_impairment_investments: "provision_impairment_investment",
  materials_consumed: "cogs_purchases",
  fv_gain_listed: "other_income_misc",
  fv_loss_listed: "impairment_expense",
  borrowings_current_bank: "borrowings_current_od",
  borrowings_related_current: "related_party_payable"
};
function normalizeCategoryAlias(category) {
  return CATEGORY_ALIAS_MAP[category] ?? category;
}
var REVIEW_THRESHOLD = 75;
var KEYWORD_THRESHOLD = 40;
function normalize(s) {
  return s.toLowerCase().replace(/[.,()&\-_/\\]/g, " ").replace(/\s+/g, " ").trim();
}
var levenshteinCache = /* @__PURE__ */ new Map();
var CACHE_LIMIT = 5e4;
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
  const cached = levenshteinCache.get(key);
  if (cached !== void 0) return cached;
  if (levenshteinCache.size >= CACHE_LIMIT) levenshteinCache.clear();
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  const result = dp[n];
  levenshteinCache.set(key, result);
  return result;
}
var EXACT_MATCH_MAP = /* @__PURE__ */ new Map();
function buildExactMatchMap() {
  if (EXACT_MATCH_MAP.size > 0) return;
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    EXACT_MATCH_MAP.set(normalize(entry.displayLabel), entry.category);
    for (const syn of entry.synonyms) {
      EXACT_MATCH_MAP.set(normalize(syn), entry.category);
    }
    for (const nr of entry.nepaliRomanized) {
      EXACT_MATCH_MAP.set(normalize(nr), entry.category);
    }
  }
}
var PARENT_GROUP_MAP = [
  { pattern: /sundry debtors?/i, category: "trade_receivables" },
  { pattern: /sundry creditors?/i, category: "trade_payables" },
  { pattern: /salary payable/i, category: "salary_payable" },
  { pattern: /tds payable/i, category: "tds_payable" },
  { pattern: /loan from bank/i, category: "borrowings_noncurrent_bank" },
  { pattern: /bank accounts?/i, category: "bank_current_account" },
  {
    pattern: /property.*plant|ppe|fixed assets?/i,
    category: "ppe_buildings",
    subPatterns: [
      { pattern: /land|bhoomi|jagga/i, category: "ppe_land" },
      { pattern: /building|bhawan/i, category: "ppe_buildings" },
      { pattern: /vehicle|gadi/i, category: "ppe_vehicles" },
      { pattern: /computer|laptop/i, category: "ppe_computers" },
      { pattern: /furniture/i, category: "ppe_furniture" },
      { pattern: /plant|machinery/i, category: "ppe_plant_machinery" },
      { pattern: /intangible|software|tally/i, category: "ppe_intangibles" },
      { pattern: /cwip|under construction/i, category: "ppe_cwip" },
      { pattern: /depreciation/i, category: "accum_depreciation" }
    ]
  },
  {
    pattern: /direct income/i,
    category: "revenue_sales",
    subPatterns: [{ pattern: /service/i, category: "revenue_services" }]
  },
  { pattern: /indirect income/i, category: "other_income" },
  {
    pattern: /employee benefit expenses?/i,
    category: "salary_wages_expense",
    subPatterns: [
      { pattern: /pf|ssf|cit|provident/i, category: "pf_ssf_expense" },
      { pattern: /bonus/i, category: "staff_bonus_expense" },
      { pattern: /allowance/i, category: "allowances_expense" }
    ]
  },
  {
    pattern: /administrative expenses?/i,
    category: "admin_others",
    subPatterns: [
      { pattern: /rent|bhada/i, category: "admin_rent" },
      { pattern: /audit/i, category: "admin_audit_fee" },
      { pattern: /travel/i, category: "admin_travelling" },
      { pattern: /electric|water|utility/i, category: "admin_water_electricity" },
      { pattern: /advertis|market/i, category: "admin_advertisement" },
      { pattern: /legal/i, category: "admin_legal" },
      { pattern: /insurance/i, category: "admin_insurance" },
      { pattern: /print|station/i, category: "admin_printing_stationery" }
    ]
  },
  { pattern: /repair.*maintenance/i, category: "admin_repair_maintenance" },
  {
    pattern: /impairment expense/i,
    category: "impairment_on_debtors",
    subPatterns: [{ pattern: /investment/i, category: "impairment_on_investments" }]
  }
];
function matchParentContext(parentGroup, label) {
  if (!parentGroup.trim()) return null;
  for (const entry of PARENT_GROUP_MAP) {
    if (!entry.pattern.test(parentGroup)) continue;
    if (entry.subPatterns) {
      for (const sub of entry.subPatterns) {
        if (sub.pattern.test(label)) {
          return { category: sub.category, confidence: 65 };
        }
      }
    }
    return { category: entry.category, confidence: 60 };
  }
  return null;
}
function scoreKeywords(entry, normalizedLabel, parentGroup) {
  let score = 0;
  const words = normalizedLabel.split(" ").filter(Boolean);
  for (const kw of entry.keywords) {
    const nkw = normalize(kw);
    if (!nkw) continue;
    if (words.includes(nkw) || normalizedLabel === nkw) {
      score += 10;
    } else if (normalizedLabel.includes(nkw)) {
      score += 5;
    }
  }
  for (const ex of entry.exclusionKeywords) {
    if (normalizedLabel.includes(normalize(ex))) score -= 20;
  }
  const pg = normalize(parentGroup);
  if (pg && entry.statementLine.toLowerCase().includes("equity") && /capital|equity|punji/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes("NCA") && /fixed asset|ppe|non.?current asset/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes("CA") && /current asset/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes("CL") && /current liabilit/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes("NCL") && /non.?current liabilit/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes("IS") && /income|expense|direct|indirect/i.test(pg)) {
    score += 15;
  }
  return score;
}
function keywordMatch(normalizedLabel, parentGroup) {
  let best = null;
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    const score = scoreKeywords(entry, normalizedLabel, parentGroup);
    if (!best || score > best.score) best = { entry, score };
  }
  if (!best || best.score < KEYWORD_THRESHOLD) return null;
  const confidence = Math.min(85, Math.max(60, 50 + best.score));
  return {
    nfrsCategory: normalizeCategoryAlias(best.entry.category),
    matchMethod: "keyword",
    confidence,
    needsReview: confidence < REVIEW_THRESHOLD,
    displayLabel: best.entry.displayLabel
  };
}
function fuzzyMatch(normalizedLabel) {
  let best = null;
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    const candidates = [entry.displayLabel, ...entry.synonyms, ...entry.nepaliRomanized];
    for (const cand of candidates) {
      const nc = normalize(cand);
      const dist = levenshtein(normalizedLabel, nc);
      const maxLen2 = Math.max(normalizedLabel.length, nc.length);
      if (maxLen2 === 0) continue;
      if (dist / maxLen2 < 0.3) {
        if (!best || dist < best.distance) {
          best = { entry, distance: dist, synonym: cand };
        }
      }
    }
  }
  if (!best) return null;
  const maxLen = Math.max(normalizedLabel.length, normalize(best.synonym).length);
  const confidence = Math.round(100 * (1 - best.distance / maxLen));
  const clamped = Math.min(60, Math.max(40, confidence));
  return {
    nfrsCategory: normalizeCategoryAlias(best.entry.category),
    matchMethod: "fuzzy",
    confidence: clamped,
    needsReview: true,
    displayLabel: best.entry.displayLabel
  };
}
function classifyRow(row) {
  buildExactMatchMap();
  const label = row.rawLabel.trim();
  const normalized = normalize(label);
  if (row.isGroupRow) {
    return {
      nfrsCategory: "unclassified",
      matchMethod: "unmatched",
      confidence: 0,
      needsReview: false,
      displayLabel: label
    };
  }
  const exact = EXACT_MATCH_MAP.get(normalized);
  if (exact) {
    const entry = CHART_OF_ACCOUNTS.find((e) => e.category === exact);
    return {
      nfrsCategory: normalizeCategoryAlias(exact),
      matchMethod: "exact",
      confidence: 100,
      needsReview: false,
      displayLabel: entry?.displayLabel ?? label
    };
  }
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    for (const syn of entry.synonyms) {
      if (normalize(syn) === normalized) {
        return {
          nfrsCategory: normalizeCategoryAlias(entry.category),
          matchMethod: "synonym",
          confidence: 95,
          needsReview: false,
          displayLabel: entry.displayLabel
        };
      }
    }
  }
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    for (const nr of entry.nepaliRomanized) {
      if (normalize(nr) === normalized) {
        return {
          nfrsCategory: normalizeCategoryAlias(entry.category),
          matchMethod: "synonym",
          confidence: 90,
          needsReview: false,
          displayLabel: entry.displayLabel
        };
      }
    }
  }
  const kw = keywordMatch(normalized, row.parentGroup);
  if (kw) return kw;
  const ctx = matchParentContext(row.parentGroup, label);
  if (ctx) {
    const entry = CHART_OF_ACCOUNTS.find((e) => e.category === ctx.category);
    return {
      nfrsCategory: normalizeCategoryAlias(ctx.category),
      matchMethod: "context",
      confidence: ctx.confidence,
      needsReview: ctx.confidence < REVIEW_THRESHOLD,
      displayLabel: entry?.displayLabel ?? label
    };
  }
  const fuzzy = fuzzyMatch(normalized);
  if (fuzzy) return fuzzy;
  return {
    nfrsCategory: "unclassified",
    matchMethod: "unmatched",
    confidence: 0,
    needsReview: true,
    displayLabel: label
  };
}
function classifyAll(rows) {
  return rows.map((row) => {
    const result = classifyRow(row);
    return {
      ...row,
      nfrsCategory: result.nfrsCategory,
      matchMethod: result.matchMethod,
      confidence: result.confidence,
      needsReview: result.needsReview || result.nfrsCategory === "unclassified",
      userOverride: false,
      displayLabel: result.displayLabel
    };
  });
}

// server/services/aiAccountMatcher.ts
import Anthropic from "@anthropic-ai/sdk";
var aiCache = /* @__PURE__ */ new Map();
var SYSTEM_PROMPT = "You are a Nepal chartered accountant expert in NAS for MEs and NFRS financial reporting. Given a list of trial balance account labels from Nepali accounting software, classify each into exactly one NFRS category from the provided list. Respond with a JSON array only. No explanation.";
function cacheKey(label, parentGroup) {
  return `${label.toLowerCase()}|${parentGroup.toLowerCase()}`;
}
function buildUserPrompt(batch) {
  return `Classify these account labels into NFRS categories.
Available categories: ${NFRS_CATEGORIES.join(", ")}
Parent group context is provided for each account.
Return ONLY a JSON array of objects: [{index, category, confidence, reasoning}]
Accounts to classify:
${JSON.stringify(batch)}`;
}
function parseAIResponse(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}
async function classifyWithAI(rows, apiKey) {
  const needsAI = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.needsReview || row.nfrsCategory === "unclassified");
  if (needsAI.length === 0 || !apiKey) return rows;
  const result = [...rows];
  const BATCH_SIZE2 = 50;
  const client = new Anthropic({ apiKey });
  for (let i = 0; i < needsAI.length; i += BATCH_SIZE2) {
    const batch = needsAI.slice(i, i + BATCH_SIZE2);
    const uncached = [];
    const cachedResults = /* @__PURE__ */ new Map();
    for (const item of batch) {
      const key = cacheKey(item.row.rawLabel, item.row.parentGroup);
      const hit = aiCache.get(key);
      if (hit?.[0]) {
        cachedResults.set(item.index, { ...hit[0], index: item.index });
      } else {
        uncached.push(item);
      }
    }
    let apiResults = [];
    if (uncached.length > 0) {
      const prompt = buildUserPrompt(
        uncached.map((u) => ({
          index: u.index,
          label: u.row.rawLabel,
          parentGroup: u.row.parentGroup
        }))
      );
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        });
        const text = response.content.filter((c) => c.type === "text").map((c) => c.type === "text" ? c.text : "").join("");
        apiResults = parseAIResponse(text);
      } catch (err) {
        console.error("[AI Matcher] API error:", err);
      }
    }
    const allResults = [...apiResults, ...cachedResults.values()];
    const validCategories = new Set(NFRS_CATEGORIES);
    for (const ai of allResults) {
      const idx = ai.index;
      if (idx < 0 || idx >= result.length) continue;
      const category = validCategories.has(ai.category) ? normalizeCategoryAlias(ai.category) : "unclassified";
      const entry = CHART_OF_ACCOUNTS.find((e) => e.category === category);
      const confidence = Math.min(100, Math.max(0, ai.confidence ?? 70));
      result[idx] = {
        ...result[idx],
        nfrsCategory: category,
        matchMethod: "ai",
        confidence,
        needsReview: confidence < 75 || category === "unclassified",
        displayLabel: entry?.displayLabel ?? result[idx].rawLabel
      };
      const key = cacheKey(result[idx].rawLabel, result[idx].parentGroup);
      aiCache.set(key, [{ index: idx, category, confidence, reasoning: ai.reasoning }]);
    }
  }
  return result;
}
async function aiMatchUnresolved(accounts, _company, apiKey) {
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const rows = accounts.map((a) => ({
    rowIndex: a.rowIndex,
    rawLabel: a.rawLabel,
    parentGroup: a.parentGroup ?? "",
    openingDr: 0,
    openingCr: 0,
    duringDr: 0,
    duringCr: 0,
    adjustmentDr: 0,
    adjustmentCr: 0,
    closingDr: a.closingDr ?? 0,
    closingCr: a.closingCr ?? 0,
    rowLevel: 2,
    isGroupRow: false,
    rawIndentSpaces: 0,
    nfrsCategory: "unclassified",
    matchMethod: "unmatched",
    confidence: 0,
    needsReview: true,
    userOverride: false,
    displayLabel: a.rawLabel
  }));
  const classified = await classifyWithAI(rows, apiKey);
  return classified.map((r, i) => ({
    rowIndex: accounts[i]?.rowIndex ?? r.rowIndex,
    nfrsCategory: String(r.nfrsCategory),
    confidence: r.confidence,
    reasoning: ""
  }));
}

// server/services/mappingProfile.ts
function mappingProfileKey(rawLabel, parentGroup = "") {
  const label = rawLabel.toLowerCase().trim().replace(/\s+/g, " ");
  const group = parentGroup.toLowerCase().trim().replace(/\s+/g, " ");
  return `${group}|${label}`;
}
function applyMappingProfile(rows, profile) {
  if (!profile || Object.keys(profile).length === 0) return rows;
  return rows.map((row) => {
    if (row.isGroupRow) return row;
    const saved = profile[mappingProfileKey(row.rawLabel, row.parentGroup)];
    if (!saved?.nfrsCategory) return row;
    return {
      ...row,
      nfrsCategory: saved.nfrsCategory,
      matchedLabel: saved.matchedLabel ?? row.displayLabel ?? row.rawLabel,
      confidence: 100,
      matchMethod: "manual",
      needsReview: false,
      userOverride: true,
      displayLabel: saved.matchedLabel ?? row.displayLabel ?? row.rawLabel
    };
  });
}
function upsertMappingProfile(profile, rows) {
  const next = { ...profile };
  for (const row of rows) {
    if (row.isGroupRow) continue;
    if (!row.nfrsCategory || row.nfrsCategory === "unclassified") continue;
    if (!row.userOverride && row.matchMethod !== "manual" && (row.confidence ?? 0) < 100) continue;
    next[mappingProfileKey(row.rawLabel, row.parentGroup)] = {
      nfrsCategory: row.nfrsCategory,
      matchedLabel: row.displayLabel ?? row.matchedLabel ?? row.rawLabel
    };
  }
  return next;
}

// server/services/tbTemplateWriter.ts
import ExcelJS3 from "exceljs";

// server/services/excelWriter.ts
import ExcelJS2 from "exceljs";

// server/services/mesEnterDetailsFields.ts
function buildMesEnterDetailsFields(company, adjustments) {
  const policies = company.accountingPolicies;
  const inv = adjustments?.inventoryDetails;
  const taxRate = policies?.incomeTaxRatePercent ?? company.incomeTaxRate ?? 25;
  const bonusRate = policies?.bonusRatePercent ?? (company.employeeBonusRate ?? 0.1) * 100;
  const employees = company.noOfEmployees ?? company.numberOfEmployees ?? 0;
  const dividendDeclared = company.dividendDeclaredPercent ?? 0;
  const dividendCapacity = Math.max(0, 100 - dividendDeclared);
  const fields = [
    { label: "name of entity", value: company.companyName ?? company.name ?? "" },
    { label: "address", value: company.fullAddress ?? company.address ?? "" },
    { label: "this year", value: company.fiscalYear?.bsFY ?? company.fiscalYearCurrent ?? "" },
    { label: "last year", value: company.previousFiscalYear?.bsFY ?? company.fiscalYearPrevious ?? "" },
    { label: "reporting date (bs)", value: company.fiscalYear?.endDateBS ?? company.reportingDateBS ?? "" },
    { label: "reporting date (ad)", value: company.fiscalYear?.endDateAD ?? company.reportingDateAD ?? "" },
    { label: "entity type", value: company.entityType ?? company.typeOfEntity ?? company.companyType ?? "" },
    { label: "applicable standard", value: company.applicableStandard ?? "NAS for MEs" },
    { label: "pan / vat number", value: company.panVatNumber ?? company.panNo ?? "" },
    { label: "registration no.", value: company.registrationNumber ?? company.registrationNo ?? "" },
    { label: "chairperson", value: company.chairperson ?? "" },
    { label: "director", value: company.director ?? "" },
    { label: "accounts head", value: company.accountsHead ?? "" },
    { label: "auditor", value: company.auditorInfo?.auditorName ?? company.auditor ?? "" },
    { label: "name of audit firm", value: company.auditorInfo?.auditorFirmName ?? company.auditFirmName ?? "" },
    { label: "ican registration no.", value: company.auditorInfo?.icanRegNumber ?? "" },
    { label: "number of employees", value: employees, isNumeric: true },
    { label: "income tax rate (%)", value: taxRate, isNumeric: true },
    { label: "bonus rate (%)", value: typeof bonusRate === "number" && bonusRate <= 1 ? bonusRate * 100 : bonusRate, isNumeric: true },
    { label: "rounding level (npr)", value: policies?.roundingLevel ?? 100, isNumeric: true },
    { label: "authorized share capital", value: company.authorizedCapital ?? 0, isNumeric: true },
    { label: "issued share capital (cy)", value: company.issuedCapitalCY ?? 0, isNumeric: true },
    { label: "dividend capacity (%)", value: dividendCapacity, isNumeric: true },
    { label: "dividend declared (%)", value: dividendDeclared, isNumeric: true },
    { label: "dividend payable (npr)", value: adjustments?.dividendPayable ?? 0, isNumeric: true }
  ];
  if (inv) {
    fields.push(
      { label: "inventory \u2014 raw materials (cy)", value: inv.rawMaterialsCY ?? 0, isNumeric: true },
      { label: "inventory \u2014 raw materials (py)", value: inv.rawMaterialsPY ?? 0, isNumeric: true },
      { label: "inventory \u2014 work in progress (cy)", value: inv.wipCY ?? 0, isNumeric: true },
      { label: "inventory \u2014 work in progress (py)", value: inv.wipPY ?? 0, isNumeric: true },
      { label: "inventory \u2014 finished goods (cy)", value: inv.finishedGoodsCY ?? 0, isNumeric: true },
      { label: "inventory \u2014 finished goods (py)", value: inv.finishedGoodsPY ?? 0, isNumeric: true }
    );
  }
  return fields;
}

// server/services/mesTrialBalanceWriter.ts
var NUMBER_FORMAT = "#,##0.00";
var SUBHEADER_BG = "E2EFDA";
var THIN_BORDER = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } }
};
function applyHeaderStyle(cell) {
  cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1E3A5F" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
}
function applySubHeaderStyle(cell) {
  cell.font = { name: "Arial", size: 10, bold: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${SUBHEADER_BG}` } };
  cell.border = THIN_BORDER;
}
function applyInputStyle(cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
}
var MES_TB_TOTAL_COLS = 19;
var MES_TB_CY_COLS = [2, 3, 4, 5, 6, 7, 8, 9];
var MES_TB_PY_COLS = [12, 13, 14, 15, 16, 17, 18, 19];
var SECTION_MAP = [
  { prefixes: ["BS Equity"], header: "CAPITAL ACCOUNT & RESERVES" },
  { prefixes: ["BS NCL Borrowings"], header: "NON-CURRENT LIABILITIES - LOANS & BORROWINGS" },
  { prefixes: ["BS NCL Employee Benefits"], header: "NON-CURRENT LIABILITIES - EMPLOYEE BENEFITS" },
  { prefixes: ["BS NCL Provisions"], header: "NON-CURRENT LIABILITIES - PROVISIONS" },
  { prefixes: ["BS NCL"], header: "NON-CURRENT LIABILITIES - OTHER" },
  { prefixes: ["BS CL Trade Payables"], header: "CURRENT LIABILITIES - TRADE PAYABLES" },
  { prefixes: ["BS CL Borrowings"], header: "CURRENT LIABILITIES - LOANS & BORROWINGS" },
  { prefixes: ["BS CL Tax"], header: "CURRENT LIABILITIES - TAX PAYABLE" },
  { prefixes: ["BS CL Employee"], header: "CURRENT LIABILITIES - EMPLOYEE PAYABLES" },
  { prefixes: ["BS CL Provisions"], header: "CURRENT LIABILITIES - PROVISIONS" },
  { prefixes: ["BS CL Other"], header: "CURRENT LIABILITIES - OTHER" },
  { prefixes: ["BS CA Tax"], header: "CURRENT ASSETS - ADVANCE TAX" },
  { prefixes: ["BS NCA PPE"], header: "PROPERTY, PLANT & EQUIPMENT" },
  { prefixes: ["BS NCA/CA Investments", "BS NCA Investments"], header: "INVESTMENTS" },
  { prefixes: ["BS NCA"], header: "OTHER NON-CURRENT ASSETS" },
  { prefixes: ["BS CA Inventory"], header: "CURRENT ASSETS - INVENTORY" },
  { prefixes: ["BS CA Receivables"], header: "CURRENT ASSETS - TRADE RECEIVABLES" },
  { prefixes: ["BS CA Other Receivables"], header: "CURRENT ASSETS - OTHER RECEIVABLES" },
  { prefixes: ["BS CA Cash"], header: "CURRENT ASSETS - CASH & BANK" },
  { prefixes: ["BS CA"], header: "CURRENT ASSETS - OTHER" },
  { prefixes: ["IS Revenue"], header: "DIRECT INCOME" },
  { prefixes: ["IS Other Income"], header: "INDIRECT INCOME" },
  { prefixes: ["IS COGS"], header: "DIRECT EXPENSES" },
  { prefixes: ["IS Employee Benefits"], header: "EMPLOYEE BENEFIT EXPENSES" },
  { prefixes: ["IS Finance Costs"], header: "FINANCE COSTS" },
  { prefixes: ["IS Depreciation"], header: "DEPRECIATION" },
  { prefixes: ["IS Impairment"], header: "IMPAIRMENT EXPENSES" },
  { prefixes: ["IS Admin"], header: "ADMINISTRATIVE EXPENSES" },
  { prefixes: ["IS Tax"], header: "INCOME TAX EXPENSE" }
];
function colLetter(col) {
  let letter = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
function normLabel(s) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
function buildSectionAccounts() {
  const sectionAccounts = /* @__PURE__ */ new Map();
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup || entry.statementLine === "N/A") continue;
    let header = null;
    for (const { prefixes, header: h } of SECTION_MAP) {
      if (prefixes.some((p) => entry.statementLine.startsWith(p))) {
        header = h;
        break;
      }
    }
    if (!header) continue;
    if (!sectionAccounts.has(header)) sectionAccounts.set(header, []);
    sectionAccounts.get(header).push({ displayLabel: entry.displayLabel, category: entry.category });
  }
  return SECTION_MAP.map(({ header }) => header).filter((header) => sectionAccounts.has(header)).map((header) => ({ header, accounts: sectionAccounts.get(header) }));
}
function indexRows(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (row.isGroupRow) continue;
    map.set(normLabel(row.rawLabel), row);
    if (row.displayLabel) map.set(normLabel(row.displayLabel), row);
    if (row.nfrsCategory) map.set(String(row.nfrsCategory), row);
  }
  return map;
}
function indexPyRows(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const row of rows ?? []) {
    if (row.isGroupRow) continue;
    map.set(normLabel(row.rawLabel), row);
  }
  return map;
}
function writeAmountCells(row, cols, amounts, styled = false) {
  amounts.forEach((amt, i) => {
    const cell = row.getCell(cols[i]);
    cell.value = amt || null;
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: "right" };
    if (styled) applyInputStyle(cell);
    cell.border = THIN_BORDER;
  });
}
function rowAmounts(r) {
  return [
    r.openingDr,
    r.openingCr,
    r.duringDr,
    r.duringCr,
    r.adjustmentDr,
    r.adjustmentCr,
    r.closingDr,
    r.closingCr
  ];
}
function writeMesFormatTrialBalance(ws, tb, company) {
  ws.getColumn(1).width = 42;
  for (const col of [...MES_TB_CY_COLS, ...MES_TB_PY_COLS]) {
    ws.getColumn(col).width = 14;
  }
  const companyName = company?.companyName ?? tb.companyName ?? "[COMPANY NAME]";
  const fy = company?.fiscalYear?.bsFY ?? tb.fiscalYear ?? "";
  ws.mergeCells(1, 1, 1, MES_TB_TOTAL_COLS);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = companyName;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  applyHeaderStyle(titleCell);
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, MES_TB_TOTAL_COLS);
  const subCell = ws.getCell(2, 1);
  subCell.value = `TRIAL BALANCE \u2014 FISCAL YEAR ${fy}`;
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  applyHeaderStyle(subCell);
  ws.mergeCells(3, 1, 3, 9);
  ws.getCell(3, 1).value = "CURRENT YEAR";
  ws.getCell(3, 1).font = { name: "Arial", size: 10, bold: true };
  ws.getCell(3, 1).alignment = { horizontal: "center" };
  ws.mergeCells(3, 11, 3, 19);
  ws.getCell(3, 11).value = "PREVIOUS YEAR";
  ws.getCell(3, 11).font = { name: "Arial", size: 10, bold: true };
  ws.getCell(3, 11).alignment = { horizontal: "center" };
  const cyHeaders = [
    "Particulars",
    "Opening Dr.",
    "Opening Cr.",
    "During Dr.",
    "During Cr.",
    "Adjustment Dr.",
    "Adjustment Cr.",
    "Closing Dr.",
    "Closing Cr."
  ];
  const headerRow = ws.getRow(5);
  cyHeaders.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle(c);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
  });
  cyHeaders.forEach((h, i) => {
    const c = headerRow.getCell(11 + i);
    c.value = h;
    applySubHeaderStyle(c);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
  });
  const cyIndex = indexRows(tb.rows);
  const pyIndex = indexPyRows(tb.previousYearData ?? void 0);
  const matchedCy = /* @__PURE__ */ new Set();
  let currentRow = 6;
  const dataStartRow = currentRow;
  for (const { header, accounts } of buildSectionAccounts()) {
    ws.mergeCells(currentRow, 1, currentRow, MES_TB_TOTAL_COLS);
    const sectionCell = ws.getRow(currentRow).getCell(1);
    sectionCell.value = header;
    sectionCell.font = { name: "Arial", size: 10, bold: true };
    sectionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${SUBHEADER_BG}` } };
    currentRow++;
    for (const account of accounts) {
      const cyRow = cyIndex.get(normLabel(account.displayLabel)) ?? cyIndex.get(account.category);
      if (!cyRow) continue;
      matchedCy.add(cyRow);
      const pyRow = pyIndex.get(normLabel(account.displayLabel)) ?? pyIndex.get(normLabel(cyRow.rawLabel));
      const row = ws.getRow(currentRow);
      row.getCell(1).value = account.displayLabel;
      row.getCell(1).font = { name: "Arial", size: 10 };
      writeAmountCells(row, MES_TB_CY_COLS, rowAmounts(cyRow));
      if (pyRow) {
        writeAmountCells(row, MES_TB_PY_COLS, rowAmounts(pyRow));
      } else {
        writeAmountCells(row, MES_TB_PY_COLS, [0, 0, 0, 0, 0, 0, 0, 0], true);
      }
      currentRow++;
    }
  }
  const unmatched = tb.rows.filter((r) => !r.isGroupRow && !matchedCy.has(r));
  if (unmatched.length > 0) {
    ws.mergeCells(currentRow, 1, currentRow, MES_TB_TOTAL_COLS);
    ws.getRow(currentRow).getCell(1).value = "OTHER ACCOUNTS";
    ws.getRow(currentRow).getCell(1).font = { name: "Arial", size: 10, bold: true };
    currentRow++;
    for (const cyRow of unmatched) {
      const pyRow = pyIndex.get(normLabel(cyRow.rawLabel));
      const row = ws.getRow(currentRow);
      row.getCell(1).value = cyRow.displayLabel ?? cyRow.rawLabel;
      writeAmountCells(row, MES_TB_CY_COLS, rowAmounts(cyRow));
      if (pyRow) writeAmountCells(row, MES_TB_PY_COLS, rowAmounts(pyRow));
      else writeAmountCells(row, MES_TB_PY_COLS, [0, 0, 0, 0, 0, 0, 0, 0], true);
      currentRow++;
    }
  }
  const dataEndRow = currentRow - 1;
  const totalRow = ws.getRow(currentRow);
  totalRow.getCell(1).value = "GRAND TOTAL";
  totalRow.getCell(1).font = { name: "Arial", size: 10, bold: true };
  const doubleTop = { style: "double", color: { argb: "FF1E40AF" } };
  for (const col of [...MES_TB_CY_COLS, ...MES_TB_PY_COLS]) {
    const cell = totalRow.getCell(col);
    const letter = colLetter(col);
    cell.value = { formula: `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`, result: 0 };
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: "right" };
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.border = { top: doubleTop };
  }
  ws.views = [{ state: "frozen", ySplit: 5 }];
}

// server/services/excelWriter.ts
var COLORS = {
  BRAND_BLUE: "1E40AF",
  HEADER_BG: "1E3A8A",
  SUBHEADER_BG: "DBEAFE",
  TOTAL_BG: "EFF6FF",
  AMOUNT_BG: "F8FAFC",
  GREEN_INPUT: "86EFAC",
  YELLOW_NOTE: "FEF9C3",
  WHITE: "FFFFFF",
  BORDER_COLOR: "CBD5E1",
  RED: "DC2626",
  LIGHT_GRAY: "F1F5F9"
};
var FONTS = {
  HEADING: { name: "Arial", size: 11, bold: true, color: { argb: `FF${COLORS.WHITE}` } },
  SUBHEADING: { name: "Arial", size: 10, bold: true, color: { argb: `FF${COLORS.BRAND_BLUE}` } },
  BODY: { name: "Arial", size: 10 },
  AMOUNT: { name: "Arial", size: 10 },
  TOTAL: { name: "Arial", size: 10, bold: true },
  NOTE_REF: { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } },
  TITLE: { name: "Arial", size: 11, bold: true, color: { argb: `FF${COLORS.WHITE}` } }
};
var NUMBER_FORMAT2 = "#,##0";
var THIN_BORDER2 = { style: "thin", color: { argb: `FF${COLORS.BORDER_COLOR}` } };
var MEDIUM_BORDER = { style: "medium", color: { argb: `FF${COLORS.BRAND_BLUE}` } };
function applyHeaderStyle2(cell) {
  cell.font = { name: "Arial", size: 11, bold: true, color: { argb: `FF${COLORS.WHITE}` } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.BRAND_BLUE}` } };
}
function applySubHeaderStyle2(cell) {
  cell.font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${COLORS.BRAND_BLUE}` } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.SUBHEADER_BG}` } };
}
function applyInputStyle2(cell) {
  cell.font = { name: "Arial", size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.GREEN_INPUT}` } };
}
function applyAssumptionStyle(cell) {
  cell.font = { name: "Arial", size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.YELLOW_NOTE}` } };
}
function applyBodyStyle(cell) {
  cell.font = { name: "Arial", size: 10 };
  cell.fill = void 0;
}
function applyTotalStyle(cell) {
  cell.font = { name: "Arial", size: 10, bold: true };
  cell.border = { ...cell.border, top: MEDIUM_BORDER };
}
function applyHeaderFill(cell, colorHex = COLORS.HEADER_BG) {
  if (colorHex === COLORS.SUBHEADER_BG) applySubHeaderStyle2(cell);
  else applyHeaderStyle2(cell);
}
function applyGreenInput(cell) {
  applyInputStyle2(cell);
}
function writeNoteSheetTitle(ws, title) {
  const cell = ws.getRow(1).getCell(1);
  cell.value = title;
  applyHeaderStyle2(cell);
}
var PPE_WORKINGS_CLASSES = [
  "Land",
  "Building",
  "Office Equipment/Furniture/Fixtures",
  "Vehicle",
  "Plant & Machinery",
  "Intangibles & Leasehold",
  "WIP"
];
function mapToPPEWorkingsClass(categoryId) {
  const c = categoryId.toLowerCase().replace(/[_\s-]/g, "");
  if (c.includes("land") && !c.includes("lease")) return "Land";
  if (c.includes("building")) return "Building";
  if (c.includes("office") || c.includes("furniture") || c.includes("fixture") || c.includes("computer")) {
    return "Office Equipment/Furniture/Fixtures";
  }
  if (c.includes("vehicle")) return "Vehicle";
  if (c.includes("plant") || c.includes("machinery")) return "Plant & Machinery";
  if (c.includes("intangible") || c.includes("leasehold") || c.includes("software")) return "Intangibles & Leasehold";
  if (c.includes("wip") || c.includes("construction") || c.includes("cwip")) return "WIP";
  return "Office Equipment/Furniture/Fixtures";
}
function approximateBsDateToSerial(bsDate, fiscalYear) {
  const fy = getFiscalYear(fiscalYear);
  if (!fy || !bsDate?.trim()) return null;
  const parts = bsDate.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const bsMonths = [
    "shrawan",
    "bhadra",
    "aswin",
    "kartik",
    "mangsir",
    "poush",
    "magh",
    "falgun",
    "chaitra",
    "baisakh",
    "jestha",
    "ashadh"
  ];
  const monthIdx = bsMonths.indexOf(parts[1].toLowerCase());
  if (monthIdx < 0) return null;
  const totalDays = fy.endExcelSerial - fy.startExcelSerial;
  const dayFraction = (monthIdx * 30 + (parseInt(parts[0], 10) || 1)) / 365;
  return Math.round(fy.startExcelSerial + totalDays * Math.min(1, dayFraction));
}
function proRataDays(purchaseSerial, fiscalYear) {
  const fy = getFiscalYear(fiscalYear);
  if (!fy || purchaseSerial == null) return 365;
  if (purchaseSerial <= fy.startExcelSerial) return 365;
  if (purchaseSerial >= fy.endExcelSerial) return 0;
  return fy.endExcelSerial - purchaseSerial;
}
function setAmountCell(cell, value) {
  cell.value = value || null;
  cell.numFmt = NUMBER_FORMAT2;
  cell.alignment = { horizontal: "right" };
}
function writeSumTotalRow(ws, row, labelCol, sumCols, fromRow, toRow, label = "Total") {
  const exRow = ws.getRow(row);
  exRow.getCell(labelCol).value = label;
  exRow.getCell(labelCol).font = FONTS.TOTAL;
  sumCols.forEach((col) => {
    const cell = exRow.getCell(col);
    const colLetter3 = ws.getColumn(col).letter ?? String.fromCharCode(64 + col);
    cell.value = { formula: `SUM(${colLetter3}${fromRow}:${colLetter3}${toRow})`, result: 0 };
    cell.numFmt = NUMBER_FORMAT2;
    cell.alignment = { horizontal: "right" };
    cell.font = FONTS.TOTAL;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
  });
}
function debtorAgingDays(d) {
  if (typeof d.agingDays === "number") return d.agingDays;
  const cat = String(d.ageCategory ?? "");
  if (cat === "<30days") return 15;
  if (cat === "31-60days") return 45;
  if (cat === "61-90days") return 75;
  if (cat === ">90days") return 120;
  return 0;
}
function agingBucketAmount(amount, days) {
  if (amount <= 0) return [0, 0, 0, 0];
  if (days <= 30) return [amount, 0, 0, 0];
  if (days <= 60) return [0, amount, 0, 0];
  if (days <= 90) return [0, 0, amount, 0];
  return [0, 0, 0, amount];
}
function applyAllBorders(cell) {
  cell.border = { top: THIN_BORDER2, bottom: THIN_BORDER2, left: THIN_BORDER2, right: THIN_BORDER2 };
}
function writeSectionHeader(ws, row, text, lastColIndex = 4) {
  const exRow = ws.getRow(row);
  const cell = exRow.getCell(1);
  ws.mergeCells(row, 1, row, lastColIndex);
  cell.value = text;
  applySubHeaderStyle2(cell);
  cell.alignment = { horizontal: "left", vertical: "middle" };
  exRow.height = 18;
}
function writeStatementHeader(ws, companyName, statementTitle, periodLine, curYearLabel, prevYearLabel) {
  ws.mergeCells("A1:F1");
  const r1 = ws.getCell("A1");
  r1.value = companyName.toUpperCase();
  r1.alignment = { horizontal: "center", vertical: "middle" };
  applyHeaderStyle2(r1);
  ws.getRow(1).height = 26;
  ws.mergeCells("A2:F2");
  const r2 = ws.getCell("A2");
  r2.value = statementTitle;
  r2.font = { name: "Arial", size: 11, bold: true };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  applyBodyStyle(r2);
  ws.getRow(2).height = 20;
  ws.mergeCells("A3:F3");
  const r3 = ws.getCell("A3");
  r3.value = periodLine;
  r3.font = { name: "Arial", size: 10, italic: true };
  r3.alignment = { horizontal: "center", vertical: "middle" };
  applyBodyStyle(r3);
  ws.getRow(3).height = 16;
  ws.mergeCells("A4:F4");
  const r4 = ws.getCell("A4");
  r4.value = "All amounts in NPR (Nepalese Rupees)";
  r4.font = { name: "Arial", size: 8, italic: true, color: { argb: "FF64748B" } };
  r4.alignment = { horizontal: "right" };
  applyBodyStyle(r4);
  ws.getRow(4).height = 14;
  const headerRow = ws.getRow(5);
  headerRow.getCell(1).value = "Particulars";
  headerRow.getCell(2).value = "Note";
  headerRow.getCell(3).value = curYearLabel;
  headerRow.getCell(4).value = prevYearLabel;
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    applySubHeaderStyle2(cell);
    cell.alignment = { horizontal: Number(cell.col) === 1 ? "left" : "center", vertical: "middle" };
    applyAllBorders(cell);
  });
  headerRow.height = 18;
  ws.views = [{ state: "frozen", ySplit: 5, xSplit: 0 }];
  return 6;
}
function writeAmountRow(ws, rowNum, r) {
  const exRow = ws.getRow(rowNum);
  if (r.isSectionHeader) {
    writeSectionHeader(ws, rowNum, r.label);
    return;
  }
  const indent = "  ".repeat(r.indent ?? 0);
  const cell1 = exRow.getCell(1);
  cell1.value = indent + r.label;
  applyBodyStyle(cell1);
  const cell2 = exRow.getCell(2);
  if (r.note) {
    cell2.value = r.note;
    cell2.font = FONTS.NOTE_REF;
  } else applyBodyStyle(cell2);
  const cell3 = exRow.getCell(3);
  cell3.value = r.cy || null;
  cell3.numFmt = NUMBER_FORMAT2;
  cell3.alignment = { horizontal: "right" };
  applyBodyStyle(cell3);
  const cell4 = exRow.getCell(4);
  cell4.value = r.py || null;
  cell4.numFmt = NUMBER_FORMAT2;
  cell4.alignment = { horizontal: "right" };
  applyBodyStyle(cell4);
  [cell1, cell2, cell3, cell4].forEach(applyAllBorders);
  if (r.isTotal || r.isSubTotal) {
    [cell1, cell2, cell3, cell4].forEach((c) => {
      applyTotalStyle(c);
      if (r.isSubTotal) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.AMOUNT_BG}` } };
      }
      if (r.isTotal) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
        c.border = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER };
      }
    });
  }
  exRow.height = 15;
}
function writeSignatureLine(ws, startRow, company) {
  ws.getRow(startRow).getCell(1).value = "The notes referred to above form an integral part of these financial statements.";
  ws.getRow(startRow).getCell(1).font = { name: "Arial", size: 9, italic: true };
  const sigRow = startRow + 2;
  ws.getRow(sigRow).getCell(1).value = "For and on behalf of the Board of Directors";
  ws.getRow(sigRow).getCell(1).font = { name: "Arial", size: 9 };
  const nameRow = sigRow + 3;
  ws.getRow(nameRow).getCell(1).value = company.chairperson ?? "Chairperson";
  ws.getRow(nameRow).getCell(3).value = company.director ?? "Director";
  const audRow = nameRow + 2;
  ws.getRow(audRow).getCell(1).value = `For ${company.auditorInfo?.auditorFirmName ?? "Audit Firm"}`;
  ws.getRow(audRow + 1).getCell(1).value = company.auditorInfo?.auditorName ?? "Auditor";
  ws.getRow(audRow + 2).getCell(1).value = company.auditorInfo?.position ?? "Engagement Partner";
}
function writeWorkings(ws, company, wb) {
  ws.state = "veryHidden";
  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 12;
  const fyTableHeaderRow = ws.getRow(1);
  ["BS Year", "Start BS", "End BS", "Start AD", "End AD", "Days in Year"].forEach((h, i) => {
    const cell = fyTableHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  fyTableHeaderRow.height = 18;
  FISCAL_YEARS.forEach((fy, idx) => {
    const row = ws.getRow(2 + idx);
    [
      fy.bsFY,
      fy.startDateBS,
      fy.endDateBS,
      fy.startDateAD,
      fy.endDateAD,
      fy.isLeapYear ? 366 : 365
    ].forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: ci === 0 ? "center" : "left" };
      if (idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FBFF" } };
      }
    });
  });
  const fyLastRow = 1 + FISCAL_YEARS.length;
  try {
    wb.definedNames.add(
      `Workings!$A$2:$F$${fyLastRow}`,
      "FiscalYearTable"
    );
  } catch {
  }
  const paramStart = 30;
  const params = [
    { label: "Company Name", value: company.companyName ?? "", name: "CompanyName" },
    { label: "Fiscal Year", value: company.fiscalYear?.bsFY ?? "", name: "FiscalYear" },
    { label: "End Date BS", value: company.fiscalYear?.endDateBS ?? "", name: "YearEndDateBS" },
    { label: "End Date AD", value: company.fiscalYear?.endDateAD ?? "", name: "YearEndDateAD" },
    { label: "Start Date BS", value: company.fiscalYear?.startDateBS ?? "", name: "YearStartDateBS" },
    { label: "Start Date AD", value: company.fiscalYear?.startDateAD ?? "", name: "YearStartDateAD" },
    { label: "Rounding Level (NPR)", value: company.accountingPolicies?.roundingLevel ?? 1, name: "RoundingLevel" },
    { label: "Income Tax Rate %", value: company.accountingPolicies?.incomeTaxRatePercent ?? 25, name: "TaxRate" },
    { label: "Staff Bonus Rate %", value: 10, name: "BonusRate" },
    { label: "PAN/VAT Number", value: company.panVatNumber ?? "" },
    { label: "Registration No.", value: company.registrationNumber ?? "" }
  ];
  const paramSectionHeader = ws.getRow(paramStart - 1);
  paramSectionHeader.getCell(1).value = "\u25B6 Company Parameters";
  paramSectionHeader.getCell(1).font = { bold: true, size: 10, color: { argb: "FF1E3A5F" } };
  paramSectionHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
  ws.mergeCells(paramStart - 1, 1, paramStart - 1, 6);
  params.forEach(({ label, value, name }, idx) => {
    const rowNum = paramStart + idx;
    const row = ws.getRow(rowNum);
    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { size: 9, color: { argb: "FF374151" } };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FBFF" } };
    const valueCell = row.getCell(2);
    valueCell.value = value;
    valueCell.font = { bold: true, size: 9 };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
    valueCell.alignment = { horizontal: "left" };
    if (name) {
      try {
        wb.definedNames.add(`Workings!$B$${rowNum}`, name);
      } catch {
      }
    }
  });
  const valStart = 55;
  const valHeader = ws.getRow(valStart - 1);
  valHeader.getCell(1).value = "\u25B6 Validation Dashboard";
  valHeader.getCell(1).font = { bold: true, size: 10, color: { argb: "FF1E3A5F" } };
  valHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
  ws.mergeCells(valStart - 1, 1, valStart - 1, 6);
  const valColHeaders = ws.getRow(valStart);
  ["Check", "Formula / Description", "Result", "Status"].forEach((h, i) => {
    const cell = valColHeaders.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9EEF5" } };
  });
  const validationChecks = [
    {
      check: "Balance Sheet Balance",
      desc: "Assets = Liabilities + Equity (difference must be 0)",
      formula: "='Balance Sheet'!C50-'Balance Sheet'!C80"
      // Adjust row refs
    },
    {
      check: "Cash Flow Reconciliation",
      desc: "Closing Cash (CF) = Closing Cash (BS)",
      formula: "='Cash Flow'!C60-'Balance Sheet'!C35"
      // Adjust row refs
    },
    {
      check: "Trial Balance Balanced",
      desc: "Total Closing Dr = Total Closing Cr",
      formula: "='Trial Balance'!C5-'Trial Balance'!D5"
      // Adjust row refs
    },
    {
      check: "Net Profit Tie",
      desc: "IS Net Profit = Equity change",
      formula: "='Income Statement'!C45-'Changes in Equity'!F15"
      // Adjust
    }
  ];
  validationChecks.forEach((check, idx) => {
    const row = ws.getRow(valStart + 1 + idx);
    row.getCell(1).value = check.check;
    row.getCell(1).font = { size: 9 };
    row.getCell(2).value = check.desc;
    row.getCell(2).font = { size: 9, color: { argb: "FF6B7280" } };
    const resultCell = row.getCell(3);
    resultCell.value = { formula: check.formula.replace(/^=/, ""), result: 0 };
    resultCell.numFmt = '#,##0.00;(#,##0.00);"\u2713 OK"';
    resultCell.font = { bold: true, size: 9 };
    const statusCell = row.getCell(4);
    const resultCellAddress = `C${valStart + 1 + idx}`;
    statusCell.value = {
      formula: `IF(ABS(${resultCellAddress})<1,"\u2713 OK","\u26A0 CHECK")`,
      result: "\u2713 OK"
    };
    statusCell.font = { bold: true, size: 9 };
    statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
  });
}
function writeInstructions(ws) {
  ws.getRow(1).getCell(1).value = "NFRS FINANCIAL REPORTER \u2014 USER GUIDE";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 14, bold: true };
  const instructions = [
    ["Green cells", "Input cells \u2014 enter your values here"],
    ["Blue headers", "Automatically calculated \u2014 do not edit"],
    ["Printing", "Use File \u2192 Print \u2192 set paper A4, scale to fit"],
    ["Trial Balance", "Enter opening and closing balances for each account"],
    ["Balance Sheet", "Auto-calculated from Trial Balance"],
    ["Income Statement", "Auto-calculated from Trial Balance"],
    ["Notes", "Detailed disclosures for each Balance Sheet line"],
    ["Depreciation", "See Note 3.1 for full PPE schedule"]
  ];
  instructions.forEach(([term, desc], i) => {
    ws.getRow(i + 3).getCell(1).value = term;
    ws.getRow(i + 3).getCell(1).font = { name: "Arial", size: 10, bold: true };
    ws.getRow(i + 3).getCell(2).value = desc;
    ws.getRow(i + 3).getCell(2).font = { name: "Arial", size: 10 };
  });
}
function writeEnterDetails(ws, company, adjustments) {
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 36;
  ws.mergeCells(1, 2, 1, 3);
  const title = ws.getCell(1, 2);
  title.value = "ENTER DETAILS \u2014 NAS FOR MEs";
  title.font = { name: "Arial", size: 12, bold: true };
  title.alignment = { horizontal: "center" };
  const fields = buildMesEnterDetailsFields(company, adjustments);
  fields.forEach(({ label, value, isNumeric }, i) => {
    const row = ws.getRow(i + 3);
    row.getCell(2).value = label;
    row.getCell(2).font = { name: "Arial", size: 10, bold: true };
    const vc = row.getCell(3);
    vc.value = value === "" ? null : value;
    if (isNumeric && typeof value === "number") vc.numFmt = NUMBER_FORMAT2;
    applyInputStyle2(vc);
    vc.border = THIN_BORDER2;
  });
}
function writeBalanceSheet(ws, bs, company) {
  ws.columns = [
    { key: "A", width: 42 },
    { key: "B", width: 8 },
    { key: "C", width: 18 },
    { key: "D", width: 18 }
  ];
  const fy = company.fiscalYear?.bsFY ?? "";
  const [startBS, endBS] = fy.split("/").map((y) => y.trim());
  let row = writeStatementHeader(
    ws,
    company.companyName ?? "Company",
    "STATEMENT OF FINANCIAL POSITION",
    `As at 31 Ashadh ${endBS ?? ""} (15 July 2025)`,
    `31 Ashadh ${endBS ?? ""}`,
    `31 Ashadh ${startBS ?? ""}`
  );
  const rows = [
    { label: "A.  NON-CURRENT ASSETS", isSectionHeader: true },
    { label: "Property, Plant and Equipment", note: "3.1", cy: bs.nca_ppe, py: bs.nca_ppe_py, indent: 1 },
    { label: "Investments", note: "3.2", cy: bs.nca_investments, py: bs.nca_investments_py, indent: 1 },
    { label: "Other Receivables (Non-current)", note: "3.4", cy: bs.nca_receivables, py: bs.nca_receivables_py, indent: 1 },
    { label: "Other Non-Current Assets", note: "3.5", cy: bs.nca_other, py: bs.nca_other_py, indent: 1 },
    { label: "Total Non-Current Assets", cy: bs.totalNonCurrentAssets, py: bs.totalNonCurrentAssets_py, isSubTotal: true },
    { label: "B.  CURRENT ASSETS", isSectionHeader: true },
    { label: "Investments (Current)", note: "3.2", cy: bs.ca_investments, py: bs.ca_investments_py, indent: 1 },
    { label: "Inventories", note: "3.7", cy: bs.ca_inventories, py: bs.ca_inventories_py, indent: 1 },
    { label: "Trade and Other Receivables", note: "3.3", cy: bs.ca_tradeReceivables, py: bs.ca_tradeReceivables_py, indent: 1 },
    { label: "Cash and Cash Equivalents", note: "3.8", cy: bs.ca_cashAndEquivalents, py: bs.ca_cashAndEquivalents_py, indent: 1 },
    { label: "Other Current Assets", note: "3.6", cy: bs.ca_other, py: bs.ca_other_py, indent: 1 },
    { label: "Total Current Assets", cy: bs.totalCurrentAssets, py: bs.totalCurrentAssets_py, isSubTotal: true },
    { label: "TOTAL ASSETS", cy: bs.totalAssets, py: bs.totalAssets_py, isTotal: true },
    { label: "C.  EQUITY", isSectionHeader: true },
    { label: "Share Capital", note: "3.9", cy: bs.eq_shareCapital, py: bs.eq_shareCapital_py, indent: 1 },
    { label: "Reserves", note: "3.10", cy: bs.eq_reserves, py: bs.eq_reserves_py, indent: 1 },
    { label: "Retained Earnings", cy: bs.eq_retainedEarnings, py: bs.eq_retainedEarnings_py, indent: 1 },
    { label: "Total Equity", cy: bs.totalEquity, py: bs.totalEquity_py, isSubTotal: true },
    { label: "D.  NON-CURRENT LIABILITIES", isSectionHeader: true },
    { label: "Loans and Borrowings", note: "3.11", cy: bs.ncl_borrowings, py: bs.ncl_borrowings_py, indent: 1 },
    { label: "Employee Benefit Liabilities", note: "3.12", cy: bs.ncl_employeeBenefits, py: bs.ncl_employeeBenefits_py, indent: 1 },
    { label: "Provisions", cy: bs.ncl_provisions, py: bs.ncl_provisions_py, indent: 1 },
    { label: "Total Non-Current Liabilities", cy: bs.totalNonCurrentLiabilities, py: bs.totalNonCurrentLiabilities_py, isSubTotal: true },
    { label: "E.  CURRENT LIABILITIES", isSectionHeader: true },
    { label: "Loans and Borrowings", note: "3.11", cy: bs.cl_borrowings, py: bs.cl_borrowings_py, indent: 1 },
    { label: "Trade and Other Payables", note: "3.13", cy: bs.cl_tradePayables, py: bs.cl_tradePayables_py, indent: 1 },
    { label: "Income Tax Liability", cy: bs.cl_incomeTaxPayable, py: bs.cl_incomeTaxPayable_py, indent: 1 },
    { label: "Employee Benefit Liability", note: "3.12", cy: bs.cl_provisions, py: bs.cl_provisions_py, indent: 1 },
    { label: "Other Current Liabilities", cy: bs.cl_other, py: bs.cl_other_py, indent: 1 },
    { label: "Total Current Liabilities", cy: bs.totalCurrentLiabilities, py: bs.totalCurrentLiabilities_py, isSubTotal: true },
    { label: "TOTAL EQUITY AND LIABILITIES", cy: bs.totalEquityAndLiabilities, py: bs.totalEquityAndLiabilities_py, isTotal: true }
  ];
  const bsRowMap = {
    ppeRow: 0,
    ncaInvestmentsRow: 0,
    ncaReceivablesRow: 0,
    ncaOtherRow: 0,
    totalNcaRow: 0,
    caInvestmentsRow: 0,
    inventoriesRow: 0,
    receivablesRow: 0,
    cashRow: 0,
    caOtherRow: 0,
    totalCaRow: 0,
    totalAssetsRow: 0,
    shareCapitalRow: 0,
    reservesRow: 0,
    retainedEarningsRow: 0,
    totalEquityRow: 0,
    ncBorrowingsRow: 0,
    totalNclRow: 0,
    cBorrowingsRow: 0,
    taxPayableRow: 0,
    totalClRow: 0,
    totalLiabilitiesEquityRow: 0
  };
  let bsSection = "";
  rows.forEach((r) => {
    if (r.isSectionHeader) bsSection = r.label;
    if (r.label === "Property, Plant and Equipment") bsRowMap.ppeRow = row;
    if (r.label === "Investments" && bsSection === "A.  NON-CURRENT ASSETS") bsRowMap.ncaInvestmentsRow = row;
    if (r.label === "Other Receivables (Non-current)") bsRowMap.ncaReceivablesRow = row;
    if (r.label === "Other Non-Current Assets") bsRowMap.ncaOtherRow = row;
    if (r.label === "Total Non-Current Assets") bsRowMap.totalNcaRow = row;
    if (r.label === "Investments (Current)") bsRowMap.caInvestmentsRow = row;
    if (r.label === "Inventories") bsRowMap.inventoriesRow = row;
    if (r.label === "Trade and Other Receivables") bsRowMap.receivablesRow = row;
    if (r.label === "Cash and Cash Equivalents") bsRowMap.cashRow = row;
    if (r.label === "Other Current Assets") bsRowMap.caOtherRow = row;
    if (r.label === "Total Current Assets") bsRowMap.totalCaRow = row;
    if (r.label === "Share Capital") bsRowMap.shareCapitalRow = row;
    if (r.label === "Reserves") bsRowMap.reservesRow = row;
    if (r.label === "Retained Earnings") bsRowMap.retainedEarningsRow = row;
    if (r.label === "Total Equity") bsRowMap.totalEquityRow = row;
    if (r.label === "Loans and Borrowings" && bsSection === "D.  NON-CURRENT LIABILITIES") bsRowMap.ncBorrowingsRow = row;
    if (r.label === "Total Non-Current Liabilities") bsRowMap.totalNclRow = row;
    if (r.label === "Loans and Borrowings" && bsSection === "E.  CURRENT LIABILITIES") bsRowMap.cBorrowingsRow = row;
    if (r.label === "Income Tax Liability") bsRowMap.taxPayableRow = row;
    if (r.label === "Total Current Liabilities") bsRowMap.totalClRow = row;
    if (r.label === "TOTAL ASSETS") bsRowMap.totalAssetsRow = row;
    if (r.label === "TOTAL EQUITY AND LIABILITIES") bsRowMap.totalLiabilitiesEquityRow = row;
    writeAmountRow(ws, row, r);
    row++;
  });
  const applyBsSumFormula = (targetRow, fromRow, toRow, col = "C") => {
    if (!targetRow || !fromRow || !toRow) return;
    const cell = ws.getRow(targetRow).getCell(col);
    cell.value = fromRow === toRow ? { formula: `${col}${fromRow}`, result: cell.value ?? 0 } : { formula: `SUM(${col}${fromRow}:${col}${toRow})`, result: cell.value ?? 0 };
    cell.numFmt = NUMBER_FORMAT2;
    applyTotalStyle(cell);
  };
  if (bsRowMap.totalNcaRow && bsRowMap.ppeRow && bsRowMap.ncaOtherRow) {
    applyBsSumFormula(bsRowMap.totalNcaRow, bsRowMap.ppeRow, bsRowMap.ncaOtherRow, "C");
    applyBsSumFormula(bsRowMap.totalNcaRow, bsRowMap.ppeRow, bsRowMap.ncaOtherRow, "D");
  }
  if (bsRowMap.totalCaRow && bsRowMap.caInvestmentsRow && bsRowMap.caOtherRow) {
    applyBsSumFormula(bsRowMap.totalCaRow, bsRowMap.caInvestmentsRow, bsRowMap.caOtherRow, "C");
    applyBsSumFormula(bsRowMap.totalCaRow, bsRowMap.caInvestmentsRow, bsRowMap.caOtherRow, "D");
  }
  if (bsRowMap.totalEquityRow && bsRowMap.shareCapitalRow && bsRowMap.retainedEarningsRow) {
    applyBsSumFormula(bsRowMap.totalEquityRow, bsRowMap.shareCapitalRow, bsRowMap.retainedEarningsRow, "C");
    applyBsSumFormula(bsRowMap.totalEquityRow, bsRowMap.shareCapitalRow, bsRowMap.retainedEarningsRow, "D");
  }
  const checkCell = ws.getRow(row).getCell(3);
  checkCell.value = { formula: `=C${row - rows.length + rows.findIndex((r) => r.isTotal && r.label.includes("TOTAL ASSETS")) + 6}-C${row - 1}` };
  checkCell.numFmt = NUMBER_FORMAT2;
  ws.getRow(row).getCell(1).value = "Balance Check (must be zero):";
  ws.getRow(row).getCell(1).font = { name: "Arial", size: 9, italic: true };
  row++;
  writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? "",
    fiscalYear: company.fiscalYear?.bsFY ?? "",
    roundingLevel: 100
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = {
    oddHeader: `&C${company.companyName ?? ""}`,
    oddFooter: "&CPage &P of &N"
  };
  return bsRowMap;
}
function writeIncomeStatement(ws, is, company) {
  ws.columns = [{ width: 42 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? "";
  const [startBS, endBS] = fy.split("/").map((y) => y.trim());
  let row = writeStatementHeader(
    ws,
    company.companyName ?? "",
    "STATEMENT OF INCOME",
    `For the Year Ended 31 Ashadh ${endBS ?? ""}`,
    fy,
    `${startBS ?? ""}-${(Number(startBS) - 1).toString().slice(-2)}/${startBS}`
  );
  const rows = [
    { label: "INCOME", isSectionHeader: true },
    { label: "Revenue from Operations", note: "3.17", cy: is.revenue, py: is.revenue_py, indent: 1 },
    { label: "Interest Income", cy: is.interestIncome, py: is.interestIncome_py, indent: 1 },
    { label: "Other Income", cy: is.otherIncome, py: is.otherIncome_py, indent: 1 },
    { label: "Total Income", cy: is.totalIncome, py: is.totalIncome_py, isSubTotal: true },
    { label: "EXPENSES", isSectionHeader: true },
    { label: "Material Consumed", note: "3.18", cy: is.materialConsumed, py: is.materialConsumed_py, indent: 1 },
    { label: "Direct Expenses", note: "3.19", cy: is.directExpenses, py: is.directExpenses_py, indent: 1 },
    { label: "Employee Benefit Expenses", note: "3.20", cy: is.employeeBenefitExpense, py: is.employeeBenefitExpense_py, indent: 1 },
    { label: "Finance Costs", cy: is.financeCharges, py: is.financeCharges_py, indent: 1 },
    { label: "Depreciation", note: "3.1", cy: is.depreciation, py: is.depreciation_py, indent: 1 },
    { label: "Impairment Losses", note: "3.21", cy: is.impairment, py: is.impairment_py, indent: 1 },
    { label: "Administrative & Other Exp", note: "3.22", cy: is.adminAndOtherExpenses, py: is.adminAndOtherExpenses_py, indent: 1 },
    { label: "Total Expenses", cy: is.totalExpenses, py: is.totalExpenses_py, isSubTotal: true },
    { label: "Profit/(Loss) before Staff Bonus", cy: is.profitBeforeStaffBonus, py: is.profitBeforeStaffBonus_py, isSubTotal: true },
    { label: "Less: Staff Bonus", cy: is.staffBonus, py: is.staffBonus_py, indent: 1 },
    { label: "Profit/(Loss) before Tax", cy: is.profitBeforeTax, py: is.profitBeforeTax_py, isSubTotal: true },
    { label: "Less: Income Tax Expense", note: "3.23", cy: is.incomeTaxExpense, py: is.incomeTaxExpense_py, indent: 1 },
    { label: "Net Profit/(Loss) for the Year", cy: is.netProfit, py: is.netProfit_py, isTotal: true }
  ];
  const isRowMap = {
    revenueRow: 0,
    empExpenseRow: 0,
    adminExpenseRow: 0,
    depreciationRow: 0,
    taxRow: 0,
    profitBeforeTaxRow: 0,
    netProfitRow: 0,
    totalIncomeRow: 0,
    totalExpensesRow: 0
  };
  const incomeDetailRows = [];
  const expenseDetailRows = [];
  let isSection = "";
  rows.forEach((r) => {
    if (r.label === "INCOME") isSection = "income";
    if (r.label === "EXPENSES") isSection = "expense";
    if (r.label === "Total Income") isSection = "";
    if (r.label === "Total Expenses") isSection = "";
    if (r.label === "Revenue from Operations") isRowMap.revenueRow = row;
    if (r.label === "Employee Benefit Expenses") isRowMap.empExpenseRow = row;
    if (r.label === "Administrative & Other Exp") isRowMap.adminExpenseRow = row;
    if (r.label === "Depreciation") isRowMap.depreciationRow = row;
    if (r.label === "Profit/(Loss) before Tax") isRowMap.profitBeforeTaxRow = row;
    if (r.label === "Less: Income Tax Expense") isRowMap.taxRow = row;
    if (r.label === "Net Profit/(Loss) for the Year") isRowMap.netProfitRow = row;
    if (r.label === "Total Income") isRowMap.totalIncomeRow = row;
    if (r.label === "Total Expenses") isRowMap.totalExpensesRow = row;
    if (isSection === "income" && !r.isSectionHeader && !r.isSubTotal) incomeDetailRows.push(row);
    if (isSection === "expense" && !r.isSectionHeader && !r.isSubTotal) expenseDetailRows.push(row);
    writeAmountRow(ws, row, r);
    row++;
  });
  const applySumFormula = (targetRow, detailRows, col = "C") => {
    if (!targetRow || detailRows.length === 0) return;
    const cell = ws.getRow(targetRow).getCell(col);
    if (detailRows.length === 1) {
      cell.value = { formula: `${col}${detailRows[0]}`, result: cell.value ?? 0 };
    } else {
      cell.value = {
        formula: `SUM(${col}${detailRows[0]}:${col}${detailRows[detailRows.length - 1]})`,
        result: cell.value ?? 0
      };
    }
    cell.numFmt = NUMBER_FORMAT2;
    applyTotalStyle(cell);
  };
  applySumFormula(isRowMap.totalIncomeRow, incomeDetailRows, "C");
  applySumFormula(isRowMap.totalIncomeRow, incomeDetailRows, "D");
  applySumFormula(isRowMap.totalExpensesRow, expenseDetailRows, "C");
  applySumFormula(isRowMap.totalExpensesRow, expenseDetailRows, "D");
  if (isRowMap.profitBeforeTaxRow && isRowMap.totalIncomeRow && isRowMap.totalExpensesRow) {
    const pbtCell = ws.getRow(isRowMap.profitBeforeTaxRow).getCell("C");
    pbtCell.value = {
      formula: `C${isRowMap.totalIncomeRow}-C${isRowMap.totalExpensesRow}`,
      result: pbtCell.value ?? 0
    };
    pbtCell.numFmt = NUMBER_FORMAT2;
    applyTotalStyle(pbtCell);
  }
  if (isRowMap.netProfitRow && isRowMap.profitBeforeTaxRow && isRowMap.taxRow) {
    const npCell = ws.getRow(isRowMap.netProfitRow).getCell("C");
    npCell.value = {
      formula: `C${isRowMap.profitBeforeTaxRow}-C${isRowMap.taxRow}`,
      result: npCell.value ?? 0
    };
    npCell.numFmt = NUMBER_FORMAT2;
    applyTotalStyle(npCell);
  }
  writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? "",
    fiscalYear: company.fiscalYear?.bsFY ?? "",
    roundingLevel: 100
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = { oddHeader: `&C${company.companyName ?? ""}`, oddFooter: "&CPage &P of &N" };
  return isRowMap;
}
function writeCashFlowStatement(ws, cf, company) {
  ws.columns = [{ width: 50 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? "";
  const [, endBS] = fy.split("/").map((y) => y.trim());
  let row = writeStatementHeader(ws, company.companyName ?? "", "STATEMENT OF CASH FLOWS (Indirect Method)", `For the Year Ended 31 Ashadh ${endBS ?? ""}`, fy, "");
  const cfRowMap = {
    profitBeforeTaxRow: 0,
    openingCashRow: 0,
    closingCashRow: 0,
    netOperatingRow: 0,
    netInvestingRow: 0,
    netFinancingRow: 0
  };
  const rows = [
    { label: "A.  CASH FLOWS FROM OPERATING ACTIVITIES", isSectionHeader: true },
    { label: "Profit Before Tax", cy: cf.profitBeforeTax, py: 0, indent: 1 },
    { label: "Adjustments for:", cy: 0, py: 0, indent: 1 },
    { label: "Depreciation", cy: cf.addDepreciation, py: 0, indent: 2 },
    { label: "Impairment Losses", cy: cf.addImpairment, py: 0, indent: 2 },
    { label: "Interest Income", cy: cf.lessInterestIncome, py: 0, indent: 2 },
    { label: "Dividend Income", cy: cf.lessDividendIncome, py: 0, indent: 2 },
    { label: "Interest Expense", cy: cf.addInterestExpense, py: 0, indent: 2 },
    { label: "Loss/(Gain) on Disposal of Assets", cy: cf.addLossOnDisposal + cf.lessGainOnDisposal, py: 0, indent: 2 },
    { label: "FV Loss/(Gain) on Investments", cy: cf.addFVLossOnInvestment + cf.lessFVGainOnInvestment, py: 0, indent: 2 },
    { label: "Changes in Working Capital:", cy: 0, py: 0, indent: 1 },
    { label: "(Increase)/Decrease in Receivables", cy: cf.decreaseIncreaseReceivables, py: 0, indent: 2 },
    { label: "(Increase)/Decrease in Inventories", cy: cf.decreaseIncreaseInventory, py: 0, indent: 2 },
    { label: "(Increase)/Decrease in Other Current Assets", cy: cf.decreaseIncreaseOtherCurrentAssets, py: 0, indent: 2 },
    { label: "Increase/(Decrease) in Payables", cy: cf.increaseDecreasePayables, py: 0, indent: 2 },
    { label: "Increase/(Decrease) in Tax Payable", cy: cf.increaseDecreaseIncomeTaxPayable, py: 0, indent: 2 },
    { label: "Increase/(Decrease) in Employee Liabilities", cy: cf.increaseDecreaseEmployeeLiability, py: 0, indent: 2 },
    { label: "Cash Generated from Operations", cy: cf.cashGeneratedFromOperations, py: 0, isSubTotal: true },
    { label: "Interest Paid", cy: cf.interestPaid, py: 0, indent: 1 },
    { label: "Income Tax Paid", cy: cf.incomeTaxPaid, py: 0, indent: 1 },
    { label: "Net Cash from Operating Activities", cy: cf.netCashFromOperating, py: 0, isSubTotal: true },
    { label: "B.  CASH FLOWS FROM INVESTING ACTIVITIES", isSectionHeader: true },
    { label: "Proceeds from Disposal of PPE", cy: cf.proceedsFromPPEDisposal, py: 0, indent: 1 },
    { label: "Interest Received", cy: cf.interestReceived, py: 0, indent: 1 },
    { label: "Dividends Received", cy: cf.dividendReceived, py: 0, indent: 1 },
    { label: "Purchase of PPE", cy: cf.purchaseOfPPE, py: 0, indent: 1 },
    { label: "Purchase of Investments", cy: cf.purchaseOfInvestments, py: 0, indent: 1 },
    { label: "Net Cash from Investing Activities", cy: cf.netCashFromInvesting, py: 0, isSubTotal: true },
    { label: "C.  CASH FLOWS FROM FINANCING ACTIVITIES", isSectionHeader: true },
    { label: "Proceeds from Issue of Shares", cy: cf.proceedsFromShareIssue, py: 0, indent: 1 },
    { label: "Proceeds from Non-Current Borrowings", cy: cf.proceedsFromBorrowingsNonCurrent, py: 0, indent: 1 },
    { label: "Repayment of Non-Current Borrowings", cy: cf.repaymentOfBorrowingsNonCurrent, py: 0, indent: 1 },
    { label: "Proceeds from Current Borrowings", cy: cf.proceedsFromBorrowingsCurrent, py: 0, indent: 1 },
    { label: "Repayment of Current Borrowings", cy: cf.repaymentOfBorrowingsCurrent, py: 0, indent: 1 },
    { label: "Dividends Paid", cy: cf.dividendPaid, py: 0, indent: 1 },
    { label: "Net Cash from Financing Activities", cy: cf.netCashFromFinancing, py: 0, isSubTotal: true },
    { label: "NET INCREASE/(DECREASE) IN CASH", cy: cf.netIncreaseDecrease, py: 0, isTotal: true },
    { label: "Cash and Equivalents at Beginning of Year", cy: cf.openingCash, py: 0, indent: 1 },
    { label: "Cash and Equivalents at End of Year", cy: cf.closingCash, py: 0, isSubTotal: true },
    { label: "Reconciliation Difference (should be zero)", cy: cf.reconciliationDifference, py: 0, indent: 1 }
  ];
  rows.forEach((r) => {
    if (r.label === "Profit Before Tax") cfRowMap.profitBeforeTaxRow = row;
    if (r.label === "Net Cash from Operating Activities") cfRowMap.netOperatingRow = row;
    if (r.label === "Net Cash from Investing Activities") cfRowMap.netInvestingRow = row;
    if (r.label === "Net Cash from Financing Activities") cfRowMap.netFinancingRow = row;
    if (r.label === "Cash and Equivalents at Beginning of Year") cfRowMap.openingCashRow = row;
    if (r.label === "Cash and Equivalents at End of Year") cfRowMap.closingCashRow = row;
    writeAmountRow(ws, row, r);
    row++;
  });
  writeSignatureLine(ws, row + 1, company);
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 };
  return cfRowMap;
}
function writeChangesInEquity(ws, ce, company) {
  ws.columns = [{ width: 36 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? "";
  const [, endBS] = fy.split("/").map((y) => y.trim());
  ws.mergeCells("A1:F1");
  const r1 = ws.getCell("A1");
  r1.value = (company.companyName ?? "").toUpperCase();
  r1.alignment = { horizontal: "center" };
  applyHeaderStyle2(r1);
  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = "STATEMENT OF CHANGES IN EQUITY";
  ws.getCell("A2").font = { name: "Arial", size: 12, bold: true };
  ws.getCell("A2").alignment = { horizontal: "center" };
  ws.mergeCells("A3:F3");
  ws.getCell("A3").value = `For the Year Ended 31 Ashadh ${endBS ?? ""}`;
  ws.getCell("A3").font = { name: "Arial", size: 10, italic: true };
  ws.getCell("A3").alignment = { horizontal: "center" };
  const hRow = ws.getRow(5);
  ["Particulars", "Share Capital", "Share Premium", "General Reserve", "Retained Earnings", "Total"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    c.alignment = { horizontal: i === 0 ? "left" : "center" };
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
  });
  const ceRows = [
    ["Opening Balance (1 Shrawan)", ce.cyOpeningShareCapital ?? 0, ce.cyOpeningSharePremium ?? 0, ce.cyOpeningGeneralReserve ?? 0, ce.cyOpeningRetainedEarnings ?? 0, ce.cyOpeningTotal ?? 0],
    ["Profit for the Year", 0, 0, 0, ce.cyNetProfit ?? 0, ce.cyNetProfit ?? 0],
    ["Issue of Share Capital", ce.cyShareCapitalIssued ?? 0, ce.cySharePremiumReceived ?? 0, 0, 0, (ce.cyShareCapitalIssued ?? 0) + (ce.cySharePremiumReceived ?? 0)],
    ["Transfer to General Reserve", 0, 0, ce.cyTransferToReserve ?? 0, -(ce.cyTransferToReserve ?? 0), 0],
    ["Dividends Paid", 0, 0, 0, -(ce.cyDividends ?? 0), -(ce.cyDividends ?? 0)],
    ["Closing Balance (31 Ashadh)", ce.cyClosingShareCapital ?? 0, ce.cyClosingSharePremium ?? 0, ce.cyClosingGeneralReserve ?? 0, ce.cyClosingRetainedEarnings ?? 0, ce.cyClosingTotal ?? 0]
  ];
  const ceRowMap = { profitForYearRow: 0 };
  ceRows.forEach(([label, sc, sp, gr, re, total], idx) => {
    const rowNum = 6 + idx;
    if (label === "Profit for the Year") ceRowMap.profitForYearRow = rowNum;
    const r = ws.getRow(rowNum);
    [label, sc, sp, gr, re, total].forEach((val, ci) => {
      const cell = r.getCell(ci + 1);
      if (ci === 0) {
        cell.value = val;
      } else {
        cell.value = val || null;
        cell.numFmt = NUMBER_FORMAT2;
        cell.alignment = { horizontal: "right" };
      }
      applyAllBorders(cell);
      if (idx === ceRows.length - 1) {
        cell.font = FONTS.TOTAL;
        applyHeaderFill(cell, COLORS.TOTAL_BG);
      }
    });
    r.height = 15;
  });
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 };
  return ceRowMap;
}
function writeNote31_PPE(ws, depnSummary) {
  writeNoteSheetTitle(ws, "3.1  Property, Plant and Equipment");
  const categories = depnSummary.map((d) => d.categoryName);
  const headers = ["Particulars", ...categories, "Total"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.alignment = { horizontal: i === 0 ? "left" : "center" };
    applySubHeaderStyle2(c);
    applyAllBorders(c);
  });
  const costRows = [
    ["Balance at Beginning of Year", (d) => d.openingCost],
    ["Additions during the Year", (d) => d.additions],
    ["Disposals during the Year", (d) => -d.disposals],
    ["Balance at End of Year", (d) => d.closingCost]
  ];
  let r = 4;
  ws.getRow(r).getCell(1).value = "COST";
  ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
  r++;
  costRows.forEach(([label, fn]) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = "  " + label;
    let total = 0;
    depnSummary.forEach((d, i) => {
      const v = fn(d);
      row.getCell(i + 2).value = v || null;
      row.getCell(i + 2).numFmt = NUMBER_FORMAT2;
      row.getCell(i + 2).alignment = { horizontal: "right" };
      total += v;
    });
    row.getCell(depnSummary.length + 2).value = total || null;
    row.getCell(depnSummary.length + 2).numFmt = NUMBER_FORMAT2;
    row.getCell(depnSummary.length + 2).alignment = { horizontal: "right" };
    row.height = 15;
  });
  ws.getRow(r).getCell(1).value = "ACCUMULATED DEPRECIATION";
  ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
  r++;
  const depnRows = [
    ["Balance at Beginning of Year", (d) => d.openingAccumDepn],
    ["Charge for the Year", (d) => d.depnForYear],
    ["Impairment Losses", (d) => d.impairmentLosses ?? 0],
    ["On Disposals", (d) => -d.depnOnDisposal],
    ["Balance at End of Year", (d) => d.closingAccumDepn]
  ];
  depnRows.forEach(([label, fn]) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = "  " + label;
    let total = 0;
    depnSummary.forEach((d, i) => {
      const v = fn(d);
      row.getCell(i + 2).value = v || null;
      row.getCell(i + 2).numFmt = NUMBER_FORMAT2;
      row.getCell(i + 2).alignment = { horizontal: "right" };
      total += v;
    });
    row.getCell(depnSummary.length + 2).value = total || null;
    row.getCell(depnSummary.length + 2).numFmt = NUMBER_FORMAT2;
    row.getCell(depnSummary.length + 2).alignment = { horizontal: "right" };
    row.height = 15;
  });
  SHEET_ROW_REGISTRY.ppeDepreciationRow = r - depnRows.length + depnRows.findIndex(([label]) => label === "Charge for the Year");
  ws.getRow(r).getCell(1).value = "NET BOOK VALUE";
  ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
  r++;
  const nbvRows = [
    ["At Beginning of Year", (d) => d.openingCost - d.openingAccumDepn],
    ["At End of Year", (d) => d.netBookValueClosing]
  ];
  nbvRows.forEach(([label, fn]) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = "  " + label;
    row.getCell(1).font = FONTS.TOTAL;
    let total = 0;
    depnSummary.forEach((d, i) => {
      const v = fn(d);
      const c = row.getCell(i + 2);
      c.value = v || null;
      c.numFmt = NUMBER_FORMAT2;
      c.alignment = { horizontal: "right" };
      c.font = FONTS.TOTAL;
      applyHeaderFill(c, COLORS.TOTAL_BG);
      total += v;
    });
    const tc = row.getCell(depnSummary.length + 2);
    tc.value = total || null;
    tc.numFmt = NUMBER_FORMAT2;
    tc.alignment = { horizontal: "right" };
    tc.font = FONTS.TOTAL;
    applyHeaderFill(tc, COLORS.TOTAL_BG);
    row.height = 15;
  });
  SHEET_ROW_REGISTRY.ppeNetBookValueRow = r - 1;
  const totalSecured = depnSummary.reduce((s, d) => s + (d.securedAmount ?? 0), 0);
  const hasCwip = depnSummary.some(
    (d) => d.categoryId === "under_construction" || /under construction|cwip/i.test(d.categoryName)
  ) && depnSummary.some((d) => d.closingCost > 0 && /under construction|cwip/i.test(d.categoryName));
  if (totalSecured > 0 || hasCwip) {
    r += 1;
    ws.getRow(r).getCell(1).value = "DISCLOSURES";
    ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
    r += 1;
  }
  if (totalSecured > 0) {
    const securedClasses = depnSummary.filter((d) => d.hasSecuredAssets).map((d) => `${d.categoryName}: NPR ${(d.securedAmount ?? 0).toLocaleString("en-IN")}`).join("; ");
    const secRow = ws.getRow(r++);
    secRow.getCell(1).value = `Security (if any): The following PPE classes are pledged as security for borrowings \u2014 ${securedClasses}. Total secured carrying amount: NPR ${totalSecured.toLocaleString("en-IN")}.`;
    secRow.getCell(1).font = { name: "Arial", size: 9, italic: true };
    ws.mergeCells(r - 1, 1, r - 1, depnSummary.length + 2);
  }
  if (hasCwip) {
    const cwipRow = ws.getRow(r++);
    cwipRow.getCell(1).value = "PPE under construction: Assets under construction are carried at cost and are not depreciated until available for use, in accordance with NAS for MEs.";
    cwipRow.getCell(1).font = { name: "Arial", size: 9, italic: true };
    ws.mergeCells(r - 1, 1, r - 1, depnSummary.length + 2);
  }
  return {
    ppeNetBookValueRow: r - 1,
    ppeDepreciationRow: SHEET_ROW_REGISTRY.ppeDepreciationRow
  };
}
function writeNote37_Inventories(ws, note37) {
  writeNoteSheetTitle(ws, "3.7  Inventories");
  const headers = ["Particulars", "Current Year", "Previous Year"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle2(c);
    applyAllBorders(c);
  });
  const rows = [
    ["Raw Materials and Consumables", note37.rawMaterials_cy, note37.rawMaterials_py],
    ["Work in Progress", note37.wip_cy, note37.wip_py],
    ["Finished Goods and Goods for Resale", note37.finishedGoods_cy, note37.finishedGoods_py],
    ["Total", note37.totalInventory_cy, note37.totalInventory_py]
  ];
  rows.forEach(([label, cy, py], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = label;
    if (i === rows.length - 1) {
      r.getCell(1).font = FONTS.TOTAL;
    }
    [cy, py].forEach((v, ci) => {
      const c = r.getCell(ci + 2);
      c.value = v || null;
      c.numFmt = NUMBER_FORMAT2;
      c.alignment = { horizontal: "right" };
      if (i === rows.length - 1) {
        c.font = FONTS.TOTAL;
        applyHeaderFill(c, COLORS.TOTAL_BG);
      }
      applyAllBorders(c);
    });
  });
  SHEET_ROW_REGISTRY.inventoryTotalRow = 4 + rows.length - 1;
  return { inventoryTotalRow: SHEET_ROW_REGISTRY.inventoryTotalRow };
}
function writeNote38_Cash(ws, note38) {
  writeNoteSheetTitle(ws, "3.8  Cash and Cash Equivalents");
  const hRow = ws.getRow(3);
  ["Particulars", "Current Year", "Previous Year"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle2(c);
    applyAllBorders(c);
  });
  let r = 4;
  const cashRow = ws.getRow(r++);
  cashRow.getCell(1).value = "Cash in Hand";
  cashRow.getCell(2).value = note38.cashInHand_cy || null;
  cashRow.getCell(2).numFmt = NUMBER_FORMAT2;
  cashRow.getCell(2).alignment = { horizontal: "right" };
  note38.bankBalances?.forEach((b) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = b.bankName;
    row.getCell(2).value = b.cy || null;
    row.getCell(2).numFmt = NUMBER_FORMAT2;
    row.getCell(2).alignment = { horizontal: "right" };
  });
  const totRow = ws.getRow(r);
  totRow.getCell(1).value = "Total Cash and Equivalents";
  totRow.getCell(1).font = FONTS.TOTAL;
  totRow.getCell(2).value = note38.totalCash_cy || null;
  totRow.getCell(2).numFmt = NUMBER_FORMAT2;
  totRow.getCell(2).alignment = { horizontal: "right" };
  totRow.getCell(2).font = FONTS.TOTAL;
  applyHeaderFill(totRow.getCell(2), COLORS.TOTAL_BG);
  SHEET_ROW_REGISTRY.cashTotalRow = r;
  return { cashTotalRow: r };
}
function writeNote39_ShareCapital(ws, note39) {
  writeNoteSheetTitle(ws, "3.9  Share Capital");
  const n39 = note39;
  const ordinary = n39.ordinaryShares;
  const rows = ordinary ? [
    ["Authorised Share Capital (shares)", ordinary.authorizedShares ?? 0],
    ["Issued and Fully Paid Shares (shares)", ordinary.closingIssuedShares ?? 0],
    ["Paid-up Capital (NPR)", ordinary.closingPaidUp ?? 0]
  ] : [
    ["Authorised Share Capital (shares)", n39.authorizedShares ?? 0],
    ["Issued and Fully Paid Shares (shares)", n39.issuedShares ?? 0],
    ["Paid-up Capital (NPR)", n39.paidUpAmount_cy ?? 0]
  ];
  rows.forEach(([label, val], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = label;
    r.getCell(2).value = val || null;
    r.getCell(2).numFmt = NUMBER_FORMAT2;
    r.getCell(2).alignment = { horizontal: "right" };
  });
  SHEET_ROW_REGISTRY.shareCapitalRow = 3 + rows.length - 1;
  return { shareCapitalRow: SHEET_ROW_REGISTRY.shareCapitalRow };
}
function writeNote311_Borrowings(ws, note311) {
  writeNoteSheetTitle(ws, "3.11  Loans and Borrowings");
  ws.getRow(2).getCell(1).value = "Non-Current Borrowings";
  applySubHeaderStyle2(ws.getRow(2).getCell(1));
  const hRow = ws.getRow(3);
  ["Lender", "Interest Rate %", "Security", "Current Year", "Previous Year"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
  });
  let r = 4;
  const n311 = note311;
  const nonCurrent = n311.nonCurrentBank ?? n311.nonCurrent ?? [];
  nonCurrent.forEach((b) => {
    const row = ws.getRow(r++);
    [b.lenderName, `${b.interestRate ?? 0}%`, b.security ?? "", b.amount_cy ?? b.balance_cy, b.amount_py ?? b.balance_py].forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v || null;
      if (i >= 3) {
        c.numFmt = NUMBER_FORMAT2;
        c.alignment = { horizontal: "right" };
      }
    });
  });
  SHEET_ROW_REGISTRY.ncBorrowingsRow = r - 1;
  r++;
  ws.getRow(r).getCell(1).value = "Current Borrowings";
  ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
  r++;
  const currentLoans = n311.currentLoans ?? n311.current ?? [];
  currentLoans.forEach((b) => {
    const row = ws.getRow(r++);
    [b.lenderName, b.loanType ?? b.type, "", b.amount_cy ?? b.balance_cy, b.amount_py ?? b.balance_py].forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v || null;
      if (i >= 3) {
        c.numFmt = NUMBER_FORMAT2;
        c.alignment = { horizontal: "right" };
      }
    });
  });
  SHEET_ROW_REGISTRY.cBorrowingsRow = r - 1;
  return {
    ncBorrowingsRow: SHEET_ROW_REGISTRY.ncBorrowingsRow,
    cBorrowingsRow: SHEET_ROW_REGISTRY.cBorrowingsRow
  };
}
function writeNote323_Tax(ws, note323, taxCalcSheetName, taxCalcNetPayableRow) {
  writeNoteSheetTitle(ws, "3.23  Income Tax");
  const items = [
    ["Profit Before Tax (per Income Statement)", note323.profitBeforeTax, false],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v, false]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, -v, false]),
    ["Taxable Income", note323.taxableIncome, false],
    [`Income Tax at ${(note323.taxRate * 100).toFixed(0)}%`, note323.currentTax, false],
    ["Less: Advance Tax / TDS Credit", -note323.advanceTaxPaid, false],
    ["Net Tax Payable", null, true]
  ];
  const netRow = 3 + items.length - 1;
  items.forEach(([label, val], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = label;
    applyBodyStyle(r.getCell(1));
    const amountCell = r.getCell(2);
    if (items[i][2] && taxCalcSheetName && taxCalcNetPayableRow) {
      amountCell.value = { formula: cellRef(taxCalcSheetName, "D", taxCalcNetPayableRow).replace(/^=/, ""), result: note323.netTaxPayable };
    } else {
      amountCell.value = val || null;
    }
    amountCell.numFmt = NUMBER_FORMAT2;
    amountCell.alignment = { horizontal: "right" };
    applyBodyStyle(amountCell);
  });
  SHEET_ROW_REGISTRY.taxPayableRow = netRow;
  return { taxPayableRow: netRow, note314_incomeTaxRow: netRow };
}
function writePPEWorkingsSheet(ws, assets, fiscalYear, depreciationResults = []) {
  writeNoteSheetTitle(ws, "PPE Workings");
  const headers = [
    "Name of Asset",
    "Purchase Date (AD serial)",
    "Cost",
    "Addition",
    "Deletion",
    "Balance",
    "Sales Value",
    "Date of Sales",
    "Useful Life (yrs)",
    "Days (pro-rata)",
    "Accum Depn opening",
    "Depn for year",
    "Depn on deletion",
    "Accum Depn closing",
    "Closing WDV",
    "Opening WDV",
    "WDV on disposal date",
    "Profit/(Loss) on disposal"
  ];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 32 : 14;
  });
  const depnByAsset = /* @__PURE__ */ new Map();
  for (const r of depreciationResults) {
    const ext = r;
    const key = String(r.assetId ?? ext.id ?? "");
    if (key) depnByAsset.set(key, ext);
  }
  let row = 4;
  const allAssetRows = [];
  for (const className of PPE_WORKINGS_CLASSES) {
    const classAssets = assets.filter((a) => mapToPPEWorkingsClass(a.categoryId) === className);
    if (classAssets.length === 0) continue;
    const classHeader = ws.getRow(row++);
    classHeader.getCell(1).value = className;
    classHeader.getCell(1).font = { name: "Arial", size: 10, bold: true, italic: true };
    ws.mergeCells(row - 1, 1, row - 1, headers.length);
    const firstAssetRow = row;
    for (const asset of classAssets) {
      const depn = depnByAsset.get(asset.id);
      const extDepn = depn;
      const cost = asset.originalCost ?? 0;
      const addition = asset.additionalCost ?? 0;
      const deletion = asset.disposed ? cost + addition : 0;
      const balance = cost + addition - deletion;
      const salesValue = asset.disposed ? asset.disposalValue ?? 0 : 0;
      const accumOpen = asset.accumDepreciationOpening ?? extDepn?.accumulatedDepnPY ?? 0;
      const depnYear = extDepn?.depnForYear ?? extDepn?.depreciationCY ?? 0;
      const depnDeletion = asset.disposed ? extDepn?.depnOnDisposal ?? 0 : 0;
      const accumClose = accumOpen + depnYear - depnDeletion;
      const openingWdv = cost - accumOpen;
      const closingWdv = balance - accumClose;
      const wdvOnDisposal = asset.disposed ? closingWdv : 0;
      const gainLoss = extDepn?.gainLossOnDisposal ?? (asset.disposed ? salesValue - wdvOnDisposal : 0);
      const purchaseSerial = approximateBsDateToSerial(asset.purchaseDateBS, fiscalYear);
      const disposalSerial = asset.disposalDateBS ? approximateBsDateToSerial(asset.disposalDateBS, fiscalYear) : null;
      const r = ws.getRow(row++);
      r.getCell(1).value = asset.assetName;
      const purchaseCell = r.getCell(2);
      purchaseCell.value = purchaseSerial;
      applyGreenInput(purchaseCell);
      if (purchaseSerial) purchaseCell.numFmt = "0";
      setAmountCell(r.getCell(3), cost);
      setAmountCell(r.getCell(4), addition || null);
      setAmountCell(r.getCell(5), deletion || null);
      r.getCell(6).value = { formula: `C${row - 1}+D${row - 1}-E${row - 1}`, result: balance };
      r.getCell(6).numFmt = NUMBER_FORMAT2;
      r.getCell(6).alignment = { horizontal: "right" };
      setAmountCell(r.getCell(7), salesValue || null);
      if (asset.disposed && disposalSerial) {
        r.getCell(8).value = disposalSerial;
        r.getCell(8).numFmt = "0";
      }
      const lifeCell = r.getCell(9);
      lifeCell.value = asset.usefulLifeYears || null;
      applyGreenInput(lifeCell);
      lifeCell.alignment = { horizontal: "right" };
      setAmountCell(r.getCell(10), proRataDays(purchaseSerial, fiscalYear));
      setAmountCell(r.getCell(11), accumOpen || null);
      setAmountCell(r.getCell(12), depnYear || null);
      setAmountCell(r.getCell(13), depnDeletion || null);
      r.getCell(14).value = { formula: `K${row - 1}+L${row - 1}-M${row - 1}`, result: accumClose };
      r.getCell(14).numFmt = NUMBER_FORMAT2;
      r.getCell(14).alignment = { horizontal: "right" };
      r.getCell(15).value = { formula: `F${row - 1}-N${row - 1}`, result: closingWdv };
      r.getCell(15).numFmt = NUMBER_FORMAT2;
      r.getCell(15).alignment = { horizontal: "right" };
      setAmountCell(r.getCell(16), openingWdv || null);
      setAmountCell(r.getCell(17), asset.disposed ? wdvOnDisposal : null);
      setAmountCell(r.getCell(18), asset.disposed ? gainLoss : null);
      allAssetRows.push(row - 1);
    }
    const totalRow = row++;
    writeSumTotalRow(ws, totalRow, 1, [3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18], firstAssetRow, row - 2, `Total \u2014 ${className}`);
  }
  if (allAssetRows.length > 0) {
    const first = Math.min(...allAssetRows);
    const last = Math.max(...allAssetRows);
    writeSumTotalRow(ws, row, 1, [3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18], first, last, "Grand Total");
    ws.getRow(row).getCell(1).font = { name: "Arial", size: 10, bold: true };
  }
}
function writeTaxDepreciationSheet(ws, taxDepPools, _fiscalYear) {
  writeNoteSheetTitle(ws, "Tax Depreciation");
  const headers = [
    "Pool Name",
    "Opening Depreciation Basis",
    "Additions",
    "Disposals",
    "Depreciation Basis",
    "Absorbed Portion",
    "Unabsorbed Portion",
    "Tax Depn Rate",
    "Tax Depreciation",
    "Closing Basis for Next Year"
  ];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 36 : 18;
  });
  const pools = taxDepPools.length > 0 ? taxDepPools : [{}];
  pools.forEach((pool, i) => {
    const r = ws.getRow(4 + i);
    const rate = Number(pool.rate ?? 0);
    const openingBasis = Number(pool.openingBasis ?? 0);
    const additions = Number(pool.additions ?? 0);
    const disposals = Number(pool.disposals ?? 0);
    const depreciationBasis = Number(pool.depreciationBasis ?? openingBasis + additions - disposals);
    const absorbed = Number(pool.absorbed ?? pool.taxDepreciation ?? 0);
    const unabsorbed = Number(pool.unabsorbed ?? 0);
    const taxDep = Number(pool.taxDepreciation ?? absorbed);
    const closingBasis = Number(pool.closingBasis ?? pool.nextYearBasis ?? Math.max(0, depreciationBasis - taxDep));
    r.getCell(1).value = String(pool.poolName ?? pool.pool ?? "");
    setAmountCell(r.getCell(2), openingBasis || null);
    setAmountCell(r.getCell(3), additions || null);
    setAmountCell(r.getCell(4), disposals || null);
    setAmountCell(r.getCell(5), depreciationBasis || null);
    setAmountCell(r.getCell(6), absorbed || null);
    setAmountCell(r.getCell(7), unabsorbed || null);
    r.getCell(8).value = rate ? rate : null;
    r.getCell(8).numFmt = "0.00%";
    r.getCell(8).alignment = { horizontal: "right" };
    setAmountCell(r.getCell(9), taxDep || null);
    setAmountCell(r.getCell(10), closingBasis || null);
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });
  const firstDataRow = 4;
  const lastDataRow = 4 + pools.length - 1;
  const totalRow = 4 + pools.length;
  writeSumTotalRow(ws, totalRow, 1, [9], firstDataRow, lastDataRow, "Total Tax Depreciation");
  const noteRow = ws.getRow(totalRow + 2);
  noteRow.getCell(1).value = "Copy Closing Basis into Opening Basis each year.";
  noteRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  return { totalTaxDepRow: totalRow };
}
function writeDisallowForTaxSheet(ws, disallowItems) {
  writeNoteSheetTitle(ws, "Disallow for Tax");
  const headers = ["Particulars", "As per Books", "Disallowed Amount", "Allowed for Tax", "Notes"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 40 : 18;
  });
  const items = disallowItems.length > 0 ? disallowItems : Array.from({ length: 5 }, () => ({}));
  items.forEach((item, i) => {
    const r = ws.getRow(4 + i);
    const disallowed = Number(item.amount ?? 0);
    const asPerBooks = Number(item.asPerBooks ?? disallowed);
    const allowed = Math.max(0, asPerBooks - disallowed);
    if (disallowItems.length === 0) {
      for (let ci = 1; ci <= headers.length; ci++) applyGreenInput(r.getCell(ci));
      return;
    }
    r.getCell(1).value = item.description ?? "";
    setAmountCell(r.getCell(2), asPerBooks || null);
    setAmountCell(r.getCell(3), disallowed || null);
    setAmountCell(r.getCell(4), allowed || null);
    r.getCell(5).value = item.section ?? item.notes ?? "";
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });
  const firstDataRow = 4;
  const lastDataRow = 4 + items.length - 1;
  const totalRow = 4 + items.length;
  writeSumTotalRow(ws, totalRow, 1, [2, 3, 4], firstDataRow, lastDataRow, "Total Disallowed");
  return { totalDisallowedRow: totalRow };
}
function writeFairValueChangeSheet(ws, listedShares, options) {
  writeNoteSheetTitle(ws, "Fair Value Change");
  const headers = [
    "Company Name",
    "Opening Units",
    "Purchased Units",
    "Sold Units",
    "Closing Units",
    "Opening LTP (NPR)",
    "Closing LTP (NPR)",
    "Opening FV",
    "Closing FV",
    "FV Gain/(Loss)"
  ];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 32 : 16;
  });
  const rows = listedShares.length > 0 ? listedShares : [{}];
  const firstDataRow = 4;
  rows.forEach((share, i) => {
    const r = ws.getRow(firstDataRow + i);
    const rowNum = firstDataRow + i;
    r.getCell(1).value = String(share.companyName ?? share.name ?? share.investmentName ?? "");
    if (listedShares.length === 0) {
      for (let ci = 1; ci <= headers.length; ci++) applyGreenInput(r.getCell(ci));
      return;
    }
    const openingUnits = Number(share.openingUnits ?? share.units ?? 0);
    const purchased = Number(share.purchasedUnits ?? share.purchasesDuringYear ?? share.additions ?? 0);
    const sold = Number(share.soldUnits ?? share.salesDuringYear ?? share.disposals ?? 0);
    const openingLtp = Number(share.openingLtp ?? share.openingLTP ?? share.costPerUnit ?? 0);
    const closingLtp = Number(share.closingLtp ?? share.closingLTP ?? share.ltp ?? 0);
    const openingFv = Number(share.openingFV ?? share.openingBalance ?? share.totalCost ?? 0);
    setAmountCell(r.getCell(2), openingUnits || null);
    setAmountCell(r.getCell(3), purchased || null);
    setAmountCell(r.getCell(4), sold || null);
    r.getCell(5).value = { formula: `B${rowNum}+C${rowNum}-D${rowNum}`, result: openingUnits + purchased - sold };
    r.getCell(5).numFmt = NUMBER_FORMAT2;
    r.getCell(5).alignment = { horizontal: "right" };
    setAmountCell(r.getCell(6), openingLtp || null);
    setAmountCell(r.getCell(7), closingLtp || null);
    setAmountCell(r.getCell(8), openingFv || null);
    r.getCell(9).value = { formula: `E${rowNum}*G${rowNum}`, result: 0 };
    r.getCell(9).numFmt = NUMBER_FORMAT2;
    r.getCell(9).alignment = { horizontal: "right" };
    r.getCell(10).value = { formula: `I${rowNum}-H${rowNum}`, result: 0 };
    r.getCell(10).numFmt = NUMBER_FORMAT2;
    r.getCell(10).alignment = { horizontal: "right" };
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });
  const lastDataRow = firstDataRow + rows.length - 1;
  const totalRow = lastDataRow + 1;
  writeSumTotalRow(ws, totalRow, 1, [10], firstDataRow, lastDataRow, "Total FV Gain / (Loss)");
  const tbFv = options?.trialBalanceFvAdjustment ?? 0;
  const verifyStart = totalRow + 2;
  ws.getRow(verifyStart).getCell(1).value = "Verification";
  ws.getRow(verifyStart).getCell(1).font = FONTS.SUBHEADING;
  ws.getRow(verifyStart + 1).getCell(1).value = "Workings total FV change";
  ws.getRow(verifyStart + 1).getCell(2).value = { formula: `J${totalRow}`, result: 0 };
  ws.getRow(verifyStart + 1).getCell(2).numFmt = NUMBER_FORMAT2;
  ws.getRow(verifyStart + 2).getCell(1).value = "Per trial balance / notes";
  ws.getRow(verifyStart + 2).getCell(2).value = tbFv || null;
  ws.getRow(verifyStart + 2).getCell(2).numFmt = NUMBER_FORMAT2;
  ws.getRow(verifyStart + 3).getCell(1).value = "Match?";
  ws.getRow(verifyStart + 3).getCell(2).value = {
    formula: `ABS(B${verifyStart + 1}-B${verifyStart + 2})<1`,
    result: Math.abs(tbFv) < 1
  };
  return { totalFvGainLossRow: totalRow, verificationMatchRow: verifyStart + 3 };
}
function writeSundryDebtors(ws, data) {
  writeNoteSheetTitle(ws, "Sundry Debtors");
  const headers = ["Party Name", "Dr Balance", "Cr Balance", "0-30 days", "31-60 days", "61-90 days", ">90 days"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 36 : 16;
  });
  const rawDebtors = data.adjustments.debtors ?? [];
  let row = 4;
  if (rawDebtors.length === 0) {
    const noteRow = ws.getRow(row++);
    noteRow.getCell(1).value = "Subledger not provided \u2014 TB balances shown";
    noteRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    ws.mergeCells(row - 1, 1, row - 1, headers.length);
    const tbDebtors = data.trialBalance.rows.filter((r) => r.nfrsCategory === "trade_receivables");
    const firstDataRow2 = row;
    tbDebtors.forEach((d) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = d.rawLabel;
      setAmountCell(r.getCell(2), d.closingDr || null);
      setAmountCell(r.getCell(3), d.closingCr || null);
      const net = (d.closingDr ?? 0) - (d.closingCr ?? 0);
      const [b0, b1, b2, b3] = agingBucketAmount(net, 30);
      [b0, b1, b2, b3].forEach((v, i) => setAmountCell(r.getCell(4 + i), v || null));
    });
    if (row > firstDataRow2) {
      writeSumTotalRow(ws, row++, 1, [2, 3, 4, 5, 6, 7], firstDataRow2, row - 2, "Total");
    }
    return;
  }
  const firstDataRow = row;
  rawDebtors.forEach((d) => {
    const partyName = String(d.partyName ?? d.name ?? "");
    const debitBalance = Number(d.debitBalance ?? d.totalAmount ?? (d.isAdvanceFromCustomer ? 0 : d.balanceCY) ?? 0);
    const creditBalance = Number(d.creditBalance ?? (d.isAdvanceFromCustomer ? d.balanceCY : 0) ?? 0);
    const days = debtorAgingDays(d);
    const [b0, b1, b2, b3] = agingBucketAmount(debitBalance, days);
    const r = ws.getRow(row++);
    r.getCell(1).value = partyName;
    setAmountCell(r.getCell(2), debitBalance || null);
    setAmountCell(r.getCell(3), creditBalance || null);
    [b0, b1, b2, b3].forEach((v, i) => setAmountCell(r.getCell(4 + i), v || null));
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });
  if (row > firstDataRow) {
    writeSumTotalRow(ws, row, 1, [2, 3, 4, 5, 6, 7], firstDataRow, row - 1, "Total");
  }
}
function writeSundryCreditors(ws, data) {
  writeNoteSheetTitle(ws, "Sundry Creditors");
  const headers = ["Party Name", "Dr Balance", "Cr Balance"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 36 : 18;
  });
  const rawCreditors = data.adjustments.creditors ?? [];
  let row = 4;
  if (rawCreditors.length === 0) {
    const noteRow = ws.getRow(row++);
    noteRow.getCell(1).value = "Subledger not provided \u2014 TB balances shown";
    noteRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    ws.mergeCells(row - 1, 1, row - 1, headers.length);
    const tbCreditors = data.trialBalance.rows.filter((r) => r.nfrsCategory === "trade_payables_creditors");
    const firstDataRow2 = row;
    tbCreditors.forEach((d) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = d.rawLabel;
      setAmountCell(r.getCell(2), d.closingDr || null);
      setAmountCell(r.getCell(3), d.closingCr || null);
    });
    if (row > firstDataRow2) {
      writeSumTotalRow(ws, row, 1, [2, 3], firstDataRow2, row - 1, "Total");
    }
    return;
  }
  const firstDataRow = row;
  rawCreditors.forEach((d) => {
    const r = ws.getRow(row++);
    r.getCell(1).value = String(d.partyName ?? d.name ?? "");
    setAmountCell(r.getCell(2), Number(d.debitBalance ?? 0) || null);
    setAmountCell(r.getCell(3), Number(d.creditBalance ?? d.totalAmount ?? d.balanceCY ?? 0) || null);
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });
  if (row > firstDataRow) {
    writeSumTotalRow(ws, row, 1, [2, 3], firstDataRow, row - 1, "Total");
  }
}
function writeBankAccounts(ws, note38) {
  writeNoteSheetTitle(ws, "Bank Accounts");
  const hRow = ws.getRow(3);
  ["Bank Name", "Account Type", "Current Year", "Previous Year"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
  });
  (note38.bankBalances ?? []).forEach((b, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = b.bankName;
    r.getCell(2).value = b.accountType;
    r.getCell(3).value = b.cy || null;
    r.getCell(3).numFmt = NUMBER_FORMAT2;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).value = b.py || null;
    r.getCell(4).numFmt = NUMBER_FORMAT2;
    r.getCell(4).alignment = { horizontal: "right" };
  });
}
function writeTrialBalance(ws, tb, company) {
  writeMesFormatTrialBalance(ws, tb, company);
}
function writeAdjustments(ws, adj) {
  writeNoteSheetTitle(ws, "Adjustment Journal Entries");
  const hRow = ws.getRow(3);
  ["#", "Description", "Dr Account", "Cr Account", "Amount", "Note Ref", "Source"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle2(c);
    applyAllBorders(c);
  });
  adj.journalEntries.forEach((je, i) => {
    const r = ws.getRow(4 + i);
    [i + 1, je.description, je.debitAccount, je.creditAccount, je.amount, je.linkedNoteRef ?? "", je.isSystemGenerated ? "System" : "Manual"].forEach((v, ci) => {
      const c = r.getCell(ci + 1);
      c.value = v || null;
      if (ci === 4) {
        c.numFmt = NUMBER_FORMAT2;
        c.alignment = { horizontal: "right" };
      }
      applyAllBorders(c);
    });
  });
}
function writeTaxCalculationSheet(ws, taxData, fiscalYear) {
  ws.columns = [{ width: 44 }, { width: 10 }, { width: 18 }, { width: 18 }];
  ws.mergeCells("A1:D1");
  const r1 = ws.getCell("A1");
  r1.value = (taxData.companyName || "Company Name").toUpperCase();
  r1.alignment = { horizontal: "center", vertical: "middle" };
  applyHeaderStyle2(r1);
  ws.getRow(1).height = 26;
  ws.mergeCells("A2:D2");
  const r2 = ws.getCell("A2");
  r2.value = taxData.address || "";
  r2.font = { name: "Arial", size: 10 };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  applyBodyStyle(r2);
  ws.mergeCells("A3:D3");
  const r3 = ws.getCell("A3");
  r3.value = "COMPUTATION OF INCOME TAX";
  r3.font = { name: "Arial", size: 11, bold: true };
  r3.alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells("A4:D4");
  const r4 = ws.getCell("A4");
  r4.value = `FOR FISCAL YEAR ${fiscalYear}`;
  r4.font = { name: "Arial", size: 10, italic: true };
  r4.alignment = { horizontal: "center", vertical: "middle" };
  const headerRow = ws.getRow(6);
  ["Particulars", "Note", "As per Books", "For Income Tax"].forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle2(c);
    c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    applyAllBorders(c);
  });
  const is = taxData.incomeStatement;
  const oi = taxData.otherIncome;
  const repair = taxData.repairExpense ?? 0;
  const interestExp = Number(is.financeCharges ?? is.interestExpenses ?? 0);
  const bookDepn = Number(is.depreciation ?? 0);
  const generalDeduction = Math.max(
    0,
    Number(is.totalExpenses ?? 0) - bookDepn - interestExp - repair
  );
  const inclusionItems = [
    {
      label: "Sales u/s 7(2)(Kha)",
      note: "3.17",
      books: Number(is.revenue ?? is.revenueFromOperations ?? 0),
      tax: Number(is.revenue ?? is.revenueFromOperations ?? 0)
    },
    {
      label: "Interest Income",
      books: Number(oi?.interestIncome?.cy ?? is.interestIncome ?? 0),
      tax: Number(oi?.interestIncome?.cy ?? is.interestIncome ?? 0)
    },
    {
      label: "Commission Income",
      books: Number(oi?.commissionIncome?.cy ?? 0),
      tax: Number(oi?.commissionIncome?.cy ?? 0)
    },
    {
      label: "Rental Income",
      books: Number(oi?.rentalIncome?.cy ?? 0),
      tax: Number(oi?.rentalIncome?.cy ?? 0)
    },
    {
      label: "Dividend Income",
      books: Number(oi?.dividendReceived?.cy ?? 0),
      tax: "exempt"
    },
    {
      label: "Insurance Claim Income",
      books: Number(oi?.insuranceClaims?.cy ?? 0),
      tax: Number(oi?.insuranceClaims?.cy ?? 0)
    },
    {
      label: "Gain on Disposal of Assets",
      books: Number(oi?.gainOnDisposalAssets?.cy ?? 0),
      tax: Number(oi?.gainOnDisposalAssets?.cy ?? 0)
    },
    {
      label: "Other Income",
      books: Number(oi?.miscellaneousIncome?.cy ?? is.otherIncome ?? 0),
      tax: Number(oi?.miscellaneousIncome?.cy ?? is.otherIncome ?? 0)
    }
  ];
  let row = 7;
  writeSectionHeader(ws, row++, "INCLUSIONS", 4);
  const inclusionStart = row;
  inclusionItems.forEach((item) => {
    const r = ws.getRow(row++);
    r.getCell(1).value = item.label;
    if (item.note) {
      r.getCell(2).value = item.note;
      r.getCell(2).font = FONTS.NOTE_REF;
    }
    setAmountCell(r.getCell(3), item.books || null);
    if (item.tax === "exempt") {
      setAmountCell(r.getCell(4), 0);
    } else {
      setAmountCell(r.getCell(4), item.tax || null);
    }
    [1, 2, 3, 4].forEach((ci) => applyAllBorders(r.getCell(ci)));
  });
  const inclusionEnd = row - 1;
  const totalInclusionRow = row++;
  writeSumTotalRow(ws, totalInclusionRow, 1, [3, 4], inclusionStart, inclusionEnd, "Total Inclusion");
  writeSectionHeader(ws, row++, "DEDUCTIONS", 4);
  const deductionStart = row;
  const deductionRows = [
    { label: "General Deduction u/s 13", books: generalDeduction, taxValue: generalDeduction },
    { label: "Interest u/s 14", books: interestExp, taxValue: interestExp },
    { label: "Cost of Trading Stock u/s 15", note: "3.18", books: Number(is.materialConsumed ?? 0), taxValue: Number(is.materialConsumed ?? 0) },
    { label: "Repair & Improvement u/s 16", books: repair, taxValue: repair },
    { label: "Depreciation u/s 19", books: bookDepn, taxValue: null }
  ];
  deductionRows.forEach((item, idx) => {
    const r = ws.getRow(row++);
    r.getCell(1).value = item.label;
    if (item.note) {
      r.getCell(2).value = item.note;
      r.getCell(2).font = FONTS.NOTE_REF;
    }
    setAmountCell(r.getCell(3), item.books);
    const taxCell = r.getCell(4);
    if (idx === 4 && taxData.taxDepSheetName && taxData.taxDepTotalRow) {
      taxCell.value = {
        formula: cellRef(taxData.taxDepSheetName, "I", taxData.taxDepTotalRow).replace(/^=/, ""),
        result: 0
      };
      taxCell.numFmt = NUMBER_FORMAT2;
      taxCell.alignment = { horizontal: "right" };
    } else {
      setAmountCell(taxCell, item.taxValue ?? null);
    }
    [1, 2, 3, 4].forEach((ci) => applyAllBorders(r.getCell(ci)));
  });
  const deductionEnd = row - 1;
  const totalDeductionRow = row++;
  writeSumTotalRow(ws, totalDeductionRow, 1, [3, 4], deductionStart, deductionEnd, "Total Deduction");
  const assessableIncomeRow = row++;
  const assessableRow = ws.getRow(assessableIncomeRow);
  assessableRow.getCell(1).value = "Assessable Income";
  assessableRow.getCell(3).value = {
    formula: `C${totalInclusionRow}-C${totalDeductionRow}`,
    result: 0
  };
  assessableRow.getCell(4).value = {
    formula: `D${totalInclusionRow}-D${totalDeductionRow}`,
    result: 0
  };
  [3, 4].forEach((ci) => {
    const c = assessableRow.getCell(ci);
    c.numFmt = NUMBER_FORMAT2;
    c.alignment = { horizontal: "right" };
    applyTotalStyle(c);
    applyAllBorders(c);
  });
  applyAllBorders(assessableRow.getCell(1));
  const donationRow = row++;
  const donationR = ws.getRow(donationRow);
  donationR.getCell(1).value = "Less: Donation u/s 12";
  const donationCell = donationR.getCell(4);
  donationCell.value = taxData.donations ?? 0;
  donationCell.numFmt = NUMBER_FORMAT2;
  donationCell.alignment = { horizontal: "right" };
  applyInputStyle2(donationCell);
  applyAllBorders(donationCell);
  applyAllBorders(donationR.getCell(1));
  const incomeLossRow = row++;
  const incomeLossR = ws.getRow(incomeLossRow);
  incomeLossR.getCell(1).value = "Income/(Loss)";
  incomeLossR.getCell(4).value = { formula: `D${assessableIncomeRow}-D${donationRow}`, result: 0 };
  incomeLossR.getCell(4).numFmt = NUMBER_FORMAT2;
  incomeLossR.getCell(4).alignment = { horizontal: "right" };
  applyTotalStyle(incomeLossR.getCell(4));
  applyAllBorders(incomeLossR.getCell(1));
  applyAllBorders(incomeLossR.getCell(4));
  const lossCarryRow = row++;
  const lossCarryR = ws.getRow(lossCarryRow);
  lossCarryR.getCell(1).value = "Carry forward of losses u/s 20";
  const lossCarryCell = lossCarryR.getCell(4);
  lossCarryCell.value = taxData.lossCarryForward ?? 0;
  lossCarryCell.numFmt = NUMBER_FORMAT2;
  lossCarryCell.alignment = { horizontal: "right" };
  applyInputStyle2(lossCarryCell);
  applyAllBorders(lossCarryCell);
  applyAllBorders(lossCarryR.getCell(1));
  const taxableIncomeRow = row++;
  const taxableR = ws.getRow(taxableIncomeRow);
  taxableR.getCell(1).value = "Taxable Income/(Loss)";
  taxableR.getCell(4).value = { formula: `D${incomeLossRow}-D${lossCarryRow}`, result: 0 };
  taxableR.getCell(4).numFmt = NUMBER_FORMAT2;
  taxableR.getCell(4).alignment = { horizontal: "right" };
  applyTotalStyle(taxableR.getCell(4));
  applyAllBorders(taxableR.getCell(1));
  applyAllBorders(taxableR.getCell(4));
  const taxRateRow = row++;
  const taxRateR = ws.getRow(taxRateRow);
  taxRateR.getCell(1).value = "Income Tax Rate";
  const rateCell = taxRateR.getCell(4);
  rateCell.value = taxData.taxRate ?? 0.25;
  rateCell.numFmt = "0.00%";
  rateCell.alignment = { horizontal: "right" };
  applyAssumptionStyle(rateCell);
  applyAllBorders(rateCell);
  applyAllBorders(taxRateR.getCell(1));
  const incomeTaxLiabilityRow = row++;
  const incomeTaxR = ws.getRow(incomeTaxLiabilityRow);
  incomeTaxR.getCell(1).value = "Income Tax Liability";
  incomeTaxR.getCell(4).value = { formula: `MAX(0,D${taxableIncomeRow}*D${taxRateRow})`, result: 0 };
  incomeTaxR.getCell(4).numFmt = NUMBER_FORMAT2;
  incomeTaxR.getCell(4).alignment = { horizontal: "right" };
  applyTotalStyle(incomeTaxR.getCell(4));
  applyAllBorders(incomeTaxR.getCell(1));
  applyAllBorders(incomeTaxR.getCell(4));
  const feeRow = row++;
  const feeR = ws.getRow(feeRow);
  feeR.getCell(1).value = "Fee u/s 117";
  const feeCell = feeR.getCell(4);
  feeCell.value = taxData.feeSection117 ?? 0;
  feeCell.numFmt = NUMBER_FORMAT2;
  feeCell.alignment = { horizontal: "right" };
  applyInputStyle2(feeCell);
  applyAllBorders(feeCell);
  applyAllBorders(feeR.getCell(1));
  const lateTaxInputRow = row + 3;
  const shortfallInputRow = row + 4;
  const interest118Row = row++;
  const int118R = ws.getRow(interest118Row);
  int118R.getCell(1).value = "Interest u/s 118";
  int118R.getCell(4).value = { formula: `IF(D${lateTaxInputRow}>0,D${lateTaxInputRow}*0.15,0)`, result: 0 };
  int118R.getCell(4).numFmt = NUMBER_FORMAT2;
  int118R.getCell(4).alignment = { horizontal: "right" };
  applyAllBorders(int118R.getCell(1));
  applyAllBorders(int118R.getCell(4));
  const interest119Row = row++;
  const int119R = ws.getRow(interest119Row);
  int119R.getCell(1).value = "Interest u/s 119";
  int119R.getCell(4).value = { formula: `IF(D${shortfallInputRow}>0,D${shortfallInputRow}*0.15,0)`, result: 0 };
  int119R.getCell(4).numFmt = NUMBER_FORMAT2;
  int119R.getCell(4).alignment = { horizontal: "right" };
  applyAllBorders(int119R.getCell(1));
  applyAllBorders(int119R.getCell(4));
  const totalTaxLiabilityRow = row++;
  const totalTaxR = ws.getRow(totalTaxLiabilityRow);
  totalTaxR.getCell(1).value = "Total Tax Liability";
  totalTaxR.getCell(4).value = {
    formula: `D${incomeTaxLiabilityRow}+D${feeRow}+D${interest118Row}+D${interest119Row}`,
    result: 0
  };
  totalTaxR.getCell(4).numFmt = NUMBER_FORMAT2;
  totalTaxR.getCell(4).alignment = { horizontal: "right" };
  applyTotalStyle(totalTaxR.getCell(4));
  applyAllBorders(totalTaxR.getCell(1));
  applyAllBorders(totalTaxR.getCell(4));
  row = lateTaxInputRow;
  const lateTaxR = ws.getRow(lateTaxInputRow);
  lateTaxR.getCell(1).value = "Tax paid late (input for s118)";
  lateTaxR.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  const lateTaxCell = lateTaxR.getCell(4);
  lateTaxCell.value = taxData.lateTaxPaidAmount ?? 0;
  lateTaxCell.numFmt = NUMBER_FORMAT2;
  lateTaxCell.alignment = { horizontal: "right" };
  applyInputStyle2(lateTaxCell);
  const shortfallR = ws.getRow(shortfallInputRow);
  shortfallR.getCell(1).value = "Advance tax shortfall (input for s119)";
  shortfallR.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  const shortfallCell = shortfallR.getCell(4);
  shortfallCell.value = taxData.advanceTaxShortfall ?? 0;
  shortfallCell.numFmt = NUMBER_FORMAT2;
  shortfallCell.alignment = { horizontal: "right" };
  applyInputStyle2(shortfallCell);
  SHEET_ROW_REGISTRY.taxCalcIncomeTaxRow = incomeTaxLiabilityRow;
  SHEET_ROW_REGISTRY.taxCalcNetPayableRow = totalTaxLiabilityRow;
  SHEET_ROW_REGISTRY.assessableIncomeRow = assessableIncomeRow;
  SHEET_ROW_REGISTRY.totalTaxLiabilityRow = totalTaxLiabilityRow;
  return {
    assessableIncomeRow,
    taxableIncomeRow,
    taxCalcIncomeTaxRow: incomeTaxLiabilityRow,
    taxCalcNetPayableRow: totalTaxLiabilityRow,
    totalTaxLiabilityRow,
    note314_incomeTaxRow: totalTaxLiabilityRow
  };
}
function writeTaxProfitReconciliationSheet(ws, data) {
  ws.columns = [{ width: 50 }, { width: 20 }];
  ws.mergeCells("A1:B1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `TAX PROFIT RECONCILIATION FOR FY ${data.fiscalYear}`;
  applyHeaderStyle2(titleCell);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;
  const headerRow = ws.getRow(3);
  ["Particulars", "Amount"].forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle2(c);
    applyAllBorders(c);
  });
  let row = 4;
  writeSectionHeader(ws, row++, "Book Profit to Assessable Income", 2);
  const profitRow = row++;
  ws.getRow(profitRow).getCell(1).value = "Profit before tax per accounts (from IS)";
  setAmountCell(ws.getRow(profitRow).getCell(2), data.profitBeforeTax || null);
  const depnRow = row++;
  ws.getRow(depnRow).getCell(1).value = "Add: Depreciation as per books";
  setAmountCell(ws.getRow(depnRow).getCell(2), data.bookDepreciation || null);
  const disallowRow = row++;
  ws.getRow(disallowRow).getCell(1).value = "Add: Disallowed expenses";
  const disallowCell = ws.getRow(disallowRow).getCell(2);
  disallowCell.value = {
    formula: cellRef(data.disallowSheetName, "C", data.disallowTotalRow).replace(/^=/, ""),
    result: 0
  };
  disallowCell.numFmt = NUMBER_FORMAT2;
  disallowCell.alignment = { horizontal: "right" };
  const taxDepRow = row++;
  ws.getRow(taxDepRow).getCell(1).value = "Less: Tax depreciation";
  const taxDepCell = ws.getRow(taxDepRow).getCell(2);
  taxDepCell.value = {
    formula: `-${cellRef(data.taxDepSheetName, "I", data.taxDepTotalRow).replace(/^=/, "")}`,
    result: 0
  };
  taxDepCell.numFmt = NUMBER_FORMAT2;
  taxDepCell.alignment = { horizontal: "right" };
  const exemptRow = row++;
  ws.getRow(exemptRow).getCell(1).value = "Less: Exempt income (Dividend income)";
  setAmountCell(ws.getRow(exemptRow).getCell(2), data.dividendExempt ? -data.dividendExempt : null);
  const otherAdjRow = row++;
  ws.getRow(otherAdjRow).getCell(1).value = "Add/Less: Other adjustments";
  const otherAdjCell = ws.getRow(otherAdjRow).getCell(2);
  otherAdjCell.value = 0;
  otherAdjCell.numFmt = NUMBER_FORMAT2;
  otherAdjCell.alignment = { horizontal: "right" };
  applyInputStyle2(otherAdjCell);
  const assessableIncomeRow = row++;
  const assessableR = ws.getRow(assessableIncomeRow);
  assessableR.getCell(1).value = "Assessable Income";
  assessableR.getCell(2).value = {
    formula: `B${profitRow}+B${depnRow}+B${disallowRow}+B${taxDepRow}+B${exemptRow}+B${otherAdjRow}`,
    result: 0
  };
  assessableR.getCell(2).numFmt = NUMBER_FORMAT2;
  assessableR.getCell(2).alignment = { horizontal: "right" };
  applyTotalStyle(assessableR.getCell(2));
  const reconciliationCheckRow = row + 1;
  const checkR = ws.getRow(reconciliationCheckRow);
  checkR.getCell(1).value = "Reconciliation Check";
  const taxCalcRef = cellRef(data.taxCalcSheetName, "D", data.taxCalcAssessableRow).replace(/^=/, "");
  checkR.getCell(2).value = {
    formula: `IF(B${assessableIncomeRow}=${taxCalcRef},"RECONCILED \u2713","DIFFERENCE: "&B${assessableIncomeRow}-${taxCalcRef})`,
    result: "RECONCILED \u2713"
  };
  checkR.getCell(2).alignment = { horizontal: "center" };
  checkR.getCell(2).font = { name: "Arial", size: 10, bold: true };
  ws.addConditionalFormatting({
    ref: `B${reconciliationCheckRow}`,
    rules: [
      {
        type: "expression",
        formulae: [`B${assessableIncomeRow}=${taxCalcRef}`],
        priority: 1,
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: `FF${COLORS.GREEN_INPUT}` } },
          font: { color: { argb: "FF166534" }, bold: true }
        }
      },
      {
        type: "expression",
        formulae: [`B${assessableIncomeRow}<>${taxCalcRef}`],
        priority: 2,
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: `FF${COLORS.RED}` } },
          font: { color: { argb: "FFFFFFFF" }, bold: true }
        }
      }
    ]
  });
  return { assessableIncomeRow, reconciliationCheckRow };
}
function normalizeNotesForExcel(notes, is, bs) {
  if (notes.note34_otherReceivables || notes.note317_revenue) {
    return {
      ...notes,
      note38_cashAndEquivalents: notes.note38_cashAndEquivalents ?? notes.note38_cashEquivalents ?? {
        cashInHand_cy: 0,
        cashInHand_py: 0,
        bankBalances: [],
        totalCash_cy: 0,
        totalCash_py: 0
      },
      note323_incomeTax: notes.note323_incomeTax ?? notes.note323_taxExpense,
      note321_impairment: notes.note321_impairment ?? []
    };
  }
  const n34 = notes.note34_otherCurrentAssets;
  const n35 = notes.note35_biologicalAssets;
  const n36 = notes.note36_heldForSale;
  const n37 = notes.note37_inventories;
  const n38 = notes.note38_cashEquivalents;
  const n39 = notes.note39_shareCapital;
  const n310 = notes.note310_reserves;
  const n311 = notes.note311_borrowings;
  const n312 = notes.note312_employeeBenefits;
  const n313 = notes.note313_tradePayables;
  const n317 = notes.note317_revenueDetailed;
  const n318 = notes.note318_materialConsumed;
  const n320 = notes.note320_employeeExpenses;
  const n322 = notes.note322_adminExpenses;
  const n323 = notes.note323_taxExpense;
  const note31_ppe = (notes.note31_ppe ?? []).map((item) => {
    const d = item;
    return {
      ...d,
      netBookValueClosing: d.netBookValueClosing ?? d.nbvClosing ?? Math.max(0, (d.closingCost ?? 0) - (d.closingAccumDepn ?? 0)),
      impairmentLosses: d.impairmentLosses ?? 0,
      securedAmount: d.securedAmount ?? 0,
      hasSecuredAssets: d.hasSecuredAssets ?? false
    };
  });
  const note37_inventories = n37?.rawMaterials ? {
    rawMaterials_cy: n37.rawMaterials.closing ?? 0,
    rawMaterials_py: n37.rawMaterials.opening ?? 0,
    wip_cy: n37.wip.closing ?? 0,
    wip_py: n37.wip.opening ?? 0,
    finishedGoods_cy: n37.finishedGoods.closing ?? 0,
    finishedGoods_py: n37.finishedGoods.opening ?? 0,
    totalInventory_cy: n37.totalClosing ?? bs.ca_inventories,
    totalInventory_py: n37.totalOpening ?? 0
  } : notes.note37_inventories;
  const note38_cashAndEquivalents = {
    cashInHand_cy: n38?.cashInHand_cy ?? 0,
    cashInHand_py: n38?.cashInHand_py ?? 0,
    bankBalances: (n38?.bankAccounts ?? []).map((b) => ({
      bankName: b.bankName,
      accountType: b.accountType,
      cy: b.closingBalance,
      py: b.openingBalance
    })),
    totalCash_cy: n38?.totalCash_cy ?? bs.ca_cashAndEquivalents,
    totalCash_py: n38?.totalCash_py ?? 0
  };
  const os = n39?.ordinaryShares ?? {};
  const note39_shareCapital = {
    authorizedShares: os.authorizedShares ?? 0,
    issuedShares: os.closingIssuedShares ?? 0,
    faceValuePerShare: os.parValuePerShare ?? 100,
    paidUpAmount_cy: os.closingPaidUp ?? bs.eq_shareCapital,
    paidUpAmount_py: os.openingPaidUp ?? 0
  };
  const note310_reserves = {};
  if (n310) {
    if (n310.sharePremium) {
      note310_reserves["Share Premium"] = { closingCY: n310.sharePremium.closing ?? 0, py: n310.sharePremium.opening ?? 0 };
    }
    if (n310.generalReserve) {
      note310_reserves["General Reserve"] = { closingCY: n310.generalReserve.closing ?? 0, py: n310.generalReserve.opening ?? 0 };
    }
    if (n310.retainedEarnings) {
      note310_reserves["Retained Earnings"] = { closingCY: n310.retainedEarnings.closing ?? 0, py: n310.retainedEarnings.opening ?? 0 };
    }
  }
  const note311_borrowings = {
    nonCurrentBank: (n311?.nonCurrent ?? []).map((b) => ({
      lenderName: b.lenderName,
      amount_cy: b.balance_cy,
      amount_py: b.balance_py,
      interestRate: b.interestRate ?? 0,
      security: b.secured ? "Secured" : ""
    })),
    currentLoans: (n311?.current ?? []).map((b) => ({
      lenderName: b.lenderName,
      amount_cy: b.balance_cy,
      amount_py: b.balance_py,
      loanType: b.type ?? "Loan"
    }))
  };
  const db = n312?.definedBenefit;
  const le = n312?.leaveEncashment;
  const note312_employeeBenefits = {
    Gratuity: { opening: db?.openingBalance ?? 0, closing: db?.closingBalance ?? 0 },
    "Leave Encashment": { opening: le?.openingBalance ?? 0, closing: le?.closingBalance ?? 0 },
    "Salary Payable": { opening: 0, closing: n312?.salaryPayable ?? 0 },
    "Bonus Payable": { opening: 0, closing: n312?.bonusPayable ?? 0 }
  };
  const note313_tradePayables = n313 ? {
    "Trade Creditors": { cy: n313.tradeCreditors ?? 0, py: n313.tradeCreditors_py ?? 0 },
    "Advance from Customers": { cy: n313.advanceFromCustomers ?? 0, py: 0 },
    "Audit Fee Payable": { cy: n313.auditFeePayable ?? 0, py: n313.auditFeePayable_py ?? 0 },
    "VAT Payable": { cy: n313.vatPayable ?? 0, py: n313.vatPayable_py ?? 0 },
    "TDS Payable": { cy: n313.tdsPayableTotal ?? 0, py: n313.tdsPayableTotal_py ?? 0 }
  } : {};
  const note317_revenue = n317 ? {
    "Sale of Goods": n317.saleOfGoods ?? { cy: 0, py: 0 },
    "Rendering of Services": n317.renderingOfServices ?? { cy: 0, py: 0 },
    "Interest Income": n317.interestIncome ?? { cy: 0, py: 0 },
    "Other Income": n317.otherIncome ?? { cy: 0, py: 0 }
  } : {};
  const note318_materialConsumed = n318 ? {
    openingInventory: n318.openingRawMaterial ?? 0,
    purchases: n318.purchasesDuringYear ?? 0,
    closingInventory: n318.closingRawMaterial ?? 0,
    consumed: n318.rawMaterialConsumed ?? is.materialConsumed
  } : notes.note318_materialConsumed;
  const note319_directExpenses = n318 ? {
    "Direct Wages": { cy: n318.directWages ?? 0, py: 0 },
    "Other Direct Expenses": { cy: n318.otherDirectExpenses ?? 0, py: 0 }
  } : notes.note319_directExpenses ?? {};
  const note320_employeeBenefitExpenses = n320 ? {
    "Salaries & Wages": n320.salariesWages ?? { cy: 0, py: 0 },
    "PF / SSF / CIT": n320.pfSsfContribution ?? { cy: 0, py: 0 },
    "Gratuity": n320.gratuityExpense ?? { cy: 0, py: 0 },
    "Staff Bonus": n320.staffBonusExpense ?? { cy: 0, py: 0 },
    "Staff Welfare": n320.staffWelfare ?? { cy: 0, py: 0 },
    "Other Employee Costs": n320.otherEmployeeCosts ?? { cy: 0, py: 0 }
  } : notes.note320_employeeBenefitExpenses ?? {};
  const note322_adminExpenses = n322?.lineItems ? Object.fromEntries(n322.lineItems.map((li) => [li.label, { cy: li.cy, py: li.py }])) : notes.note322_adminExpenses ?? {};
  const recon = n323?.reconciliation;
  const note323_incomeTax = {
    profitBeforeTax: recon?.profitBeforeTax ?? is.profitBeforeTax,
    addDisallowableExpenses: recon?.disallowableExpenses ?? {},
    lessAllowableExpenses: recon?.allowableDeductions ?? {},
    taxableIncome: recon?.taxableProfit ?? is.profitBeforeTax,
    currentTax: recon?.totalCurrentTax ?? is.incomeTaxExpense,
    taxRate: n323?.effectiveTaxRate ?? 0.25,
    advanceTaxPaid: n323?.advanceTaxPaid ?? 0,
    tdsCreditAvailable: n323?.tdsCreditAvailable ?? 0,
    netTaxPayable: n323?.netTaxPayable ?? bs.cl_incomeTaxPayable
  };
  return {
    ...notes,
    note31_ppe,
    note34_otherReceivables: {
      "Security Deposits": { cy: n34?.securityDeposits ?? 0, py: 0 },
      "Advance Income Tax": { cy: n34?.advanceIncomeTax ?? 0, py: 0 },
      "Other Prepaid Expenses": { cy: n34?.otherPrepaidExpenses ?? 0, py: 0 }
    },
    note35_otherNonCurrentAssets: {
      "Biological Assets": { cy: n35?.closingCarrying ?? 0, py: n35?.openingCarrying ?? 0 }
    },
    note36_otherCurrentAssets: {
      "Held for Sale": { cy: n36?.total ?? 0, py: 0 }
    },
    note37_inventories,
    note38_cashAndEquivalents,
    note39_shareCapital,
    note310_reserves,
    note311_borrowings,
    note312_employeeBenefits,
    note313_tradePayables,
    note317_revenue,
    note318_materialConsumed,
    note319_directExpenses,
    note320_employeeBenefitExpenses,
    note321_impairment: notes.note321_impairment ?? [
      { description: "Impairment on Receivables", cy: is.impairment ?? 0, py: 0 }
    ],
    note322_adminExpenses,
    note323_incomeTax
  };
}
function buildInvestmentsNoteData(note32) {
  const data = {};
  if (!note32) return data;
  for (const share of note32.listedShares ?? []) {
    data[`Listed Shares \u2014 ${share.companyName}`] = {
      cy: share.carryingAmount ?? share.marketValue ?? 0,
      py: share.openingCost ?? 0
    };
  }
  for (const share of note32.unlistedShares ?? []) {
    data[`Unlisted Shares \u2014 ${share.companyName}`] = {
      cy: share.closingCarrying ?? 0,
      py: share.openingCost ?? 0
    };
  }
  if ((note32.fdrNonCurrent ?? 0) !== 0) {
    data["Fixed Deposits (Non-current)"] = { cy: note32.fdrNonCurrent ?? 0, py: 0 };
  }
  if ((note32.fdrCurrent ?? 0) !== 0) {
    data["Fixed Deposits (Current)"] = { cy: note32.fdrCurrent ?? 0, py: 0 };
  }
  if ((note32.totalNonCurrent ?? 0) !== 0 && Object.keys(data).length === 0) {
    data["Investments (Non-current)"] = { cy: note32.totalNonCurrent ?? 0, py: 0 };
  }
  if ((note32.totalCurrent ?? 0) !== 0 && Object.keys(data).length === 0) {
    data["Investments (Current)"] = { cy: note32.totalCurrent ?? 0, py: 0 };
  }
  return data;
}
function buildProvisionsNoteData(adjustments) {
  const record = {};
  for (const provision of adjustments.provisions ?? []) {
    const label = String(provision.provisionType ?? "Provision").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    record[label] = {
      cy: provision.closingBalance ?? 0,
      py: provision.openingBalance ?? 0
    };
  }
  if (Object.keys(record).length === 0) {
    record["No provisions recognised"] = { cy: 0, py: 0 };
  }
  return record;
}
function writeDisclosureTextNote(ws, title, body) {
  writeNoteSheetTitle(ws, title);
  ws.mergeCells(3, 1, 10, 3);
  const cell = ws.getCell(3, 1);
  cell.value = body;
  cell.alignment = { wrapText: true, vertical: "top" };
  cell.font = { name: "Arial", size: 10 };
}
function writeNote33_Receivables(ws, note) {
  writeNoteSheetTitle(ws, "3.3  Trade and Other Receivables");
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  const writeHeader = (rowNum) => {
    ["Particulars", "Current Year", "Previous Year"].forEach((label, idx) => {
      const cell = ws.getRow(rowNum).getCell(idx + 1);
      cell.value = label;
      applySubHeaderStyle2(cell);
      applyAllBorders(cell);
      cell.alignment = { horizontal: idx === 0 ? "left" : "right" };
    });
  };
  const writeAmountLine = (rowNum, label, cy, py, bold = false) => {
    const row2 = ws.getRow(rowNum);
    row2.getCell(1).value = label;
    row2.getCell(2).value = cy || null;
    row2.getCell(3).value = py || null;
    [1, 2, 3].forEach((col) => {
      const cell = row2.getCell(col);
      applyBodyStyle(cell);
      applyAllBorders(cell);
      if (col > 1) {
        cell.numFmt = NUMBER_FORMAT2;
        cell.alignment = { horizontal: "right" };
      }
      if (bold) applyTotalStyle(cell);
    });
  };
  let row = 3;
  writeHeader(row++);
  const grossCy = note?.grossReceivables_cy ?? 0;
  const grossPy = note?.grossReceivables_py ?? 0;
  const provisionCy = note?.provisionForImpairment_cy ?? note?.provisionMovement?.closing ?? 0;
  const provisionPy = note?.provisionForImpairment_py ?? note?.provisionMovement?.opening ?? 0;
  const netCy = note?.netReceivables_cy ?? Math.max(0, grossCy - provisionCy);
  const netPy = note?.netReceivables_py ?? Math.max(0, grossPy - provisionPy);
  writeAmountLine(row++, "Gross Trade Receivables", grossCy, grossPy);
  writeAmountLine(row++, "Less: Provision for Impairment", -provisionCy, -provisionPy);
  const netRow = row;
  writeAmountLine(row++, "Net Trade Receivables", netCy, netPy, true);
  const otherLines = [
    ["Related Party Receivables", note?.relatedPartyReceivables],
    ["Prepayments", note?.prepayments],
    ["TDS Receivable", note?.tdsReceivable],
    ["Staff Advances", note?.staffAdvances],
    ["Advance to Suppliers", note?.advanceToSuppliers],
    ["Other Loans & Advances", note?.otherLoansAdvances]
  ];
  const visibleOther = otherLines.filter(([, amount]) => (amount ?? 0) !== 0);
  if (visibleOther.length > 0) {
    row++;
    ws.getRow(row).getCell(1).value = "Other Receivable Components";
    ws.getRow(row).getCell(1).font = FONTS.SUBHEADING;
    row++;
    for (const [label, amount] of visibleOther) {
      writeAmountLine(row++, `  ${label}`, amount, 0);
    }
  }
  const movement = note?.provisionMovement;
  if (movement) {
    row++;
    ws.getRow(row).getCell(1).value = "Movement in Provision for Doubtful Debts";
    ws.getRow(row).getCell(1).font = FONTS.SUBHEADING;
    row++;
    writeAmountLine(row++, "  Opening Balance", movement.opening, void 0);
    writeAmountLine(row++, "  Additions during the Year", movement.additions, void 0);
    writeAmountLine(row++, "  Write-offs", -(movement.writeOffs ?? 0), void 0);
    writeAmountLine(row++, "  Reversals", -(movement.reversals ?? 0), void 0);
    writeAmountLine(row++, "  Closing Balance", movement.closing, void 0, true);
  }
  const aging = note?.agingAnalysis ?? [];
  if (aging.length > 0) {
    row++;
    ws.getRow(row).getCell(1).value = "Ageing Analysis of Trade Receivables";
    ws.getRow(row).getCell(1).font = FONTS.SUBHEADING;
    row++;
    writeHeader(row++);
    for (const bucket of aging) {
      writeAmountLine(row++, `  ${bucket.bucket}`, bucket.amount, 0);
    }
  }
  return { note33_receivablesRow: netRow, cyTotalRow: netRow };
}
function writeGenericNoteRecord(ws, title, data) {
  const safeData = data ?? {};
  writeNoteSheetTitle(ws, title);
  const hRow = ws.getRow(3);
  ["Particulars", "Current Year", "Previous Year"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle2(c);
    applyAllBorders(c);
  });
  const entries = Object.entries(safeData);
  const dataStartRow = 4;
  entries.forEach(([label, vals], i) => {
    const r = ws.getRow(dataStartRow + i);
    r.getCell(1).value = label;
    applyBodyStyle(r.getCell(1));
    r.getCell(2).value = vals.cy || null;
    r.getCell(3).value = vals.py || null;
    [2, 3].forEach((ci) => {
      const c = r.getCell(ci);
      c.numFmt = NUMBER_FORMAT2;
      c.alignment = { horizontal: "right" };
      applyBodyStyle(c);
    });
  });
  if (entries.length === 0) {
    return { cyTotalRow: dataStartRow };
  }
  const totalRowNum = dataStartRow + entries.length;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.getCell(1).value = "Total";
  applyBodyStyle(totalRow.getCell(1));
  applyTotalStyle(totalRow.getCell(1));
  const cySum = entries.reduce((s, [, v]) => s + (v.cy ?? 0), 0);
  const pySum = entries.reduce((s, [, v]) => s + (v.py ?? 0), 0);
  const cyCell = totalRow.getCell(2);
  const pyCell = totalRow.getCell(3);
  if (entries.length === 1) {
    cyCell.value = { formula: `B${dataStartRow}`, result: cySum };
    pyCell.value = { formula: `C${dataStartRow}`, result: pySum };
  } else {
    cyCell.value = {
      formula: `SUM(B${dataStartRow}:B${dataStartRow + entries.length - 1})`,
      result: cySum
    };
    pyCell.value = {
      formula: `SUM(C${dataStartRow}:C${dataStartRow + entries.length - 1})`,
      result: pySum
    };
  }
  [cyCell, pyCell].forEach((c) => {
    c.numFmt = NUMBER_FORMAT2;
    c.alignment = { horizontal: "right" };
    applyTotalStyle(c);
  });
  return { cyTotalRow: totalRowNum };
}
async function generateNFRSWorkbook(params) {
  try {
    const { company, trialBalance, balanceSheet, incomeStatement, changesInEquity, cashFlow, notes: rawNotes, adjustments } = params;
    const notes = normalizeNotesForExcel(rawNotes, incomeStatement, balanceSheet);
    const wb = new ExcelJS2.Workbook();
    wb.creator = "NFRS Reporter";
    wb.lastModifiedBy = "NFRS Reporter";
    wb.created = /* @__PURE__ */ new Date();
    const addSheet = (name, tabColor) => {
      const ws = wb.addWorksheet(name);
      if (tabColor) ws.properties = { ...ws.properties, tabColor: { argb: `FF${tabColor}` } };
      ws.columns = [{ width: 42 }, { width: 10 }, { width: 18 }, { width: 18 }];
      return ws;
    };
    writeWorkings(addSheet("Workings", COLORS.LIGHT_GRAY), company, wb);
    writeInstructions(addSheet("Instructions", COLORS.LIGHT_GRAY));
    writeEnterDetails(addSheet("Enter Details", COLORS.GREEN_INPUT), company, adjustments);
    writeTrialBalance(addSheet("Trial Balance", COLORS.BRAND_BLUE), trialBalance, company);
    const bsRowMap = writeBalanceSheet(addSheet("Balance Sheet", COLORS.BRAND_BLUE), balanceSheet, company);
    const isRowMap = writeIncomeStatement(addSheet("Income Statement", COLORS.BRAND_BLUE), incomeStatement, company);
    const ceRowMap = writeChangesInEquity(addSheet("Change in Equity", COLORS.BRAND_BLUE), changesInEquity, company);
    const cfRowMap = writeCashFlowStatement(addSheet("Cash Flow", COLORS.BRAND_BLUE), cashFlow, company);
    writeNote1_AccountingPolicies(wb, {
      ...company.accountingPolicies ?? {},
      companyName: company.companyName ?? "",
      fiscalYear: company.fiscalYear?.bsFY ?? ""
    });
    writeNote2_CriticalJudgments(wb, {
      companyName: company.companyName ?? "",
      fiscalYear: company.fiscalYear?.bsFY ?? ""
    });
    const taxNoteData = notes.note323_incomeTax ?? {
      profitBeforeTax: 0,
      addDisallowableExpenses: {},
      lessAllowableExpenses: {},
      taxableIncome: 0,
      currentTax: 0,
      taxRate: 0.25,
      advanceTaxPaid: 0,
      tdsCreditAvailable: 0,
      netTaxPayable: 0
    };
    const noteRowMap = {
      ...writeNote31_PPE(addSheet("Note 3.1 - PPE", "16A34A"), notes.note31_ppe)
    };
    writeGenericNoteRecord(addSheet("Note 3.21b - Depn Summary", "16A34A"), "3.21  Depreciation Summary", Object.fromEntries(
      (notes.note321_depreciation?.byClass ?? []).map((item) => [item.categoryName, { cy: item.depreciationForYear, py: 0 }])
    ));
    Object.assign(noteRowMap, writeGenericNoteRecord(
      addSheet("Note 3.2 - Investments", "16A34A"),
      "3.2  Investments",
      buildInvestmentsNoteData(notes.note32_investments)
    ));
    noteRowMap.note32_investmentsRow = noteRowMap.cyTotalRow;
    const receivablesMap = writeNote33_Receivables(
      addSheet("Note 3.3 - Receivables", "16A34A"),
      notes.note33_tradeReceivables
    );
    noteRowMap.note33_receivablesRow = receivablesMap.note33_receivablesRow ?? receivablesMap.cyTotalRow;
    SHEET_ROW_REGISTRY.receivablesNetRow = receivablesMap.cyTotalRow;
    const otherRecvMap = writeGenericNoteRecord(addSheet("Note 3.4 - Other Recv", "16A34A"), "3.4  Other Receivables", notes.note34_otherReceivables);
    noteRowMap.note34_otherRecvRow = otherRecvMap.cyTotalRow;
    const ncAssetsMap = writeGenericNoteRecord(addSheet("Note 3.5 - NC Assets", "16A34A"), "3.5  Other Non-Current Assets", notes.note35_otherNonCurrentAssets);
    noteRowMap.note35_ncAssetsRow = ncAssetsMap.cyTotalRow;
    const caOtherMap = writeGenericNoteRecord(addSheet("Note 3.6 - CA Other", "16A34A"), "3.6  Other Current Assets", notes.note36_otherCurrentAssets);
    noteRowMap.note36_caOtherRow = caOtherMap.cyTotalRow;
    Object.assign(noteRowMap, writeNote37_Inventories(addSheet("Note 3.7 - Inventories", "16A34A"), notes.note37_inventories));
    Object.assign(noteRowMap, writeNote38_Cash(addSheet("Note 3.8 - Cash", "16A34A"), notes.note38_cashAndEquivalents));
    Object.assign(noteRowMap, writeNote39_ShareCapital(addSheet("Note 3.9 - Share Capital", "16A34A"), notes.note39_shareCapital));
    writeGenericNoteRecord(addSheet("Note 3.10 - Reserves", "16A34A"), "3.10  Reserves", Object.fromEntries(
      Object.entries(notes.note310_reserves ?? {}).map(([k, v]) => {
        const entry = v;
        return [k, { cy: entry.closingCY ?? entry.closing ?? 0, py: entry.py ?? entry.opening ?? 0 }];
      })
    ));
    Object.assign(noteRowMap, writeNote311_Borrowings(addSheet("Note 3.11 - Borrowings", "16A34A"), notes.note311_borrowings ?? { nonCurrentBank: [], currentLoans: [] }));
    writeGenericNoteRecord(addSheet("Note 3.12 - Emp Benefits", "16A34A"), "3.12  Employee Benefits", Object.fromEntries(
      Object.entries(notes.note312_employeeBenefits ?? {}).map(([k, v]) => {
        const entry = v;
        return [k, { cy: entry.closing ?? 0, py: entry.opening ?? 0 }];
      })
    ));
    writeGenericNoteRecord(addSheet("Note 3.13 - Payables", "16A34A"), "3.13  Trade and Other Payables", notes.note313_tradePayables);
    writeGenericNoteRecord(addSheet("Note 3.14 - Provisions", "16A34A"), "3.14  Provisions", buildProvisionsNoteData(adjustments));
    writeGenericNoteRecord(addSheet("Note 3.15 - TDS", "16A34A"), "3.15  TDS Payable", Object.fromEntries(
      (notes.note313_tradePayables?.tdsPayableBreakdown ?? []).map((item) => [item.ledgerName, { cy: item.amount, py: 0 }])
    ));
    writeGenericNoteRecord(addSheet("Note 3.16 - Dividend", "16A34A"), "3.16  Dividend Payable", {
      "Total Dividend Declared": { cy: notes.note316_dividendPayable?.totalDividendDeclared ?? 0, py: 0 },
      "TDS on Dividend": { cy: notes.note316_dividendPayable?.tdsOnDividend ?? 0, py: 0 },
      "Net Dividend Payable": { cy: notes.note316_dividendPayable?.netDividendPayable ?? 0, py: 0 }
    });
    const revenueMap = writeGenericNoteRecord(addSheet("Note 3.17 - Revenue", "16A34A"), "3.17  Revenue", notes.note317_revenue);
    noteRowMap.revenueTotalRow = revenueMap.cyTotalRow;
    SHEET_ROW_REGISTRY.revenueTotalRow = revenueMap.cyTotalRow;
    writeGenericNoteRecord(addSheet("Note 3.18 - Materials", "16A34A"), "3.18  Material Consumed", {
      "Opening Stock": { cy: notes.note318_materialConsumed?.openingInventory ?? 0, py: 0 },
      "Purchases": { cy: notes.note318_materialConsumed?.purchases ?? 0, py: 0 },
      "Less: Closing Stock": { cy: -(notes.note318_materialConsumed?.closingInventory ?? 0), py: 0 },
      "Material Consumed": { cy: notes.note318_materialConsumed?.consumed ?? 0, py: 0 }
    });
    writeGenericNoteRecord(addSheet("Note 3.19 - Direct Exp", "16A34A"), "3.19  Direct Expenses", notes.note319_directExpenses);
    writeGenericNoteRecord(addSheet("Note 3.19b - Other Income", "16A34A"), "3.19  Other Income (Detail)", {
      "Interest Income": notes.note319_otherIncome?.interestIncome ?? { cy: 0, py: 0 },
      "Commission Income": notes.note319_otherIncome?.commissionIncome ?? { cy: 0, py: 0 },
      "Rental Income": notes.note319_otherIncome?.rentalIncome ?? { cy: 0, py: 0 },
      "Dividend Received": notes.note319_otherIncome?.dividendReceived ?? { cy: 0, py: 0 },
      "Gain on Disposal of Assets": notes.note319_otherIncome?.gainOnDisposalAssets ?? { cy: 0, py: 0 },
      "Miscellaneous Income": notes.note319_otherIncome?.miscellaneousIncome ?? { cy: 0, py: 0 }
    });
    const empExpMap = writeGenericNoteRecord(addSheet("Note 3.20 - Emp Expense", "16A34A"), "3.20  Employee Benefit Expenses", notes.note320_employeeBenefitExpenses);
    noteRowMap.empExpenseTotalRow = empExpMap.cyTotalRow;
    SHEET_ROW_REGISTRY.empExpenseTotalRow = empExpMap.cyTotalRow;
    writeGenericNoteRecord(addSheet("Note 3.21 - Impairment", "16A34A"), "3.21  Impairment", Object.fromEntries(
      (notes.note321_impairment ?? []).map((item) => [item.description, { cy: item.cy, py: item.py }])
    ));
    const adminExpMap = writeGenericNoteRecord(addSheet("Note 3.22 - Admin Exp", "16A34A"), "3.22  Administrative Expenses", notes.note322_adminExpenses);
    noteRowMap.adminExpenseTotalRow = adminExpMap.cyTotalRow;
    SHEET_ROW_REGISTRY.adminExpenseTotalRow = adminExpMap.cyTotalRow;
    const fiscalYearLabel = company.fiscalYear?.bsFY ?? "";
    const taxDepPools = adjustments.taxDepPool?.length ? adjustments.taxDepPool : adjustments.taxDepreciationPools ?? [];
    const disallowItems = adjustments.disallowedForTax ?? [];
    const taxDepPoolCount = taxDepPools.length > 0 ? taxDepPools.length : 1;
    const disallowItemCount = disallowItems.length > 0 ? disallowItems.length : 5;
    const predictedTaxDepTotalRow = 4 + taxDepPoolCount;
    const predictedDisallowTotalRow = 4 + disallowItemCount;
    const repairExpense = notes.note322_adminExpenses?.lineItems?.find((li) => /repair/i.test(li.label))?.cy ?? 0;
    const taxCalcMap = writeTaxCalculationSheet(
      addSheet("Tax Calculation", COLORS.LIGHT_GRAY),
      {
        companyName: company.companyName ?? "",
        address: company.address ?? "",
        incomeStatement,
        otherIncome: notes.note319_otherIncome,
        repairExpense,
        taxRate: taxNoteData.taxRate ?? company.incomeTaxRate ?? 0.25,
        taxDepSheetName: "Tax Depreciation",
        taxDepTotalRow: predictedTaxDepTotalRow
      },
      fiscalYearLabel
    );
    Object.assign(noteRowMap, taxCalcMap);
    Object.assign(noteRowMap, writeNote323_Tax(
      addSheet("Note 3.23 - Tax", "16A34A"),
      taxNoteData,
      "Tax Calculation",
      taxCalcMap.taxCalcNetPayableRow
    ));
    writeGenericNoteRecord(addSheet("Note 3.24 - Related Party", "16A34A"), "3.24  Related Party Disclosures", Object.fromEntries(
      (notes.note324_relatedParty?.relatedParties ?? []).map((p) => [p.partyName, { cy: p.outstandingBalance, py: 0 }])
    ));
    writeDisclosureTextNote(
      addSheet("Note 3.25 - Contingencies", "16A34A"),
      "3.25  Contingent Liabilities and Commitments",
      notes.note325_contingencies?.defaultText ?? "The Company has no contingent liabilities or commitments as at the reporting date."
    );
    writeDisclosureTextNote(
      addSheet("Note 3.26 - Subsequent Events", "16A34A"),
      "3.26  Events After Reporting Date",
      notes.note326_subsequentEvents?.defaultText ?? "There are no significant events after the reporting date that require adjustment to or disclosure in these financial statements."
    );
    writeAdjustments(addSheet("Adjustments", COLORS.LIGHT_GRAY), adjustments);
    const listedSharesData = adjustments.listedShares ?? (adjustments.investmentAdjustments ?? []).filter((inv) => {
      const t = inv.investmentType ?? inv.type ?? "";
      return t === "listed_trading" || t === "listed_ats" || t === "listed";
    }).map((inv) => {
      const i = inv;
      return {
        companyName: i.investmentName ?? i.name,
        openingUnits: i.units,
        purchasedUnits: 0,
        soldUnits: 0,
        closingUnits: i.units,
        openingLtp: i.costPerUnit,
        closingLtp: i.ltp ?? i.fairValuePerUnit,
        openingFV: i.totalCost,
        closingFV: i.carryingAmount ?? i.marketValue ?? i.totalFairValue,
        fvGainLoss: i.fairValueGainLoss ?? i.gainLossOnFV
      };
    });
    writePPEWorkingsSheet(
      addSheet("PPE Workings", "16A34A"),
      adjustments.assets ?? [],
      fiscalYearLabel,
      adjustments.depreciationResults ?? []
    );
    const taxDepMap = writeTaxDepreciationSheet(addSheet("Tax Depreciation", "16A34A"), taxDepPools, fiscalYearLabel);
    const disallowMap = writeDisallowForTaxSheet(addSheet("Disallow for Tax", "16A34A"), disallowItems);
    writeTaxProfitReconciliationSheet(addSheet("Tax Profit Reconciliation", COLORS.LIGHT_GRAY), {
      fiscalYear: fiscalYearLabel,
      profitBeforeTax: incomeStatement.profitBeforeTax ?? 0,
      bookDepreciation: incomeStatement.depreciation ?? 0,
      dividendExempt: Number(notes.note319_otherIncome?.dividendReceived?.cy ?? 0),
      disallowSheetName: "Disallow for Tax",
      disallowTotalRow: disallowMap.totalDisallowedRow,
      taxDepSheetName: "Tax Depreciation",
      taxDepTotalRow: taxDepMap.totalTaxDepRow,
      taxCalcSheetName: "Tax Calculation",
      taxCalcAssessableRow: taxCalcMap.assessableIncomeRow ?? 0
    });
    writeFairValueChangeSheet(
      addSheet("Fair Value Change", "16A34A"),
      listedSharesData,
      { trialBalanceFvAdjustment: adjustments.totalInvestmentFVAdjustment ?? 0 }
    );
    writeSundryDebtors(addSheet("Sundry Debtors", "16A34A"), { adjustments, trialBalance });
    writeSundryCreditors(addSheet("Sundry Creditors", "16A34A"), { adjustments, trialBalance });
    writeBankAccounts(addSheet("Bank Accounts", "16A34A"), notes.note38_cashAndEquivalents);
    const noteSheetNames = {
      ppe: "Note 3.1 - PPE",
      investments: "Note 3.2 - Investments",
      receivables: "Note 3.3 - Receivables",
      otherReceivables: "Note 3.4 - Other Recv",
      ncAssets: "Note 3.5 - NC Assets",
      caOther: "Note 3.6 - CA Other",
      inventories: "Note 3.7 - Inventories",
      cash: "Note 3.8 - Cash",
      shareCapital: "Note 3.9 - Share Capital",
      borrowings: "Note 3.11 - Borrowings",
      tax: "Note 3.23 - Tax",
      taxCalculation: "Tax Calculation"
    };
    applyBalanceSheetCrossReferences(wb, "Balance Sheet", noteSheetNames, bsRowMap, noteRowMap);
    applyIncomeStatementCrossReferences(wb, "Income Statement", {
      revenue: "Note 3.17 - Revenue",
      empExpense: "Note 3.20 - Emp Expense",
      adminExpense: "Note 3.22 - Admin Exp",
      ppe: "Note 3.1 - PPE",
      tax: "Note 3.23 - Tax",
      taxCalculation: "Tax Calculation"
    }, isRowMap, noteRowMap);
    applyCashFlowCrossReferences(wb, "Cash Flow", "Income Statement", cfRowMap, isRowMap);
    applyCashFlowReconciliation(wb, "Cash Flow", "Balance Sheet", cfRowMap);
    applyChangesInEquityCrossReferences(wb, "Change in Equity", "Income Statement", ceRowMap, isRowMap);
    applyWorkingsValidationRefs(wb, {
      balanceSheet: bsRowMap,
      incomeStatement: isRowMap,
      cashFlow: cfRowMap,
      changesInEquity: ceRowMap,
      notes: noteRowMap
    });
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error("[excelWriter] Error generating workbook:", error);
    throw error;
  }
}
function cellRef(sheetName, col, row) {
  const needsQuotes = /[\s\-!@#$%^&*()+={}\[\]|\\:;"'<>?,./]/.test(sheetName);
  const quotedSheet = needsQuotes ? `'${sheetName}'` : sheetName;
  return `=${quotedSheet}!${col}${row}`;
}
var SHEET_ROW_REGISTRY = {};
function appendNoteRef(parts, sheet, row, col = "B") {
  if (sheet && row) parts.push(cellRef(sheet, col, row).replace(/^=/, ""));
}
function applyBalanceSheetCrossReferences(wb, balanceSheetSheetName, noteSheetNames, rowMap, noteRows, cyCol = "C") {
  const ws = wb.getWorksheet(balanceSheetSheetName);
  if (!ws) {
    console.warn(`[excelWriter] Balance sheet not found: ${balanceSheetSheetName}`);
    return;
  }
  const setFormula = (rowNum, col, formula) => {
    if (!rowNum) return;
    const cell = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ""), result: 0 };
    cell.numFmt = existingNumFmt || NUMBER_FORMAT2;
    cell.font = { name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
  };
  if (noteSheetNames.ppe && noteRows.ppeNetBookValueRow) {
    setFormula(rowMap.ppeRow, cyCol, cellRef(noteSheetNames.ppe, "H", noteRows.ppeNetBookValueRow));
  }
  if (noteSheetNames.investments && noteRows.note32_investmentsRow) {
    setFormula(rowMap.ncaInvestmentsRow, cyCol, cellRef(noteSheetNames.investments, "B", noteRows.note32_investmentsRow));
    setFormula(rowMap.caInvestmentsRow, cyCol, cellRef(noteSheetNames.investments, "B", noteRows.note32_investmentsRow));
  }
  if (noteSheetNames.receivables && noteRows.note33_receivablesRow) {
    setFormula(rowMap.receivablesRow, cyCol, cellRef(noteSheetNames.receivables, "B", noteRows.note33_receivablesRow));
  }
  if (noteSheetNames.otherReceivables && noteRows.note34_otherRecvRow) {
    setFormula(rowMap.ncaReceivablesRow, cyCol, cellRef(noteSheetNames.otherReceivables, "B", noteRows.note34_otherRecvRow));
  }
  if (noteSheetNames.ncAssets && noteRows.note35_ncAssetsRow) {
    setFormula(rowMap.ncaOtherRow, cyCol, cellRef(noteSheetNames.ncAssets, "B", noteRows.note35_ncAssetsRow));
  }
  if (noteSheetNames.caOther && noteRows.note36_caOtherRow) {
    setFormula(rowMap.caOtherRow, cyCol, cellRef(noteSheetNames.caOther, "B", noteRows.note36_caOtherRow));
  }
  if (noteSheetNames.inventories && noteRows.inventoryTotalRow) {
    setFormula(rowMap.inventoriesRow, cyCol, cellRef(noteSheetNames.inventories, "B", noteRows.inventoryTotalRow));
  }
  if (noteSheetNames.cash && noteRows.cashTotalRow) {
    setFormula(rowMap.cashRow, cyCol, cellRef(noteSheetNames.cash, "B", noteRows.cashTotalRow));
  }
  if (noteSheetNames.shareCapital && noteRows.shareCapitalRow) {
    setFormula(rowMap.shareCapitalRow, cyCol, cellRef(noteSheetNames.shareCapital, "B", noteRows.shareCapitalRow));
  }
  if (noteSheetNames.borrowings && noteRows.ncBorrowingsRow) {
    setFormula(rowMap.ncBorrowingsRow, cyCol, cellRef(noteSheetNames.borrowings, "D", noteRows.ncBorrowingsRow));
  }
  if (noteSheetNames.borrowings && noteRows.cBorrowingsRow) {
    setFormula(rowMap.cBorrowingsRow, cyCol, cellRef(noteSheetNames.borrowings, "D", noteRows.cBorrowingsRow));
  }
  if (noteSheetNames.taxCalculation && noteRows.taxCalcNetPayableRow) {
    setFormula(rowMap.taxPayableRow, cyCol, cellRef(noteSheetNames.taxCalculation, "B", noteRows.taxCalcNetPayableRow));
  } else if (noteSheetNames.tax && noteRows.taxPayableRow) {
    setFormula(rowMap.taxPayableRow, cyCol, cellRef(noteSheetNames.tax, "B", noteRows.taxPayableRow));
  }
  const assetParts = [];
  appendNoteRef(assetParts, noteSheetNames.ppe, noteRows.ppeNetBookValueRow, "H");
  appendNoteRef(assetParts, noteSheetNames.investments, noteRows.note32_investmentsRow);
  appendNoteRef(assetParts, noteSheetNames.otherReceivables, noteRows.note34_otherRecvRow);
  appendNoteRef(assetParts, noteSheetNames.ncAssets, noteRows.note35_ncAssetsRow);
  appendNoteRef(assetParts, noteSheetNames.inventories, noteRows.inventoryTotalRow);
  appendNoteRef(assetParts, noteSheetNames.receivables, noteRows.note33_receivablesRow);
  appendNoteRef(assetParts, noteSheetNames.cash, noteRows.cashTotalRow);
  appendNoteRef(assetParts, noteSheetNames.caOther, noteRows.note36_caOtherRow);
  const totalAssetsCell = ws.getRow(rowMap.totalAssetsRow).getCell(cyCol);
  if (assetParts.length > 0) {
    totalAssetsCell.value = { formula: assetParts.join("+"), result: 0 };
  } else if (rowMap.totalNcaRow && rowMap.totalCaRow) {
    totalAssetsCell.value = { formula: `${cyCol}${rowMap.totalNcaRow}+${cyCol}${rowMap.totalCaRow}`, result: 0 };
  }
  totalAssetsCell.numFmt = NUMBER_FORMAT2;
  applyTotalStyle(totalAssetsCell);
  console.log("[excelWriter] Balance sheet cross-references applied.");
}
function applyIncomeStatementCrossReferences(wb, isSheetName, noteSheetNames, rowMap, noteRows, cyCol = "C") {
  const ws = wb.getWorksheet(isSheetName);
  if (!ws) return;
  const setFormula = (rowNum, col, formula) => {
    if (!rowNum) return;
    const cell = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ""), result: 0 };
    cell.numFmt = existingNumFmt || NUMBER_FORMAT2;
    cell.font = { name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
  };
  if (noteSheetNames.revenue && noteRows.revenueTotalRow) {
    setFormula(rowMap.revenueRow, cyCol, cellRef(noteSheetNames.revenue, "B", noteRows.revenueTotalRow));
  }
  if (noteSheetNames.empExpense && noteRows.empExpenseTotalRow) {
    setFormula(rowMap.empExpenseRow, cyCol, cellRef(noteSheetNames.empExpense, "B", noteRows.empExpenseTotalRow));
  }
  if (noteSheetNames.adminExpense && noteRows.adminExpenseTotalRow) {
    setFormula(rowMap.adminExpenseRow, cyCol, cellRef(noteSheetNames.adminExpense, "B", noteRows.adminExpenseTotalRow));
  }
  if (noteSheetNames.ppe && noteRows.ppeDepreciationRow) {
    setFormula(rowMap.depreciationRow, cyCol, cellRef(noteSheetNames.ppe, "E", noteRows.ppeDepreciationRow));
  }
  if (noteSheetNames.taxCalculation && noteRows.taxCalcIncomeTaxRow) {
    setFormula(rowMap.taxRow, cyCol, cellRef(noteSheetNames.taxCalculation, "D", noteRows.taxCalcIncomeTaxRow));
  } else if (noteSheetNames.tax && noteRows.taxPayableRow) {
    setFormula(rowMap.taxRow, cyCol, cellRef(noteSheetNames.tax, "B", noteRows.taxPayableRow));
  }
  console.log("[excelWriter] Income statement cross-references applied.");
}
function applyCashFlowCrossReferences(wb, cfSheetName, isSheetName, cfMap, isMap, cyCol = "C") {
  const ws = wb.getWorksheet(cfSheetName);
  if (!ws || !cfMap.profitBeforeTaxRow || !isMap.profitBeforeTaxRow) return;
  const cell = ws.getRow(cfMap.profitBeforeTaxRow).getCell(cyCol);
  cell.value = {
    formula: cellRef(isSheetName, cyCol, isMap.profitBeforeTaxRow).replace(/^=/, ""),
    result: cell.value ?? 0
  };
  cell.numFmt = NUMBER_FORMAT2;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
}
function applyChangesInEquityCrossReferences(wb, ceSheetName, isSheetName, ceMap, isMap, cyCol = "C") {
  const ws = wb.getWorksheet(ceSheetName);
  if (!ws || !ceMap.profitForYearRow || !isMap.netProfitRow) return;
  const isRef = cellRef(isSheetName, cyCol, isMap.netProfitRow).replace(/^=/, "");
  for (const col of ["E", "F"]) {
    const cell = ws.getRow(ceMap.profitForYearRow).getCell(col);
    cell.value = { formula: isRef, result: cell.value ?? 0 };
    cell.numFmt = NUMBER_FORMAT2;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
  }
}
function applyCashFlowReconciliation(wb, cfSheetName, _bsSheetName, rowMap, cyCol = "C") {
  const ws = wb.getWorksheet(cfSheetName);
  if (!ws) return;
  const closingFormula = `${cyCol}${rowMap.openingCashRow}+${cyCol}${rowMap.netOperatingRow}+${cyCol}${rowMap.netInvestingRow}+${cyCol}${rowMap.netFinancingRow}`;
  const cell = ws.getRow(rowMap.closingCashRow).getCell(cyCol);
  cell.value = { formula: closingFormula, result: 0 };
  cell.numFmt = NUMBER_FORMAT2;
  applyTotalStyle(cell);
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
  console.log("[excelWriter] Cash flow reconciliation formula applied.");
}
function applyWorkingsValidationRefs(wb, maps) {
  const ws = wb.getWorksheet("Workings");
  if (!ws) return;
  const { balanceSheet: bs, incomeStatement: is, cashFlow: cf, changesInEquity: ce } = maps;
  const valStart = 56;
  const checks = [
    {
      formula: `'Balance Sheet'!C${bs.totalAssetsRow}-'Balance Sheet'!C${bs.totalLiabilitiesEquityRow}`
    },
    {
      formula: `'Cash Flow'!C${cf.closingCashRow}-'Balance Sheet'!C${bs.cashRow}`
    },
    {
      formula: `'Income Statement'!C${is.netProfitRow}-'Change in Equity'!F${ce.profitForYearRow}`
    }
  ];
  checks.forEach((check, idx) => {
    const resultCell = ws.getRow(valStart + idx).getCell(3);
    resultCell.value = { formula: check.formula, result: 0 };
    resultCell.numFmt = NUMBER_FORMAT2;
    applyBodyStyle(resultCell);
  });
}
function writeNote1_AccountingPolicies(wb, policies) {
  const ws = wb.addWorksheet("Note 1 - Policies");
  ws.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
  };
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 100;
  let r = 1;
  const addHeading = (text, level) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = text;
    if (level === 1) {
      cell.font = { bold: true, size: 13, color: { argb: "FF1E3A5F" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF4FF" } };
      row.height = 22;
    } else if (level === 2) {
      cell.font = { bold: true, size: 11, color: { argb: "FF1E3A5F" } };
      row.height = 18;
    } else {
      cell.font = { bold: true, size: 10 };
    }
    cell.alignment = { wrapText: true, vertical: "middle" };
  };
  const addPara = (text, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = " ".repeat(indent * 4) + text;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(15, Math.ceil(text.length / 110) * 14);
  };
  const addBlank = () => {
    ws.getRow(r++).height = 6;
  };
  const depMethod = policies.depreciationMethod === "WDV" ? "Written-Down Value (WDV) method" : "Straight-Line Method (SLM)";
  const inventoryMethod = policies.inventoryCostFormula === "FIFO" ? "First-In, First-Out (FIFO)" : policies.inventoryCostFormula === "SpecificIdentification" ? "Specific Identification" : "Weighted Average Cost";
  const taxRate = policies.incomeTaxRatePercent ?? 25;
  const rounding = policies.roundingLevel ?? 100;
  const company = policies.companyName ?? "[Company Name]";
  const fy = policies.fiscalYear ?? "[Fiscal Year]";
  const authDate = policies.dateOfAuthorizationForIssue ?? "[Date]";
  addHeading(`${company}`, 1);
  addPara(`Notes to the Financial Statements for the Year Ended ${fy}`);
  addBlank();
  addHeading("NOTE 1: SIGNIFICANT ACCOUNTING POLICIES", 1);
  addBlank();
  addHeading("1.1 Statement of Compliance", 2);
  addPara(
    `These financial statements have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Accounting Standards Board Nepal (AASB) under authority of the Institute of Chartered Accountants of Nepal (ICAN). Where NAS for MEs does not address a particular transaction or event, appropriate Nepal Accounting Standards (NAS), Nepal Financial Reporting Standards (NFRS), or internationally accepted accounting principles have been applied.`
  );
  addBlank();
  addHeading("1.2 Basis of Preparation", 2);
  addPara(
    `These financial statements are prepared on the historical cost basis, except for certain financial instruments and investment properties that are measured at fair value as described in the relevant policies below. The financial statements are presented in Nepalese Rupees (NPR) and rounded to the nearest NPR ${rounding.toLocaleString("en-IN")}.`
  );
  addPara(
    `The financial statements are prepared on the going concern basis. The management has assessed the company's ability to continue as a going concern for the foreseeable future and is not aware of any material uncertainties that may cast significant doubt on this assessment.`
  );
  addBlank();
  addHeading("1.3 Reporting Period", 2);
  addPara(
    `The financial statements cover the fiscal year ${fy} in Bikram Sambat (BS) calendar, as mandated for companies registered in Nepal under the Companies Act 2063 and the Income Tax Act 2058. Comparative figures presented are for the immediately preceding fiscal year.`
  );
  addBlank();
  addHeading("1.4 Revenue Recognition", 2);
  addPara(
    `Revenue is recognised when it is probable that the economic benefits associated with the transaction will flow to the company and the amount of revenue can be measured reliably.`
  );
  addPara(`(a) Sales of Goods: Revenue from the sale of goods is recognised when the significant risks and rewards of ownership have been transferred to the buyer, the company retains neither continuing managerial involvement nor effective control over the goods sold, the amount of revenue can be measured reliably, and it is probable that the economic benefits associated with the transaction will flow to the entity.`, 1);
  addPara(`(b) Revenue from Services: Revenue from services is recognised when services are rendered, by reference to the stage of completion of the service transaction at the end of the reporting period.`, 1);
  addPara(`(c) Interest Income: Interest income is accrued on a time basis by reference to the principal outstanding and the effective interest rate applicable.`, 1);
  addPara(`(d) Dividend Income: Dividend income is recognised when the company's right to receive payment is established.`, 1);
  addBlank();
  addHeading("1.5 Property, Plant & Equipment (PPE)", 2);
  addPara(
    `Property, Plant and Equipment are stated at cost less accumulated depreciation and any accumulated impairment losses. Cost includes the purchase price, import duties, non-refundable purchase taxes, and any directly attributable costs of bringing the asset to the location and condition necessary for it to be capable of operating in the manner intended by management.`
  );
  addPara(
    `Depreciation is provided on all PPE, other than freehold land, using the ${depMethod} over the estimated useful lives of the assets. Depreciation commences when the assets are ready for their intended use.`
  );
  addPara(
    `The estimated useful lives and depreciation rates applied are consistent with the rates prescribed under Schedule 2 of the Nepal Income Tax Act 2058 (as amended) and are reviewed annually by management.`
  );
  addPara(
    `An item of PPE is derecognised upon disposal or when no future economic benefits are expected from its use or disposal. Any gain or loss arising on derecognition of the asset (calculated as the difference between the net disposal proceeds and the carrying amount of the asset) is included in the income statement in the period the item is derecognised.`
  );
  addBlank();
  addHeading("1.6 Inventories", 2);
  addPara(
    `Inventories are stated at the lower of cost and net realisable value. Cost is determined using the ${inventoryMethod} method. Net realisable value is the estimated selling price in the ordinary course of business less the estimated costs of completion and the estimated costs necessary to make the sale.`
  );
  addBlank();
  addHeading("1.7 Financial Instruments", 2);
  addPara(
    `Financial assets comprise primarily trade receivables, other receivables, and cash and cash equivalents. They are initially measured at fair value plus transaction costs. Subsequent measurement is at amortised cost using the effective interest method.`
  );
  addPara(
    `Trade receivables are measured at amortised cost, which is their face amount less any allowance for impairment. An allowance for impairment is created when there is objective evidence that the company will be unable to collect the amounts due, based on a review of all outstanding receivables at the balance sheet date.`
  );
  addBlank();
  addHeading("1.8 Investments", 2);
  addPara(
    `Investments in listed equity securities are measured at fair value through profit or loss. Investments in unlisted securities and long-term investments are carried at cost less any provision for impairment in value, where no reliable fair value can be estimated.`
  );
  addBlank();
  addHeading("1.9 Employee Benefits", 2);
  addPara(
    `(a) Short-term employee benefits: Salaries, wages, annual leave and other short-term employee benefits are accrued in the period in which the associated services are rendered by employees.`,
    1
  );
  if (policies.hasGratuityLiability) {
    addPara(
      `(b) Gratuity: The company recognises a liability for gratuity payable under the Labour Act 2074. The gratuity liability is calculated based on the last drawn monthly salary multiplied by the number of completed years of service, as prescribed under the Act. The charge for the year represents the movement in the liability during the year.`,
      1
    );
  }
  if (policies.hasLeaveEncashment) {
    addPara(
      `(c) Leave Encashment: The company accrues a liability for leave encashment based on the accumulated entitled leave balance of employees at the balance sheet date, calculated at the salary rates prevailing at the year end.`,
      1
    );
  }
  addPara(
    `(d) Staff Bonus: Provision for staff bonus is made in accordance with the Bonus Act 2030 at the rate of 10% of net profit before tax and before charging such bonus.`,
    1
  );
  addPara(
    `(e) Provident Fund and Social Security Fund: The company contributes to the Employee Provident Fund and Social Security Fund as required by law. Contributions are charged to the income statement as incurred.`,
    1
  );
  addBlank();
  addHeading("1.10 Income Tax", 2);
  addPara(
    `Income tax expense represents the sum of current tax and deferred tax. Current tax is the amount of income tax payable in respect of the taxable income for the year, calculated using tax rates enacted or substantially enacted at the balance sheet date. The applicable corporate income tax rate is ${taxRate}% as per the Nepal Income Tax Act 2058 (for the applicable category of company).`
  );
  addPara(
    `Deferred tax is recognised on all temporary differences between the carrying amounts of assets and liabilities for financial reporting purposes and the amounts used for taxation purposes. Deferred tax assets are recognised to the extent that it is probable that future taxable profit will be available against which the temporary differences can be utilised.`
  );
  addBlank();
  addHeading("1.11 Foreign Currency Transactions", 2);
  addPara(
    `Transactions in foreign currencies are recorded at the rate of exchange prevailing on the date of the transaction. Monetary assets and liabilities denominated in foreign currencies are retranslated at the rate of exchange prevailing at the balance sheet date. Exchange differences arising from the settlement of monetary items or from translating monetary items at rates different from those at which they were translated at initial recognition during the period or in previous financial statements are recognised in profit or loss in the period in which they arise.`
  );
  addBlank();
  addHeading("1.12 Authorization for Issue", 2);
  addPara(
    `These financial statements were authorized for issue by the Board of Directors of ${company} on ${authDate}.`
  );
  addBlank();
  return ws;
}
function writeNote2_CriticalJudgments(wb, params) {
  const ws = wb.addWorksheet("Note 2 - Judgments");
  ws.pageSetup = { paperSize: 9, orientation: "portrait" };
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 100;
  let r = 1;
  const addHeading = (text, isMain = false) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = text;
    cell.font = isMain ? { bold: true, size: 13, color: { argb: "FF1E3A5F" } } : { bold: true, size: 11, color: { argb: "FF1E3A5F" } };
    if (isMain) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF4FF" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    row.height = isMain ? 22 : 18;
  };
  const addPara = (text, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = " ".repeat(indent * 4) + text;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(15, Math.ceil(text.length / 110) * 14);
  };
  const addBlank = () => {
    ws.getRow(r++).height = 6;
  };
  const company = params.companyName ?? "[Company Name]";
  const fy = params.fiscalYear ?? "[Fiscal Year]";
  addHeading(`${company}`, true);
  addPara(`Notes to the Financial Statements for the Year Ended ${fy}`);
  addBlank();
  addHeading("NOTE 2: CRITICAL ACCOUNTING JUDGMENTS AND KEY SOURCES OF ESTIMATION UNCERTAINTY", true);
  addBlank();
  addPara(
    `In the application of the company's accounting policies, management is required to make judgments, estimates and assumptions about the carrying amounts of assets and liabilities that are not readily apparent from other sources. The estimates and associated assumptions are based on historical experience and other factors that are considered to be relevant. Actual results may differ from these estimates.`
  );
  addBlank();
  addPara("The estimates and underlying assumptions are reviewed on an ongoing basis. Revisions to accounting estimates are recognised in the period in which the estimate is revised if the revision affects only that period, or in the period of the revision and future periods if the revision affects both current and future periods.");
  addBlank();
  addHeading("2.1 Critical Judgments in Applying Accounting Policies", false);
  addBlank();
  addHeading("Useful Lives of PPE", false);
  addPara(
    `Management determines the estimated useful lives and related depreciation charges for the company's PPE. This estimate is based on the expected physical and technical obsolescence of assets, industry norms, and the condition of the assets. Depreciation methods and estimated useful lives are reviewed annually and adjusted if appropriate.`
  );
  addBlank();
  addHeading("Impairment of Trade Receivables", false);
  addPara(
    `Management assesses the recoverability of trade receivables based on a review of individual debtor balances, past experience, and current economic conditions. A provision for impairment is created for receivables where there is objective evidence of impairment. The assessment involves significant judgment as to the likelihood and timing of recovery.`
  );
  addBlank();
  addHeading("Inventory Valuation", false);
  addPara(
    `The company estimates net realisable value for slow-moving and obsolete inventory items. These estimates take into account anticipated selling prices, costs to completion, and selling costs. Actual realisable values may differ from estimates.`
  );
  addBlank();
  addHeading("2.2 Key Sources of Estimation Uncertainty", false);
  addBlank();
  addHeading("Income Tax", false);
  addPara(
    `The company is subject to income tax in Nepal. Significant judgment is required in determining the provision for income taxes. There are transactions and calculations for which the ultimate tax determination is uncertain. Where the final tax outcome of these matters is different from the amounts initially recorded, such differences will impact the income tax and deferred tax provisions in the period in which such determination is made.`
  );
  addBlank();
  addHeading("Employee Benefit Provisions", false);
  addPara(
    `The cost of defined benefit obligations (gratuity and leave encashment) is determined using actuarial assumptions. The principal assumptions used in the estimation are salary growth rates, employee attrition rates, and retirement ages. Changes in these assumptions will impact the carrying amount of the obligation.`
  );
  addBlank();
  addHeading("Depreciation and Residual Values", false);
  addPara(
    `The company reviews residual values and useful lives of assets at each reporting date. Estimation of residual values inherently involves uncertainty about future market conditions and the company's future plans for asset disposal.`
  );
  addBlank();
  addHeading("Provisions and Contingencies", false);
  addPara(
    `Provisions are recognised when the company has a present obligation (legal or constructive) as a result of a past event, it is probable that the company will be required to settle the obligation, and a reliable estimate can be made of the amount of the obligation. The amount recognised as a provision is the best estimate of the consideration required to settle the present obligation at the balance sheet date. Contingencies are disclosed in Note 3.16.`
  );
  addBlank();
  return ws;
}
function appendComplianceStatement(ws, params, startRow) {
  let r = startRow + 2;
  const addRow = (text, bold = false, italic = false, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(1);
    cell.value = text;
    cell.font = { bold, italic, size: 9, color: { argb: "FF374151" } };
    cell.alignment = { wrapText: true, vertical: "top", indent };
    row.height = Math.max(12, Math.ceil(text.length / 120) * 11);
  };
  const divider = ws.getRow(r++);
  const divCell = divider.getCell(1);
  divCell.border = { top: { style: "medium", color: { argb: "FF1E3A5F" } } };
  ws.mergeCells(r - 1, 1, r - 1, 5);
  addRow("NOTES TO FINANCIAL STATEMENTS", true, false);
  addRow("");
  addRow("1. STATEMENT OF COMPLIANCE", true);
  addRow(
    `These financial statements of ${params.companyName} have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Institute of Chartered Accountants of Nepal (ICAN).`,
    false,
    false,
    1
  );
  addRow("");
  addRow("2. BASIS OF PREPARATION", true);
  addRow(
    `These financial statements are prepared on the historical cost basis except for certain financial instruments measured at fair values as described in the accounting policies. The financial statements are presented in Nepalese Rupees (NPR) rounded to the nearest NPR ${params.roundingLevel.toLocaleString("en-IN")}.`,
    false,
    false,
    1
  );
  addRow("");
  addRow("3. AUTHORIZATION FOR ISSUE", true);
  addRow(
    `These financial statements for the fiscal year ${params.fiscalYear} were authorized for issue by the Board of Directors of ${params.companyName} on ${params.authorizationDate ?? "[Board Meeting Date]"}.`,
    false,
    false,
    1
  );
  addRow("");
  addRow(
    "Refer to Note 1 (Significant Accounting Policies) and Note 2 (Critical Accounting Judgments) sheets in this workbook for the complete notes to the financial statements.",
    false,
    true,
    0
  );
}

// server/services/tbTemplateWriter.ts
var TOTAL_COLS = 19;
var CY_AMOUNT_COLS = [2, 3, 4, 5, 6, 7, 8, 9];
var PY_AMOUNT_COLS = [12, 13, 14, 15, 16, 17, 18, 19];
var SECTION_MAP2 = [
  { prefixes: ["BS Equity"], header: "CAPITAL ACCOUNT & RESERVES" },
  { prefixes: ["BS NCL Borrowings"], header: "NON-CURRENT LIABILITIES - LOANS & BORROWINGS" },
  { prefixes: ["BS NCL Employee Benefits"], header: "NON-CURRENT LIABILITIES - EMPLOYEE BENEFITS" },
  { prefixes: ["BS NCL Provisions"], header: "NON-CURRENT LIABILITIES - PROVISIONS" },
  { prefixes: ["BS NCL"], header: "NON-CURRENT LIABILITIES - OTHER" },
  { prefixes: ["BS CL Trade Payables"], header: "CURRENT LIABILITIES - TRADE PAYABLES" },
  { prefixes: ["BS CL Borrowings"], header: "CURRENT LIABILITIES - LOANS & BORROWINGS" },
  { prefixes: ["BS CL Tax"], header: "CURRENT LIABILITIES - TAX PAYABLE" },
  { prefixes: ["BS CL Employee"], header: "CURRENT LIABILITIES - EMPLOYEE PAYABLES" },
  { prefixes: ["BS CL Provisions"], header: "CURRENT LIABILITIES - PROVISIONS" },
  { prefixes: ["BS CL Other"], header: "CURRENT LIABILITIES - OTHER" },
  { prefixes: ["BS CA Tax"], header: "CURRENT ASSETS - ADVANCE TAX" },
  { prefixes: ["BS NCA PPE"], header: "PROPERTY, PLANT & EQUIPMENT" },
  { prefixes: ["BS NCA/CA Investments", "BS NCA Investments"], header: "INVESTMENTS" },
  { prefixes: ["BS NCA"], header: "OTHER NON-CURRENT ASSETS" },
  { prefixes: ["BS CA Inventory"], header: "CURRENT ASSETS - INVENTORY" },
  { prefixes: ["BS CA Receivables"], header: "CURRENT ASSETS - TRADE RECEIVABLES" },
  { prefixes: ["BS CA Other Receivables"], header: "CURRENT ASSETS - OTHER RECEIVABLES" },
  { prefixes: ["BS CA Cash"], header: "CURRENT ASSETS - CASH & BANK" },
  { prefixes: ["BS CA"], header: "CURRENT ASSETS - OTHER" },
  { prefixes: ["IS Revenue"], header: "DIRECT INCOME" },
  { prefixes: ["IS Other Income"], header: "INDIRECT INCOME" },
  { prefixes: ["IS COGS"], header: "DIRECT EXPENSES" },
  { prefixes: ["IS Employee Benefits"], header: "EMPLOYEE BENEFIT EXPENSES" },
  { prefixes: ["IS Finance Costs"], header: "FINANCE COSTS" },
  { prefixes: ["IS Depreciation"], header: "DEPRECIATION" },
  { prefixes: ["IS Impairment"], header: "IMPAIRMENT EXPENSES" },
  { prefixes: ["IS Admin"], header: "ADMINISTRATIVE EXPENSES" },
  { prefixes: ["IS Tax"], header: "INCOME TAX EXPENSE" }
];
function resolveSectionHeader(statementLine) {
  for (const { prefixes, header } of SECTION_MAP2) {
    for (const prefix of prefixes) {
      if (statementLine.startsWith(prefix)) return header;
    }
  }
  return null;
}
function buildSectionAccounts2() {
  const sectionAccounts = /* @__PURE__ */ new Map();
  const sectionOrder = [];
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup || entry.statementLine === "N/A") continue;
    const header = resolveSectionHeader(entry.statementLine);
    if (!header) continue;
    if (!sectionAccounts.has(header)) {
      sectionAccounts.set(header, []);
      sectionOrder.push(header);
    }
    sectionAccounts.get(header).push({ displayLabel: entry.displayLabel });
  }
  return SECTION_MAP2.map(({ header }) => header).filter((header) => sectionAccounts.has(header)).map((header) => ({ header, accounts: sectionAccounts.get(header) }));
}
function colLetter2(col) {
  let letter = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
async function generateTrialBalanceTemplate() {
  try {
    const wb = new ExcelJS3.Workbook();
    wb.creator = "NFRS Reporter";
    wb.created = /* @__PURE__ */ new Date();
    const ws = wb.addWorksheet("Trial Balance");
    ws.getColumn(1).width = 40;
    for (const col of [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS]) {
      ws.getColumn(col).width = 14;
    }
    ws.mergeCells(1, 1, 1, TOTAL_COLS);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = "[COMPANY NAME]";
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    applyHeaderStyle2(titleCell);
    ws.getRow(1).height = 26;
    ws.mergeCells(2, 1, 2, TOTAL_COLS);
    const subtitleCell = ws.getCell(2, 1);
    subtitleCell.value = "NAS FOR MEs \u2014 TRIAL BALANCE TEMPLATE";
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    applyHeaderStyle2(subtitleCell);
    ws.mergeCells(3, 1, 3, TOTAL_COLS);
    const noteCell = ws.getCell(3, 1);
    noteCell.value = "Fill in GREEN cells only. Do not rename or delete account labels or section headers. You may insert extra rows within a section to add accounts not listed here.";
    noteCell.font = { name: "Arial", size: 10, italic: true };
    noteCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(3).height = 36;
    const cyHeaders = [
      "Particulars",
      "Opening Dr.",
      "Opening Cr.",
      "During Dr.",
      "During Cr.",
      "Adjustment Dr.",
      "Adjustment Cr.",
      "Closing Dr.",
      "Closing Cr."
    ];
    const headerRow = ws.getRow(5);
    cyHeaders.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      applySubHeaderStyle2(c);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    });
    cyHeaders.forEach((h, i) => {
      const c = headerRow.getCell(11 + i);
      c.value = h;
      applySubHeaderStyle2(c);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    });
    let currentRow = 6;
    const sections = buildSectionAccounts2();
    for (const { header, accounts } of sections) {
      ws.mergeCells(currentRow, 1, currentRow, TOTAL_COLS);
      const sectionCell = ws.getRow(currentRow).getCell(1);
      sectionCell.value = header;
      sectionCell.font = { name: "Arial", size: 10, bold: true };
      sectionCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${COLORS.SUBHEADER_BG}` }
      };
      sectionCell.alignment = { horizontal: "left", vertical: "middle" };
      currentRow++;
      for (const account of accounts) {
        const row = ws.getRow(currentRow);
        row.getCell(1).value = account.displayLabel;
        row.getCell(1).font = { name: "Arial", size: 10 };
        for (const col of [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS]) {
          const cell = row.getCell(col);
          cell.value = null;
          applyInputStyle2(cell);
          cell.numFmt = NUMBER_FORMAT2;
          cell.alignment = { horizontal: "right" };
        }
        currentRow++;
      }
    }
    const dataStartRow = 6;
    const dataEndRow = currentRow - 1;
    const totalRow = ws.getRow(currentRow);
    totalRow.getCell(1).value = "GRAND TOTAL";
    totalRow.getCell(1).font = { name: "Arial", size: 10, bold: true };
    const doubleTop = { style: "double", color: { argb: "FF1E40AF" } };
    for (const col of [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS]) {
      const cell = totalRow.getCell(col);
      const letter = colLetter2(col);
      cell.value = { formula: `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`, result: 0 };
      cell.numFmt = NUMBER_FORMAT2;
      cell.alignment = { horizontal: "right" };
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.border = { top: doubleTop };
    }
    ws.views = [{ state: "frozen", ySplit: 5 }];
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error("[tbTemplateWriter] Error generating trial balance template:", error);
    throw error;
  }
}

// server/services/aiTbConverter.ts
import Anthropic2 from "@anthropic-ai/sdk";
import ExcelJS4 from "exceljs";

// server/services/tbHierarchy.ts
var round2 = (n) => Math.round(n * 100) / 100;
function deriveClosingBalances(row) {
  if (row.isGroupRow) return row;
  let { closingDr, closingCr, openingDr, openingCr, duringDr, duringCr, adjustmentDr, adjustmentCr } = row;
  if (closingDr === 0 && closingCr === 0) {
    const netDr = openingDr + duringDr + adjustmentDr;
    const netCr = openingCr + duringCr + adjustmentCr;
    const net = netDr - netCr;
    if (net >= 0) {
      closingDr = round2(net);
      closingCr = 0;
    } else {
      closingDr = 0;
      closingCr = round2(Math.abs(net));
    }
  }
  return { ...row, closingDr, closingCr };
}
function markGroupRowsByIndentation2(rows) {
  return rows.map((row, i) => {
    let hasDeeperDescendant = false;
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces <= row.rawIndentSpaces) break;
      hasDeeperDescendant = true;
      break;
    }
    return {
      ...row,
      isGroupRow: row.isGroupRow || hasDeeperDescendant,
      rowLevel: hasDeeperDescendant ? 0 : row.rawIndentSpaces > 4 ? 2 : row.rowLevel ?? 1
    };
  });
}
function markTallyShorthandAggregates2(rows) {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    const peers = [];
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces < row.rawIndentSpaces) break;
      if (rows[j].rawIndentSpaces === row.rawIndentSpaces) {
        peers.push(rows[j].rawLabel.trim());
      }
    }
    const isShorthandAggregate = peers.some(
      (peer) => (peer.startsWith(`${row.rawLabel.trim()}:`) || peer.startsWith(`${row.rawLabel.trim()} `)) && peer.length > row.rawLabel.trim().length
    );
    return { ...row, isGroupRow: isShorthandAggregate };
  });
}
function assignParentGroups2(rows) {
  const groupStack = [];
  return rows.map((row) => {
    if (row.isGroupRow) {
      while (groupStack.length > 0 && groupStack[groupStack.length - 1].indentSpaces >= row.rawIndentSpaces) {
        groupStack.pop();
      }
      groupStack.push({
        label: row.rawLabel,
        indentSpaces: row.rawIndentSpaces,
        level: row.rowLevel
      });
      return {
        ...row,
        parentGroup: groupStack.length > 1 ? groupStack[groupStack.length - 2].label : ""
      };
    }
    const parentGroup = groupStack.length > 0 ? groupStack[groupStack.length - 1].label : "";
    return { ...row, parentGroup: row.parentGroup || parentGroup };
  });
}
function postProcessHierarchy(rows) {
  return assignParentGroups2(markTallyShorthandAggregates2(markGroupRowsByIndentation2(rows)));
}
function computeRawTBTotals(rows) {
  const leafRows = rows.filter((r) => !r.isGroupRow);
  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalDuringDr = 0;
  let totalDuringCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;
  for (const row of leafRows) {
    totalOpeningDr += row.openingDr;
    totalOpeningCr += row.openingCr;
    totalDuringDr += row.duringDr;
    totalDuringCr += row.duringCr;
    totalClosingDr += row.closingDr;
    totalClosingCr += row.closingCr;
  }
  totalClosingDr = round2(totalClosingDr);
  totalClosingCr = round2(totalClosingCr);
  const difference = round2(totalClosingDr - totalClosingCr);
  return {
    totalOpeningDr: round2(totalOpeningDr),
    totalOpeningCr: round2(totalOpeningCr),
    totalDuringDr: round2(totalDuringDr),
    totalDuringCr: round2(totalDuringCr),
    totalClosingDr,
    totalClosingCr,
    isBalanced: Math.abs(difference) < 1,
    difference
  };
}
function finalizeRawTBRows(rows, options = {}) {
  const deriveClosing = options.deriveClosing !== false;
  const runHierarchy = options.postProcessHierarchy !== false;
  let processed = rows.map((row, idx) => ({ ...row, rowIndex: idx }));
  if (deriveClosing) {
    processed = processed.map(deriveClosingBalances);
  }
  if (runHierarchy) {
    processed = postProcessHierarchy(processed);
  } else {
    processed = assignParentGroups2(processed);
  }
  processed = processed.map((row, idx) => ({ ...row, rowIndex: idx }));
  const totals = computeRawTBTotals(processed);
  const warnings = [];
  if (!totals.isBalanced) {
    warnings.push(
      `Trial Balance not balanced. Difference: ${Math.abs(totals.difference).toLocaleString("en-IN")}.`
    );
  }
  const derivedCount = rows.filter(
    (r, i) => !r.isGroupRow && r.closingDr === 0 && r.closingCr === 0 && processed[i] && (processed[i].closingDr > 0 || processed[i].closingCr > 0)
  ).length;
  if (derivedCount > 0) {
    warnings.push(
      `Closing balances derived for ${derivedCount} account${derivedCount === 1 ? "" : "s"} from opening + movement columns.`
    );
  }
  return { rows: processed, totals, warnings };
}

// server/services/aiTbConverter.ts
var BATCH_SIZE = 100;
var SYSTEM_PROMPT2 = `You are an expert Nepali chartered accountant assistant. You will be given raw rows extracted from a messy, unstructured, or non-standard trial balance export from Nepali accounting software (Tally, Swastik, Busy, or similar). Extract ALL rows in document order, including section and group header rows (e.g. "Property, Plant & Equipment", "Employee Benefit Expenses") even when they have no numeric balance. For group headers set isGroupRow=true, all amount fields to 0, and infer rawIndentSpaces from leading spaces in the label (2 spaces per indent level). For leaf ledger accounts with balances, set isGroupRow=false and populate amounts. Set parentGroup to the nearest group header above each leaf row. IGNORE: company name/address rows, titles, date ranges, blank rows, and any 'Total'/'Grand Total'/subtotal rows. Balances are sometimes shown as a single combined value like '1,43,51,552.00 Cr' or '9,664.55 Dr' \u2014 split these correctly into the Dr or Cr field based on the suffix and remove commas. If a row has separate Opening/Debit/Credit/Closing columns, map them precisely. If only a closing balance exists, populate closingDr or closingCr only, leave opening/during at 0. If opening and during-period columns exist but closing is missing, leave closing at 0 (the server will derive closing). Never invent numbers you do not see. Respond with ONLY a raw JSON array, no markdown fences, no commentary, no explanation.`;
function parseAIResponse2(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}
function isRowEmpty(row) {
  return row.every((cell) => cell === null || cell === void 0 || String(cell).trim() === "");
}
function countLeadingSpaces2(s) {
  const m = s.match(/^(\s*)/);
  return m ? m[1].length : 0;
}
function toRawTBRow(el, idx) {
  const rawLabel = String(el.rawLabel ?? "").trim();
  const rawIndentSpaces = el.rawIndentSpaces ?? countLeadingSpaces2(String(el.rawLabel ?? ""));
  const isGroupRow = Boolean(el.isGroupRow);
  const rowLevel = el.rowLevel ?? (isGroupRow ? 0 : rawIndentSpaces > 0 ? 1 : 2);
  return {
    rowIndex: idx,
    rawLabel,
    openingDr: isGroupRow ? 0 : Number(el.openingDr) || 0,
    openingCr: isGroupRow ? 0 : Number(el.openingCr) || 0,
    duringDr: isGroupRow ? 0 : Number(el.duringDr) || 0,
    duringCr: isGroupRow ? 0 : Number(el.duringCr) || 0,
    adjustmentDr: 0,
    adjustmentCr: 0,
    closingDr: isGroupRow ? 0 : Number(el.closingDr) || 0,
    closingCr: isGroupRow ? 0 : Number(el.closingCr) || 0,
    rowLevel,
    isGroupRow,
    parentGroup: String(el.parentGroup ?? "").trim(),
    rawIndentSpaces
  };
}
async function convertRoughTrialBalance(buffer, filename, apiKey) {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  let matrix;
  if (ext === ".csv") {
    matrix = parseCSVText(buffer.toString("utf-8"));
  } else {
    const workbook = new ExcelJS4.Workbook();
    await workbook.xlsx.load(buffer);
    const primaryWs = workbook.getWorksheet("Trial Balance") ?? workbook.getWorksheet("TB") ?? workbook.worksheets[0];
    if (!primaryWs) {
      throw new Error("The uploaded workbook has no worksheets.");
    }
    matrix = worksheetToMatrix(primaryWs);
  }
  const nonEmptyRows = matrix.filter((row) => !isRowEmpty(row));
  const warnings = [];
  const merged = [];
  const client = new Anthropic2({ apiKey });
  const rowSchema = '{"rawLabel": string, "openingDr": number, "openingCr": number, "duringDr": number, "duringCr": number, "closingDr": number, "closingCr": number, "isGroupRow": boolean, "parentGroup": string, "rawIndentSpaces": number, "rowLevel": number}';
  for (let i = 0; i < nonEmptyRows.length; i += BATCH_SIZE) {
    const chunk = nonEmptyRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT2,
        messages: [
          {
            role: "user",
            content: `Extract trial balance rows from this raw data. Return a JSON array where each element is exactly: ${rowSchema}. Preserve document order. Include group header rows with isGroupRow=true. Set parentGroup on every leaf row.

Raw rows:
${JSON.stringify(chunk)}`
          }
        ]
      });
      const text = response.content.filter((c) => c.type === "text").map((c) => c.type === "text" ? c.text : "").join("");
      const parsed = parseAIResponse2(text);
      merged.push(...parsed);
    } catch (err) {
      console.warn(`[aiTbConverter] batch ${batchNum} failed:`, err);
      warnings.push(
        `AI could not process ${chunk.length} raw rows in batch ${batchNum}; skipped.`
      );
    }
  }
  const rawRows = merged.map((el) => ({
    ...el,
    rawLabel: String(el.rawLabel ?? "").trim()
  })).filter((el) => {
    if (!el.rawLabel) return false;
    if (el.isGroupRow) return true;
    return !(el.openingDr === 0 && el.openingCr === 0 && el.duringDr === 0 && el.duringCr === 0 && el.closingDr === 0 && el.closingCr === 0);
  }).map((el, idx) => toRawTBRow(el, idx));
  if (rawRows.filter((r) => !r.isGroupRow).length === 0) {
    throw Object.assign(
      new Error(
        "AI could not extract any account balances from this file. Please try Manual Upload (Standard Format) instead."
      ),
      { status: 422 }
    );
  }
  const finalized = finalizeRawTBRows(rawRows);
  warnings.push(...finalized.warnings);
  const parentGroupCount = finalized.rows.filter((r) => !r.isGroupRow && r.parentGroup).length;
  const leafCount = finalized.rows.filter((r) => !r.isGroupRow).length;
  if (leafCount > 0 && parentGroupCount === 0) {
    warnings.push(
      "No parent group context was detected. Account classification may be less accurate for ambiguous accounts."
    );
  }
  return {
    rows: finalized.rows,
    ...finalized.totals,
    warnings,
    detectedColumns: {},
    headerRowIndex: 0,
    detectedFormat: "ai_converted"
  };
}

// server/services/normalizedTbWriter.ts
import ExcelJS5 from "exceljs";
var HEADERS = [
  "Account Name",
  "Opening Dr",
  "Opening Cr",
  "During Dr",
  "During Cr",
  "Adjustment Dr",
  "Adjustment Cr",
  "Closing Dr",
  "Closing Cr",
  "Parent Group"
];
async function writeNormalizedTrialBalance(rows, meta) {
  const wb = new ExcelJS5.Workbook();
  const ws = wb.addWorksheet("Trial Balance");
  if (meta?.companyName) {
    ws.addRow([meta.companyName]);
    ws.getRow(1).font = { bold: true, size: 14 };
  }
  if (meta?.fiscalYear) {
    ws.addRow([`Fiscal Year: ${meta.fiscalYear}`]);
  }
  ws.addRow([]);
  const headerRow = ws.addRow(HEADERS);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" }
  };
  for (const row of rows) {
    const indent = "  ".repeat(Math.min(4, Math.floor(row.rawIndentSpaces / 2)));
    const label = row.isGroupRow ? row.rawLabel.toUpperCase() : `${indent}${row.rawLabel}`;
    const dataRow = ws.addRow([
      label,
      row.isGroupRow ? "" : row.openingDr || "",
      row.isGroupRow ? "" : row.openingCr || "",
      row.isGroupRow ? "" : row.duringDr || "",
      row.isGroupRow ? "" : row.duringCr || "",
      row.isGroupRow ? "" : row.adjustmentDr || "",
      row.isGroupRow ? "" : row.adjustmentCr || "",
      row.isGroupRow ? "" : row.closingDr || "",
      row.isGroupRow ? "" : row.closingCr || "",
      row.parentGroup || ""
    ]);
    if (row.isGroupRow) {
      dataRow.font = { bold: true };
    }
  }
  ws.columns = [
    { width: 40 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 24 }
  ];
  for (let c = 2; c <= 9; c++) {
    ws.getColumn(c).numFmt = "#,##0.00";
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// server/routes/trialBalance.ts
var router2 = Router2();
function ensureSession(req) {
  let session = sessionStore.get(req.params.companyId);
  if (!session) {
    const companyRaw = req.body?.company;
    if (typeof companyRaw === "string") {
      try {
        const company = JSON.parse(companyRaw);
        sessionStore.set(req.params.companyId, { company: { ...company, id: req.params.companyId } });
        session = sessionStore.get(req.params.companyId);
      } catch {
      }
    }
  }
  if (!session) return null;
  return { companyId: req.params.companyId, session };
}
function countMappingProfileHits(rows, profile) {
  if (!profile || Object.keys(profile).length === 0) return 0;
  return rows.filter(
    (r) => !r.isGroupRow && profile[mappingProfileKey(r.rawLabel, r.parentGroup)]
  ).length;
}
async function classifyAndBuildTB(companyId, parsed, options) {
  const session = sessionStore.get(companyId);
  if (!session) throw Object.assign(new Error("Company session not found."), { status: 404 });
  const leafRows = parsed.rows.filter((r) => !r.isGroupRow);
  const profileHitCount = countMappingProfileHits(parsed.rows, session.mappingProfile);
  let rows = classifyAll(parsed.rows);
  rows = applyMappingProfile(rows, session.mappingProfile);
  if (options.useAI && options.apiKey) {
    try {
      rows = await classifyWithAI(rows, options.apiKey);
    } catch (aiErr) {
      console.warn("[trialBalance] AI matching failed:", aiErr);
    }
  }
  const tb = {
    rows,
    companyName: session.company?.name ?? session.company?.companyName ?? "",
    fiscalYear: session.company?.fiscalYearCurrent ?? session.company?.fiscalYear?.bsFY ?? "",
    isBalanced: parsed.isBalanced,
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    warnings: parsed.warnings,
    companyId,
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
    uploadedFileName: options.uploadedFileName,
    totalClosingDr: parsed.totalClosingDr,
    totalClosingCr: parsed.totalClosingCr,
    difference: parsed.difference,
    detectedFormat: parsed.detectedFormat,
    detectedColumns: parsed.detectedColumns,
    headerRowIndex: parsed.headerRowIndex,
    previousYearData: parsed.previousYearData ?? null,
    leafAccountCount: leafRows.length,
    groupRowCount: parsed.rows.filter((r) => r.isGroupRow).length,
    mappingProfileAppliedCount: profileHitCount,
    mappingProfileTotalAccounts: leafRows.length,
    importMode: options.importMode
  };
  const validation = validateTrialBalanceTotals(rows);
  tb.validation = validation;
  return tb;
}
router2.get("/template/download", asyncHandler(async (req, res) => {
  const buffer = await generateTrialBalanceTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="NFRS_Trial_Balance_Template.xlsx"');
  return res.send(buffer);
}));
router2.post("/:companyId/upload", tbUploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded. Please select a file and try again." });
    }
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: "File size exceeds the 50 MB limit. Please reduce the file size by removing unnecessary sheets or rows."
      });
    }
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv"
    ];
    const ext = (req.file.originalname ?? "").split(".").pop()?.toLowerCase();
    if (!allowed.includes(req.file.mimetype) && !["xlsx", "xls", "csv"].includes(ext ?? "")) {
      return res.status(415).json({
        success: false,
        error: "Unsupported file format. Please upload .xlsx, .xls, or .csv files exported from your accounting software."
      });
    }
    let session = sessionStore.get(req.params.companyId);
    if (!session) {
      const companyRaw = req.body?.company;
      if (typeof companyRaw === "string") {
        try {
          const company = JSON.parse(companyRaw);
          sessionStore.set(req.params.companyId, { company: { ...company, id: req.params.companyId } });
          session = sessionStore.get(req.params.companyId);
        } catch {
        }
      }
    }
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Company session not found on server. Save company details first, then upload again.",
        code: "SESSION_NOT_FOUND"
      });
    }
    const parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
    if (parsed.workbookMetadata?.format === "mes_template") {
      const meta = parsed.workbookMetadata;
      const current = session.company ?? {};
      const fiscalYear = meta.fiscalYear ? getFiscalYear(meta.fiscalYear) ?? current.fiscalYear : current.fiscalYear;
      const enrichedCompany = {
        ...current,
        companyName: meta.companyName || current.companyName,
        fullAddress: meta.fullAddress || current.fullAddress,
        chairperson: meta.chairperson || current.chairperson,
        director: meta.director || current.director,
        accountsHead: meta.accountsHead || current.accountsHead,
        fiscalYear,
        auditorInfo: {
          ...current.auditorInfo ?? { auditorName: "", auditorFirmName: "", position: "", icanRegNumber: "" },
          auditorName: meta.auditorName || current.auditorInfo?.auditorName || "",
          auditorFirmName: meta.auditFirmName || current.auditorInfo?.auditorFirmName || ""
        }
      };
      sessionStore.set(req.params.companyId, { company: enrichedCompany });
      session = sessionStore.get(req.params.companyId);
    }
    if (!parsed.rows || parsed.rows.length === 0) {
      return res.status(422).json({
        success: false,
        error: "No data rows found in the uploaded file. Please check your export settings and ensure the file contains account entries."
      });
    }
    const tb = await classifyAndBuildTB(req.params.companyId, parsed, {
      useAI: req.query.useAI === "true",
      uploadedFileName: req.file.originalname,
      importMode: "manual",
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    const validation = tb.validation;
    const diff = Math.abs(validation.totalClosingDr - validation.totalClosingCr);
    if (diff > 1e3) {
      return res.status(422).json({
        success: false,
        error: `Trial balance has a significant imbalance of NPR ${diff.toLocaleString("en-IN")}. Please check your accounting export before proceeding. Rounding differences up to NPR 1,000 are auto-adjusted.`,
        data: tb
      });
    }
    sessionStore.set(req.params.companyId, { trialBalance: tb });
    res.json({ success: true, data: tb });
  } catch (err) {
    next(err);
  }
});
router2.post("/:companyId/ai-convert", tbUploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded. Please select a file and try again." });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ success: false, error: "AI import is not configured on this server. Please use Manual Upload (Standard Format) instead." });
    }
    let session = sessionStore.get(req.params.companyId);
    if (!session) {
      const companyRaw = req.body?.company;
      if (typeof companyRaw === "string") {
        try {
          const company = JSON.parse(companyRaw);
          sessionStore.set(req.params.companyId, { company: { ...company, id: req.params.companyId } });
          session = sessionStore.get(req.params.companyId);
        } catch {
        }
      }
    }
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Company session not found on server. Save company details first, then try again.",
        code: "SESSION_NOT_FOUND"
      });
    }
    const parsed = await convertRoughTrialBalance(req.file.buffer, req.file.originalname, apiKey);
    const tb = await classifyAndBuildTB(req.params.companyId, parsed, {
      useAI: true,
      uploadedFileName: req.file.originalname,
      importMode: "ai",
      apiKey
    });
    sessionStore.set(req.params.companyId, { trialBalance: tb });
    res.json({ success: true, data: tb });
  } catch (err) {
    next(err);
  }
});
router2.post("/:companyId/parse-preview", tbUploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }
    const ensured = ensureSession(req);
    if (!ensured) {
      return res.status(404).json({
        success: false,
        error: "Company session not found on server. Save company details first.",
        code: "SESSION_NOT_FOUND"
      });
    }
    const mode = req.query.mode === "ai" ? "ai" : "manual";
    let parsed;
    if (mode === "ai") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: "AI import is not configured. Use manual upload instead."
        });
      }
      parsed = await convertRoughTrialBalance(req.file.buffer, req.file.originalname, apiKey);
    } else {
      parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
      if (!parsed.rows?.length) {
        return res.status(422).json({ success: false, error: "No data rows found in the uploaded file." });
      }
    }
    const profileHitCount = countMappingProfileHits(parsed.rows, ensured.session.mappingProfile);
    const preview = {
      ...parsed,
      companyId: req.params.companyId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      uploadedFileName: req.file.originalname,
      importMode: mode,
      mappingProfileAppliedCount: profileHitCount,
      mappingProfileTotalAccounts: parsed.rows.filter((r) => !r.isGroupRow).length
    };
    sessionStore.set(req.params.companyId, { rawTrialBalance: preview });
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
});
router2.post("/:companyId/confirm-normalized", asyncHandler(async (req, res) => {
  const ensured = ensureSession(req);
  if (!ensured) {
    return res.status(404).json({ success: false, error: "Company session not found.", code: "SESSION_NOT_FOUND" });
  }
  const inputRows = req.body.rows ?? [];
  if (!inputRows.length) {
    return res.status(400).json({ success: false, error: "No trial balance rows provided." });
  }
  const stored = ensured.session.rawTrialBalance;
  const importMode = stored?.importMode ?? "manual";
  const useAI = req.body.useAI === true || importMode === "ai";
  const finalized = finalizeRawTBRows(inputRows);
  const parsed = {
    rows: finalized.rows,
    ...finalized.totals,
    warnings: [
      ...stored?.warnings ?? [],
      ...finalized.warnings
    ],
    detectedColumns: stored?.detectedColumns ?? {},
    headerRowIndex: stored?.headerRowIndex ?? 0,
    detectedFormat: stored?.detectedFormat ?? "full",
    previousYearData: stored?.previousYearData ?? null
  };
  const tb = await classifyAndBuildTB(req.params.companyId, parsed, {
    useAI,
    uploadedFileName: stored?.uploadedFileName,
    importMode,
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const validation = tb.validation;
  const diff = Math.abs(validation.totalClosingDr - validation.totalClosingCr);
  if (importMode === "manual" && diff > 1e3) {
    return res.status(422).json({
      success: false,
      error: `Trial balance has a significant imbalance of NPR ${diff.toLocaleString("en-IN")}.`,
      data: tb
    });
  }
  sessionStore.set(req.params.companyId, { trialBalance: tb, rawTrialBalance: void 0 });
  res.json({ success: true, data: tb });
}));
router2.post("/:companyId/normalized/save", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.rawTrialBalance) {
    return res.status(404).json({ error: "No normalized preview in session." });
  }
  const inputRows = req.body.rows ?? [];
  if (!inputRows.length) {
    return res.status(400).json({ error: "No rows provided." });
  }
  const finalized = finalizeRawTBRows(inputRows);
  const existing = session.rawTrialBalance;
  const updated = {
    ...existing,
    rows: finalized.rows,
    ...finalized.totals,
    warnings: [...existing.warnings ?? [], ...finalized.warnings]
  };
  sessionStore.set(req.params.companyId, { rawTrialBalance: updated });
  res.json({ success: true, data: updated });
}));
router2.get("/:companyId/normalized/export", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  const raw = session?.rawTrialBalance;
  const rows = raw?.rows ?? session?.trialBalance?.rows;
  if (!rows?.length) {
    return res.status(404).json({ error: "No normalized trial balance available to export." });
  }
  const company = session?.company;
  const buffer = await writeNormalizedTrialBalance(rows, {
    companyName: company?.companyName,
    fiscalYear: company?.fiscalYear?.bsFY,
    filename: raw?.uploadedFileName
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="Normalized_Trial_Balance.xlsx"');
  return res.send(buffer);
}));
router2.get("/:companyId", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: "No trial balance loaded for this company." });
  return res.json(session.trialBalance);
}));
router2.put("/:companyId/mapping", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: "No trial balance loaded." });
  const updates = req.body.updates ?? [];
  const updatedRows = [...session.trialBalance.rows];
  for (const update of updates) {
    const idx = updatedRows.findIndex((r) => r.rowIndex === update.rowIndex);
    if (idx !== -1) {
      updatedRows[idx] = {
        ...updatedRows[idx],
        nfrsCategory: update.nfrsCategory,
        matchedLabel: update.matchedLabel,
        confidence: 100,
        matchMethod: "manual",
        needsReview: false,
        userOverride: true
      };
    }
  }
  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  updatedTB.validation = validation;
  const mappingProfile = upsertMappingProfile(session.mappingProfile ?? {}, updatedRows);
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB, mappingProfile });
  return res.json(updatedTB);
}));
router2.put("/:companyId/mapping/:rowIndex", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: "No trial balance loaded." });
  const { nfrsCategory } = req.body;
  if (!nfrsCategory) return res.status(400).json({ error: "nfrsCategory is required." });
  const updatedRows = [...session.trialBalance.rows];
  const idx = updatedRows.findIndex((r) => String(r.rowIndex) === req.params.rowIndex);
  if (idx === -1) return res.status(404).json({ error: "Row not found." });
  updatedRows[idx] = {
    ...updatedRows[idx],
    nfrsCategory,
    confidence: 100,
    matchMethod: "manual",
    needsReview: false,
    userOverride: true
  };
  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  updatedTB.validation = validation;
  const mappingProfile = upsertMappingProfile(session.mappingProfile ?? {}, updatedRows);
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB, mappingProfile });
  return res.json({ updated: true, row: updatedRows[idx] });
}));
router2.post("/:companyId/rematch-ai", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: "No trial balance loaded." });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI matching is not configured. Set ANTHROPIC_API_KEY on the server." });
  }
  const lowConfRows = session.trialBalance.rows.filter(
    (r) => !r.isGroupRow && !r.userOverride && (r.confidence ?? 0) < 80
  );
  if (lowConfRows.length === 0) {
    return res.json({ message: "All accounts already matched with high confidence.", updatedCount: 0, trialBalance: session.trialBalance });
  }
  const aiInput = lowConfRows.map((r) => ({
    rowIndex: r.rowIndex,
    rawLabel: r.rawLabel,
    parentGroup: r.parentGroup ?? "",
    closingDr: r.closingDr ?? 0,
    closingCr: r.closingCr ?? 0
  }));
  const aiResults = await aiMatchUnresolved(aiInput, session.company, apiKey);
  const aiByRowIndex = new Map(aiResults.map((r) => [r.rowIndex, r]));
  let updatedCount = 0;
  const updatedRows = session.trialBalance.rows.map((row) => {
    if (row.isGroupRow || row.userOverride) return row;
    const ai = aiByRowIndex.get(row.rowIndex);
    if (!ai) return row;
    updatedCount += 1;
    return {
      ...row,
      nfrsCategory: ai.nfrsCategory,
      matchedLabel: null,
      confidence: ai.confidence,
      matchMethod: "ai",
      needsReview: ai.confidence < 80,
      displayLabel: row.displayLabel ?? row.rawLabel
    };
  });
  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  updatedTB.validation = validation;
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB });
  return res.json({ updatedCount, trialBalance: updatedTB });
}));
router2.get("/:companyId/validation", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: "No trial balance loaded." });
  const validation = validateTrialBalanceTotals(session.trialBalance.rows);
  return res.json(validation);
}));
var trialBalance_default = router2;

// server/routes/adjustments.ts
import { Router as Router3 } from "express";

// server/store/subledgerStore.ts
import crypto2 from "crypto";
var store = /* @__PURE__ */ new Map();
function emptySubledger(sessionId) {
  return {
    sessionId,
    debtors: [],
    creditors: [],
    bankAccounts: [],
    relatedParties: [],
    lastUpdatedAt: /* @__PURE__ */ new Date()
  };
}
function getSubledger(sessionId) {
  return store.get(sessionId) ?? emptySubledger(sessionId);
}
function upsertDebtors(sessionId, debtors) {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = debtors.map((d) => ({
    ...d,
    id: d.id || crypto2.randomUUID(),
    debitBalance: Math.max(0, d.debitBalance ?? 0),
    creditBalance: Math.max(0, d.creditBalance ?? 0)
  }));
  const updated = {
    ...existing,
    debtors: normalised,
    lastUpdatedAt: /* @__PURE__ */ new Date()
  };
  store.set(sessionId, updated);
  return updated;
}
function upsertCreditors(sessionId, creditors) {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = creditors.map((c) => ({
    ...c,
    id: c.id || crypto2.randomUUID(),
    creditBalance: Math.max(0, c.creditBalance ?? 0),
    debitBalance: Math.max(0, c.debitBalance ?? 0)
  }));
  const updated = {
    ...existing,
    creditors: normalised,
    lastUpdatedAt: /* @__PURE__ */ new Date()
  };
  store.set(sessionId, updated);
  return updated;
}
function upsertBankAccounts(sessionId, bankAccounts) {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = bankAccounts.map((b) => ({
    ...b,
    id: b.id || crypto2.randomUUID()
  }));
  const updated = {
    ...existing,
    bankAccounts: normalised,
    lastUpdatedAt: /* @__PURE__ */ new Date()
  };
  store.set(sessionId, updated);
  return updated;
}
function upsertRelatedParties(sessionId, relatedParties) {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = relatedParties.map((rp) => ({
    ...rp,
    id: rp.id || crypto2.randomUUID(),
    transactionsCurrentYear: (rp.transactionsCurrentYear ?? []).map((t) => ({
      ...t,
      id: t.id || crypto2.randomUUID()
    }))
  }));
  const updated = {
    ...existing,
    relatedParties: normalised,
    lastUpdatedAt: /* @__PURE__ */ new Date()
  };
  store.set(sessionId, updated);
  return updated;
}
function deleteSubledger(sessionId) {
  return store.delete(sessionId);
}
function validateSubledger(sessionId, tbDebtorTotal, tbCreditorTotal) {
  const data = getSubledger(sessionId);
  const warnings = [];
  const debtorTotal = data.debtors.reduce((s, d) => s + d.debitBalance, 0);
  const creditorTotal = data.creditors.reduce((s, c) => s + c.creditBalance, 0);
  const bankAssetTotal = data.bankAccounts.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const bankLiabilityTotal = data.bankAccounts.filter((b) => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);
  const debtorDiff = Math.abs(debtorTotal - tbDebtorTotal);
  if (data.debtors.length > 0 && debtorDiff > 1) {
    warnings.push(
      `Debtor subledger total (NPR ${debtorTotal.toLocaleString("en-IN")}) does not match trial balance trade receivables (NPR ${tbDebtorTotal.toLocaleString("en-IN")}). Difference: NPR ${debtorDiff.toLocaleString("en-IN")}.`
    );
  }
  const creditorDiff = Math.abs(creditorTotal - tbCreditorTotal);
  if (data.creditors.length > 0 && creditorDiff > 1) {
    warnings.push(
      `Creditor subledger total (NPR ${creditorTotal.toLocaleString("en-IN")}) does not match trial balance trade payables (NPR ${tbCreditorTotal.toLocaleString("en-IN")}). Difference: NPR ${creditorDiff.toLocaleString("en-IN")}.`
    );
  }
  return {
    debtorTotal,
    creditorTotal,
    bankAssetTotal,
    bankLiabilityTotal,
    isValid: warnings.length === 0,
    warnings
  };
}
function cleanupSubledger(maxAgeHours) {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1e3;
  let removed = 0;
  for (const [id, data] of store.entries()) {
    if (data.lastUpdatedAt.getTime() < cutoff) {
      store.delete(id);
      removed++;
    }
  }
  return removed;
}
var subledgerStore = {
  get: getSubledger,
  upsertDebtors,
  upsertCreditors,
  upsertBankAccounts,
  upsertRelatedParties,
  delete: deleteSubledger,
  validate: validateSubledger,
  cleanup: cleanupSubledger,
  size: () => store.size
};

// server/services/ppeCategoryMap.ts
var PPE_CLASSES = [
  { categoryId: "Land", label: "Land", tbCategories: ["ppe_land"] },
  { categoryId: "Building", label: "Buildings", tbCategories: ["ppe_buildings"] },
  {
    categoryId: "OfficeEquipment",
    label: "Furniture, Computers & Office Equipment",
    tbCategories: ["ppe_office_equipment", "ppe_furniture", "ppe_computers"]
  },
  { categoryId: "Vehicle", label: "Vehicles", tbCategories: ["ppe_vehicles"] },
  { categoryId: "PlantMachinery", label: "Plant & Machinery", tbCategories: ["ppe_plant_machinery"] },
  { categoryId: "Intangible", label: "Intangibles / Software", tbCategories: ["ppe_intangibles"] },
  { categoryId: "UnderConstruction", label: "Capital Work in Progress", tbCategories: ["ppe_cwip"] }
];
var PPE_CLASS_ALIASES = {
  land: "Land",
  building: "Building",
  buildings: "Building",
  ppe_buildings: "Building",
  ppe_land: "Land",
  officeequipment: "OfficeEquipment",
  office_equipment: "OfficeEquipment",
  ppe_office_equipment: "OfficeEquipment",
  ppe_furniture: "OfficeEquipment",
  ppe_computers: "OfficeEquipment",
  furniture: "OfficeEquipment",
  computers: "OfficeEquipment",
  vehicle: "Vehicle",
  vehicles: "Vehicle",
  ppe_vehicles: "Vehicle",
  plantmachinery: "PlantMachinery",
  plant_machinery: "PlantMachinery",
  ppe_plant_machinery: "PlantMachinery",
  intangible: "Intangible",
  intangibles: "Intangible",
  ppe_intangibles: "Intangible",
  underconstruction: "UnderConstruction",
  cwip: "UnderConstruction",
  ppe_cwip: "UnderConstruction",
  wip: "UnderConstruction"
};
function normalizePPEClassId(value) {
  if (!value) return "OfficeEquipment";
  const direct = PPE_CLASSES.find((c) => c.categoryId === value);
  if (direct) return direct.categoryId;
  const key = value.toLowerCase().replace(/[\s_-]/g, "");
  return PPE_CLASS_ALIASES[key] ?? PPE_CLASS_ALIASES[value.toLowerCase()] ?? "OfficeEquipment";
}
function ppeClassLabel(categoryId) {
  return PPE_CLASSES.find((c) => c.categoryId === categoryId)?.label ?? categoryId;
}
function ppeTbCategories(categoryId) {
  const normalized = normalizePPEClassId(categoryId);
  return PPE_CLASSES.find((c) => c.categoryId === normalized)?.tbCategories ?? [];
}

// server/services/depreciationEngine.ts
var DEFAULT_RATES = {
  Land: { rate: 0, method: "SLM" },
  Building: { rate: 0.04, method: "SLM" },
  OfficeEquipment: { rate: 0.25, method: "WDV" },
  Vehicle: { rate: 0.2, method: "WDV" },
  PlantMachinery: { rate: 0.15, method: "WDV" },
  Intangible: { rate: 0.2, method: "SLM" },
  UnderConstruction: { rate: 0, method: "SLM" }
};
var TAX_POOLS = [
  { poolName: "Pool A (Building 5%)", rate: 0.05, classes: ["Building"] },
  { poolName: "Pool B (Computers & Software 25%)", rate: 0.25, classes: ["Intangible", "OfficeEquipment"] },
  { poolName: "Pool C (Office Equipment & Furniture 25%)", rate: 0.25, classes: ["OfficeEquipment"] },
  { poolName: "Pool D (Vehicles 20%)", rate: 0.2, classes: ["Vehicle"] },
  { poolName: "Pool E (Plant & Machinery 15%)", rate: 0.15, classes: ["PlantMachinery"] }
];
function parseBSMonth(dateStr) {
  const months = {
    shrawan: 1,
    bhadra: 2,
    aswin: 3,
    kartik: 4,
    mangsir: 5,
    poush: 6,
    magh: 7,
    falgun: 8,
    chaitra: 9,
    baisakh: 10,
    jestha: 11,
    ashadh: 12
  };
  const parts = dateStr.trim().split(/\s+/);
  return months[(parts[1] ?? "").toLowerCase()] ?? 1;
}
function monthsHeldInFY(purchaseDate) {
  if (typeof purchaseDate === "number") {
    return 12;
  }
  const month = parseBSMonth(purchaseDate);
  if (month <= 6) return 12;
  if (month <= 9) return 12 - (month - 6) * 2;
  return Math.max(1, 12 - month + 1);
}
function getRateAndMethod(asset, policies) {
  if (asset.depreciationMethodOverride) {
    return {
      rate: asset.rateOverride ?? DEFAULT_RATES[asset.assetClass]?.rate ?? 0.1,
      method: asset.depreciationMethodOverride
    };
  }
  const policyRate = policies?.depreciationRates?.[asset.assetClass];
  const defaults = DEFAULT_RATES[asset.assetClass] ?? { rate: 0.1, method: "SLM" };
  return {
    rate: policyRate ?? defaults.rate,
    method: policies?.depreciationMethod ?? defaults.method
  };
}
function computeAccountingDepreciation(asset, policies) {
  const raw = asset;
  const assetLabel = asset.assetName ?? raw.name ?? asset.id;
  let purchaseDateForCalc;
  if (raw.purchaseDateBS) {
    purchaseDateForCalc = raw.purchaseDateBS;
  } else if (typeof raw.purchaseDate === "number") {
    purchaseDateForCalc = raw.purchaseDate;
  } else if (raw.purchaseDate) {
    purchaseDateForCalc = raw.purchaseDate;
  } else {
    throw new Error(`Asset '${assetLabel}': purchaseDate or purchaseDateBS required.`);
  }
  const { rate, method } = getRateAndMethod(asset, policies);
  const costBase = asset.originalCost + asset.additionsCY;
  const months = monthsHeldInFY(purchaseDateForCalc);
  const fraction = asset.disposalDate ? months / 12 : months / 12;
  const accumulatedDepnPY = raw.accumDepn ?? asset.accumulatedDepnPY ?? raw.accumulatedDepreciation ?? 0;
  let depreciationCY = 0;
  if (asset.assetClass === "Land" || rate === 0) {
    depreciationCY = 0;
  } else if (method === "SLM") {
    depreciationCY = costBase * rate * fraction;
  } else {
    const wdv = costBase - accumulatedDepnPY;
    depreciationCY = wdv * rate * fraction;
  }
  if (asset.disposalDate && asset.disposalValue !== void 0) {
    const nbv = costBase - accumulatedDepnPY - depreciationCY;
    const gainLoss = asset.disposalValue - nbv;
    void gainLoss;
  }
  const accumulatedDepnCY = accumulatedDepnPY + depreciationCY;
  const netBookValueCY = costBase - accumulatedDepnCY;
  const netBookValuePY = asset.originalCost - accumulatedDepnPY;
  return {
    ...asset,
    depreciationCY: Math.round(depreciationCY * 100) / 100,
    accumulatedDepnCY: Math.round(accumulatedDepnCY * 100) / 100,
    netBookValueCY: Math.round(netBookValueCY * 100) / 100,
    netBookValuePY: Math.round(netBookValuePY * 100) / 100
  };
}
function buildPPENote(assets, policies) {
  const classMap = /* @__PURE__ */ new Map();
  for (const asset of assets) {
    const name = asset.assetClass;
    if (!classMap.has(name)) {
      classMap.set(name, {
        name,
        costOpeningDr: 0,
        costOpeningCr: 0,
        additions: 0,
        disposals: 0,
        costClosing: 0,
        accumDepnOpening: 0,
        depreciationCharged: 0,
        impairmentLosses: 0,
        disposalDepn: 0,
        accumDepnClosing: 0,
        carryingAmountOpening: 0,
        carryingAmountClosing: 0
      });
    }
    const cls = classMap.get(name);
    cls.costOpeningDr += asset.originalCost;
    cls.additions += asset.additionsCY;
    cls.disposals += asset.disposalValue ?? 0;
    cls.accumDepnOpening += asset.accumulatedDepnPY;
    cls.depreciationCharged += asset.depreciationCY ?? 0;
    cls.accumDepnClosing += asset.accumulatedDepnCY ?? 0;
    cls.carryingAmountOpening += asset.netBookValuePY ?? 0;
    cls.carryingAmountClosing += asset.netBookValueCY ?? 0;
    cls.costClosing = cls.costOpeningDr + cls.additions - cls.disposals;
  }
  const classes = Array.from(classMap.values());
  const totals = classes.reduce(
    (acc, c) => ({
      name: "Total",
      costOpeningDr: acc.costOpeningDr + c.costOpeningDr,
      costOpeningCr: 0,
      additions: acc.additions + c.additions,
      disposals: acc.disposals + c.disposals,
      costClosing: acc.costClosing + c.costClosing,
      accumDepnOpening: acc.accumDepnOpening + c.accumDepnOpening,
      depreciationCharged: acc.depreciationCharged + c.depreciationCharged,
      impairmentLosses: acc.impairmentLosses + c.impairmentLosses,
      disposalDepn: acc.disposalDepn + c.disposalDepn,
      accumDepnClosing: acc.accumDepnClosing + c.accumDepnClosing,
      carryingAmountOpening: acc.carryingAmountOpening + c.carryingAmountOpening,
      carryingAmountClosing: acc.carryingAmountClosing + c.carryingAmountClosing
    }),
    {
      name: "Total",
      costOpeningDr: 0,
      costOpeningCr: 0,
      additions: 0,
      disposals: 0,
      costClosing: 0,
      accumDepnOpening: 0,
      depreciationCharged: 0,
      impairmentLosses: 0,
      disposalDepn: 0,
      accumDepnClosing: 0,
      carryingAmountOpening: 0,
      carryingAmountClosing: 0
    }
  );
  const depreciationRates = {};
  for (const [cls, def] of Object.entries(DEFAULT_RATES)) {
    depreciationRates[cls] = policies?.depreciationRates?.[cls] ?? def.rate;
  }
  return {
    classes,
    totals,
    depreciationRates,
    depreciationMethod: policies?.depreciationMethod ?? "SLM",
    securityNote: "",
    WIPNote: ""
  };
}
function computeTaxDepPool(assets, openingBases, taxableIncome, repairExpenses = {}) {
  const poolResults = TAX_POOLS.map((pool) => {
    const poolAssets = assets.filter((a) => pool.classes.includes(a.assetClass));
    let additions = 0;
    let disposals = 0;
    for (const a of poolAssets) {
      additions += a.additionsCY ?? 0;
      disposals += a.disposalValue ?? 0;
    }
    const openingBasis = openingBases[pool.poolName] ?? 0;
    let repairExpense = repairExpenses[pool.poolName] ?? 0;
    const repairThreshold = openingBasis * 0.07;
    const capitalizedRepairs = Math.max(0, repairExpense - repairThreshold);
    additions += capitalizedRepairs;
    const depreciationBasis = openingBasis + additions - disposals;
    const depreciation = depreciationBasis * pool.rate;
    const netDepreciation = depreciation;
    return {
      poolName: pool.poolName,
      pool: pool.poolName,
      rate: pool.rate,
      openingBasis,
      additions,
      disposals,
      depreciationBasis: Math.round(depreciationBasis * 100) / 100,
      netDepreciation: Math.round(netDepreciation * 100) / 100,
      repairExpense
    };
  });
  const totalNetDep = poolResults.reduce((s, p) => s + p.netDepreciation, 0);
  const maxAllowable = taxableIncome * (2 / 3);
  const totalUnabsorbed = Math.max(0, totalNetDep - maxAllowable);
  return poolResults.map((pool) => {
    const share = totalNetDep > 0 ? pool.netDepreciation / totalNetDep : 0;
    const unabsorbed = Math.round(totalUnabsorbed * share * 100) / 100;
    const taxableDepreciation = Math.round((pool.netDepreciation - unabsorbed) * 100) / 100;
    const nextYearBasis = Math.max(0, pool.depreciationBasis - taxableDepreciation);
    return {
      poolName: pool.poolName,
      pool: pool.poolName,
      rate: pool.rate,
      openingBasis: pool.openingBasis,
      additions: pool.additions,
      disposals: pool.disposals,
      absorbed: taxableDepreciation,
      unabsorbed,
      taxDepreciation: taxableDepreciation,
      depreciationBasis: pool.depreciationBasis,
      closingBasis: Math.round(nextYearBasis * 100) / 100,
      nextYearBasis: Math.round(nextYearBasis * 100) / 100,
      repairExpense: pool.repairExpense
    };
  });
}
function computeDepreciation(assetRegister, policies, options) {
  const assetRegisterComputed = assetRegister.map(
    (a) => computeAccountingDepreciation(a, policies)
  );
  const totalDepreciationExpense = assetRegisterComputed.reduce(
    (s, a) => s + (a.depreciationCY ?? 0),
    0
  );
  const ppeTotals = buildPPENote(assetRegisterComputed, policies);
  const taxDepSchedule = computeTaxDepPool(
    assetRegisterComputed,
    options?.taxOpeningBases ?? {},
    options?.taxableIncome ?? 0,
    options?.repairExpenses
  );
  return {
    assetRegisterComputed,
    ppeTotals,
    taxDepSchedule,
    totalDepreciationExpense: Math.round(totalDepreciationExpense * 100) / 100
  };
}
function calculateDepreciationSummary(assets, _categories, _fiscalYear) {
  const result = computeDepreciation(assets);
  const summary = result.ppeTotals.classes.map((cls) => {
    const categoryId = normalizePPEClassId(cls.name);
    const classAssets = result.assetRegisterComputed.filter(
      (asset) => normalizePPEClassId(asset.assetClass) === categoryId
    );
    return {
      categoryId,
      categoryName: ppeClassLabel(categoryId),
      openingCost: cls.costOpeningDr,
      additions: cls.additions,
      disposals: cls.disposals,
      closingCost: cls.costClosing,
      openingAccumDepn: cls.accumDepnOpening,
      depnForYear: cls.depreciationCharged,
      depnOnDisposal: cls.disposalDepn,
      closingAccumDepn: cls.accumDepnClosing,
      netBookValueClosing: cls.carryingAmountClosing,
      assets: classAssets
    };
  });
  return {
    results: result.assetRegisterComputed,
    summary
  };
}
function calculateTaxDepreciation(assets, _categories, openingPoolBases, taxableIncome = 0, repairExpenses) {
  return computeDepreciation(assets, void 0, {
    taxOpeningBases: openingPoolBases,
    taxableIncome,
    repairExpenses
  }).taxDepSchedule;
}

// server/routes/adjustments.ts
function toDepreciationAssets(assets) {
  return assets.map((asset) => ({
    id: asset.id,
    assetClass: normalizePPEClassId(asset.categoryId),
    assetName: asset.assetName,
    purchaseDate: asset.purchaseDateBS,
    purchaseDateBS: asset.purchaseDateBS,
    originalCost: asset.originalCost,
    additionsCY: asset.additionalCost ?? 0,
    accumulatedDepnPY: asset.accumDepreciationOpening ?? 0,
    depreciationMethodOverride: asset.depreciationMethod === "WrittenDownValue" || asset.depreciationMethod === "WDV" ? "WDV" : "SLM",
    rateOverride: asset.wdvRate,
    disposed: asset.disposed,
    disposalDate: asset.disposalDateBS,
    disposalValue: asset.disposalValue
  }));
}
var router3 = Router3();
var emptyAdj = (companyId, fiscalYear) => ({
  companyId,
  fiscalYear,
  assets: [],
  depreciationResults: [],
  depreciationSummary: [],
  taxDepreciationPools: [],
  inventoryAdjustments: [],
  investmentAdjustments: [],
  provisions: [],
  journalEntries: [],
  disallowedForTax: [],
  totalDepreciationExpense: 0,
  totalInventoryImpairment: 0,
  totalInvestmentFVAdjustment: 0,
  totalProvisions: 0,
  gainOnDisposals: 0,
  lossOnDisposals: 0
});
router3.post("/:companyId/assets", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const assets = req.body.assets ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear?.bsFY ?? "");
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, assets } });
  return res.json({ message: "Asset register saved.", count: assets.length });
}));
router3.post("/:companyId/calculate-depreciation", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.company) return res.status(404).json({ error: "Company not found." });
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company.fiscalYear?.bsFY ?? "");
  const assetCategories = session.company.accountingPolicies?.assetCategories ?? [];
  const fiscalYear = session.company.fiscalYear?.bsFY ?? "2081/82";
  const { results, summary } = calculateDepreciationSummary(
    toDepreciationAssets(adj.assets ?? []),
    assetCategories,
    fiscalYear
  );
  const totalDepreciation = results.reduce((s, r) => s + (r.depreciationCY ?? r.depnForYear ?? 0), 0);
  const gainOnDisposals = results.filter((r) => (r.gainLossOnDisposal ?? 0) > 0).reduce((s, r) => s + (r.gainLossOnDisposal ?? 0), 0);
  const lossOnDisposals = results.filter((r) => (r.gainLossOnDisposal ?? 0) < 0).reduce((s, r) => s + Math.abs(r.gainLossOnDisposal ?? 0), 0);
  const openingPoolBases = req.body.openingPoolBases ?? {};
  const taxableIncome = req.body.taxableIncome ?? 0;
  const repairExpenses = req.body.repairExpenses ?? {};
  let effectiveTaxableIncome = taxableIncome;
  if (!effectiveTaxableIncome && session.trialBalance) {
    const tbRows = session.trialBalance.rows ?? [];
    const sumCr2 = (cats) => tbRows.filter((r) => cats.includes(String(r.nfrsCategory ?? ""))).reduce((s, r) => s + (r.closingCr ?? 0), 0);
    const sumDr2 = (cats) => tbRows.filter((r) => cats.includes(String(r.nfrsCategory ?? ""))).reduce((s, r) => s + (r.closingDr ?? 0), 0);
    const revenue = sumCr2(["revenue", "sales", "service_income"]);
    const expenses = sumDr2(["cost_of_sales", "admin_expenses", "employee_benefits", "finance_costs", "depreciation_expense"]);
    effectiveTaxableIncome = Math.max(0, revenue - expenses);
  }
  const taxPools = calculateTaxDepreciation(
    toDepreciationAssets(adj.assets ?? []),
    assetCategories,
    openingPoolBases,
    effectiveTaxableIncome,
    repairExpenses
  );
  const updatedAdj = {
    ...adj,
    depreciationResults: results,
    depreciationSummary: summary,
    taxDepreciationPools: taxPools,
    totalDepreciationExpense: totalDepreciation,
    gainOnDisposals,
    lossOnDisposals
  };
  sessionStore.set(req.params.companyId, { adjustments: updatedAdj });
  return res.json({
    results,
    summary,
    taxPools,
    totalDepreciationExpense: totalDepreciation,
    gainOnDisposals,
    lossOnDisposals
  });
}));
router3.post("/:companyId/provisions", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const provisions = req.body.provisions ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear?.bsFY ?? "");
  const totalProvisions = provisions.reduce((s, p) => s + p.additionForYear, 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, provisions, totalProvisions } });
  return res.json({ message: "Provisions saved.", count: provisions.length, total: totalProvisions });
}));
router3.post("/:companyId/disallowed-tax", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const disallowedForTax = req.body.disallowedForTax ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear?.bsFY ?? "");
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, disallowedForTax } });
  return res.json({ message: "Disallowed tax items saved.", count: disallowedForTax.length });
}));
router3.post("/:companyId/inventory", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const items = req.body.items ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear?.bsFY ?? "");
  const totalInventoryImpairment = items.reduce((s, i) => s + i.impairmentAmount, 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, inventoryAdjustments: items, totalInventoryImpairment } });
  return res.json({ message: "Inventory adjustments saved.", totalImpairment: totalInventoryImpairment });
}));
router3.post("/:companyId/investments", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const items = req.body.items ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear?.bsFY ?? "");
  const totalFV = items.reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, investmentAdjustments: items, totalInvestmentFVAdjustment: totalFV } });
  return res.json({ message: "Investment adjustments saved.", totalFVAdjustment: totalFV });
}));
router3.get("/:companyId", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  return res.json(session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear?.bsFY ?? ""));
}));
router3.post("/:companyId/calculate-all", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.adjustments) return res.status(400).json({ error: "No adjustments data found. Add assets, provisions, and inventory first." });
  const adj = session.adjustments;
  const journalTotal = adj.journalEntries.reduce((s, j) => s + j.amount, 0);
  return res.json({ adjustments: adj, journalEntryCount: adj.journalEntries.length, totalDebitCredit: journalTotal });
}));
router3.get("/subledger/:companyId", asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: "Company session not found." });
  const data = subledgerStore.get(companyId);
  return res.json(data);
}));
router3.post("/subledger/debtors", asyncHandler(async (req, res) => {
  const { companyId, debtors } = req.body;
  if (!companyId) {
    return res.status(400).json({ error: "companyId is required." });
  }
  const session = sessionStore.get(companyId);
  if (!session) {
    return res.status(404).json({ error: "Company session not found." });
  }
  if (!Array.isArray(debtors)) {
    return res.status(400).json({ error: "debtors must be an array." });
  }
  const updated = subledgerStore.upsertDebtors(companyId, debtors);
  const tbRows = session.trialBalance?.rows ?? [];
  const tbDebtorTotal = tbRows.filter((r) => r.nfrsCategory === "trade_receivables" && !r.isGroupRow).reduce((s, r) => s + (r.closingDr ?? 0), 0);
  const validation = subledgerStore.validate(companyId, tbDebtorTotal, 0);
  return res.json({
    message: "Debtor subledger saved.",
    count: updated.debtors.length,
    debtorTotal: updated.debtors.reduce((s, d) => s + d.debitBalance, 0),
    tbDebtorTotal,
    validation
  });
}));
router3.post("/subledger/creditors", asyncHandler(async (req, res) => {
  const { companyId, creditors } = req.body;
  if (!companyId) return res.status(400).json({ error: "companyId is required." });
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: "Company session not found." });
  if (!Array.isArray(creditors)) return res.status(400).json({ error: "creditors must be an array." });
  const updated = subledgerStore.upsertCreditors(companyId, creditors);
  const tbRows = session.trialBalance?.rows ?? [];
  const tbCreditorTotal = tbRows.filter((r) => r.nfrsCategory === "trade_payables_creditors" && !r.isGroupRow).reduce((s, r) => s + (r.closingCr ?? 0), 0);
  const validation = subledgerStore.validate(companyId, 0, tbCreditorTotal);
  return res.json({
    message: "Creditor subledger saved.",
    count: updated.creditors.length,
    creditorTotal: updated.creditors.reduce((s, c) => s + c.creditBalance, 0),
    tbCreditorTotal,
    validation
  });
}));
router3.post("/subledger/bank-accounts", asyncHandler(async (req, res) => {
  const { companyId, bankAccounts } = req.body;
  if (!companyId) return res.status(400).json({ error: "companyId is required." });
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: "Company session not found." });
  if (!Array.isArray(bankAccounts)) {
    return res.status(400).json({ error: "bankAccounts must be an array." });
  }
  const invalid = bankAccounts.filter((b) => !b.bankName?.trim());
  if (invalid.length > 0) {
    return res.status(400).json({
      error: `${invalid.length} bank account row(s) are missing a bank name.`
    });
  }
  const updated = subledgerStore.upsertBankAccounts(companyId, bankAccounts);
  const assetTotal = updated.bankAccounts.filter((b) => b.balance >= 0).reduce((s, b) => s + b.balance, 0);
  const liabilityTotal = updated.bankAccounts.filter((b) => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);
  return res.json({
    message: "Bank accounts saved.",
    count: updated.bankAccounts.length,
    assetTotal,
    liabilityTotal
  });
}));
router3.post("/subledger/related-parties", asyncHandler(async (req, res) => {
  const { companyId, relatedParties } = req.body;
  if (!companyId) return res.status(400).json({ error: "companyId is required." });
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: "Company session not found." });
  if (!Array.isArray(relatedParties)) {
    return res.status(400).json({ error: "relatedParties must be an array." });
  }
  const updated = subledgerStore.upsertRelatedParties(companyId, relatedParties);
  return res.json({
    message: "Related parties saved.",
    count: updated.relatedParties.length
  });
}));
var adjustments_default = router3;

// server/routes/financials.ts
import { Router as Router4 } from "express";

// server/services/taxEngine.ts
function computeStaffBonus(profitBeforeBonus, rate = 0.1) {
  return Math.max(0, Math.round(profitBeforeBonus * rate * 100) / 100);
}
function computePrivateFirmTax(taxableIncome) {
  if (taxableIncome <= 5e5) return 0;
  if (taxableIncome <= 7e5) return (taxableIncome - 5e5) * 0.15;
  return 5e4 * 0.15 + (taxableIncome - 7e5) * 0.25;
}
function computeTax(input) {
  const {
    accountingProfit,
    accountingDepreciation,
    taxDepreciation,
    disallowedForTax,
    staffBonus,
    profitBeforeBonus,
    donations = 0,
    researchDevelopment = 0,
    advanceTaxPaid,
    incomeTaxRate,
    entityType
  } = input;
  const reconciliation = [];
  reconciliation.push({ label: "Accounting profit before tax", amount: accountingProfit });
  reconciliation.push({ label: "Add: Accounting depreciation", amount: accountingDepreciation });
  reconciliation.push({ label: "Less: Tax depreciation (ITA pools)", amount: -taxDepreciation });
  const totalDisallowed = disallowedForTax.reduce((s, d) => s + d.amount, 0);
  if (totalDisallowed > 0) {
    reconciliation.push({ label: "Add: Disallowed expenses", amount: totalDisallowed });
  }
  const maxBonusAllowed = profitBeforeBonus * 0.1;
  const staffBonusAllowed = Math.min(staffBonus, maxBonusAllowed);
  let adjustedProfit = accountingProfit + accountingDepreciation - taxDepreciation + totalDisallowed;
  const donationAllowed = Math.min(donations, adjustedProfit * 0.05);
  adjustedProfit -= donationAllowed;
  const rdAllowance = researchDevelopment * 0.5;
  adjustedProfit -= rdAllowance;
  const taxableIncome = Math.max(0, Math.round(adjustedProfit * 100) / 100);
  reconciliation.push({ label: "Taxable income", amount: taxableIncome });
  let currentTaxExpense;
  if (entityType === "Sole Proprietorship" || entityType === "Partnership") {
    currentTaxExpense = computePrivateFirmTax(taxableIncome);
  } else {
    currentTaxExpense = Math.round(taxableIncome * incomeTaxRate * 100) / 100;
  }
  const netTaxPayable = Math.max(0, Math.round((currentTaxExpense - advanceTaxPaid) * 100) / 100);
  reconciliation.push({
    label: `Income tax at ${(incomeTaxRate * 100).toFixed(0)}%`,
    amount: currentTaxExpense
  });
  return {
    taxableIncome,
    currentTaxExpense,
    netTaxPayable,
    staffBonusAllowed,
    bookTaxReconciliation: reconciliation
  };
}
function computeIncomeTax(params) {
  const result = computeTax({
    accountingProfit: params.bookProfit,
    accountingDepreciation: 0,
    taxDepreciation: 0,
    disallowedForTax: Object.entries(params.disallowableExpenses).map(([description, amount]) => ({
      description,
      amount,
      section: "Section 21 ITA"
    })),
    staffBonus: 0,
    profitBeforeBonus: params.bookProfit,
    advanceTaxPaid: params.advanceTaxPaid + params.tdsCredit,
    incomeTaxRate: params.taxRate / 100,
    entityType: "Company"
  });
  const netAfterCredits = result.currentTaxExpense - params.advanceTaxPaid - params.tdsCredit;
  return {
    taxableIncome: result.taxableIncome,
    currentTaxExpense: result.currentTaxExpense,
    taxPayable: netAfterCredits > 0 ? netAfterCredits : 0,
    taxRecoverable: netAfterCredits < 0 ? -netAfterCredits : 0,
    effectiveTaxRate: params.bookProfit > 0 ? Math.round(result.currentTaxExpense / params.bookProfit * 1e4) / 100 : 0
  };
}

// server/services/notesEngine.ts
function sumTB(rows, categories, field = "closingDr") {
  const cats = Array.isArray(categories) ? categories : [categories];
  return rows.filter((r) => cats.includes(r.nfrsCategory) && !r.isGroupRow).reduce((s, r) => s + (r[field] ?? 0), 0);
}
function netClosing(rows, categories) {
  const cats = Array.isArray(categories) ? categories : [categories];
  return rows.filter((r) => cats.includes(r.nfrsCategory) && !r.isGroupRow).reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0);
}
function rowsByCategory(rows, category) {
  return rows.filter((r) => r.nfrsCategory === category && !r.isGroupRow);
}
function safeSum(...vals) {
  return vals.reduce((a, v) => a + (v ?? 0), 0);
}
var round = (n) => Math.round(n * 100) / 100;
function debtorDaysOutstanding(d) {
  if (typeof d.daysOutstanding === "number") return d.daysOutstanding;
  if (typeof d.agingDays === "number") return d.agingDays;
  const cat = String(d.ageCategory ?? "");
  if (cat === "<30days") return 15;
  if (cat === "31-60days") return 45;
  if (cat === "61-90days") return 75;
  if (cat === ">90days") return 120;
  return 0;
}
function debtorAmount(d) {
  return Number(d.debitBalance ?? d.balanceCY ?? d.amount ?? 0);
}
function buildAgingAnalysis(debtors, grossReceivables) {
  const buckets = [
    { bucket: "0-30 days", min: 0, max: 30, amount: 0 },
    { bucket: "31-60 days", min: 31, max: 60, amount: 0 },
    { bucket: "61-90 days", min: 61, max: 90, amount: 0 },
    { bucket: ">90 days", min: 91, max: Number.POSITIVE_INFINITY, amount: 0 }
  ];
  for (const d of debtors) {
    const amt = debtorAmount(d);
    if (amt <= 0) continue;
    const days = debtorDaysOutstanding(d);
    const bucket = buckets.find((b) => days >= b.min && days <= b.max) ?? buckets[3];
    bucket.amount += amt;
  }
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  if (total > 0 && grossReceivables > 0 && Math.abs(total - grossReceivables) > 1) {
    const factor = grossReceivables / total;
    buckets.forEach((b) => {
      b.amount = round(b.amount * factor);
    });
  }
  return buckets.map(({ bucket, amount }) => ({ bucket, amount: round(amount) }));
}
function mapSubledgerBankType(accountType) {
  const t = accountType.toLowerCase();
  if (t === "savings") return "Savings";
  if (t === "fixed_deposit") return "Fixed Deposit (\u22643 months)";
  return "Current";
}
function isLoanBankType(accountType) {
  const t = accountType.toLowerCase();
  return t === "loan" || t === "overdraft" || t === "cash_credit" || t === "working_capital";
}
var TAX_DEPN_RATES = {
  ppe_buildings: 0.05,
  ppe_furniture: 0.25,
  ppe_vehicles: 0.2,
  ppe_plant_machinery: 0.15,
  ppe_intangibles: 0.15,
  ppe_computers: 0.25,
  ppe_office_equipment: 0.15
};
function sumTBForPPEClass(rows, classId, field) {
  return ppeTbCategories(classId).reduce((total, category) => total + sumTB(rows, category, field), 0);
}
function normalizeDepreciationSummary(adj) {
  return (adj.depreciationSummary ?? []).map((raw) => {
    const item = raw;
    const categoryId = normalizePPEClassId(item.categoryId ?? item.name ?? item.assetClass);
    return {
      categoryId,
      categoryName: item.categoryName ?? item.name ?? categoryId,
      openingCost: item.openingCost ?? item.costOpeningDr ?? 0,
      additions: item.additions ?? 0,
      disposals: item.disposals ?? 0,
      closingCost: item.closingCost ?? item.costClosing ?? 0,
      openingAccumDepn: item.openingAccumDepn ?? item.accumDepnOpening ?? 0,
      depnForYear: item.depnForYear ?? item.depreciationCharged ?? 0,
      depnOnDisposal: item.depnOnDisposal ?? item.disposalDepn ?? 0,
      closingAccumDepn: item.closingAccumDepn ?? item.accumDepnClosing ?? 0,
      netBookValueClosing: item.netBookValueClosing ?? item.carryingAmountClosing ?? Math.max(0, (item.closingCost ?? item.costClosing ?? 0) - (item.closingAccumDepn ?? item.accumDepnClosing ?? 0)),
      assets: item.assets ?? []
    };
  });
}
function buildNotesData(params) {
  const { tb, adj, bs, is: IS, company } = params;
  const rows = tb.rows ?? [];
  const provisions = adj.provisions ?? [];
  const subledger = company.id ? subledgerStore.get(company.id) : null;
  const taxRate = (company.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;
  const roundingLevel = company.accountingPolicies?.roundingLevel ?? 1;
  const nas = company.nasCompliance ?? {};
  const normalizedDepSummary = normalizeDepreciationSummary(adj);
  const depnSummaryMap = new Map(
    normalizedDepSummary.map((d) => [d.categoryId, d])
  );
  const note31_ppe = PPE_CLASSES.map((cls) => {
    const d = depnSummaryMap.get(cls.categoryId);
    const tbGross = sumTBForPPEClass(rows, cls.categoryId, "closingDr");
    const tbOpenGross = sumTBForPPEClass(rows, cls.categoryId, "openingDr");
    const openingCost = d?.openingCost ?? tbOpenGross;
    const additions = d?.additions ?? 0;
    const disposals = d?.disposals ?? 0;
    const closingCost = d?.closingCost ?? openingCost + additions - disposals;
    const openingAccumDepn = d?.openingAccumDepn ?? 0;
    const depnForYear = d?.depnForYear ?? 0;
    const depnOnDisposal = d?.depnOnDisposal ?? 0;
    const closingAccumDepn = d?.closingAccumDepn ?? openingAccumDepn + depnForYear - depnOnDisposal;
    const nbvClosing = d?.netBookValueClosing ?? Math.max(0, closingCost - closingAccumDepn);
    const nbvOpening = Math.max(0, openingCost - openingAccumDepn);
    const assetsSecured = (adj.assets ?? []).filter((a) => normalizePPEClassId(a.categoryId) === cls.categoryId && a.isMortgaged).reduce((s, a) => s + a.originalCost, 0);
    return {
      categoryId: cls.categoryId,
      categoryName: cls.label,
      // Cost movement
      openingCost,
      additions,
      disposals,
      closingCost,
      // Accumulated depreciation movement
      openingAccumDepn,
      depnForYear,
      impairmentLosses: 0,
      depnOnDisposal,
      closingAccumDepn,
      // NBV
      netBookValueClosing: nbvClosing,
      nbvClosing,
      nbvOpening,
      // Assets pledged
      securedAmount: assetsSecured,
      hasSecuredAssets: assetsSecured > 0,
      // Individual assets
      assets: normalizedDepSummary.find((ds) => ds.categoryId === cls.categoryId)?.assets ?? []
    };
  }).filter(
    (item) => (
      // Only include categories that have any balance or movement
      item.openingCost > 0 || item.additions > 0 || item.closingCost > 0
    )
  );
  const investmentAdjs = adj.investmentAdjustments ?? [];
  const listedShares = investmentAdjs.filter(
    (i) => i.investmentType === "listed_trading" || i.investmentType === "listed_ats"
  ).map((inv) => ({
    companyName: inv.investmentName,
    openingUnits: inv.units ?? 0,
    purchasesDuringYear: 0,
    salesDuringYear: 0,
    closingUnits: inv.units ?? 0,
    costPerUnit: inv.totalCost && inv.units ? inv.totalCost / inv.units : 0,
    totalCost: inv.totalCost ?? 0,
    ltp: inv.ltp ?? 0,
    marketValue: inv.marketValue ?? (inv.units ?? 0) * (inv.ltp ?? 0),
    fairValueGainLoss: inv.fairValueGainLoss ?? 0,
    impairmentAmount: inv.impairmentAmount ?? 0,
    carryingAmount: inv.carryingAmount ?? 0
  }));
  const unlistedShares = investmentAdjs.filter(
    (i) => i.investmentType === "unlisted"
  ).map((inv) => ({
    companyName: inv.investmentName,
    openingCost: inv.totalCost ?? 0,
    additions: 0,
    disposals: 0,
    impairmentAmount: inv.impairmentAmount ?? 0,
    closingCarrying: inv.carryingAmount ?? 0
  }));
  const fdrNonCurrent = sumTB(rows, "investment_fixed_deposit_noncurrent", "closingDr");
  const fdrCurrent = sumTB(rows, "bank_fixed_deposit_current", "closingDr");
  const note32_investments = {
    listedShares,
    unlistedShares,
    fdrNonCurrent,
    fdrCurrent,
    totalNonCurrent: listedShares.reduce((s, i) => s + i.carryingAmount, 0) + unlistedShares.reduce((s, i) => s + i.closingCarrying, 0) + fdrNonCurrent,
    totalCurrent: listedShares.reduce((s, i) => s + i.marketValue, 0) + fdrCurrent
  };
  const grossReceivables = sumTB(rows, "trade_receivables", "closingDr");
  const grossReceivablesOpen = sumTB(rows, "trade_receivables", "openingDr");
  const provisionBadDebt = provisions.find((p) => p.provisionType === "doubtful_debts");
  const provisionImpairment = Math.abs(safeSum(
    sumTB(rows, "provision_impairment_debtors", "closingCr"),
    provisionBadDebt?.closingBalance ?? 0
  ));
  const provisionImpairmentOpen = Math.abs(safeSum(
    sumTB(rows, "provision_impairment_debtors", "openingCr"),
    provisionBadDebt?.openingBalance ?? 0
  ));
  const provisionAdditions = provisionBadDebt?.additionForYear ?? 0;
  const provisionWriteOffs = provisionBadDebt?.utilisedDuringYear ?? 0;
  const provisionReversals = 0;
  const debtorRows = subledger?.debtors?.length ? subledger.debtors : adj.debtors ?? [];
  const agingAnalysis = debtorRows.length > 0 ? buildAgingAnalysis(debtorRows, grossReceivables) : [];
  const note33_tradeReceivables = {
    grossReceivables_cy: grossReceivables,
    grossReceivables_py: grossReceivablesOpen,
    provisionMovement: {
      opening: provisionImpairmentOpen,
      additions: provisionAdditions,
      writeOffs: provisionWriteOffs,
      reversals: provisionReversals,
      closing: provisionImpairment
    },
    provisionForImpairment_cy: provisionImpairment,
    provisionForImpairment_py: provisionImpairmentOpen,
    netReceivables_cy: round(grossReceivables - provisionImpairment),
    netReceivables_py: round(grossReceivablesOpen - provisionImpairmentOpen),
    relatedPartyReceivables: sumTB(rows, "related_party_receivable", "closingDr"),
    prepayments: sumTB(rows, "other_receivables_prepayments", "closingDr"),
    tdsReceivable: sumTB(rows, "other_receivables_tds", "closingDr"),
    staffAdvances: sumTB(rows, "other_receivables_staff_advance", "closingDr"),
    advanceToSuppliers: sumTB(rows, "other_receivables_advance_supplier", "closingDr"),
    otherLoansAdvances: sumTB(rows, "other_receivables_loans", "closingDr"),
    nonCurrentPortion: safeSum(
      sumTB(rows, "nca_loans_advances", "closingDr"),
      sumTB(rows, "nca_deposits", "closingDr")
    ),
    currentPortion: round(
      grossReceivables - provisionImpairment + sumTB(rows, "other_receivables_prepayments", "closingDr") + sumTB(rows, "other_receivables_tds", "closingDr") + sumTB(rows, "other_receivables_staff_advance", "closingDr") + sumTB(rows, "other_receivables_advance_supplier", "closingDr") + sumTB(rows, "other_receivables_loans", "closingDr")
    ),
    agingAnalysis
  };
  const note34_otherCurrentAssets = {
    securityDeposits: sumTB(rows, "nca_deposits", "closingDr"),
    // current portion
    guaranteeMargins: 0,
    advanceIncomeTax: sumTB(rows, "advance_tax_paid", "closingDr"),
    otherPrepaidExpenses: sumTB(rows, "other_receivables_other", "closingDr"),
    total: round(
      sumTB(rows, "nca_deposits", "closingDr") + sumTB(rows, "advance_tax_paid", "closingDr") + sumTB(rows, "other_receivables_other", "closingDr")
    )
  };
  const bioOpeningBalance = sumTB(rows, "biological_assets", "openingDr");
  const bioClosingBalance = sumTB(rows, "biological_assets", "closingDr");
  const note35_biologicalAssets = {
    hasBalance: bioClosingBalance > 0 || bioOpeningBalance > 0,
    openingCarrying: bioOpeningBalance,
    additionsPurchases: Math.max(0, sumTB(rows, "biological_assets", "duringDr")),
    disposalsSales: Math.max(0, sumTB(rows, "biological_assets", "duringCr")),
    fairValueAdjustment: 0,
    closingCarrying: bioClosingBalance
  };
  const hfsBalance = sumTB(rows, "nca_held_for_sale", "closingDr");
  const note36_heldForSale = {
    hasBalance: hfsBalance > 0,
    assets: hfsBalance > 0 ? [{
      description: "Non-Current Assets Held for Sale",
      carryingAmount: hfsBalance,
      expectedSaleDate: null
    }] : [],
    total: hfsBalance
  };
  const invAdjs = adj.inventoryAdjustments ?? [];
  const rmClosing = round(sumTB(rows, "inventory_raw_materials", "closingDr") - (invAdjs.find((i) => i.category === "raw_materials")?.impairmentAmount ?? 0));
  const wipClosing = round(sumTB(rows, "inventory_wip", "closingDr") - (invAdjs.find((i) => i.category === "wip")?.impairmentAmount ?? 0));
  const fgClosing = round(sumTB(rows, "inventory_finished_goods", "closingDr") - (invAdjs.find((i) => i.category === "finished_goods")?.impairmentAmount ?? 0));
  const rmOpening = sumTB(rows, "inventory_raw_materials", "openingDr");
  const wipOpening = sumTB(rows, "inventory_wip", "openingDr");
  const fgOpening = sumTB(rows, "inventory_finished_goods", "openingDr");
  const note37_inventories = {
    rawMaterials: { opening: rmOpening, closing: rmClosing },
    wip: { opening: wipOpening, closing: wipClosing },
    finishedGoods: { opening: fgOpening, closing: fgClosing },
    totalOpening: round(rmOpening + wipOpening + fgOpening),
    totalClosing: round(rmClosing + wipClosing + fgClosing),
    impairmentRecognised: invAdjs.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0),
    inventoryAtNRV: invAdjs.filter((i) => i.writtenDownTo !== void 0).reduce((s, i) => s + (i.writtenDownTo ?? 0), 0),
    pledgedAsSecurityAmt: 0,
    costFormula: company.accountingPolicies?.inventoryCostMethod ?? "WeightedAverage"
  };
  const cashRows = rowsByCategory(rows, "cash_in_hand");
  const bankCurrentRows = rowsByCategory(rows, "bank_current_account");
  const bankSavingsRows = rowsByCategory(rows, "bank_savings_account");
  const fdCurrentRows = rowsByCategory(rows, "bank_fixed_deposit_current");
  const subledgerCashAssetBanks = (subledger?.bankAccounts ?? []).filter((b) => b.balance >= 0 && !isLoanBankType(b.accountType));
  const subledgerBankRows = subledgerCashAssetBanks.map((b) => ({
    accountName: b.bankName,
    bankName: b.bankName,
    accountType: mapSubledgerBankType(b.accountType),
    closingBalance: round(b.balance),
    openingBalance: 0
  }));
  const note38_cashEquivalents = {
    cashInHand_cy: cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0),
    cashInHand_py: cashRows.reduce((s, r) => s + (r.openingDr ?? 0), 0),
    bankAccounts: subledgerBankRows.length > 0 ? subledgerBankRows : [
      ...bankCurrentRows.map((r) => ({
        accountName: r.rawLabel,
        bankName: r.rawLabel,
        accountType: "Current",
        closingBalance: round((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        openingBalance: round((r.openingDr ?? 0) - (r.openingCr ?? 0))
      })),
      ...bankSavingsRows.map((r) => ({
        accountName: r.rawLabel,
        bankName: r.rawLabel,
        accountType: "Savings",
        closingBalance: round((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        openingBalance: round((r.openingDr ?? 0) - (r.openingCr ?? 0))
      })),
      ...fdCurrentRows.map((r) => ({
        accountName: r.rawLabel,
        bankName: r.rawLabel,
        accountType: "Fixed Deposit (\u22643 months)",
        closingBalance: round(r.closingDr ?? 0),
        openingBalance: round(r.openingDr ?? 0)
      }))
    ],
    totalCash_cy: round(
      cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0) + (subledgerBankRows.length > 0 ? subledgerBankRows.reduce((s, b) => s + b.closingBalance, 0) : bankCurrentRows.reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0) + bankSavingsRows.reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0) + fdCurrentRows.reduce((s, r) => s + (r.closingDr ?? 0), 0))
    ),
    totalCash_py: round(
      cashRows.reduce((s, r) => s + (r.openingDr ?? 0), 0) + (subledgerBankRows.length > 0 ? subledgerBankRows.reduce((s, b) => s + b.openingBalance, 0) : bankCurrentRows.reduce((s, r) => s + (r.openingDr ?? 0) - (r.openingCr ?? 0), 0) + bankSavingsRows.reduce((s, r) => s + (r.openingDr ?? 0) - (r.openingCr ?? 0), 0) + fdCurrentRows.reduce((s, r) => s + (r.openingDr ?? 0), 0))
    )
  };
  const paidUpCapital = Math.abs(netClosing(rows, "share_capital"));
  const paidUpCapitalOpen = Math.abs(
    rows.filter((r) => r.nfrsCategory === "share_capital" && !r.isGroupRow).reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const sharesIssued = Math.round(paidUpCapital / 100);
  const note39_shareCapital = {
    ordinaryShares: {
      authorizedAmount: paidUpCapital,
      authorizedShares: sharesIssued,
      parValuePerShare: 100,
      openingIssuedShares: Math.round(paidUpCapitalOpen / 100),
      openingPaidUp: paidUpCapitalOpen,
      issuedDuringYear: 0,
      issuedForCash: 0,
      closingIssuedShares: sharesIssued,
      closingPaidUp: paidUpCapital
    },
    preferenceShares: null,
    restrictionsOnDistribution: null,
    sharesReservedForOptions: 0
  };
  const sharePremiumClose = Math.abs(netClosing(rows, "share_premium"));
  const sharePremiumOpen = Math.abs(
    rows.filter((r) => r.nfrsCategory === "share_premium" && !r.isGroupRow).reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const genReserveClose = Math.abs(netClosing(rows, "general_reserve"));
  const genReserveOpen = Math.abs(
    rows.filter((r) => r.nfrsCategory === "general_reserve" && !r.isGroupRow).reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const retainedClose = Math.abs(netClosing(rows, "retained_earnings"));
  const retainedOpen = Math.abs(
    rows.filter((r) => r.nfrsCategory === "retained_earnings" && !r.isGroupRow).reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const note310_reserves = {
    sharePremium: {
      opening: sharePremiumOpen,
      additions: round(sharePremiumClose - sharePremiumOpen),
      closing: sharePremiumClose
    },
    generalReserve: {
      opening: genReserveOpen,
      transferFromProfit: round(genReserveClose - genReserveOpen),
      closing: genReserveClose
    },
    retainedEarnings: {
      opening: retainedOpen,
      netProfitForYear: IS.netProfit ?? 0,
      dividendsDeclared: 0,
      transferToReserve: round(genReserveClose - genReserveOpen),
      closing: retainedClose
    },
    otherReserves: Math.abs(netClosing(rows, "other_reserves"))
  };
  const ltBankRows = rowsByCategory(rows, "borrowings_noncurrent_bank");
  const ltOtherRows = rowsByCategory(rows, "borrowings_noncurrent_other");
  const stOdRows = rowsByCategory(rows, "borrowings_current_od");
  const stCcRows = rowsByCategory(rows, "borrowings_current_cc");
  const stWcRows = rowsByCategory(rows, "borrowings_current_wc");
  const stPortionRows = rowsByCategory(rows, "borrowings_current_portion_lt");
  const rpPayableRows = rowsByCategory(rows, "related_party_payable");
  const subledgerLoanBanks = (subledger?.bankAccounts ?? []).filter(
    (b) => isLoanBankType(b.accountType) || b.balance < 0
  );
  const subledgerLoanCurrent = subledgerLoanBanks.filter((b) => ["overdraft", "cash_credit", "working_capital"].includes(b.accountType)).map((b) => ({
    lenderName: b.bankName,
    type: b.accountType === "overdraft" ? "Bank Overdraft" : b.accountType === "cash_credit" ? "Cash Credit" : "Working Capital Loan",
    secured: !!b.securedBy,
    balance_cy: Math.abs(b.balance),
    balance_py: 0
  }));
  const subledgerLoanNonCurrent = subledgerLoanBanks.filter((b) => b.accountType === "loan").map((b) => ({
    lenderName: b.bankName,
    type: "Bank Term Loan",
    secured: !!b.securedBy,
    interestRate: b.interestRate ?? 0,
    maturityDate: b.maturityDate ?? null,
    balance_cy: Math.abs(b.balance),
    balance_py: 0
  }));
  const subledgerRpPayableLoans = (subledger?.relatedParties ?? []).filter((rp) => rp.balanceType === "payable").map((rp) => ({
    lenderName: rp.partyName,
    type: "Related Party Loan",
    secured: false,
    balance_cy: Math.abs(rp.outstandingBalance),
    balance_py: 0
  }));
  const note311_borrowings = {
    nonCurrent: [
      ...ltBankRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Bank Term Loan",
        secured: true,
        interestRate: 0,
        maturityDate: null,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...ltOtherRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Other Loan",
        secured: false,
        interestRate: 0,
        maturityDate: null,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...subledgerLoanNonCurrent
    ],
    current: [
      ...stOdRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Bank Overdraft",
        secured: true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...stCcRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Cash Credit",
        secured: true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...stWcRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Working Capital Loan",
        secured: true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...stPortionRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Current Portion of Long-Term Loan",
        secured: true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...rpPayableRows.map((r) => ({
        lenderName: r.rawLabel,
        type: "Related Party Loan",
        secured: false,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0))
      })),
      ...subledgerLoanCurrent,
      ...subledgerRpPayableLoans
    ],
    totalNonCurrent_cy: ltBankRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + ltOtherRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + subledgerLoanNonCurrent.reduce((s, r) => s + r.balance_cy, 0),
    totalCurrent_cy: [stOdRows, stCcRows, stWcRows, stPortionRows, rpPayableRows].flat().reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + subledgerLoanCurrent.reduce((s, r) => s + r.balance_cy, 0) + subledgerRpPayableLoans.reduce((s, r) => s + r.balance_cy, 0)
  };
  const gratuityProv = provisions.find((p) => p.provisionType === "gratuity");
  const leaveProv = provisions.find((p) => p.provisionType === "leave_encashment");
  const bonusProv = provisions.find((p) => p.provisionType === "bonus");
  const note312_employeeBenefits = {
    definedBenefit: {
      description: "Gratuity (as per Labour Act 2074)",
      openingBalance: gratuityProv?.openingBalance ?? 0,
      expenseForYear: gratuityProv?.additionForYear ?? 0,
      paidDuringYear: gratuityProv?.utilisedDuringYear ?? 0,
      closingBalance: gratuityProv?.closingBalance ?? sumTB(rows, "employee_benefit_gratuity", "closingCr"),
      nonCurrentPortion: gratuityProv?.closingBalance ?? 0,
      currentPortion: 0
    },
    definedContribution: {
      pfContribution: sumTB(rows, "employee_payables_pf", "closingCr"),
      ssfContribution: 0
    },
    leaveEncashment: {
      openingBalance: leaveProv?.openingBalance ?? 0,
      expenseForYear: leaveProv?.additionForYear ?? 0,
      paidDuringYear: leaveProv?.utilisedDuringYear ?? 0,
      closingBalance: leaveProv?.closingBalance ?? 0
    },
    salaryPayable: sumTB(rows, "employee_payables_salary", "closingCr"),
    bonusPayable: bonusProv?.closingBalance ?? sumTB(rows, "employee_payables_bonus", "closingCr"),
    totalCurrentEmployeeLiabilities: round(
      sumTB(rows, "employee_payables_salary", "closingCr") + (bonusProv?.closingBalance ?? sumTB(rows, "employee_payables_bonus", "closingCr")) + sumTB(rows, "employee_payables_pf", "closingCr")
    ),
    totalNonCurrentEmployeeLiabilities: gratuityProv?.closingBalance ?? 0
  };
  const creditorRows = rowsByCategory(rows, "trade_payables_creditors");
  const advFromCustRows = rowsByCategory(rows, "trade_payables_advance_customers");
  const auditFeeRows = rowsByCategory(rows, "audit_fee_payable");
  const vatRows = rowsByCategory(rows, "other_payables");
  const tdsPayRows = rowsByCategory(rows, "tds_payable");
  const note313_tradePayables = {
    tradeCreditors: creditorRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    advanceFromCustomers: advFromCustRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    auditFeePayable: auditFeeRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    vatPayable: vatRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    tdsPayableBreakdown: tdsPayRows.map((r) => ({
      ledgerName: r.rawLabel,
      amount: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0))
    })),
    tdsPayableTotal: tdsPayRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    otherAccruals: 0,
    total: round(
      creditorRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + advFromCustRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + auditFeeRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + vatRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + tdsPayRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
    ),
    // Previous year
    tradeCreditors_py: creditorRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
    auditFeePayable_py: auditFeeRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
    vatPayable_py: vatRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
    tdsPayableTotal_py: tdsPayRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0)
  };
  const advanceTaxPaid = sumTB(rows, "advance_tax_paid", "closingDr");
  const tdsCredit = sumTB(rows, "other_receivables_tds", "closingDr");
  const taxPayable = Math.abs(sumTB(rows, "income_tax_payable", "closingCr"));
  const currentTaxExpense = IS.incomeTaxExpense ?? 0;
  const note314_taxComputation = {
    advanceTaxPaid,
    tdsCreditAvailable: tdsCredit,
    incomeTaxForYear: currentTaxExpense,
    netTaxLiability: Math.max(0, currentTaxExpense - advanceTaxPaid - tdsCredit),
    taxRecoverable: Math.max(0, advanceTaxPaid + tdsCredit - currentTaxExpense)
  };
  const saleOfGoods = sumTB(rows, "revenue_sales", "closingCr");
  const saleOfServices = sumTB(rows, "revenue_services", "closingCr");
  const note315_revenue = {
    saleOfGoods_cy: saleOfGoods,
    saleOfServices_cy: saleOfServices,
    totalRevenue_cy: round(saleOfGoods + saleOfServices),
    saleOfGoods_py: sumTB(rows, "revenue_sales", "openingCr"),
    saleOfServices_py: sumTB(rows, "revenue_services", "openingCr"),
    totalRevenue_py: round(
      sumTB(rows, "revenue_sales", "openingCr") + sumTB(rows, "revenue_services", "openingCr")
    )
  };
  const dividendPayableBalance = Math.abs(
    sumTB(rows, "dividend_payable", "closingCr")
  );
  const paidUpForDividend = note39_shareCapital.ordinaryShares.closingPaidUp;
  const declaredRate = paidUpForDividend > 0 && dividendPayableBalance > 0 ? round(dividendPayableBalance / paidUpForDividend * 100) : 0;
  const note316_dividendPayable = {
    hasDividend: dividendPayableBalance > 0,
    paidUpCapital: paidUpForDividend,
    declaredRatePercent: declaredRate,
    amountPerShare: note39_shareCapital.ordinaryShares.closingIssuedShares > 0 ? round(dividendPayableBalance / note39_shareCapital.ordinaryShares.closingIssuedShares) : 0,
    totalDividendDeclared: dividendPayableBalance,
    tdsOnDividend: round(dividendPayableBalance * 0.05),
    netDividendPayable: round(dividendPayableBalance * 0.95)
  };
  const otherIncomeRows = [
    "other_income_interest",
    "other_income_dividend",
    "other_income_rental",
    "other_income_disposal_gain",
    "other_income_misc"
  ];
  const note317_revenueDetailed = {
    saleOfGoods: {
      cy: sumTB(rows, "revenue_sales", "closingCr"),
      py: sumTB(rows, "revenue_sales", "openingCr")
    },
    renderingOfServices: {
      cy: sumTB(rows, "revenue_services", "closingCr"),
      py: sumTB(rows, "revenue_services", "openingCr")
    },
    interestIncome: {
      cy: sumTB(rows, "other_income_interest", "closingCr"),
      py: sumTB(rows, "other_income_interest", "openingCr")
    },
    dividendIncome: {
      cy: sumTB(rows, "other_income_dividend", "closingCr"),
      py: sumTB(rows, "other_income_dividend", "openingCr")
    },
    otherIncome: {
      cy: otherIncomeRows.reduce((s, c) => s + sumTB(rows, c, "closingCr"), 0),
      py: otherIncomeRows.reduce((s, c) => s + sumTB(rows, c, "openingCr"), 0)
    },
    totalIncome: {
      cy: IS.totalIncome ?? 0,
      py: IS.totalIncome_py ?? 0
    }
  };
  const rmOpenForConsumed = sumTB(rows, "inventory_raw_materials", "openingDr");
  const purchases = sumTB(rows, "cogs_purchases", "closingDr");
  const rmCloseForConsumed = sumTB(rows, "inventory_raw_materials", "closingDr");
  const materialConsumed = round(rmOpenForConsumed + purchases - rmCloseForConsumed);
  const fgWipOpenForChange = round(fgOpening + wipOpening);
  const fgWipCloseForChange = round(fgClosing + wipClosing);
  const changeInInventories = round(fgWipOpenForChange - fgWipCloseForChange);
  const directWages = sumTB(rows, "direct_wages", "closingDr");
  const directOther = sumTB(rows, "direct_expenses_other", "closingDr");
  const note318_materialConsumed = {
    openingRawMaterial: rmOpenForConsumed,
    purchasesDuringYear: purchases,
    closingRawMaterial: rmCloseForConsumed,
    rawMaterialConsumed: materialConsumed,
    changeInInventoriesFGWIP: changeInInventories,
    openingFGWIP: fgWipOpenForChange,
    closingFGWIP: fgWipCloseForChange,
    directWages,
    otherDirectExpenses: directOther,
    totalCostOfProduction: round(materialConsumed + changeInInventories + directWages + directOther)
  };
  const miscIncomeCy = sumTB(rows, "other_income_misc", "closingCr");
  const governmentGrantIncomeCy = nas.governmentGrants ? miscIncomeCy : 0;
  const miscellaneousIncomeCy = nas.governmentGrants ? 0 : miscIncomeCy;
  const note319_otherIncome = {
    interestIncome: { cy: sumTB(rows, "other_income_interest", "closingCr"), py: 0 },
    commissionIncome: { cy: 0, py: 0 },
    rentalIncome: { cy: sumTB(rows, "other_income_rental", "closingCr"), py: 0 },
    dividendReceived: { cy: sumTB(rows, "other_income_dividend", "closingCr"), py: 0 },
    gainOnDisposalAssets: { cy: sumTB(rows, "other_income_disposal_gain", "closingCr"), py: 0 },
    insuranceClaims: { cy: 0, py: 0 },
    governmentGrantIncome: { cy: governmentGrantIncomeCy, py: 0 },
    fairValueGainOnInvestments: {
      cy: investmentAdjs.filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0),
      py: 0
    },
    miscellaneousIncome: { cy: miscellaneousIncomeCy, py: 0 },
    hasForeignCurrencyTransactions: nas.foreignCurrency,
    total: {
      cy: round(
        sumTB(rows, "other_income_interest", "closingCr") + sumTB(rows, "other_income_rental", "closingCr") + sumTB(rows, "other_income_dividend", "closingCr") + sumTB(rows, "other_income_disposal_gain", "closingCr") + miscIncomeCy + investmentAdjs.filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0)
      ),
      py: 0
    }
  };
  const salariesExp = sumTB(rows, "emp_expense_salaries", "closingDr");
  const pfExp = sumTB(rows, "emp_expense_pf", "closingDr");
  const gratuityExp = gratuityProv?.additionForYear ?? sumTB(rows, "emp_expense_gratuity", "closingDr");
  const welfareExp = sumTB(rows, "emp_expense_welfare", "closingDr");
  const bonusExp = IS.staffBonus ?? bonusProv?.additionForYear ?? 0;
  const leaveExp = leaveProv?.additionForYear ?? sumTB(rows, "emp_expense_leave", "closingDr");
  const otherEmpExp = sumTB(rows, "emp_expense_other", "closingDr");
  const note320_employeeExpenses = {
    salariesWages: { cy: salariesExp, py: 0 },
    allowances: { cy: 0, py: 0 },
    pfSsfContribution: { cy: pfExp, py: 0 },
    gratuityExpense: { cy: gratuityExp, py: 0 },
    leaveEncashment: { cy: leaveExp, py: 0 },
    staffBonusExpense: { cy: bonusExp, py: 0 },
    staffWelfare: { cy: welfareExp, py: 0 },
    otherEmployeeCosts: { cy: otherEmpExp, py: 0 },
    totalEmployeeExpenses: { cy: round(salariesExp + pfExp + gratuityExp + welfareExp + bonusExp + leaveExp + otherEmpExp), py: 0 },
    kmpCompensation: {
      description: "Key Management Personnel Compensation",
      salary: 0,
      bonus: 0,
      otherBenefits: 0,
      total: 0
    }
  };
  const note321_depreciation = {
    byClass: note31_ppe.map((item) => ({
      categoryName: item.categoryName,
      depreciationForYear: item.depnForYear
    })),
    totalDepreciation: round(note31_ppe.reduce((s, item) => s + item.depnForYear, 0)),
    totalDepreciation_py: 0
  };
  const ADMIN_CATEGORIES2 = [
    { cat: "admin_rent", label: "Rent / Lease Rentals" },
    { cat: "admin_communication", label: "Communication Expenses" },
    { cat: "admin_printing", label: "Printing & Stationery" },
    { cat: "admin_traveling", label: "Travel & Conveyance" },
    { cat: "admin_advertisement", label: "Advertisement & Promotion" },
    { cat: "admin_audit_fee", label: "Audit Fees" },
    { cat: "admin_legal_professional", label: "Professional & Legal Fees" },
    { cat: "admin_rates_taxes", label: "Board & AGM / Rates & Taxes" },
    { cat: "admin_repairs", label: "Repairs & Maintenance" },
    { cat: "admin_insurance", label: "Insurance Premium" },
    { cat: "finance_cost_bank_charges", label: "Bank Charges" },
    { cat: "admin_other", label: "CSR & Other Miscellaneous" }
  ];
  const note322_adminExpenses = {
    lineItems: [
      ...ADMIN_CATEGORIES2.map((ac) => ({
        label: ac.label,
        cy: sumTB(rows, ac.cat, "closingDr"),
        py: 0
      })).filter((li) => li.cy > 0),
      ...nas.foreignCurrency && sumTB(rows, "finance_cost_interest", "closingDr") > 0 ? [{
        label: "Foreign Exchange / Finance Charges",
        cy: sumTB(rows, "finance_cost_interest", "closingDr"),
        py: 0
      }] : []
    ],
    total_cy: round(
      ADMIN_CATEGORIES2.reduce((s, ac) => s + sumTB(rows, ac.cat, "closingDr"), 0) + (nas.foreignCurrency ? sumTB(rows, "finance_cost_interest", "closingDr") : 0)
    ),
    total_py: 0
  };
  const bookProfit = IS.profitBeforeTax ?? 0;
  const bookDepreciation = adj.depreciationSummary?.reduce((s, d) => s + d.depnForYear, 0) ?? 0;
  const taxDepreciation = (adj.depreciationSummary ?? []).reduce((total, d) => {
    const rate = TAX_DEPN_RATES[d.categoryId] ?? 0.1;
    const basis = d.openingCost + d.additions - d.disposals - d.openingAccumDepn;
    return total + Math.max(0, basis) * rate;
  }, 0);
  const disallowableExpenses = {
    "Accounting Depreciation": bookDepreciation,
    "Provisions (non-deductible)": provisions.reduce((s, p) => s + (p.closingBalance ?? 0), 0)
  };
  const allowableDeductions = {
    "Tax Depreciation (ITA 2058)": taxDepreciation
  };
  const taxResult = computeIncomeTax({
    bookProfit,
    taxRate,
    disallowableExpenses,
    allowableExpenses: allowableDeductions,
    advanceTaxPaid: advanceTaxPaid + tdsCredit,
    tdsCredit: 0,
    previousYearLoss: 0
  });
  const note323_taxExpense = {
    currentTaxExpense: round(taxResult.currentTaxExpense),
    deferredTaxExpense: round(adj.deferredTaxExpense ?? 0),
    priorYearAdjustment: 0,
    totalTaxExpense: round(taxResult.currentTaxExpense + (adj.deferredTaxExpense ?? 0)),
    effectiveTaxRate: taxResult.effectiveTaxRate,
    reconciliation: {
      profitBeforeTax: bookProfit,
      disallowableExpenses,
      allowableDeductions,
      taxableProfit: round(taxResult.taxableIncome),
      taxAtStatutoryRate: round(taxResult.taxableIncome * taxRate),
      taxAdjustments: 0,
      totalCurrentTax: round(taxResult.currentTaxExpense)
    },
    taxDepreciationByPool: (adj.taxDepreciationPools ?? []).map((pool) => ({
      poolName: pool.poolName,
      rate: pool.rate,
      openingBasis: pool.openingBasis,
      additions: pool.additions ?? 0,
      disposals: pool.disposals ?? 0,
      depreciationBasis: pool.depreciationBasis ?? pool.openingBasis ?? 0,
      taxDepreciation: pool.taxDepreciation ?? 0,
      closingBasis: pool.closingBasis ?? pool.nextYearBasis ?? 0
    })),
    advanceTaxPaid,
    tdsCreditAvailable: tdsCredit,
    netTaxPayable: round(taxResult.taxPayable)
  };
  const rpReceivableRows = rowsByCategory(rows, "related_party_receivable");
  const rpPayRows = rowsByCategory(rows, "related_party_payable");
  const subledgerRelatedParties = subledger?.relatedParties?.length ? subledger.relatedParties : adj.relatedParties ?? [];
  const note324_relatedParty = {
    relatedParties: subledgerRelatedParties.length > 0 ? subledgerRelatedParties.map((rp) => {
      const row = rp;
      const balanceType = String(row.balanceType ?? "receivable");
      const txns = row.transactionsCurrentYear ?? [];
      return {
        partyName: String(row.partyName ?? row.name ?? ""),
        relationship: String(row.relationshipType ?? row.relationship ?? "Related Party"),
        natureOfTransaction: balanceType === "payable" ? "Loan Received" : "Loan Given",
        transactionAmount: txns.reduce((s, t) => s + (t.amount ?? 0), 0),
        outstandingBalance: Math.abs(Number(row.outstandingBalance ?? row.balanceCY ?? 0)),
        balanceType: balanceType === "payable" ? "Payable" : "Receivable",
        atArmSLength: Boolean(row.isArmLength ?? false)
      };
    }) : [
      ...rpPayRows.map((r) => ({
        partyName: r.rawLabel,
        relationship: "Director / Related Party",
        natureOfTransaction: "Loan Received",
        transactionAmount: 0,
        outstandingBalance: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balanceType: "Payable",
        atArmSLength: false
      })),
      ...rpReceivableRows.map((r) => ({
        partyName: r.rawLabel,
        relationship: "Director / Related Party",
        natureOfTransaction: "Loan Given",
        transactionAmount: 0,
        outstandingBalance: Math.abs((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        balanceType: "Receivable",
        atArmSLength: false
      }))
    ],
    kmpCompensationTotal: 0,
    noRelatedPartyTransactions: subledgerRelatedParties.length === 0 && rpPayRows.length === 0 && rpReceivableRows.length === 0
  };
  const hasContingencies = Boolean(nas.contingentLiabilities || nas.leaseArrangements);
  const contingencyParts = [];
  if (nas.contingentLiabilities) {
    contingencyParts.push(
      "Management has confirmed the existence of contingent liabilities that require disclosure in accordance with NAS for MEs."
    );
  }
  if (nas.leaseArrangements) {
    contingencyParts.push(
      "The Company has lease arrangements (finance or operating) that may give rise to commitments requiring disclosure."
    );
  }
  const note325_contingencies = {
    hasContingencies,
    bankGuaranteesIssued: 0,
    lcOpened: 0,
    legalCasesPending: [],
    capitalCommitments: 0,
    operatingLeaseCommitments: nas.leaseArrangements ? 1 : 0,
    defaultText: hasContingencies ? contingencyParts.join(" ") : "The Company has no contingent liabilities or commitments as at the reporting date."
  };
  const hasSubsequentEvents = Boolean(nas.eventsAfterDate);
  const note326_subsequentEvents = {
    hasSubsequentEvents,
    events: [],
    defaultText: hasSubsequentEvents ? "Management has identified material events after the reporting date that require disclosure in these financial statements. Details are provided in the accompanying schedules." : "There are no significant events after the reporting date that require adjustment to or disclosure in these financial statements."
  };
  return {
    note31_ppe,
    note32_investments,
    note33_tradeReceivables,
    note34_otherCurrentAssets,
    note35_biologicalAssets,
    note36_heldForSale,
    note37_inventories,
    note38_cashEquivalents,
    note39_shareCapital,
    note310_reserves,
    note311_borrowings,
    note312_employeeBenefits,
    note313_tradePayables,
    note314_taxComputation,
    note315_revenue,
    note316_dividendPayable,
    note317_revenueDetailed,
    note318_materialConsumed,
    note319_otherIncome,
    note320_employeeExpenses,
    note321_depreciation,
    note322_adminExpenses,
    note323_taxExpense,
    note324_relatedParty,
    note325_contingencies,
    note326_subsequentEvents
  };
}

// server/services/financialEngine.ts
function rowMatchesCategory(rowCategory, categories) {
  if (!rowCategory) return false;
  const rowNorm = normalizeCategoryAlias(rowCategory);
  for (const cat of categories) {
    const catNorm = normalizeCategoryAlias(cat);
    if (rowCategory === cat || rowNorm === catNorm || rowCategory === catNorm || rowNorm === cat) {
      return true;
    }
  }
  return false;
}
function sumDr(rows, ...categories) {
  return rows.filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory, categories)).reduce((acc, r) => acc + (r.closingDr ?? 0), 0);
}
function sumCr(rows, ...categories) {
  return rows.filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory, categories)).reduce((acc, r) => acc + (r.closingCr ?? 0), 0);
}
function sumOpeningDr(rows, ...categories) {
  return rows.filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory, categories)).reduce((acc, r) => acc + (r.openingDr ?? 0), 0);
}
function sumOpeningCr(rows, ...categories) {
  return rows.filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory, categories)).reduce((acc, r) => acc + (r.openingCr ?? 0), 0);
}
function netBalance(rows, ...categories) {
  return sumDr(rows, ...categories) - sumCr(rows, ...categories);
}
var round22 = (n) => Math.round(n * 100) / 100;
function splitCashAndOverdrafts(rows) {
  const cashCats = /* @__PURE__ */ new Set(["cash_in_hand", "bank_current_account", "bank_fixed_deposit_current"]);
  let cash = 0;
  let overdrafts = 0;
  for (const row of rows) {
    if (!cashCats.has(row.nfrsCategory) || row.isGroupRow) continue;
    const net = (row.closingDr ?? 0) - (row.closingCr ?? 0);
    if (net >= 0) cash += net;
    else overdrafts += -net;
  }
  return { cash: round22(cash), overdrafts: round22(overdrafts) };
}
var ADMIN_CATEGORIES = CHART_OF_ACCOUNTS.filter((e) => e.statementLine === "IS Admin" && !e.isGroup).map((e) => e.category).concat([
  "admin_electricity",
  "admin_printing",
  "admin_legal_professional",
  "admin_other",
  "admin_traveling",
  "admin_repairs",
  "admin_rates_taxes"
]);
function inventoryFromAdj(adj, rows) {
  const inv = adj.inventoryDetails;
  const openingPY = inv ? inv.rawMaterialsPY + inv.wipPY + inv.finishedGoodsPY : sumOpeningDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods");
  const closingCY = inv ? inv.rawMaterialsCY + inv.wipCY + inv.finishedGoodsCY : sumDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods");
  return { openingPY, closingCY };
}
function computeIncomeStatement(tb, adj, company, previousYearIS = {}) {
  const rows = tb.rows;
  const revenue = round22(sumCr(rows, "revenue_sales", "revenue_services"));
  const interestIncome = round22(
    sumCr(rows, "other_income_interest", "interest_income")
  );
  const otherIncome = round22(
    sumCr(rows, "other_income_dividend", "other_income_rental", "other_income_misc", "other_income_disposal_gain", "commission_income", "insurance_claim_income") + (adj.gainOnDisposals ?? 0) + (adj.investmentAdjustments ?? []).filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0)
  );
  const totalIncome = round22(revenue + interestIncome + otherIncome);
  const { openingPY, closingCY } = inventoryFromAdj(adj, rows);
  const materialConsumed = round22(
    openingPY + sumDr(rows, "cogs_purchases", "cogs_opening_stock", "materials_consumed", "purchase") - closingCY
  );
  const directExpenses = round22(sumDr(rows, "direct_wages", "direct_expenses_other"));
  const staffBonusProvision = adj.staffBonusProvision ?? round22(sumDr(rows, "emp_expense_bonus"));
  const employeeBenefitExpense = round22(
    sumDr(rows, "emp_expense_salaries", "emp_expense_welfare", "allowances_expense") + sumDr(rows, "emp_expense_pf", "emp_expense_gratuity", "emp_expense_other") + staffBonusProvision + sumDr(rows, "emp_expense_leave")
  );
  const financeCharges = round22(sumDr(rows, "finance_cost_interest", "finance_cost_bank_charges"));
  const depreciation = round22(adj.totalDepreciationExpense ?? 0);
  const impairment = round22(
    sumDr(rows, "impairment_expense") + (adj.investmentAdjustments ?? []).reduce((s, i) => s + (i.impairmentAmount ?? 0), 0) + (adj.investmentAdjustments ?? []).filter((i) => (i.fairValueGainLoss ?? 0) < 0).reduce((s, i) => s + Math.abs(i.fairValueGainLoss ?? 0), 0)
  );
  const adminAndOtherExpenses = round22(
    ADMIN_CATEGORIES.reduce((s, cat) => s + sumDr(rows, cat), 0)
  );
  const totalExpenses = round22(
    materialConsumed + directExpenses + employeeBenefitExpense + financeCharges + depreciation + impairment + adminAndOtherExpenses
  );
  const profitBeforeStaffBonus = round22(totalIncome - (totalExpenses - staffBonusProvision));
  const staffBonus = round22(staffBonusProvision);
  const profitBeforeTax = round22(profitBeforeStaffBonus - staffBonus);
  const incomeTaxExpense = round22(
    adj.incomeTaxProvision ?? adj.currentTaxExpense ?? sumDr(rows, "income_tax_expense")
  );
  const netProfit = round22(profitBeforeTax - incomeTaxExpense);
  return {
    revenue,
    interestIncome,
    otherIncome,
    totalIncome,
    materialConsumed,
    directExpenses,
    employeeBenefitExpense,
    financeCharges,
    depreciation,
    impairment,
    adminAndOtherExpenses,
    totalExpenses,
    profitBeforeStaffBonus,
    staffBonus,
    profitBeforeTax,
    incomeTaxExpense,
    netProfit,
    revenue_py: previousYearIS.revenue ?? 0,
    interestIncome_py: previousYearIS.interestIncome ?? 0,
    otherIncome_py: previousYearIS.otherIncome ?? 0,
    totalIncome_py: previousYearIS.totalIncome ?? 0,
    materialConsumed_py: previousYearIS.materialConsumed ?? 0,
    directExpenses_py: previousYearIS.directExpenses ?? 0,
    employeeBenefitExpense_py: previousYearIS.employeeBenefitExpense ?? 0,
    financeCharges_py: previousYearIS.financeCharges ?? 0,
    depreciation_py: previousYearIS.depreciation ?? 0,
    impairment_py: previousYearIS.impairment ?? 0,
    adminAndOtherExpenses_py: previousYearIS.adminAndOtherExpenses ?? 0,
    totalExpenses_py: previousYearIS.totalExpenses ?? 0,
    profitBeforeStaffBonus_py: previousYearIS.profitBeforeStaffBonus ?? 0,
    staffBonus_py: previousYearIS.staffBonus ?? 0,
    profitBeforeTax_py: previousYearIS.profitBeforeTax ?? 0,
    incomeTaxExpense_py: previousYearIS.incomeTaxExpense ?? 0,
    netProfit_py: previousYearIS.netProfit ?? 0
  };
}
function computeBalanceSheet(tb, adj, is, company, previousYearBS = {}) {
  const rows = tb.rows;
  const grossPPE = sumDr(
    rows,
    "ppe_land",
    "ppe_buildings",
    "ppe_vehicles",
    "ppe_office_equipment",
    "ppe_computers",
    "ppe_furniture",
    "ppe_plant_machinery",
    "ppe_intangibles",
    "ppe_cwip"
  );
  const accumDepn = sumCr(rows, "accum_depreciation");
  const depnInTB = round22(sumCr(rows, "accum_depreciation") - sumOpeningCr(rows, "accum_depreciation"));
  const totalAccumDepn = depnInTB >= adj.totalDepreciationExpense * 0.99 ? accumDepn : accumDepn + adj.totalDepreciationExpense;
  const nca_ppe = round22(Math.max(0, grossPPE - totalAccumDepn));
  const listedFVAdj = (adj.investmentAdjustments ?? []).filter((i) => i.investmentType === "listed_trading" || i.investmentType === "listed_ats").reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const unlistedImpair = (adj.investmentAdjustments ?? []).filter((i) => i.investmentType === "unlisted").reduce((s, i) => s + (i.impairmentAmount ?? 0), 0);
  const invImpairmentProvision = sumCr(
    rows,
    "provision_impairment_investment",
    "provision_impairment_investments"
  );
  const investmentListedTrading = round22(Math.max(0, sumDr(rows, "investment_listed_trading") + listedFVAdj));
  const investmentUnlisted = sumDr(rows, "investment_unlisted") - unlistedImpair;
  const investmentFD_NC = sumDr(rows, "investment_fixed_deposit_noncurrent");
  const nca_investments = round22(Math.max(
    0,
    investmentUnlisted + investmentFD_NC - invImpairmentProvision
  ));
  const nca_receivables = round22(
    sumDr(rows, "nca_deposits", "nca_loans_advances")
  );
  const nca_other = round22(
    sumDr(rows, "biological_assets", "other_noncurrent_assets", "nca_other")
  );
  const totalNonCurrentAssets = round22(nca_ppe + nca_investments + nca_receivables + nca_other);
  const ca_investments = investmentListedTrading;
  const { closingCY } = inventoryFromAdj(adj, rows);
  const ca_inventories = round22(Math.max(0, closingCY - (adj.totalInventoryImpairment ?? 0)));
  const tradeRec = sumDr(rows, "trade_receivables");
  const impairmentOnRec = sumCr(rows, "provision_impairment_debtors");
  const ca_tradeReceivables = round22(Math.max(
    0,
    tradeRec - impairmentOnRec + sumDr(rows, "related_party_receivable") + sumDr(
      rows,
      "other_receivables_advance_supplier",
      "other_receivables_prepayments",
      "other_receivables_staff_advance",
      "other_receivables_tds",
      "other_receivables_loans"
    )
  ));
  const { cash: cashNet, overdrafts: bankOverdrafts } = splitCashAndOverdrafts(rows);
  const ca_cashAndEquivalents = cashNet;
  const ca_other = round22(sumDr(rows, "lc_bg_margin", "other_current_assets", "nca_held_for_sale"));
  const totalCurrentAssets = round22(
    ca_investments + ca_inventories + ca_tradeReceivables + ca_cashAndEquivalents + ca_other
  );
  const totalAssets = round22(totalNonCurrentAssets + totalCurrentAssets);
  const shareCapital = round22(sumCr(rows, "share_capital"));
  const sharePremium = round22(sumCr(rows, "share_premium"));
  const reserves = round22(sumCr(rows, "capital_reserve", "revaluation_reserve"));
  const dividendDeclared = adj.dividendPayable ?? sumCr(rows, "dividend_payable") ?? round22((company.dividendDeclaredPercent ?? 0) / 100 * shareCapital);
  const openingRE = round22(
    sumOpeningCr(rows, "retained_earnings", "general_reserve") - sumOpeningDr(rows, "retained_earnings", "general_reserve")
  );
  const eq_retainedEarnings = round22(openingRE + is.netProfit - dividendDeclared);
  const eq_shareCapital = round22(shareCapital + sharePremium);
  const eq_reserves = round22(reserves);
  const totalEquity = round22(eq_shareCapital + eq_reserves + eq_retainedEarnings);
  const ncl_borrowings = round22(
    sumCr(rows, "borrowings_noncurrent_bank", "borrowings_noncurrent_other", "borrowings_noncurrent_related")
  );
  const ncl_employeeBenefits = round22(sumCr(rows, "employee_benefit_noncurrent", "employee_benefit_gratuity"));
  const ncl_provisions = 0;
  const bookDepForDeferred = adj.totalDepreciationExpense ?? is.depreciation ?? 0;
  const taxDepForDeferred = adj.taxDepreciationPools?.reduce((s, p) => s + (p.taxDepreciation ?? 0), 0) ?? 0;
  const taxRateForDeferred = (company.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;
  const timingDifference = bookDepForDeferred - taxDepForDeferred;
  const computedDeferredTax = round22(Math.max(0, timingDifference) * taxRateForDeferred);
  const tbDeferredTax = sumCr(rows, "deferred_tax_liability");
  const ncl_deferredTax = round22(Math.max(tbDeferredTax, computedDeferredTax));
  const totalNonCurrentLiabilities = round22(
    ncl_borrowings + ncl_employeeBenefits + ncl_provisions + ncl_deferredTax
  );
  const cl_borrowings = round22(
    sumCr(
      rows,
      "borrowings_current_od",
      "borrowings_current_cc",
      "borrowings_current_wc",
      "borrowings_current_portion_lt",
      "borrowings_related_current",
      "related_party_payable"
    ) + bankOverdrafts
  );
  const cl_tradePayables = round22(
    sumCr(
      rows,
      "trade_payables_creditors",
      "trade_payables",
      "audit_fee_payable",
      "tds_payable",
      "other_payables",
      "trade_payables_advance_customers",
      "vat_payable"
    )
  );
  const incomeTaxPayable = round22(sumCr(rows, "income_tax_payable"));
  const advanceTax = round22(sumDr(rows, "advance_tax_paid", "other_receivables_tds"));
  const cl_incomeTaxPayable = round22(Math.max(
    0,
    incomeTaxPayable - advanceTax - (adj.incomeTaxPaidPY ?? 0) + Math.max(0, (adj.incomeTaxProvision ?? 0) - sumDr(rows, "income_tax_expense"))
  ));
  const cl_provisions = round22(
    sumCr(
      rows,
      "provisions_csr",
      "provisions_current",
      "employee_payables_pf",
      "employee_payables_salary",
      "employee_payables_bonus"
    )
  );
  const cl_other = round22(sumCr(rows, "advance_from_customers", "dividend_payable"));
  const totalCurrentLiabilities = round22(
    cl_borrowings + cl_tradePayables + cl_incomeTaxPayable + cl_provisions + cl_other
  );
  const totalEquityAndLiabilities = round22(totalEquity + totalNonCurrentLiabilities + totalCurrentLiabilities);
  const checkDifference = round22(totalAssets - totalEquityAndLiabilities);
  return {
    nca_ppe,
    nca_investments,
    nca_receivables,
    nca_other,
    totalNonCurrentAssets,
    ca_investments,
    ca_inventories,
    ca_tradeReceivables,
    ca_cashAndEquivalents,
    ca_other,
    totalCurrentAssets,
    totalAssets,
    eq_shareCapital,
    eq_reserves,
    eq_retainedEarnings,
    totalEquity,
    ncl_borrowings,
    ncl_employeeBenefits,
    ncl_provisions,
    ncl_deferredTax,
    totalNonCurrentLiabilities,
    cl_borrowings,
    cl_tradePayables,
    cl_incomeTaxPayable,
    cl_provisions,
    cl_other,
    totalCurrentLiabilities,
    totalEquityAndLiabilities,
    checkDifference,
    nca_ppe_py: previousYearBS.nca_ppe ?? 0,
    nca_investments_py: previousYearBS.nca_investments ?? 0,
    nca_receivables_py: previousYearBS.nca_receivables ?? 0,
    nca_other_py: previousYearBS.nca_other ?? 0,
    totalNonCurrentAssets_py: previousYearBS.totalNonCurrentAssets ?? 0,
    ca_investments_py: previousYearBS.ca_investments ?? 0,
    ca_inventories_py: previousYearBS.ca_inventories ?? 0,
    ca_tradeReceivables_py: previousYearBS.ca_tradeReceivables ?? 0,
    ca_cashAndEquivalents_py: previousYearBS.ca_cashAndEquivalents ?? 0,
    ca_other_py: previousYearBS.ca_other ?? 0,
    totalCurrentAssets_py: previousYearBS.totalCurrentAssets ?? 0,
    totalAssets_py: previousYearBS.totalAssets ?? 0,
    eq_shareCapital_py: previousYearBS.eq_shareCapital ?? 0,
    eq_reserves_py: previousYearBS.eq_reserves ?? 0,
    eq_retainedEarnings_py: previousYearBS.eq_retainedEarnings ?? 0,
    totalEquity_py: previousYearBS.totalEquity ?? 0,
    ncl_borrowings_py: previousYearBS.ncl_borrowings ?? 0,
    ncl_employeeBenefits_py: previousYearBS.ncl_employeeBenefits ?? 0,
    ncl_provisions_py: previousYearBS.ncl_provisions ?? 0,
    ncl_deferredTax_py: previousYearBS.ncl_deferredTax ?? 0,
    totalNonCurrentLiabilities_py: previousYearBS.totalNonCurrentLiabilities ?? 0,
    cl_borrowings_py: previousYearBS.cl_borrowings ?? 0,
    cl_tradePayables_py: previousYearBS.cl_tradePayables ?? 0,
    cl_incomeTaxPayable_py: previousYearBS.cl_incomeTaxPayable ?? 0,
    cl_provisions_py: previousYearBS.cl_provisions ?? 0,
    cl_other_py: previousYearBS.cl_other ?? 0,
    totalCurrentLiabilities_py: previousYearBS.totalCurrentLiabilities ?? 0,
    totalEquityAndLiabilities_py: previousYearBS.totalEquityAndLiabilities ?? 0,
    checkDifference_py: previousYearBS.checkDifference ?? 0
  };
}
function computeChangesInEquity(tb, adj, is, company, previousCIE) {
  const rows = tb.rows;
  const shareCapital = sumCr(rows, "share_capital");
  const sharePremium = sumCr(rows, "share_premium");
  const otherReserves = sumCr(rows, "general_reserve", "capital_reserve", "revaluation_reserve");
  const openingShareCapital = sumOpeningCr(rows, "share_capital");
  const openingSharePremium = sumOpeningCr(rows, "share_premium");
  const openingOtherReserves = sumOpeningCr(rows, "general_reserve", "capital_reserve", "revaluation_reserve");
  const openingRetained = round22(
    sumOpeningCr(rows, "retained_earnings", "general_reserve") - sumOpeningDr(rows, "retained_earnings", "general_reserve")
  );
  const shareIssued = company.shareIssuedDuringYear ? round22(company.shareIssuedDuringYear * 100) : round22(shareCapital - openingShareCapital);
  const dividendDeclared = adj.dividendPayable ?? sumCr(rows, "dividend_payable") ?? round22((company.dividendDeclaredPercent ?? 0) / 100 * openingShareCapital);
  const closingRetained = round22(openingRetained + is.netProfit - dividendDeclared);
  return {
    cyOpeningShareCapital: round22(openingShareCapital),
    cyOpeningSharePremium: round22(openingSharePremium),
    cyOpeningGeneralReserve: round22(openingOtherReserves),
    cyOpeningRetainedEarnings: round22(openingRetained),
    cyOpeningTotal: round22(openingShareCapital + openingSharePremium + openingOtherReserves + openingRetained),
    cyNetProfit: round22(is.netProfit),
    cyShareCapitalIssued: shareIssued,
    cySharePremiumReceived: round22(sharePremium - openingSharePremium),
    cyTransferToReserve: 0,
    cyDividends: round22(dividendDeclared),
    cyClosingShareCapital: round22(shareCapital),
    cyClosingSharePremium: round22(sharePremium),
    cyClosingGeneralReserve: round22(otherReserves),
    cyClosingRetainedEarnings: closingRetained,
    cyClosingTotal: round22(shareCapital + sharePremium + otherReserves + closingRetained),
    ...previousCIE
  };
}
function computeCashFlow(tb, adj, is, bs, previousCF) {
  const rows = tb.rows;
  const profitBeforeTax = is.profitBeforeTax;
  const addDepreciation = adj.totalDepreciationExpense ?? 0;
  const addImpairment = is.impairment;
  const lessInterestIncome = -is.interestIncome;
  const lessDividendIncome = -sumCr(rows, "other_income_dividend");
  const addInterestExpense = is.financeCharges;
  const addLossOnDisposal = adj.lossOnDisposals ?? 0;
  const lessGainOnDisposal = -(adj.gainOnDisposals ?? 0);
  const fvLoss = (adj.investmentAdjustments ?? []).filter((i) => (i.fairValueGainLoss ?? 0) < 0).reduce((s, i) => s - (i.fairValueGainLoss ?? 0), 0);
  const fvGain = (adj.investmentAdjustments ?? []).filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const addFVLossOnInvestment = fvLoss;
  const lessFVGainOnInvestment = -fvGain;
  const prevTradeRec = previousCF?.decreaseIncreaseReceivables !== void 0 ? bs.ca_tradeReceivables + previousCF.decreaseIncreaseReceivables : round22(
    sumOpeningDr(
      rows,
      "trade_receivables",
      "other_receivables_advance_supplier",
      "other_receivables_prepayments",
      "other_receivables_staff_advance",
      "other_receivables_loans",
      "related_party_receivable"
    ) - sumOpeningCr(rows, "provision_impairment_debtors")
  );
  const decreaseIncreaseReceivables = round22(prevTradeRec - bs.ca_tradeReceivables);
  const { openingPY, closingCY } = inventoryFromAdj(adj, rows);
  const prevInv = previousCF?.decreaseIncreaseInventory !== void 0 ? bs.ca_inventories + previousCF.decreaseIncreaseInventory : openingPY;
  const decreaseIncreaseInventory = round22(prevInv - bs.ca_inventories);
  const prevOtherCA = sumOpeningDr(rows, "other_current_assets", "nca_held_for_sale");
  const decreaseIncreaseOtherCurrentAssets = round22(prevOtherCA - bs.ca_other);
  const prevPayables = sumOpeningCr(
    rows,
    "trade_payables_creditors",
    "tds_payable",
    "other_payables",
    "audit_fee_payable",
    "trade_payables_advance_customers"
  );
  const increaseDecreasePayables = round22(bs.cl_tradePayables - prevPayables);
  const prevTaxPayable = sumOpeningCr(rows, "income_tax_payable");
  const increaseDecreaseIncomeTaxPayable = round22(bs.cl_incomeTaxPayable - prevTaxPayable);
  const prevEmpLiab = sumOpeningCr(
    rows,
    "employee_payables_pf",
    "employee_payables_bonus",
    "employee_payables_salary",
    "employee_benefit_noncurrent"
  );
  const currentEmpLiab = round22(
    sumCr(rows, "employee_payables_pf", "employee_payables_bonus", "employee_payables_salary") + (adj.staffBonusProvision ?? is.staffBonus)
  );
  const increaseDecreaseEmployeeLiability = round22(currentEmpLiab - prevEmpLiab);
  const prevProvisions = sumOpeningCr(rows, "provisions_csr", "provisions_current");
  const increaseDecreaseProvisions = round22(bs.cl_provisions - prevProvisions - (adj.staffBonusProvision ?? 0));
  const cashGeneratedFromOperations = round22(
    profitBeforeTax + addDepreciation + addImpairment + lessInterestIncome + lessDividendIncome + addInterestExpense + addLossOnDisposal + lessGainOnDisposal + addFVLossOnInvestment + lessFVGainOnInvestment + decreaseIncreaseReceivables + decreaseIncreaseInventory + decreaseIncreaseOtherCurrentAssets + increaseDecreasePayables + increaseDecreaseIncomeTaxPayable + increaseDecreaseEmployeeLiability + increaseDecreaseProvisions
  );
  const interestPaid = -Math.abs(is.financeCharges);
  const incomeTaxPaid = -Math.abs(
    sumDr(rows, "advance_tax_paid") + (adj.incomeTaxPaidPY ?? 0)
  );
  const netCashFromOperating = round22(cashGeneratedFromOperations + interestPaid + incomeTaxPaid);
  const proceedsFromPPEDisposal = (adj.depreciationResults ?? []).reduce((s, r) => s + (r.disposalProceeds ?? 0), 0);
  const proceedsFromInvestmentDisposal = 0;
  const interestReceived = is.interestIncome;
  const dividendReceived = sumCr(rows, "other_income_dividend");
  const purchaseOfPPE = -(adj.assets ?? []).reduce((s, a) => s + (a.additionalCost ?? 0), 0);
  const purchaseOfInvestments = -Math.max(
    0,
    netBalance(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent") - (sumOpeningDr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent") - sumOpeningCr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent"))
  );
  const netCashFromInvesting = round22(
    proceedsFromPPEDisposal + proceedsFromInvestmentDisposal + interestReceived + dividendReceived + purchaseOfPPE + purchaseOfInvestments
  );
  const proceedsFromShareIssue = round22(
    sumCr(rows, "share_capital") - sumOpeningCr(rows, "share_capital") + (sumCr(rows, "share_premium") - sumOpeningCr(rows, "share_premium"))
  );
  const ncBorrowChange = sumCr(rows, "borrowings_noncurrent_bank", "borrowings_noncurrent_other") - sumOpeningCr(rows, "borrowings_noncurrent_bank", "borrowings_noncurrent_other");
  const proceedsFromBorrowingsNonCurrent = round22(Math.max(0, ncBorrowChange));
  const repaymentOfBorrowingsNonCurrent = round22(Math.min(0, ncBorrowChange));
  const cBorrowChange = sumCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc") - sumOpeningCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc");
  const proceedsFromBorrowingsCurrent = round22(Math.max(0, cBorrowChange));
  const repaymentOfBorrowingsCurrent = round22(Math.min(0, cBorrowChange));
  const openingDivPayable = sumOpeningCr(rows, "dividend_payable");
  const closingDivPayable = sumCr(rows, "dividend_payable");
  const dividendDeclared = adj.dividendPayable ?? 0;
  const impliedCashPaid = Math.max(0, openingDivPayable - closingDivPayable);
  const cashDividendsPaid = Math.max(0, openingDivPayable + dividendDeclared - closingDivPayable, impliedCashPaid);
  const dividendPaid = -round22(cashDividendsPaid);
  const netCashFromFinancing = round22(
    proceedsFromShareIssue + proceedsFromBorrowingsNonCurrent + repaymentOfBorrowingsNonCurrent + proceedsFromBorrowingsCurrent + repaymentOfBorrowingsCurrent + dividendPaid
  );
  const netIncreaseDecrease = round22(netCashFromOperating + netCashFromInvesting + netCashFromFinancing);
  const openingCash = round22(
    sumOpeningDr(rows, "cash_in_hand", "bank_current_account", "bank_fixed_deposit_current") - sumOpeningCr(rows, "bank_current_account")
  );
  const closingCash = bs.ca_cashAndEquivalents;
  const reconciliationDifference = round22(closingCash - (openingCash + netIncreaseDecrease));
  return {
    profitBeforeTax,
    addDepreciation,
    addImpairment,
    lessInterestIncome,
    lessDividendIncome,
    addInterestExpense,
    addLossOnDisposal,
    lessGainOnDisposal,
    addFVLossOnInvestment,
    lessFVGainOnInvestment,
    decreaseIncreaseReceivables,
    decreaseIncreaseInventory,
    decreaseIncreaseOtherCurrentAssets,
    increaseDecreasePayables,
    increaseDecreaseIncomeTaxPayable,
    increaseDecreaseEmployeeLiability,
    increaseDecreaseProvisions,
    cashGeneratedFromOperations,
    interestPaid,
    incomeTaxPaid,
    netCashFromOperating,
    proceedsFromPPEDisposal,
    proceedsFromInvestmentDisposal,
    interestReceived,
    dividendReceived,
    purchaseOfPPE,
    purchaseOfInvestments,
    netCashFromInvesting,
    proceedsFromShareIssue,
    proceedsFromBorrowingsNonCurrent,
    proceedsFromBorrowingsCurrent,
    repaymentOfBorrowingsNonCurrent,
    repaymentOfBorrowingsCurrent,
    dividendPaid,
    netCashFromFinancing,
    netIncreaseDecrease,
    openingCash,
    closingCash,
    reconciliationDifference,
    ...previousCF
  };
}
function computeAllFinancials(tb, adj, company, previousYearData) {
  const enrichedAdj = { ...adj };
  const pyBS = previousYearData ? {
    nca_ppe: previousYearData.ppe,
    nca_investments: previousYearData.investments,
    ca_cashAndEquivalents: previousYearData.cashAndEquivalents,
    totalCurrentAssets: previousYearData.currentAssets,
    eq_shareCapital: previousYearData.shareCapital,
    eq_reserves: previousYearData.reserves,
    ncl_borrowings: previousYearData.borrowingsNonCurrent,
    cl_borrowings: previousYearData.borrowingsCurrent,
    cl_tradePayables: previousYearData.tradePayables,
    cl_provisions: previousYearData.provisions
  } : {};
  const pyIS = previousYearData ? {
    revenue: previousYearData.revenue,
    materialConsumed: previousYearData.costOfSales,
    otherIncome: previousYearData.otherIncome,
    adminAndOtherExpenses: previousYearData.adminExpenses,
    financeCharges: previousYearData.financeCosts,
    depreciation: previousYearData.depreciation,
    incomeTaxExpense: previousYearData.incomeTaxExpense
  } : {};
  const incomeStatement = computeIncomeStatement(tb, enrichedAdj, company, pyIS);
  if (enrichedAdj.staffBonusProvision == null && incomeStatement.profitBeforeStaffBonus > 0) {
    enrichedAdj.staffBonusProvision = computeStaffBonus(incomeStatement.profitBeforeStaffBonus);
    incomeStatement.staffBonus = enrichedAdj.staffBonusProvision;
    incomeStatement.profitBeforeTax = round22(incomeStatement.profitBeforeStaffBonus - incomeStatement.staffBonus);
  }
  if (enrichedAdj.incomeTaxProvision == null && incomeStatement.profitBeforeTax > 0) {
    const taxRate = (company.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;
    const taxResult = computeTax({
      accountingProfit: incomeStatement.profitBeforeTax,
      accountingDepreciation: enrichedAdj.totalDepreciationExpense ?? incomeStatement.depreciation ?? 0,
      taxDepreciation: enrichedAdj.taxDepreciationPools?.reduce((s, p) => s + (p.taxDepreciation ?? 0), 0) ?? 0,
      disallowedForTax: enrichedAdj.disallowedForTax ?? [],
      staffBonus: enrichedAdj.staffBonusProvision ?? 0,
      profitBeforeBonus: incomeStatement.profitBeforeStaffBonus,
      advanceTaxPaid: sumDr(tb.rows, "advance_tax_paid"),
      incomeTaxRate: taxRate,
      entityType: company.entityType ?? "Company"
    });
    enrichedAdj.incomeTaxProvision = taxResult.currentTaxExpense;
    enrichedAdj.currentTaxExpense = taxResult.currentTaxExpense;
    const bookDep = enrichedAdj.totalDepreciationExpense ?? incomeStatement.depreciation ?? 0;
    const taxDep = enrichedAdj.taxDepreciationPools?.reduce((s, p) => s + (p.taxDepreciation ?? 0), 0) ?? 0;
    const timingDiff = bookDep - taxDep;
    const pyDeferredTax = 0;
    const computedDTL = round22(Math.max(0, timingDiff) * taxRate);
    enrichedAdj.deferredTaxExpense = round22(Math.max(0, computedDTL - pyDeferredTax));
    incomeStatement.incomeTaxExpense = round22(
      taxResult.currentTaxExpense + (enrichedAdj.deferredTaxExpense ?? 0)
    );
    incomeStatement.netProfit = round22(incomeStatement.profitBeforeTax - incomeStatement.incomeTaxExpense);
  }
  const balanceSheet = computeBalanceSheet(tb, enrichedAdj, incomeStatement, company, pyBS);
  const changesInEquity = computeChangesInEquity(tb, enrichedAdj, incomeStatement, company);
  const cashFlow = computeCashFlow(tb, enrichedAdj, incomeStatement, balanceSheet);
  const notes = buildNotesData({ tb, adj: enrichedAdj, bs: balanceSheet, is: incomeStatement, company });
  return { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes };
}

// server/routes/financials.ts
var router4 = Router4();
function getSessionId(req) {
  return req.params.companyId || req.cookies?.sessionId || "";
}
function requireSession(req, res) {
  const sessionId = getSessionId(req);
  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: "Session not found" });
    return null;
  }
  return { session, sessionId };
}
router4.post("/compute", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const { session } = ctx;
  const missing = [];
  if (!session.company) missing.push("company profile");
  if (!session.trialBalance) missing.push("trial balance");
  if (!session.adjustments) missing.push("year-end adjustments");
  if (missing.length > 0) {
    return res.status(400).json({ success: false, error: `Missing data: ${missing.join(", ")}.` });
  }
  const result = computeAllFinancials(
    session.trialBalance,
    session.adjustments,
    session.company,
    session.company?.previousYearData
  );
  sessionStore.set(ctx.sessionId, {
    financials: result,
    statements: result,
    notes: result.notes
  });
  return res.json({ success: true, data: result });
}));
router4.post("/:companyId/generate", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const { session } = ctx;
  const missing = [];
  if (!session.company) missing.push("company profile");
  if (!session.trialBalance) missing.push("trial balance");
  if (!session.adjustments) missing.push("year-end adjustments");
  if (missing.length > 0) return res.status(400).json({ success: false, error: `Missing data: ${missing.join(", ")}.` });
  const result = computeAllFinancials(session.trialBalance, session.adjustments, session.company, session.company?.previousYearData);
  sessionStore.set(ctx.sessionId, { financials: result, statements: result, notes: result.notes });
  return res.json({ success: true, data: result });
}));
router4.get("/validation", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const financials = ctx.session.financials;
  if (!financials?.balanceSheet) {
    return res.status(404).json({ success: false, error: "Financial statements not computed yet." });
  }
  const bs = financials.balanceSheet;
  const cf = financials.cashFlow;
  const errors = [];
  if (Math.abs(bs.checkDifference ?? 0) > 1) errors.push(`Balance sheet difference: NPR ${bs.checkDifference}`);
  if (Math.abs(cf.reconciliationDifference ?? 0) > 1) errors.push(`Cash flow reconciliation difference: NPR ${cf.reconciliationDifference}`);
  return res.json({ success: true, data: { isValid: errors.length === 0, errors, warnings: [] } });
}));
router4.get("/:companyId/balance-sheet", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const bs = ctx.session.financials?.balanceSheet;
  if (!bs) return res.status(404).json({ success: false, error: "Not generated yet." });
  return res.json({ success: true, data: bs });
}));
router4.get("/:companyId/income-statement", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const is = ctx.session.financials?.incomeStatement;
  if (!is) return res.status(404).json({ success: false, error: "Not generated yet." });
  return res.json({ success: true, data: is });
}));
router4.get("/:companyId/cash-flow", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const cf = ctx.session.financials?.cashFlow;
  if (!cf) return res.status(404).json({ success: false, error: "Not generated yet." });
  return res.json({ success: true, data: cf });
}));
router4.get("/:companyId/changes-in-equity", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const cie = ctx.session.financials?.changesInEquity;
  if (!cie) return res.status(404).json({ success: false, error: "Not generated yet." });
  return res.json({ success: true, data: cie });
}));
router4.get("/:companyId/notes", asyncHandler(async (req, res) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const notes = ctx.session.financials?.notes;
  if (!notes) return res.status(404).json({ success: false, error: "Not generated yet." });
  return res.json({ success: true, data: notes });
}));
var financials_default = router4;

// server/routes/output.ts
import { Router as Router5 } from "express";
var router5 = Router5();
router5.post("/:companyId/generate-excel", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const missing = [];
  if (!session?.company) missing.push("company profile");
  if (!session?.trialBalance) missing.push("trial balance");
  if (!session?.adjustments) missing.push("year-end adjustments");
  if (missing.length > 0) return res.status(400).json({ error: `Missing data: ${missing.join(", ")}.` });
  const financials = session.financials ?? computeAllFinancials(session.trialBalance, session.adjustments, session.company, session.company.previousYearData);
  const { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes } = financials;
  const buffer = await generateNFRSWorkbook({
    company: session.company,
    trialBalance: session.trialBalance,
    balanceSheet,
    incomeStatement,
    changesInEquity,
    cashFlow,
    notes,
    adjustments: session.adjustments
  });
  const companyName = (session.company.companyName ?? "Company").replace(/[^a-zA-Z0-9]/g, "_");
  const fiscalYear = session.company.fiscalYear?.bsFY?.replace("/", "-") ?? "financials";
  const filename = `NFRS_Financials_${companyName}_${fiscalYear}.xlsx`;
  console.log("[Excel Generated]", companyName, fiscalYear, buffer.length, "bytes");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
}));
var output_default = router5;

// server/middleware/security.ts
function createRateLimiter(windowMs, maxRequests, message) {
  const clients = /* @__PURE__ */ new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      if (now > record.resetAt) {
        clients.delete(ip);
      }
    }
  }, windowMs * 2);
  if (cleanup.unref) cleanup.unref();
  return (req, res, next) => {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const existing = clients.get(clientIp);
    if (!existing || now > existing.resetAt) {
      clients.set(clientIp, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1e3)));
      next();
    } else if (existing.count < maxRequests) {
      existing.count++;
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(maxRequests - existing.count));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1e3)));
      next();
    } else {
      const retryAfterSecs = Math.ceil((existing.resetAt - now) / 1e3);
      res.setHeader("Retry-After", String(retryAfterSecs));
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1e3)));
      res.status(429).json({
        error: message ?? "Too many requests. Please wait and try again.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: retryAfterSecs
      });
    }
  };
}
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        // Vite inline scripts
        "style-src 'self' 'unsafe-inline'",
        // Tailwind inline styles
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'"
      ].join("; ")
    );
  }
  next();
}
function requestLogger(req, res, next) {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }
  const start = Date.now();
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 500 ? "\x1B[31m" : (
      // red
      res.statusCode >= 400 ? "\x1B[33m" : (
        // yellow
        res.statusCode >= 300 ? "\x1B[36m" : (
          // cyan
          "\x1B[32m"
        )
      )
    );
    const reset = "\x1B[0m";
    console.log(
      `[${(/* @__PURE__ */ new Date()).toISOString()}] ${req.method} ${req.path} ${statusColor}${res.statusCode}${reset} ${duration}ms \u2014 ${clientIp}`
    );
  });
  next();
}

// server/server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = parseInt(process.env.PORT ?? "3000", 10);
var isDev = process.env.NODE_ENV !== "production";
var DIST = path.join(__dirname, "..", "dist");
var app = express();
app.use(securityHeaders);
app.use(requestLogger);
if (isDev) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5173");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.header("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  console.log("[CORS] Dev CORS enabled for http://localhost:5173");
}
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  "/api/trial-balance",
  express.raw({ type: "application/octet-stream", limit: "50mb" })
);
var standardLimiter = createRateLimiter(6e4, 120);
var uploadLimiter = createRateLimiter(6e4, 20);
var outputLimiter = createRateLimiter(6e4, 10);
var aiLimiter = createRateLimiter(6e4, 5);
app.use("/api", standardLimiter);
app.use("/api/trial-balance", uploadLimiter);
app.use("/api/output", outputLimiter);
app.use("/api/trial-balance/:companyId/rematch-ai", aiLimiter);
app.use("/api/trial-balance/:companyId/ai-convert", aiLimiter);
app.get("/api/health", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    service: "NFRS Financial Reporter",
    version: "2.0.0",
    env: process.env.NODE_ENV ?? "development",
    uptime: `${Math.floor(process.uptime())}s`,
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use("/api/company", company_default);
app.use("/api/trial-balance", trialBalance_default);
app.use("/api/adjustments", adjustments_default);
app.use("/api/financials", financials_default);
app.use("/api/output", output_default);
if (!isDev) {
  app.use(express.static(DIST, {
    maxAge: "1d",
    etag: true,
    index: "index.html"
  }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      message: "NFRS API Server (dev mode). Frontend served by Vite at http://localhost:5173",
      api: "http://localhost:3000/api",
      health: "http://localhost:3000/api/health"
    });
  });
}
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});
app.use(errorMiddleware);
var server = http.createServer(app);
var HOST = process.env.HOST ?? "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log("\n" + "\u2550".repeat(50));
  console.log(`  \u{1F1F3}\u{1F1F5} NFRS Financial Reporter`);
  console.log("\u2550".repeat(50));
  console.log(`  \u{1F310} Mode:       ${isDev ? "Development" : "Production"}`);
  console.log(`  \u{1F50C} API:        http://${HOST}:${PORT}/api`);
  console.log(`  \u2764\uFE0F  Health:     http://${HOST}:${PORT}/api/health`);
  if (!isDev) {
    console.log(`  \u{1F4C1} Frontend:   http://${HOST}:${PORT}`);
  } else {
    console.log(`  \u{1F4C1} Frontend:   http://localhost:5173 (Vite)`);
  }
  const mem = process.memoryUsage();
  console.log(`  \u{1F4BE} Memory:     RSS ${(mem.rss / 1024 / 1024).toFixed(1)}MB, Heap ${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  console.log("\u2550".repeat(50) + "\n");
});
var SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1e3;
var SESSION_MAX_AGE_HOURS = 4;
setInterval(() => {
  const removed = sessionStore.cleanup(SESSION_MAX_AGE_HOURS);
  console.log(`[Session Cleanup] Removed ${removed} expired session(s) (older than ${SESSION_MAX_AGE_HOURS}h)`);
}, SESSION_CLEANUP_INTERVAL_MS);
setTimeout(() => {
  const removed = sessionStore.cleanup(SESSION_MAX_AGE_HOURS);
  if (removed > 0) console.log(`[Session Cleanup] Startup: removed ${removed} stale session(s)`);
}, 5e3);
function shutdown(signal) {
  console.log(`
[Server] ${signal} received. Shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error("[Server] Error during shutdown:", err.message);
      process.exit(1);
    }
    console.log("[Server] All connections closed. Goodbye!");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[Server] Force shutdown after timeout.");
    process.exit(1);
  }, 1e4).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception]", err);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});
var server_default = app;
export {
  server_default as default
};
//# sourceMappingURL=server.js.map
