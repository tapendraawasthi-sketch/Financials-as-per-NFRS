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
function getFiscalYearOptions() {
  return FISCAL_YEARS.map((fy) => ({
    value: fy.bsFY,
    label: `${fy.bsFY}  (${formatADDate(fy.startAD)} \u2013 ${formatADDate(fy.endAD)})`
  }));
}

// server/routes/company.ts
var router = Router();
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
    "debit",
    "dr",
    "during year dr",
    "receipt",
    "dr total",
    "transaction debit",
    "total debit",
    "transactions dr",
    "during period dr",
    "period dr"
  ],
  duringCr: [
    "during cr",
    "transaction cr",
    "dur cr",
    "movement cr",
    "credit",
    "cr",
    "during year cr",
    "payment",
    "cr total",
    "transaction credit",
    "total credit",
    "transactions cr",
    "during period cr",
    "period cr"
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
  const cleaned = str.replace(/,/g, "").replace(/\s/g, "").replace(/[()]/g, "").replace(/NPR/gi, "").replace(/Rs\.?/gi, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNeg ? -Math.abs(num) : num;
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
    if (colMap["label"] !== void 0) {
      const amountCols = Object.keys(colMap).filter((k) => k !== "label");
      if (amountCols.length >= 1) {
        return { colMap, headerRowIndex: r };
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
function detectFormat(matrix, detection) {
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
function parseMatrix(matrix) {
  const warnings = [];
  const headerDetection = detectColumns(matrix);
  const { format, colMap, headerRowIndex } = detectFormat(matrix, headerDetection);
  const mode = format;
  if (mode === "3col") {
    warnings.push("Treating file as 3-column (label, debit, credit) layout.");
  } else if (mode === "2col") {
    warnings.push("Treating file as 2-column net balance layout (positive=Dr, negative=Cr).");
  }
  if (mode === "full" && colMap["label"] === void 0) {
    throw Object.assign(
      new Error("Could not detect column headers."),
      { status: 400, code: "NO_HEADERS" }
    );
  }
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
  const rowsWithParents = assignParentGroups(rows);
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
  const round22 = (n) => Math.round(n * 100) / 100;
  totalClosingDr = round22(totalClosingDr);
  totalClosingCr = round22(totalClosingCr);
  const difference = round22(totalClosingDr - totalClosingCr);
  const isBalanced = Math.abs(difference) < 1;
  if (!isBalanced) {
    warnings.push(`Trial Balance not balanced. Difference: ${Math.abs(difference).toLocaleString("en-IN")}.`);
  }
  return {
    rows: rowsWithParents,
    totalOpeningDr: round22(totalOpeningDr),
    totalOpeningCr: round22(totalOpeningCr),
    totalDuringDr: round22(totalDuringDr),
    totalDuringCr: round22(totalDuringCr),
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
function parseCsv(buffer) {
  let text = buffer.toString("utf-8");
  if (text.includes("\uFFFD")) {
    text = buffer.toString("latin1");
  }
  return parseMatrix(parseCSVText(text));
}
async function parseTrialBalance(buffer, filename) {
  if (!buffer || buffer.length === 0) {
    throw Object.assign(
      new Error("The uploaded file is empty. Please upload a valid Excel or CSV file."),
      { status: 400, code: "EMPTY_FILE" }
    );
  }
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  let matrix = [];
  if (ext === ".csv") {
    return parseCsv(buffer);
  } else {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch (e) {
      throw new Error(
        "Could not read the uploaded file as an Excel workbook. If the file is in .xls (old format), please re-save it as .xlsx in Excel first."
      );
    }
    const ws = workbook.getWorksheet("Trial Balance") ?? workbook.getWorksheet("TB") ?? workbook.worksheets[0];
    if (!ws) {
      throw new Error("The uploaded workbook has no worksheets.");
    }
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
  }
  if (matrix.length === 0) {
    throw new Error("The uploaded file appears to be empty.");
  }
  return parseMatrix(matrix);
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
    nfrsCategory: best.entry.category,
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
    nfrsCategory: best.entry.category,
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
      nfrsCategory: exact,
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
          nfrsCategory: entry.category,
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
          nfrsCategory: entry.category,
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
      nfrsCategory: ctx.category,
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
  const BATCH_SIZE = 50;
  const client = new Anthropic({ apiKey });
  for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
    const batch = needsAI.slice(i, i + BATCH_SIZE);
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
      const category = validCategories.has(ai.category) ? ai.category : "unclassified";
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

// server/routes/trialBalance.ts
var router2 = Router2();
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
    const session = sessionStore.get(req.params.companyId);
    if (!session) return res.status(404).json({ error: "Company session not found. Create a company first." });
    const parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
    if (!parsed.rows || parsed.rows.length === 0) {
      return res.status(422).json({
        success: false,
        error: "No data rows found in the uploaded file. Please check your export settings and ensure the file contains account entries."
      });
    }
    let rows = classifyAll(parsed.rows);
    if (req.query.useAI === "true" && process.env.ANTHROPIC_API_KEY) {
      try {
        rows = await classifyWithAI(rows, process.env.ANTHROPIC_API_KEY);
      } catch (aiErr) {
        console.warn("[trialBalance.upload] AI matching failed:", aiErr);
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
      companyId: req.params.companyId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      uploadedFileName: req.file.originalname,
      totalClosingDr: parsed.totalClosingDr,
      totalClosingCr: parsed.totalClosingCr,
      difference: parsed.difference,
      detectedFormat: parsed.detectedFormat
    };
    const validation = validateTrialBalanceTotals(rows);
    tb.validation = validation;
    const diff = Math.abs(validation.totalClosingDr - validation.totalClosingCr);
    if (diff > 1e3) {
      return res.status(422).json({
        success: false,
        error: `Trial balance has a significant imbalance of NPR ${diff.toLocaleString("en-IN")}. Please check your accounting export before proceeding. Rounding differences up to NPR 1,000 are auto-adjusted.`,
        data: tb
        // still return data so user can review
      });
    }
    sessionStore.set(req.params.companyId, { trialBalance: tb });
    res.json({ success: true, data: tb });
  } catch (err) {
    next(err);
  }
});
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
        userOverride: "manual"
      };
    }
  }
  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  updatedTB.validation = validation;
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB });
  return res.json(updatedTB);
}));
router2.post("/:companyId/rematch-ai", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: "No trial balance loaded." });
  const lowConfRows = session.trialBalance.rows.filter((r) => !r.userOverride && (r.confidence ?? 0) < 80);
  if (lowConfRows.length === 0) return res.json({ message: "All accounts already matched with high confidence.", updatedCount: 0 });
  const aiInput = lowConfRows.map((r) => ({
    rowIndex: r.rowIndex,
    rawLabel: r.rawLabel,
    matchedLabel: r.matchedLabel ?? null,
    nfrsCategory: r.nfrsCategory ?? "unclassified",
    confidence: r.confidence ?? 0,
    method: r.matchMethod ?? "unmatched",
    candidates: r.candidates ?? [],
    needsReview: r.needsReview ?? true
  }));
  const aiResults = await aiMatchUnresolved(aiInput.map((r) => ({ rawLabel: r.rawLabel, closingBalance: 0 })), session.company, process.env.ANTHROPIC_API_KEY);
  const aiByRowIndex = new Map(aiResults.map((r) => [r.rowIndex, r]));
  const updatedRows = session.trialBalance.rows.map((row) => {
    const ai = aiByRowIndex.get(row.rowIndex);
    if (!ai || row.userOverride) return row;
    return { ...row, nfrsCategory: ai.nfrsCategory, matchedLabel: null, confidence: ai.confidence, matchMethod: "ai", needsReview: ai.confidence < 80 };
  });
  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB });
  return res.json({ updatedCount: aiResults.length, trialBalance: updatedTB });
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
  const { rate, method } = getRateAndMethod(asset, policies);
  const costBase = asset.originalCost + asset.additionsCY;
  const months = monthsHeldInFY(asset.purchaseDate);
  const fraction = asset.disposalDate ? months / 12 : months / 12;
  let depreciationCY = 0;
  if (asset.assetClass === "Land" || rate === 0) {
    depreciationCY = 0;
  } else if (method === "SLM") {
    depreciationCY = costBase * rate * fraction;
  } else {
    const wdv = costBase - asset.accumulatedDepnPY;
    depreciationCY = wdv * rate * fraction;
  }
  if (asset.disposalDate && asset.disposalValue !== void 0) {
    const nbv = costBase - asset.accumulatedDepnPY - depreciationCY;
    const gainLoss = asset.disposalValue - nbv;
    void gainLoss;
  }
  const accumulatedDepnCY = asset.accumulatedDepnPY + depreciationCY;
  const netBookValueCY = costBase - accumulatedDepnCY;
  const netBookValuePY = asset.originalCost - asset.accumulatedDepnPY;
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
  return TAX_POOLS.map((pool) => {
    const poolAssets = assets.filter((a) => pool.classes.includes(a.assetClass));
    let additions = 0;
    let disposals = 0;
    for (const a of poolAssets) {
      additions += a.additionsCY + a.originalCost;
      disposals += a.disposalValue ?? 0;
    }
    const openingBasis = openingBases[pool.poolName] ?? 0;
    let repairExpense = repairExpenses[pool.poolName] ?? 0;
    const repairThreshold = openingBasis * 0.07;
    const capitalizedRepairs = Math.max(0, repairExpense - repairThreshold);
    additions += capitalizedRepairs;
    const depreciationBasis = openingBasis + additions - disposals;
    const absorbed = additions;
    const depreciation = depreciationBasis * pool.rate;
    const netDepreciation = depreciation;
    const unabsorbed = Math.max(0, netDepreciation - taxableIncome * (2 / 3));
    const taxableDepreciation = netDepreciation - unabsorbed;
    const nextYearBasis = depreciationBasis - taxableDepreciation;
    return {
      poolName: pool.poolName,
      rate: pool.rate,
      openingBasis,
      additions,
      disposals,
      absorbed,
      unabsorbed: Math.round(unabsorbed * 100) / 100,
      nextYearBasis: Math.round(Math.max(0, nextYearBasis) * 100) / 100,
      repairExpense
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
  return {
    results: result.assetRegisterComputed,
    summary: result.ppeTotals.classes
  };
}
function calculateTaxDepreciation(assets, _categories, openingPoolBases) {
  return computeDepreciation(assets, void 0, { taxOpeningBases: openingPoolBases }).taxDepSchedule;
}

// server/routes/adjustments.ts
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
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? "");
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, assets } });
  return res.json({ message: "Asset register saved.", count: assets.length });
}));
router3.post("/:companyId/calculate-depreciation", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.company) return res.status(404).json({ error: "Company not found." });
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company.fiscalYear ?? "");
  const assetCategories = session.company.accountingPolicies?.assetCategories ?? [];
  const fiscalYear = session.company.fiscalYear ?? "2081/82";
  const { results, summary } = calculateDepreciationSummary(adj.assets, assetCategories, fiscalYear);
  const totalDepreciation = results.reduce((s, r) => s + r.depnForYear, 0);
  const gainOnDisposals = results.filter((r) => (r.gainLossOnDisposal ?? 0) > 0).reduce((s, r) => s + (r.gainLossOnDisposal ?? 0), 0);
  const lossOnDisposals = results.filter((r) => (r.gainLossOnDisposal ?? 0) < 0).reduce((s, r) => s + Math.abs(r.gainLossOnDisposal ?? 0), 0);
  const openingPoolBases = req.body.openingPoolBases ?? {};
  const taxPools = calculateTaxDepreciation(adj.assets, assetCategories, openingPoolBases);
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
  return res.json({ summary, taxPools, totalDepreciationExpense: totalDepreciation, gainOnDisposals, lossOnDisposals });
}));
router3.post("/:companyId/provisions", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const provisions = req.body.provisions ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? "");
  const totalProvisions = provisions.reduce((s, p) => s + p.additionForYear, 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, provisions, totalProvisions } });
  return res.json({ message: "Provisions saved.", count: provisions.length, total: totalProvisions });
}));
router3.post("/:companyId/inventory", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const items = req.body.items ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? "");
  const totalInventoryImpairment = items.reduce((s, i) => s + i.impairmentAmount, 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, inventoryAdjustments: items, totalInventoryImpairment } });
  return res.json({ message: "Inventory adjustments saved.", totalImpairment: totalInventoryImpairment });
}));
router3.post("/:companyId/investments", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  const items = req.body.items ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? "");
  const totalFV = items.reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, investmentAdjustments: items, totalInvestmentFVAdjustment: totalFV } });
  return res.json({ message: "Investment adjustments saved.", totalFVAdjustment: totalFV });
}));
router3.get("/:companyId", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Company not found." });
  return res.json(session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? ""));
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
var TAX_DEPN_RATES = {
  ppe_buildings: 0.05,
  ppe_furniture: 0.25,
  ppe_vehicles: 0.2,
  ppe_plant_machinery: 0.15,
  ppe_intangibles: 0.15,
  ppe_computers: 0.25,
  ppe_office_equipment: 0.15
};
function buildNotesData(params) {
  const { tb, adj, bs, is: IS, company } = params;
  const rows = tb.rows ?? [];
  const provisions = adj.provisions ?? [];
  const taxRate = (company.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;
  const roundingLevel = company.accountingPolicies?.roundingLevel ?? 1;
  const PPE_CLASSES = [
    { categoryId: "ppe_land", label: "Land" },
    { categoryId: "ppe_buildings", label: "Buildings" },
    { categoryId: "ppe_furniture", label: "Furniture & Office Equipment" },
    { categoryId: "ppe_vehicles", label: "Vehicles" },
    { categoryId: "ppe_plant_machinery", label: "Plant & Machinery" },
    { categoryId: "ppe_computers", label: "Computer & IT Equipment" },
    { categoryId: "ppe_intangibles", label: "Intangibles / Software" },
    { categoryId: "ppe_office_equipment", label: "Other Equipment" },
    { categoryId: "ppe_cwip", label: "Capital Work in Progress" }
  ];
  const depnSummaryMap = new Map(
    (adj.depreciationSummary ?? []).map((d) => [d.categoryId, d])
  );
  const note31_ppe = PPE_CLASSES.map((cls) => {
    const d = depnSummaryMap.get(cls.categoryId);
    const tbGross = sumTB(rows, cls.categoryId, "closingDr");
    const tbOpenGross = sumTB(rows, cls.categoryId, "openingDr");
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
    const assetsSecured = (adj.assets ?? []).filter((a) => a.categoryId === cls.categoryId && a.isMortgaged).reduce((s, a) => s + a.originalCost, 0);
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
      assets: adj.depreciationSummary?.find((ds) => ds.categoryId === cls.categoryId)?.assets ?? []
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
    agingAnalysis: []
    // populated if subledger data provided
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
  const note38_cashEquivalents = {
    cashInHand_cy: cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0),
    cashInHand_py: cashRows.reduce((s, r) => s + (r.openingDr ?? 0), 0),
    bankAccounts: [
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
      cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0) + bankCurrentRows.reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0) + bankSavingsRows.reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0) + fdCurrentRows.reduce((s, r) => s + (r.closingDr ?? 0), 0)
    ),
    totalCash_py: round(
      cashRows.reduce((s, r) => s + (r.openingDr ?? 0), 0) + bankCurrentRows.reduce((s, r) => s + (r.openingDr ?? 0) - (r.openingCr ?? 0), 0) + bankSavingsRows.reduce((s, r) => s + (r.openingDr ?? 0) - (r.openingCr ?? 0), 0) + fdCurrentRows.reduce((s, r) => s + (r.openingDr ?? 0), 0)
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
      }))
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
      }))
    ],
    totalNonCurrent_cy: ltBankRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0) + ltOtherRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    totalCurrent_cy: [stOdRows, stCcRows, stWcRows, stPortionRows, rpPayableRows].flat().reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
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
  const note319_otherIncome = {
    interestIncome: { cy: sumTB(rows, "other_income_interest", "closingCr"), py: 0 },
    commissionIncome: { cy: 0, py: 0 },
    rentalIncome: { cy: sumTB(rows, "other_income_rental", "closingCr"), py: 0 },
    dividendReceived: { cy: sumTB(rows, "other_income_dividend", "closingCr"), py: 0 },
    gainOnDisposalAssets: { cy: sumTB(rows, "other_income_disposal_gain", "closingCr"), py: 0 },
    insuranceClaims: { cy: 0, py: 0 },
    fairValueGainOnInvestments: {
      cy: investmentAdjs.filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0),
      py: 0
    },
    miscellaneousIncome: { cy: sumTB(rows, "other_income_misc", "closingCr"), py: 0 },
    total: {
      cy: round(
        sumTB(rows, "other_income_interest", "closingCr") + sumTB(rows, "other_income_rental", "closingCr") + sumTB(rows, "other_income_dividend", "closingCr") + sumTB(rows, "other_income_disposal_gain", "closingCr") + sumTB(rows, "other_income_misc", "closingCr") + investmentAdjs.filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0)
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
    lineItems: ADMIN_CATEGORIES2.map((ac) => ({
      label: ac.label,
      cy: sumTB(rows, ac.cat, "closingDr"),
      py: 0
    })).filter((li) => li.cy > 0),
    total_cy: round(ADMIN_CATEGORIES2.reduce((s, ac) => s + sumTB(rows, ac.cat, "closingDr"), 0)),
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
    deferredTaxExpense: 0,
    priorYearAdjustment: 0,
    totalTaxExpense: round(taxResult.currentTaxExpense),
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
      additions: pool.additionsFullYear + pool.additionsTwoThirds + pool.additionsOneThird,
      disposals: pool.disposals,
      depreciationBasis: pool.depreciationBasis,
      taxDepreciation: pool.taxDepreciation,
      closingBasis: pool.closingBasis
    })),
    advanceTaxPaid,
    tdsCreditAvailable: tdsCredit,
    netTaxPayable: round(taxResult.taxPayable)
  };
  const rpReceivableRows = rowsByCategory(rows, "related_party_receivable");
  const rpPayRows = rowsByCategory(rows, "related_party_payable");
  const note324_relatedParty = {
    relatedParties: [
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
    noRelatedPartyTransactions: rpPayRows.length === 0 && rpReceivableRows.length === 0
  };
  const note325_contingencies = {
    hasContingencies: false,
    bankGuaranteesIssued: 0,
    lcOpened: 0,
    legalCasesPending: [],
    capitalCommitments: 0,
    operatingLeaseCommitments: 0,
    defaultText: "The Company has no contingent liabilities or commitments as at the reporting date."
  };
  const note326_subsequentEvents = {
    hasSubsequentEvents: false,
    events: [],
    defaultText: "There are no significant events after the reporting date that require adjustment to or disclosure in these financial statements."
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
function sumDr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory) && !r.isGroupRow).reduce((acc, r) => acc + (r.closingDr ?? 0), 0);
}
function sumCr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory) && !r.isGroupRow).reduce((acc, r) => acc + (r.closingCr ?? 0), 0);
}
function sumOpeningDr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory) && !r.isGroupRow).reduce((acc, r) => acc + (r.openingDr ?? 0), 0);
}
function sumOpeningCr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory) && !r.isGroupRow).reduce((acc, r) => acc + (r.openingCr ?? 0), 0);
}
function netBalance(rows, ...categories) {
  return sumDr(rows, ...categories) - sumCr(rows, ...categories);
}
var round2 = (n) => Math.round(n * 100) / 100;
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
  return { cash: round2(cash), overdrafts: round2(overdrafts) };
}
var ADMIN_CATEGORIES = [
  "admin_rent",
  "admin_rates_taxes",
  "admin_insurance",
  "admin_repairs",
  "admin_electricity",
  "admin_communication",
  "admin_printing",
  "admin_legal_professional",
  "admin_audit_fee",
  "admin_traveling",
  "admin_advertisement",
  "admin_other"
];
function inventoryFromAdj(adj, rows) {
  const inv = adj.inventoryDetails;
  const openingPY = inv ? inv.rawMaterialsPY + inv.wipPY + inv.finishedGoodsPY : sumOpeningDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods");
  const closingCY = inv ? inv.rawMaterialsCY + inv.wipCY + inv.finishedGoodsCY : sumDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods");
  return { openingPY, closingCY };
}
function computeIncomeStatement(tb, adj, company, previousYearIS = {}) {
  const rows = tb.rows;
  const revenue = round2(sumCr(rows, "revenue_sales", "revenue_services"));
  const interestIncome = round2(sumCr(rows, "other_income_interest"));
  const otherIncome = round2(
    sumCr(rows, "other_income_dividend", "other_income_rental", "other_income_misc", "other_income_disposal_gain") + adj.gainOnDisposals + adj.investmentAdjustments.filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0)
  );
  const totalIncome = round2(revenue + interestIncome + otherIncome);
  const { openingPY, closingCY } = inventoryFromAdj(adj, rows);
  const materialConsumed = round2(
    openingPY + sumDr(rows, "cogs_purchases", "cogs_opening_stock") - closingCY
  );
  const directExpenses = round2(sumDr(rows, "direct_wages", "direct_expenses_other"));
  const staffBonusProvision = adj.staffBonusProvision ?? round2(sumDr(rows, "emp_expense_bonus"));
  const employeeBenefitExpense = round2(
    sumDr(rows, "emp_expense_salaries", "emp_expense_welfare") + sumDr(rows, "emp_expense_pf", "emp_expense_gratuity", "emp_expense_other") + staffBonusProvision + sumDr(rows, "emp_expense_leave")
  );
  const financeCharges = round2(sumDr(rows, "finance_cost_interest", "finance_cost_bank_charges"));
  const depreciation = round2(adj.totalDepreciationExpense);
  const impairment = round2(
    sumDr(rows, "impairment_expense") + adj.investmentAdjustments.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0) + adj.investmentAdjustments.filter((i) => (i.fairValueGainLoss ?? 0) < 0).reduce((s, i) => s + Math.abs(i.fairValueGainLoss ?? 0), 0)
  );
  const adminAndOtherExpenses = round2(
    ADMIN_CATEGORIES.reduce((s, cat) => s + sumDr(rows, cat), 0)
  );
  const totalExpenses = round2(
    materialConsumed + directExpenses + employeeBenefitExpense + financeCharges + depreciation + impairment + adminAndOtherExpenses
  );
  const profitBeforeStaffBonus = round2(totalIncome - (totalExpenses - staffBonusProvision));
  const staffBonus = round2(staffBonusProvision);
  const profitBeforeTax = round2(profitBeforeStaffBonus - staffBonus);
  const incomeTaxExpense = round2(
    adj.incomeTaxProvision ?? adj.currentTaxExpense ?? sumDr(rows, "income_tax_expense")
  );
  const netProfit = round2(profitBeforeTax - incomeTaxExpense);
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
  const depnInTB = round2(sumCr(rows, "accum_depreciation") - sumOpeningCr(rows, "accum_depreciation"));
  const totalAccumDepn = depnInTB >= adj.totalDepreciationExpense * 0.99 ? accumDepn : accumDepn + adj.totalDepreciationExpense;
  const nca_ppe = round2(Math.max(0, grossPPE - totalAccumDepn));
  const listedFVAdj = adj.investmentAdjustments.filter((i) => i.investmentType === "listed_trading" || i.investmentType === "listed_ats").reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const unlistedImpair = adj.investmentAdjustments.filter((i) => i.investmentType === "unlisted").reduce((s, i) => s + (i.impairmentAmount ?? 0), 0);
  const invImpairmentProvision = sumCr(rows, "provision_impairment_investment");
  const investmentListed = sumDr(rows, "investment_listed_trading") + listedFVAdj;
  const investmentUnlisted = sumDr(rows, "investment_unlisted") - unlistedImpair;
  const investmentFD_NC = sumDr(rows, "investment_fixed_deposit_noncurrent");
  const nca_investments = round2(Math.max(
    0,
    investmentListed + investmentUnlisted + investmentFD_NC - invImpairmentProvision
  ));
  const relatedPartyRecNC = sumDr(rows, "related_party_receivable");
  const nca_receivables = round2(
    sumDr(rows, "nca_deposits", "nca_loans_advances") + relatedPartyRecNC
  );
  const nca_other = round2(
    sumDr(rows, "biological_assets", "other_noncurrent_assets", "nca_other")
  );
  const totalNonCurrentAssets = round2(nca_ppe + nca_investments + nca_receivables + nca_other);
  const ca_investments = 0;
  const { closingCY } = inventoryFromAdj(adj, rows);
  const ca_inventories = round2(Math.max(0, closingCY - adj.totalInventoryImpairment));
  const tradeRec = sumDr(rows, "trade_receivables");
  const impairmentOnRec = sumCr(rows, "provision_impairment_debtors");
  const ca_tradeReceivables = round2(Math.max(
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
  const ca_other = round2(sumDr(rows, "lc_bg_margin", "other_current_assets", "nca_held_for_sale"));
  const totalCurrentAssets = round2(
    ca_investments + ca_inventories + ca_tradeReceivables + ca_cashAndEquivalents + ca_other
  );
  const totalAssets = round2(totalNonCurrentAssets + totalCurrentAssets);
  const shareCapital = round2(sumCr(rows, "share_capital"));
  const sharePremium = round2(sumCr(rows, "share_premium"));
  const reserves = round2(sumCr(rows, "capital_reserve", "revaluation_reserve"));
  const dividendDeclared = adj.dividendPayable ?? sumCr(rows, "dividend_payable") ?? round2((company.dividendDeclaredPercent ?? 0) / 100 * shareCapital);
  const openingRE = round2(
    sumOpeningCr(rows, "retained_earnings", "general_reserve") - sumOpeningDr(rows, "retained_earnings", "general_reserve")
  );
  const eq_retainedEarnings = round2(openingRE + is.netProfit - dividendDeclared);
  const eq_shareCapital = round2(shareCapital + sharePremium);
  const eq_reserves = round2(reserves);
  const totalEquity = round2(eq_shareCapital + eq_reserves + eq_retainedEarnings);
  const ncl_borrowings = round2(
    sumCr(rows, "borrowings_noncurrent_bank", "borrowings_noncurrent_other", "borrowings_noncurrent_related")
  );
  const ncl_employeeBenefits = round2(sumCr(rows, "employee_benefit_noncurrent", "employee_benefit_gratuity"));
  const ncl_provisions = 0;
  const ncl_deferredTax = 0;
  const totalNonCurrentLiabilities = round2(
    ncl_borrowings + ncl_employeeBenefits + ncl_provisions + ncl_deferredTax
  );
  const cl_borrowings = round2(
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
  const cl_tradePayables = round2(
    sumCr(
      rows,
      "trade_payables_creditors",
      "audit_fee_payable",
      "tds_payable",
      "other_payables",
      "trade_payables_advance_customers"
    )
  );
  const incomeTaxPayable = round2(sumCr(rows, "income_tax_payable"));
  const advanceTax = round2(sumDr(rows, "advance_tax_paid", "other_receivables_tds"));
  const cl_incomeTaxPayable = round2(Math.max(
    0,
    incomeTaxPayable - advanceTax - (adj.incomeTaxPaidPY ?? 0) + Math.max(0, (adj.incomeTaxProvision ?? 0) - sumDr(rows, "income_tax_expense"))
  ));
  const cl_provisions = round2(
    sumCr(
      rows,
      "provisions_csr",
      "provisions_current",
      "employee_payables_pf",
      "employee_payables_salary",
      "employee_payables_bonus"
    )
  );
  const cl_other = round2(sumCr(rows, "advance_from_customers", "dividend_payable"));
  const totalCurrentLiabilities = round2(
    cl_borrowings + cl_tradePayables + cl_incomeTaxPayable + cl_provisions + cl_other
  );
  const totalEquityAndLiabilities = round2(totalEquity + totalNonCurrentLiabilities + totalCurrentLiabilities);
  const checkDifference = round2(totalAssets - totalEquityAndLiabilities);
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
  const openingRetained = round2(
    sumOpeningCr(rows, "retained_earnings", "general_reserve") - sumOpeningDr(rows, "retained_earnings", "general_reserve")
  );
  const shareIssued = company.shareIssuedDuringYear ? round2(company.shareIssuedDuringYear * 100) : round2(shareCapital - openingShareCapital);
  const dividendDeclared = adj.dividendPayable ?? sumCr(rows, "dividend_payable") ?? round2((company.dividendDeclaredPercent ?? 0) / 100 * openingShareCapital);
  const closingRetained = round2(openingRetained + is.netProfit - dividendDeclared);
  return {
    cyOpeningShareCapital: round2(openingShareCapital),
    cyOpeningSharePremium: round2(openingSharePremium),
    cyOpeningGeneralReserve: round2(openingOtherReserves),
    cyOpeningRetainedEarnings: round2(openingRetained),
    cyOpeningTotal: round2(openingShareCapital + openingSharePremium + openingOtherReserves + openingRetained),
    cyNetProfit: round2(is.netProfit),
    cyShareCapitalIssued: shareIssued,
    cySharePremiumReceived: round2(sharePremium - openingSharePremium),
    cyTransferToReserve: 0,
    cyDividends: round2(dividendDeclared),
    cyClosingShareCapital: round2(shareCapital),
    cyClosingSharePremium: round2(sharePremium),
    cyClosingGeneralReserve: round2(otherReserves),
    cyClosingRetainedEarnings: closingRetained,
    cyClosingTotal: round2(shareCapital + sharePremium + otherReserves + closingRetained),
    ...previousCIE
  };
}
function computeCashFlow(tb, adj, is, bs, previousCF) {
  const rows = tb.rows;
  const profitBeforeTax = is.profitBeforeTax;
  const addDepreciation = adj.totalDepreciationExpense;
  const addImpairment = is.impairment;
  const lessInterestIncome = -is.interestIncome;
  const lessDividendIncome = -sumCr(rows, "other_income_dividend");
  const addInterestExpense = is.financeCharges;
  const addLossOnDisposal = adj.lossOnDisposals;
  const lessGainOnDisposal = -adj.gainOnDisposals;
  const fvLoss = adj.investmentAdjustments.filter((i) => (i.fairValueGainLoss ?? 0) < 0).reduce((s, i) => s - (i.fairValueGainLoss ?? 0), 0);
  const fvGain = adj.investmentAdjustments.filter((i) => (i.fairValueGainLoss ?? 0) > 0).reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const addFVLossOnInvestment = fvLoss;
  const lessFVGainOnInvestment = -fvGain;
  const prevTradeRec = previousCF?.decreaseIncreaseReceivables !== void 0 ? bs.ca_tradeReceivables + previousCF.decreaseIncreaseReceivables : round2(
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
  const decreaseIncreaseReceivables = round2(prevTradeRec - bs.ca_tradeReceivables);
  const { openingPY, closingCY } = inventoryFromAdj(adj, rows);
  const prevInv = previousCF?.decreaseIncreaseInventory !== void 0 ? bs.ca_inventories + previousCF.decreaseIncreaseInventory : openingPY;
  const decreaseIncreaseInventory = round2(prevInv - bs.ca_inventories);
  const prevOtherCA = sumOpeningDr(rows, "other_current_assets", "nca_held_for_sale");
  const decreaseIncreaseOtherCurrentAssets = round2(prevOtherCA - bs.ca_other);
  const prevPayables = sumOpeningCr(
    rows,
    "trade_payables_creditors",
    "tds_payable",
    "other_payables",
    "audit_fee_payable",
    "trade_payables_advance_customers"
  );
  const increaseDecreasePayables = round2(bs.cl_tradePayables - prevPayables);
  const prevTaxPayable = sumOpeningCr(rows, "income_tax_payable");
  const increaseDecreaseIncomeTaxPayable = round2(bs.cl_incomeTaxPayable - prevTaxPayable);
  const prevEmpLiab = sumOpeningCr(
    rows,
    "employee_payables_pf",
    "employee_payables_bonus",
    "employee_payables_salary",
    "employee_benefit_noncurrent"
  );
  const currentEmpLiab = round2(
    sumCr(rows, "employee_payables_pf", "employee_payables_bonus", "employee_payables_salary") + (adj.staffBonusProvision ?? is.staffBonus)
  );
  const increaseDecreaseEmployeeLiability = round2(currentEmpLiab - prevEmpLiab);
  const prevProvisions = sumOpeningCr(rows, "provisions_csr", "provisions_current");
  const increaseDecreaseProvisions = round2(bs.cl_provisions - prevProvisions - (adj.staffBonusProvision ?? 0));
  const cashGeneratedFromOperations = round2(
    profitBeforeTax + addDepreciation + addImpairment + lessInterestIncome + lessDividendIncome + addInterestExpense + addLossOnDisposal + lessGainOnDisposal + addFVLossOnInvestment + lessFVGainOnInvestment + decreaseIncreaseReceivables + decreaseIncreaseInventory + decreaseIncreaseOtherCurrentAssets + increaseDecreasePayables + increaseDecreaseIncomeTaxPayable + increaseDecreaseEmployeeLiability + increaseDecreaseProvisions
  );
  const interestPaid = -Math.abs(is.financeCharges);
  const incomeTaxPaid = -Math.abs(
    sumDr(rows, "advance_tax_paid") + (adj.incomeTaxPaidPY ?? 0)
  );
  const netCashFromOperating = round2(cashGeneratedFromOperations + interestPaid + incomeTaxPaid);
  const proceedsFromPPEDisposal = adj.depreciationResults.reduce((s, r) => s + (r.disposalProceeds ?? 0), 0);
  const proceedsFromInvestmentDisposal = 0;
  const interestReceived = is.interestIncome;
  const dividendReceived = sumCr(rows, "other_income_dividend");
  const purchaseOfPPE = -adj.assets.reduce((s, a) => s + (a.additionalCost ?? 0), 0);
  const purchaseOfInvestments = -Math.max(
    0,
    netBalance(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent") - (sumOpeningDr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent") - sumOpeningCr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent"))
  );
  const netCashFromInvesting = round2(
    proceedsFromPPEDisposal + proceedsFromInvestmentDisposal + interestReceived + dividendReceived + purchaseOfPPE + purchaseOfInvestments
  );
  const proceedsFromShareIssue = round2(
    sumCr(rows, "share_capital") - sumOpeningCr(rows, "share_capital") + (sumCr(rows, "share_premium") - sumOpeningCr(rows, "share_premium"))
  );
  const ncBorrowChange = sumCr(rows, "borrowings_noncurrent_bank", "borrowings_noncurrent_other") - sumOpeningCr(rows, "borrowings_noncurrent_bank", "borrowings_noncurrent_other");
  const proceedsFromBorrowingsNonCurrent = round2(Math.max(0, ncBorrowChange));
  const repaymentOfBorrowingsNonCurrent = round2(Math.min(0, ncBorrowChange));
  const cBorrowChange = sumCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc") - sumOpeningCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc");
  const proceedsFromBorrowingsCurrent = round2(Math.max(0, cBorrowChange));
  const repaymentOfBorrowingsCurrent = round2(Math.min(0, cBorrowChange));
  const dividendPaid = -round2(adj.incomeTaxPaidPY ? 0 : adj.dividendPayable ?? sumCr(rows, "dividend_payable"));
  const netCashFromFinancing = round2(
    proceedsFromShareIssue + proceedsFromBorrowingsNonCurrent + repaymentOfBorrowingsNonCurrent + proceedsFromBorrowingsCurrent + repaymentOfBorrowingsCurrent + dividendPaid
  );
  const netIncreaseDecrease = round2(netCashFromOperating + netCashFromInvesting + netCashFromFinancing);
  const openingCash = round2(
    sumOpeningDr(rows, "cash_in_hand", "bank_current_account", "bank_fixed_deposit_current") - sumOpeningCr(rows, "bank_current_account")
  );
  const closingCash = bs.ca_cashAndEquivalents;
  const reconciliationDifference = round2(closingCash - (openingCash + netIncreaseDecrease));
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
  const incomeStatement = computeIncomeStatement(tb, adj, company, pyIS);
  const balanceSheet = computeBalanceSheet(tb, adj, incomeStatement, company, pyBS);
  const changesInEquity = computeChangesInEquity(tb, adj, incomeStatement, company);
  const cashFlow = computeCashFlow(tb, adj, incomeStatement, balanceSheet);
  const notes = buildNotesData({ tb, adj, bs: balanceSheet, is: incomeStatement, company });
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

// server/services/excelWriter.ts
import ExcelJS2 from "exceljs";
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
  HEADING: { name: "Arial", size: 12, bold: true, color: { argb: `FF${COLORS.WHITE}` } },
  SUBHEADING: { name: "Arial", size: 10, bold: true, color: { argb: `FF${COLORS.BRAND_BLUE}` } },
  BODY: { name: "Arial", size: 10 },
  AMOUNT: { name: "Arial", size: 10 },
  TOTAL: { name: "Arial", size: 10, bold: true },
  NOTE_REF: { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } },
  TITLE: { name: "Arial", size: 14, bold: true, color: { argb: `FF${COLORS.WHITE}` } }
};
var NUMBER_FORMAT = "#,##0";
var THIN_BORDER = { style: "thin", color: { argb: `FF${COLORS.BORDER_COLOR}` } };
var MEDIUM_BORDER = { style: "medium", color: { argb: `FF${COLORS.BRAND_BLUE}` } };
function applyHeaderFill(cell, colorHex = COLORS.HEADER_BG) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${colorHex}` } };
}
function applyAllBorders(cell) {
  cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
}
function writeSectionHeader(ws, row, text, lastColIndex = 4) {
  const exRow = ws.getRow(row);
  const cell = exRow.getCell(1);
  ws.mergeCells(row, 1, row, lastColIndex);
  cell.value = text;
  cell.font = { ...FONTS.HEADING };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  applyHeaderFill(cell, COLORS.HEADER_BG);
  exRow.height = 18;
}
function writeStatementHeader(ws, companyName, statementTitle, periodLine, curYearLabel, prevYearLabel) {
  ws.mergeCells("A1:F1");
  const r1 = ws.getCell("A1");
  r1.value = companyName.toUpperCase();
  r1.font = FONTS.TITLE;
  r1.alignment = { horizontal: "center", vertical: "middle" };
  applyHeaderFill(r1, COLORS.HEADER_BG);
  ws.getRow(1).height = 26;
  ws.mergeCells("A2:F2");
  const r2 = ws.getCell("A2");
  r2.value = statementTitle;
  r2.font = { name: "Arial", size: 12, bold: true };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;
  ws.mergeCells("A3:F3");
  const r3 = ws.getCell("A3");
  r3.value = periodLine;
  r3.font = { name: "Arial", size: 10, italic: true };
  r3.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 16;
  ws.mergeCells("A4:F4");
  const r4 = ws.getCell("A4");
  r4.value = "All amounts in NPR (Nepalese Rupees)";
  r4.font = { name: "Arial", size: 8, italic: true, color: { argb: "FF64748B" } };
  r4.alignment = { horizontal: "right" };
  ws.getRow(4).height = 14;
  const headerRow = ws.getRow(5);
  headerRow.getCell(1).value = "Particulars";
  headerRow.getCell(2).value = "Note";
  headerRow.getCell(3).value = curYearLabel;
  headerRow.getCell(4).value = prevYearLabel;
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { ...FONTS.SUBHEADING };
    cell.alignment = { horizontal: Number(cell.col) === 1 ? "left" : "center", vertical: "middle" };
    applyHeaderFill(cell, COLORS.SUBHEADER_BG);
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
  const cell2 = exRow.getCell(2);
  if (r.note) {
    cell2.value = r.note;
    cell2.font = FONTS.NOTE_REF;
  }
  const cell3 = exRow.getCell(3);
  cell3.value = r.cy || null;
  cell3.numFmt = NUMBER_FORMAT;
  cell3.alignment = { horizontal: "right" };
  const cell4 = exRow.getCell(4);
  cell4.value = r.py || null;
  cell4.numFmt = NUMBER_FORMAT;
  cell4.alignment = { horizontal: "right" };
  [cell1, cell2, cell3, cell4].forEach(applyAllBorders);
  if (r.isTotal || r.isSubTotal) {
    [cell1, cell2, cell3, cell4].forEach((c) => {
      c.font = FONTS.TOTAL;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${r.isTotal ? COLORS.TOTAL_BG : COLORS.AMOUNT_BG}` } };
      if (r.isTotal) c.border = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER };
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
function writeEnterDetails(ws, company) {
  const fields = [
    ["Company Name", company.companyName ?? ""],
    ["PAN / VAT Number", company.panVatNumber ?? ""],
    ["Registration No.", company.registrationNumber ?? ""],
    ["Company Type", company.companyType ?? ""],
    ["Fiscal Year", company.fiscalYear?.bsFY ?? ""],
    ["Chairperson", company.chairperson ?? ""],
    ["Director", company.director ?? ""],
    ["Accounts Head", company.accountsHead ?? ""],
    ["Auditor Name", company.auditorInfo?.auditorName ?? ""],
    ["Audit Firm", company.auditorInfo?.auditorFirmName ?? ""]
  ];
  fields.forEach(([label, value], i) => {
    const row = ws.getRow(i + 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { name: "Arial", size: 10, bold: true };
    const vc = row.getCell(2);
    vc.value = value;
    vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COLORS.GREEN_INPUT}` } };
    vc.border = THIN_BORDER;
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
  rows.forEach((r) => {
    writeAmountRow(ws, row, r);
    row++;
  });
  const checkCell = ws.getRow(row).getCell(3);
  checkCell.value = { formula: `=C${row - rows.length + rows.findIndex((r) => r.isTotal && r.label.includes("TOTAL ASSETS")) + 6}-C${row - 1}` };
  checkCell.numFmt = NUMBER_FORMAT;
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
  rows.forEach((r) => {
    writeAmountRow(ws, row, r);
    row++;
  });
  writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? "",
    fiscalYear: company.fiscalYear?.bsFY ?? "",
    roundingLevel: 100
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = { oddHeader: `&C${company.companyName ?? ""}`, oddFooter: "&CPage &P of &N" };
}
function writeCashFlowStatement(ws, cf, company) {
  ws.columns = [{ width: 50 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? "";
  const [, endBS] = fy.split("/").map((y) => y.trim());
  let row = writeStatementHeader(ws, company.companyName ?? "", "STATEMENT OF CASH FLOWS (Indirect Method)", `For the Year Ended 31 Ashadh ${endBS ?? ""}`, fy, "");
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
    writeAmountRow(ws, row, r);
    row++;
  });
  writeSignatureLine(ws, row + 1, company);
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 };
}
function writeChangesInEquity(ws, ce, company) {
  ws.columns = [{ width: 36 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? "";
  const [, endBS] = fy.split("/").map((y) => y.trim());
  ws.mergeCells("A1:F1");
  const r1 = ws.getCell("A1");
  r1.value = (company.companyName ?? "").toUpperCase();
  r1.font = FONTS.TITLE;
  r1.alignment = { horizontal: "center" };
  applyHeaderFill(r1, COLORS.HEADER_BG);
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
  ceRows.forEach(([label, sc, sp, gr, re, total], idx) => {
    const r = ws.getRow(6 + idx);
    [label, sc, sp, gr, re, total].forEach((val, ci) => {
      const cell = r.getCell(ci + 1);
      if (ci === 0) {
        cell.value = val;
      } else {
        cell.value = val || null;
        cell.numFmt = NUMBER_FORMAT;
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
}
function writeNote31_PPE(ws, depnSummary) {
  ws.getRow(1).getCell(1).value = "3.1  Property, Plant and Equipment";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const categories = depnSummary.map((d) => d.categoryName);
  const headers = ["Particulars", ...categories, "Total"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    c.alignment = { horizontal: i === 0 ? "left" : "center" };
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
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
      row.getCell(i + 2).numFmt = NUMBER_FORMAT;
      row.getCell(i + 2).alignment = { horizontal: "right" };
      total += v;
    });
    row.getCell(depnSummary.length + 2).value = total || null;
    row.getCell(depnSummary.length + 2).numFmt = NUMBER_FORMAT;
    row.getCell(depnSummary.length + 2).alignment = { horizontal: "right" };
    row.height = 15;
  });
  ws.getRow(r).getCell(1).value = "ACCUMULATED DEPRECIATION";
  ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
  r++;
  const depnRows = [
    ["Balance at Beginning of Year", (d) => d.openingAccumDepn],
    ["Charge for the Year", (d) => d.depnForYear],
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
      row.getCell(i + 2).numFmt = NUMBER_FORMAT;
      row.getCell(i + 2).alignment = { horizontal: "right" };
      total += v;
    });
    row.getCell(depnSummary.length + 2).value = total || null;
    row.getCell(depnSummary.length + 2).numFmt = NUMBER_FORMAT;
    row.getCell(depnSummary.length + 2).alignment = { horizontal: "right" };
    row.height = 15;
  });
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
      c.numFmt = NUMBER_FORMAT;
      c.alignment = { horizontal: "right" };
      c.font = FONTS.TOTAL;
      applyHeaderFill(c, COLORS.TOTAL_BG);
      total += v;
    });
    const tc = row.getCell(depnSummary.length + 2);
    tc.value = total || null;
    tc.numFmt = NUMBER_FORMAT;
    tc.alignment = { horizontal: "right" };
    tc.font = FONTS.TOTAL;
    applyHeaderFill(tc, COLORS.TOTAL_BG);
    row.height = 15;
  });
}
function writeNote37_Inventories(ws, note37) {
  ws.getRow(1).getCell(1).value = "3.7  Inventories";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const headers = ["Particulars", "Current Year", "Previous Year"];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
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
      c.numFmt = NUMBER_FORMAT;
      c.alignment = { horizontal: "right" };
      if (i === rows.length - 1) {
        c.font = FONTS.TOTAL;
        applyHeaderFill(c, COLORS.TOTAL_BG);
      }
      applyAllBorders(c);
    });
  });
}
function writeNote38_Cash(ws, note38) {
  ws.getRow(1).getCell(1).value = "3.8  Cash and Cash Equivalents";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const hRow = ws.getRow(3);
  ["Particulars", "Current Year", "Previous Year"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
  });
  let r = 4;
  const cashRow = ws.getRow(r++);
  cashRow.getCell(1).value = "Cash in Hand";
  cashRow.getCell(2).value = note38.cashInHand_cy || null;
  cashRow.getCell(2).numFmt = NUMBER_FORMAT;
  cashRow.getCell(2).alignment = { horizontal: "right" };
  note38.bankBalances?.forEach((b) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = b.bankName;
    row.getCell(2).value = b.cy || null;
    row.getCell(2).numFmt = NUMBER_FORMAT;
    row.getCell(2).alignment = { horizontal: "right" };
  });
  const totRow = ws.getRow(r);
  totRow.getCell(1).value = "Total Cash and Equivalents";
  totRow.getCell(1).font = FONTS.TOTAL;
  totRow.getCell(2).value = note38.totalCash_cy || null;
  totRow.getCell(2).numFmt = NUMBER_FORMAT;
  totRow.getCell(2).alignment = { horizontal: "right" };
  totRow.getCell(2).font = FONTS.TOTAL;
  applyHeaderFill(totRow.getCell(2), COLORS.TOTAL_BG);
}
function writeNote39_ShareCapital(ws, note39) {
  ws.getRow(1).getCell(1).value = "3.9  Share Capital";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
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
    r.getCell(2).numFmt = NUMBER_FORMAT;
    r.getCell(2).alignment = { horizontal: "right" };
  });
}
function writeNote311_Borrowings(ws, note311) {
  ws.getRow(1).getCell(1).value = "3.11  Loans and Borrowings";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  ws.getRow(2).getCell(1).value = "Non-Current Borrowings";
  ws.getRow(2).getCell(1).font = FONTS.SUBHEADING;
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
        c.numFmt = NUMBER_FORMAT;
        c.alignment = { horizontal: "right" };
      }
    });
  });
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
        c.numFmt = NUMBER_FORMAT;
        c.alignment = { horizontal: "right" };
      }
    });
  });
}
function writeNote323_Tax(ws, note323) {
  ws.getRow(1).getCell(1).value = "3.23  Income Tax";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const items = [
    ["Profit Before Tax (per Income Statement)", note323.profitBeforeTax],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, -v]),
    ["Taxable Income", note323.taxableIncome],
    [`Income Tax at ${(note323.taxRate * 100).toFixed(0)}%`, note323.currentTax],
    ["Less: Advance Tax / TDS Credit", -note323.advanceTaxPaid],
    ["Net Tax Payable", note323.netTaxPayable]
  ];
  items.forEach(([label, val], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = label;
    r.getCell(2).value = val || null;
    r.getCell(2).numFmt = NUMBER_FORMAT;
    r.getCell(2).alignment = { horizontal: "right" };
  });
}
function writeSundryDebtors(ws, tb) {
  ws.getRow(1).getCell(1).value = "Sundry Debtors";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const hRow = ws.getRow(3);
  ["Account Name", "Closing Dr", "Closing Cr", "Net Balance"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
  });
  const debtors = tb.rows.filter((r) => r.nfrsCategory === "trade_receivables");
  debtors.forEach((d, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = d.rawLabel;
    r.getCell(2).value = d.closingDr || null;
    r.getCell(3).value = d.closingCr || null;
    r.getCell(4).value = (d.closingDr ?? 0) - (d.closingCr ?? 0) || null;
    [2, 3, 4].forEach((c) => {
      r.getCell(c).numFmt = NUMBER_FORMAT;
      r.getCell(c).alignment = { horizontal: "right" };
    });
  });
}
function writeSundryCreditors(ws, tb) {
  ws.getRow(1).getCell(1).value = "Sundry Creditors";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const hRow = ws.getRow(3);
  ["Account Name", "Closing Dr", "Closing Cr", "Net Balance"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
  });
  const creditors = tb.rows.filter((r) => r.nfrsCategory === "trade_payables_creditors");
  creditors.forEach((d, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = d.rawLabel;
    r.getCell(2).value = d.closingDr || null;
    r.getCell(3).value = d.closingCr || null;
    r.getCell(4).value = (d.closingCr ?? 0) - (d.closingDr ?? 0) || null;
    [2, 3, 4].forEach((c) => {
      r.getCell(c).numFmt = NUMBER_FORMAT;
      r.getCell(c).alignment = { horizontal: "right" };
    });
  });
}
function writeBankAccounts(ws, note38) {
  ws.getRow(1).getCell(1).value = "Bank Accounts";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
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
    r.getCell(3).numFmt = NUMBER_FORMAT;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).value = b.py || null;
    r.getCell(4).numFmt = NUMBER_FORMAT;
    r.getCell(4).alignment = { horizontal: "right" };
  });
}
function writeTrialBalance(ws, tb) {
  ws.columns = [
    { key: "label", width: 40 },
    { key: "cat", width: 28 },
    { key: "note", width: 8 },
    { key: "opdr", width: 14 },
    { key: "opcr", width: 14 },
    { key: "durdr", width: 14 },
    { key: "durcr", width: 14 },
    { key: "adjdr", width: 14 },
    { key: "adjcr", width: 14 },
    { key: "cldr", width: 14 },
    { key: "clcr", width: 14 },
    { key: "net", width: 16 }
  ];
  const headers = ["Account Name", "NFRS Category", "Note", "Opening Dr", "Opening Cr", "During Dr", "During Cr", "Adj Dr", "Adj Cr", "Closing Dr", "Closing Cr", "Net Balance"];
  const hRow = ws.getRow(1);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
  });
  tb.rows.forEach((row, idx) => {
    const r = ws.getRow(2 + idx);
    const vals = [row.rawLabel, row.nfrsCategory, row.matchedLabel ?? "", row.openingDr, row.openingCr, row.duringDr, row.duringCr, row.adjustmentDr, row.adjustmentCr, row.closingDr, row.closingCr, (row.closingDr ?? 0) - (row.closingCr ?? 0)];
    vals.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v || null;
      if (i >= 3) {
        c.numFmt = NUMBER_FORMAT;
        c.alignment = { horizontal: "right" };
      }
      applyAllBorders(c);
    });
    r.height = 14;
  });
}
function writeAdjustments(ws, adj) {
  ws.getRow(1).getCell(1).value = "Adjustment Journal Entries";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const hRow = ws.getRow(3);
  ["#", "Description", "Dr Account", "Cr Account", "Amount", "Note Ref", "Source"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
  });
  adj.journalEntries.forEach((je, i) => {
    const r = ws.getRow(4 + i);
    [i + 1, je.description, je.debitAccount, je.creditAccount, je.amount, je.linkedNoteRef ?? "", je.isSystemGenerated ? "System" : "Manual"].forEach((v, ci) => {
      const c = r.getCell(ci + 1);
      c.value = v || null;
      if (ci === 4) {
        c.numFmt = NUMBER_FORMAT;
        c.alignment = { horizontal: "right" };
      }
      applyAllBorders(c);
    });
  });
}
function writeTaxCalculation(ws, note323) {
  ws.getRow(1).getCell(1).value = "Income Tax Computation";
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  ws.getRow(2).getCell(1).value = `Tax Rate: ${(note323.taxRate * 100).toFixed(0)}%`;
  const items = [
    ["Profit Before Tax", note323.profitBeforeTax],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, v]),
    ["Taxable Income", note323.taxableIncome],
    ["Income Tax", note323.currentTax],
    ["Advance Tax / TDS Credit", note323.advanceTaxPaid + note323.tdsCreditAvailable],
    ["Net Tax Payable", note323.netTaxPayable]
  ];
  items.forEach(([label, val], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = label;
    r.getCell(2).value = val || null;
    r.getCell(2).numFmt = NUMBER_FORMAT;
    r.getCell(2).alignment = { horizontal: "right" };
  });
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
      netBookValueClosing: d.netBookValueClosing ?? d.nbvClosing ?? Math.max(0, (d.closingCost ?? 0) - (d.closingAccumDepn ?? 0))
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
function writeGenericNoteRecord(ws, title, data) {
  const safeData = data ?? {};
  ws.getRow(1).getCell(1).value = title;
  ws.getRow(1).getCell(1).font = { name: "Arial", size: 11, bold: true };
  const hRow = ws.getRow(3);
  ["Particulars", "Current Year", "Previous Year"].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
  });
  Object.entries(safeData).forEach(([label, vals], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = label;
    r.getCell(2).value = vals.cy || null;
    r.getCell(3).value = vals.py || null;
    [2, 3].forEach((ci) => {
      r.getCell(ci).numFmt = NUMBER_FORMAT;
      r.getCell(ci).alignment = { horizontal: "right" };
    });
  });
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
    writeEnterDetails(addSheet("Enter Details", COLORS.GREEN_INPUT), company);
    writeTrialBalance(addSheet("Trial Balance", COLORS.BRAND_BLUE), trialBalance);
    writeBalanceSheet(addSheet("Balance Sheet", COLORS.BRAND_BLUE), balanceSheet, company);
    writeIncomeStatement(addSheet("Income Statement", COLORS.BRAND_BLUE), incomeStatement, company);
    writeChangesInEquity(addSheet("Change in Equity", COLORS.BRAND_BLUE), changesInEquity, company);
    writeCashFlowStatement(addSheet("Cash Flow", COLORS.BRAND_BLUE), cashFlow, company);
    writeNote1_AccountingPolicies(wb, {
      ...company.accountingPolicies ?? {},
      companyName: company.companyName ?? "",
      fiscalYear: company.fiscalYear?.bsFY ?? ""
    });
    writeNote2_CriticalJudgments(wb, {
      companyName: company.companyName ?? "",
      fiscalYear: company.fiscalYear?.bsFY ?? ""
    });
    writeNote31_PPE(addSheet("Note 3.1 - PPE", "16A34A"), notes.note31_ppe);
    writeGenericNoteRecord(addSheet("Note 3.2 - Investments", "16A34A"), "3.2  Investments", {});
    writeGenericNoteRecord(addSheet("Note 3.3 - Receivables", "16A34A"), "3.3  Trade Receivables", {
      "Net Trade Receivables": {
        cy: notes.note33_tradeReceivables?.netReceivables_cy ?? 0,
        py: notes.note33_tradeReceivables?.netReceivables_py ?? 0
      }
    });
    writeGenericNoteRecord(addSheet("Note 3.4 - Other Recv", "16A34A"), "3.4  Other Receivables", notes.note34_otherReceivables);
    writeGenericNoteRecord(addSheet("Note 3.5 - NC Assets", "16A34A"), "3.5  Other Non-Current Assets", notes.note35_otherNonCurrentAssets);
    writeGenericNoteRecord(addSheet("Note 3.6 - CA Other", "16A34A"), "3.6  Other Current Assets", notes.note36_otherCurrentAssets);
    writeNote37_Inventories(addSheet("Note 3.7 - Inventories", "16A34A"), notes.note37_inventories);
    writeNote38_Cash(addSheet("Note 3.8 - Cash", "16A34A"), notes.note38_cashAndEquivalents);
    writeNote39_ShareCapital(addSheet("Note 3.9 - Share Capital", "16A34A"), notes.note39_shareCapital);
    writeGenericNoteRecord(addSheet("Note 3.10 - Reserves", "16A34A"), "3.10  Reserves", Object.fromEntries(
      Object.entries(notes.note310_reserves ?? {}).map(([k, v]) => {
        const entry = v;
        return [k, { cy: entry.closingCY ?? entry.closing ?? 0, py: entry.py ?? entry.opening ?? 0 }];
      })
    ));
    writeNote311_Borrowings(addSheet("Note 3.11 - Borrowings", "16A34A"), notes.note311_borrowings ?? { nonCurrentBank: [], currentLoans: [] });
    writeGenericNoteRecord(addSheet("Note 3.12 - Emp Benefits", "16A34A"), "3.12  Employee Benefits", Object.fromEntries(
      Object.entries(notes.note312_employeeBenefits ?? {}).map(([k, v]) => {
        const entry = v;
        return [k, { cy: entry.closing ?? 0, py: entry.opening ?? 0 }];
      })
    ));
    writeGenericNoteRecord(addSheet("Note 3.13 - Payables", "16A34A"), "3.13  Trade and Other Payables", notes.note313_tradePayables);
    writeGenericNoteRecord(addSheet("Note 3.14 - Provisions", "16A34A"), "3.14  Provisions", {});
    writeGenericNoteRecord(addSheet("Note 3.17 - Revenue", "16A34A"), "3.17  Revenue", notes.note317_revenue);
    writeGenericNoteRecord(addSheet("Note 3.18 - Materials", "16A34A"), "3.18  Material Consumed", {
      "Opening Stock": { cy: notes.note318_materialConsumed?.openingInventory ?? 0, py: 0 },
      "Purchases": { cy: notes.note318_materialConsumed?.purchases ?? 0, py: 0 },
      "Less: Closing Stock": { cy: -(notes.note318_materialConsumed?.closingInventory ?? 0), py: 0 },
      "Material Consumed": { cy: notes.note318_materialConsumed?.consumed ?? 0, py: 0 }
    });
    writeGenericNoteRecord(addSheet("Note 3.19 - Direct Exp", "16A34A"), "3.19  Direct Expenses", notes.note319_directExpenses);
    writeGenericNoteRecord(addSheet("Note 3.20 - Emp Expense", "16A34A"), "3.20  Employee Benefit Expenses", notes.note320_employeeBenefitExpenses);
    writeGenericNoteRecord(addSheet("Note 3.21 - Impairment", "16A34A"), "3.21  Impairment", Object.fromEntries(
      (notes.note321_impairment ?? []).map((item) => [item.description, { cy: item.cy, py: item.py }])
    ));
    writeGenericNoteRecord(addSheet("Note 3.22 - Admin Exp", "16A34A"), "3.22  Administrative Expenses", notes.note322_adminExpenses);
    writeNote323_Tax(addSheet("Note 3.23 - Tax", "16A34A"), notes.note323_incomeTax ?? {
      profitBeforeTax: 0,
      addDisallowableExpenses: {},
      lessAllowableExpenses: {},
      taxableIncome: 0,
      currentTax: 0,
      taxRate: 0.25,
      advanceTaxPaid: 0,
      tdsCreditAvailable: 0,
      netTaxPayable: 0
    });
    writeAdjustments(addSheet("Adjustments", COLORS.LIGHT_GRAY), adjustments);
    writeTaxCalculation(addSheet("Tax Calculation", COLORS.LIGHT_GRAY), notes.note323_incomeTax);
    writeSundryDebtors(addSheet("Sundry Debtors", "16A34A"), trialBalance);
    writeSundryCreditors(addSheet("Sundry Creditors", "16A34A"), trialBalance);
    writeBankAccounts(addSheet("Bank Accounts", "16A34A"), notes.note38_cashAndEquivalents);
    applyBalanceSheetCrossReferences(wb, "Balance Sheet", {
      ppe: "Note 3.1 - PPE",
      receivables: "Note 3.3 - Receivables",
      otherReceivables: "Note 3.4 - Other Recv",
      cash: "Note 3.8 - Cash",
      shareCapital: "Note 3.9 - Share Capital",
      borrowings: "Note 3.11 - Borrowings",
      tax: "Note 3.23 - Tax"
    }, {
      ppeRow: 8,
      receivablesRow: 16,
      cashRow: 17,
      shareCapitalRow: 22,
      ncBorrowingsRow: 27,
      cBorrowingsRow: 32,
      taxPayableRow: 34,
      totalAssetsRow: 20,
      totalLiabilitiesEquityRow: 38
    });
    applyIncomeStatementCrossReferences(wb, "Income Statement", {
      revenue: "Note 3.17 - Revenue",
      empExpense: "Note 3.20 - Emp Expense",
      adminExpense: "Note 3.22 - Admin Exp",
      ppe: "Note 3.1 - PPE",
      tax: "Note 3.23 - Tax"
    }, {
      revenueRow: 8,
      empExpenseRow: 15,
      adminExpenseRow: 19,
      depreciationRow: 17,
      taxRow: 24
    });
    applyCashFlowReconciliation(wb, "Cash Flow", "Balance Sheet", {
      openingCashRow: 42,
      closingCashRow: 43,
      netOperatingRow: 26,
      netInvestingRow: 32,
      netFinancingRow: 40
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
function applyBalanceSheetCrossReferences(wb, balanceSheetSheetName, noteSheetNames, rowMap, cyCol = "C") {
  const ws = wb.getWorksheet(balanceSheetSheetName);
  if (!ws) {
    console.warn(`[excelWriter] Balance sheet not found: ${balanceSheetSheetName}`);
    return;
  }
  const setFormula = (rowNum, col, formula) => {
    const cell2 = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell2.numFmt;
    cell2.value = { formula: formula.replace(/^=/, ""), result: 0 };
    cell2.numFmt = existingNumFmt || '#,##0.00;(#,##0.00);"-"';
    cell2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE3F2FD" }
      // blue tint = cross-reference cell
    };
  };
  if (noteSheetNames.ppe && SHEET_ROW_REGISTRY.ppeNetBookValueRow) {
    setFormula(
      rowMap.ppeRow,
      cyCol,
      cellRef(noteSheetNames.ppe, "H", SHEET_ROW_REGISTRY.ppeNetBookValueRow)
    );
  }
  if (noteSheetNames.receivables && SHEET_ROW_REGISTRY.receivablesNetRow) {
    setFormula(
      rowMap.receivablesRow,
      cyCol,
      cellRef(noteSheetNames.receivables, "B", SHEET_ROW_REGISTRY.receivablesNetRow)
    );
  }
  if (noteSheetNames.cash && SHEET_ROW_REGISTRY.cashTotalRow) {
    setFormula(
      rowMap.cashRow,
      cyCol,
      cellRef(noteSheetNames.cash, "B", SHEET_ROW_REGISTRY.cashTotalRow)
    );
  }
  if (noteSheetNames.shareCapital && SHEET_ROW_REGISTRY.shareCapitalRow) {
    setFormula(
      rowMap.shareCapitalRow,
      cyCol,
      cellRef(noteSheetNames.shareCapital, "B", SHEET_ROW_REGISTRY.shareCapitalRow)
    );
  }
  if (noteSheetNames.borrowings && SHEET_ROW_REGISTRY.ncBorrowingsRow) {
    setFormula(
      rowMap.ncBorrowingsRow,
      cyCol,
      cellRef(noteSheetNames.borrowings, "D", SHEET_ROW_REGISTRY.ncBorrowingsRow)
    );
  }
  if (noteSheetNames.borrowings && SHEET_ROW_REGISTRY.cBorrowingsRow) {
    setFormula(
      rowMap.cBorrowingsRow,
      cyCol,
      cellRef(noteSheetNames.borrowings, "D", SHEET_ROW_REGISTRY.cBorrowingsRow)
    );
  }
  const cell = ws.getRow(rowMap.totalAssetsRow).getCell(cyCol);
  cell.value = { formula: `SUM(${cyCol}5:${cyCol}${rowMap.totalAssetsRow - 1})`, result: 0 };
  cell.numFmt = '#,##0.00;(#,##0.00);"-"';
  cell.font = { bold: true };
  console.log("[excelWriter] Balance sheet cross-references applied.");
}
function applyIncomeStatementCrossReferences(wb, isSheetName, noteSheetNames, rowMap, cyCol = "C") {
  const ws = wb.getWorksheet(isSheetName);
  if (!ws) return;
  const setFormula = (rowNum, col, formula) => {
    const cell = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ""), result: 0 };
    cell.numFmt = existingNumFmt || '#,##0.00;(#,##0.00);"-"';
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
  };
  if (noteSheetNames.revenue && SHEET_ROW_REGISTRY.revenueTotalRow) {
    setFormula(
      rowMap.revenueRow,
      cyCol,
      cellRef(noteSheetNames.revenue, "B", SHEET_ROW_REGISTRY.revenueTotalRow)
    );
  }
  if (noteSheetNames.empExpense && SHEET_ROW_REGISTRY.empExpenseTotalRow) {
    setFormula(
      rowMap.empExpenseRow,
      cyCol,
      cellRef(noteSheetNames.empExpense, "B", SHEET_ROW_REGISTRY.empExpenseTotalRow)
    );
  }
  if (noteSheetNames.adminExpense && SHEET_ROW_REGISTRY.adminExpenseTotalRow) {
    setFormula(
      rowMap.adminExpenseRow,
      cyCol,
      cellRef(noteSheetNames.adminExpense, "B", SHEET_ROW_REGISTRY.adminExpenseTotalRow)
    );
  }
  if (noteSheetNames.ppe && SHEET_ROW_REGISTRY.ppeDepreciationRow) {
    setFormula(
      rowMap.depreciationRow,
      cyCol,
      cellRef(noteSheetNames.ppe, "E", SHEET_ROW_REGISTRY.ppeDepreciationRow)
    );
  }
  console.log("[excelWriter] Income statement cross-references applied.");
}
function applyCashFlowReconciliation(wb, cfSheetName, bsSheetName, rowMap, cyCol = "C") {
  const ws = wb.getWorksheet(cfSheetName);
  if (!ws) return;
  const closingFormula = `${cyCol}${rowMap.openingCashRow}+${cyCol}${rowMap.netOperatingRow}+${cyCol}${rowMap.netInvestingRow}+${cyCol}${rowMap.netFinancingRow}`;
  const cell = ws.getRow(rowMap.closingCashRow).getCell(cyCol);
  cell.value = { formula: closingFormula, result: 0 };
  cell.numFmt = '#,##0.00;(#,##0.00);"-"';
  cell.font = { bold: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
  console.log("[excelWriter] Cash flow reconciliation formula applied.");
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
    `These financial statements of \${params.companyName} have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Institute of Chartered Accountants of Nepal (ICAN).`,
    false,
    false,
    1
  );
  addRow("");
  addRow("2. BASIS OF PREPARATION", true);
  addRow(
    `These financial statements are prepared on the historical cost basis except for certain financial instruments measured at fair values as described in the accounting policies. The financial statements are presented in Nepalese Rupees (NPR) rounded to the nearest NPR \${params.roundingLevel.toLocaleString('en-IN')}.`,
    false,
    false,
    1
  );
  addRow("");
  addRow("3. AUTHORIZATION FOR ISSUE", true);
  addRow(
    `These financial statements for the fiscal year \${params.fiscalYear} were authorized for issue by the Board of Directors of \${params.companyName} on \${params.authorizationDate ?? '[Board Meeting Date]'}.`,
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

// server/routes/output.ts
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
  const fiscalYear = (session.company.fiscalYear ?? "").replace(/\//g, "-");
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
app.use("/api/trial-balance/ai-match", aiLimiter);
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
server.listen(PORT, () => {
  console.log("\n" + "\u2550".repeat(50));
  console.log(`  \u{1F1F3}\u{1F1F5} NFRS Financial Reporter`);
  console.log("\u2550".repeat(50));
  console.log(`  \u{1F310} Mode:       ${isDev ? "Development" : "Production"}`);
  console.log(`  \u{1F50C} API:        http://localhost:${PORT}/api`);
  console.log(`  \u2764\uFE0F  Health:     http://localhost:${PORT}/api/health`);
  if (!isDev) {
    console.log(`  \u{1F4C1} Frontend:   http://localhost:${PORT}`);
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
