// server/server.ts
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
var SessionStore = class {
  store = /* @__PURE__ */ new Map();
  get(id) {
    const session = this.store.get(id);
    if (session) session.lastAccessAt = /* @__PURE__ */ new Date();
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
  delete(id) {
    return this.store.delete(id);
  }
  has(id) {
    return this.store.has(id);
  }
  /** Removes sessions older than maxAgeHours. Returns count removed. */
  cleanup(maxAgeHours) {
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
var FISCAL_YEARS = [
  {
    bsYear: "2072/73",
    startDateBS: "1 Shrawan 2072",
    endDateBS: "31 Ashadh 2073",
    startDateAD: "July 17, 2015",
    endDateAD: "July 15, 2016",
    startYear: 2015,
    endYear: 2016,
    isLeapYear: false
  },
  {
    bsYear: "2073/74",
    startDateBS: "1 Shrawan 2073",
    endDateBS: "32 Ashadh 2074",
    startDateAD: "July 16, 2016",
    endDateAD: "July 16, 2017",
    startYear: 2016,
    endYear: 2017,
    isLeapYear: true
  },
  {
    bsYear: "2074/75",
    startDateBS: "1 Shrawan 2074",
    endDateBS: "31 Ashadh 2075",
    startDateAD: "July 17, 2017",
    endDateAD: "July 15, 2018",
    startYear: 2017,
    endYear: 2018,
    isLeapYear: false
  },
  {
    bsYear: "2075/76",
    startDateBS: "1 Shrawan 2075",
    endDateBS: "31 Ashadh 2076",
    startDateAD: "July 16, 2018",
    endDateAD: "July 15, 2019",
    startYear: 2018,
    endYear: 2019,
    isLeapYear: false
  },
  {
    bsYear: "2076/77",
    startDateBS: "1 Shrawan 2076",
    endDateBS: "32 Ashadh 2077",
    startDateAD: "July 16, 2019",
    endDateAD: "July 15, 2020",
    startYear: 2019,
    endYear: 2020,
    isLeapYear: true
  },
  {
    bsYear: "2077/78",
    startDateBS: "1 Shrawan 2077",
    endDateBS: "31 Ashadh 2078",
    startDateAD: "July 16, 2020",
    endDateAD: "July 15, 2021",
    startYear: 2020,
    endYear: 2021,
    isLeapYear: false
  },
  {
    bsYear: "2078/79",
    startDateBS: "1 Shrawan 2078",
    endDateBS: "31 Ashadh 2079",
    startDateAD: "July 16, 2021",
    endDateAD: "July 15, 2022",
    startYear: 2021,
    endYear: 2022,
    isLeapYear: false
  },
  {
    bsYear: "2079/80",
    startDateBS: "1 Shrawan 2079",
    endDateBS: "31 Ashadh 2080",
    startDateAD: "July 17, 2022",
    endDateAD: "July 15, 2023",
    startYear: 2022,
    endYear: 2023,
    isLeapYear: false
  },
  {
    bsYear: "2080/81",
    startDateBS: "1 Shrawan 2080",
    endDateBS: "31 Ashadh 2081",
    startDateAD: "July 16, 2023",
    endDateAD: "July 15, 2024",
    startYear: 2023,
    endYear: 2024,
    isLeapYear: false
  },
  {
    bsYear: "2081/82",
    startDateBS: "1 Shrawan 2081",
    endDateBS: "31 Ashadh 2082",
    startDateAD: "July 16, 2024",
    endDateAD: "July 15, 2025",
    startYear: 2024,
    endYear: 2025,
    isLeapYear: false
  },
  {
    bsYear: "2082/83",
    startDateBS: "1 Shrawan 2082",
    endDateBS: "32 Ashadh 2083",
    startDateAD: "July 16, 2025",
    endDateAD: "July 16, 2026",
    startYear: 2025,
    endYear: 2026,
    isLeapYear: true
  },
  {
    bsYear: "2083/84",
    startDateBS: "1 Shrawan 2083",
    endDateBS: "31 Ashadh 2084",
    startDateAD: "July 17, 2026",
    endDateAD: "July 15, 2027",
    startYear: 2026,
    endYear: 2027,
    isLeapYear: false
  },
  {
    bsYear: "2084/85",
    startDateBS: "1 Shrawan 2084",
    endDateBS: "31 Ashadh 2085",
    startDateAD: "July 16, 2027",
    endDateAD: "July 15, 2028",
    startYear: 2027,
    endYear: 2028,
    isLeapYear: false
  },
  {
    bsYear: "2085/86",
    startDateBS: "1 Shrawan 2085",
    endDateBS: "32 Ashadh 2086",
    startDateAD: "July 15, 2028",
    endDateAD: "July 15, 2029",
    startYear: 2028,
    endYear: 2029,
    isLeapYear: true
  },
  {
    bsYear: "2086/87",
    startDateBS: "1 Shrawan 2086",
    endDateBS: "31 Ashadh 2087",
    startDateAD: "July 16, 2029",
    endDateAD: "July 15, 2030",
    startYear: 2029,
    endYear: 2030,
    isLeapYear: false
  },
  {
    bsYear: "2087/88",
    startDateBS: "1 Shrawan 2087",
    endDateBS: "31 Ashadh 2088",
    startDateAD: "July 16, 2030",
    endDateAD: "July 15, 2031",
    startYear: 2030,
    endYear: 2031,
    isLeapYear: false
  },
  {
    bsYear: "2088/89",
    startDateBS: "1 Shrawan 2088",
    endDateBS: "32 Ashadh 2089",
    startDateAD: "July 17, 2031",
    endDateAD: "July 16, 2032",
    startYear: 2031,
    endYear: 2032,
    isLeapYear: true
  },
  {
    bsYear: "2089/90",
    startDateBS: "1 Shrawan 2089",
    endDateBS: "31 Ashadh 2090",
    startDateAD: "July 16, 2032",
    endDateAD: "July 15, 2033",
    startYear: 2032,
    endYear: 2033,
    isLeapYear: false
  },
  {
    bsYear: "2090/91",
    startDateBS: "1 Shrawan 2090",
    endDateBS: "31 Ashadh 2091",
    startDateAD: "July 16, 2033",
    endDateAD: "July 15, 2034",
    startYear: 2033,
    endYear: 2034,
    isLeapYear: false
  }
];
function getFiscalYearOptions() {
  return FISCAL_YEARS.map((fy) => ({
    value: fy.bsYear,
    label: `${fy.bsYear}  (${fy.startDateAD} \u2013 ${fy.endDateAD})`
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
function detectRowLevel(label, amounts) {
  const rawIndentSpaces = countLeadingSpaces(label);
  const hasAnyAmount = amounts.some((a) => a !== 0);
  let rowLevel;
  let isGroupRow;
  if (!hasAnyAmount) {
    if (rawIndentSpaces === 0) {
      rowLevel = 0;
    } else if (rawIndentSpaces <= 4) {
      rowLevel = 1;
    } else {
      rowLevel = 1;
    }
    isGroupRow = true;
  } else {
    if (rawIndentSpaces >= 8) {
      rowLevel = 2;
    } else if (rawIndentSpaces >= 4) {
      rowLevel = 2;
    } else {
      rowLevel = 2;
    }
    isGroupRow = false;
  }
  return { rowLevel, isGroupRow, rawIndentSpaces };
}
var MAX_HEADER_SCAN = 15;
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
  const rawLabel = String(matRow[colMap["label"] ?? 0] ?? "").trim();
  const trimmedLabel = rawLabel.trim();
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
      closingDr = g("closingDr");
      closingCr = g("closingCr");
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
  const amounts = [openingDr, openingCr, duringDr, duringCr, closingDr, closingCr];
  const { rowLevel, isGroupRow, rawIndentSpaces } = detectRowLevel(rawLabel, amounts);
  return {
    rowIndex,
    rawLabel: trimmedLabel,
    // store trimmed label for matching
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
function parseCSV(text) {
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
async function parseTrialBalance(buffer, filename) {
  if (!buffer || buffer.length === 0) {
    throw Object.assign(
      new Error("The uploaded file is empty. Please upload a valid Excel or CSV file."),
      { status: 400, code: "EMPTY_FILE" }
    );
  }
  const warnings = [];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  let matrix = [];
  if (ext === ".csv") {
    const text = buffer.toString("utf-8");
    matrix = parseCSV(text);
  } else {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch (e) {
      throw new Error(
        "Could not read the uploaded file as an Excel workbook. If the file is in .xls (old format), please re-save it as .xlsx in Excel first."
      );
    }
    const ws = workbook.worksheets[0];
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
  const headerDetection = detectColumns(matrix);
  const { format, colMap, headerRowIndex } = detectFormat(matrix, headerDetection);
  let mode = format;
  if (mode === "3col") {
    warnings.push(
      "Could not detect a standard TB header row. Treating file as a 3-column (label, debit balance, credit balance) layout. Please verify the imported data carefully."
    );
  } else if (mode === "2col") {
    warnings.push(
      "Could not detect a standard TB header row. Treating file as a 2-column (label, net amount) layout where positive = Dr, negative = Cr. Please verify the imported data carefully."
    );
  } else if (mode === "tally_prime") {
  }
  if (mode === "full" && colMap["label"] === void 0) {
    throw Object.assign(
      new Error(
        "Could not detect column headers. Please ensure your file has clear column headers for account name and amounts."
      ),
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
    if (row.rawLabel === "") continue;
    if (mode === "full" && colMap["closingDr"] !== void 0 && colMap["openingDr"] !== void 0) {
      const derivedDr = row.openingDr + row.duringDr + row.adjustmentDr;
      const derivedCr = row.openingCr + row.duringCr + row.adjustmentCr;
      if (!row.isGroupRow && (Math.abs(derivedDr - row.closingDr) > 1.5 || Math.abs(derivedCr - row.closingCr) > 1.5)) {
        warnings.push(
          `"${label}" (row ${r + 1}): opening + during + adjustment does not reconcile to closing (Dr: ${derivedDr.toFixed(0)} vs ${row.closingDr.toFixed(0)}, Cr: ${derivedCr.toFixed(0)} vs ${row.closingCr.toFixed(0)}).`
        );
      }
    }
    rows.push(row);
  }
  if (skippedSubtotals.length > 0) {
    warnings.push(
      `${skippedSubtotals.length} subtotal row(s) were automatically skipped to avoid double-counting: "${skippedSubtotals.slice(0, 3).join('", "')}". ` + (skippedSubtotals.length > 3 ? `\u2026and ${skippedSubtotals.length - 3} more.` : "")
    );
  }
  if (rows.filter((r) => !r.isGroupRow).length === 0) {
    throw Object.assign(
      new Error(
        "No data rows found in the uploaded file. Please check your export and ensure it contains account entries."
      ),
      { status: 400, code: "NO_DATA_ROWS" }
    );
  }
  const rowsWithParents = assignParentGroups(rows);
  const leafRows = rowsWithParents.filter((r) => !r.isGroupRow);
  if (leafRows.length > 2e3) {
    warnings.push(
      `File contains ${leafRows.length} ledger rows which exceeds the recommended limit of 2000. Processing may be slow. Consider filtering inactive accounts before uploading.`
    );
  }
  let totalOpeningDr = 0, totalOpeningCr = 0;
  let totalDuringDr = 0, totalDuringCr = 0;
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
  const round2 = (n) => Math.round(n * 100) / 100;
  totalClosingDr = round2(totalClosingDr);
  totalClosingCr = round2(totalClosingCr);
  const difference = round2(totalClosingDr - totalClosingCr);
  const isBalanced = Math.abs(difference) < 1;
  if (!isBalanced) {
    warnings.push(
      `Trial Balance is not balanced. Total Debit Closing: ${totalClosingDr.toLocaleString("en-IN")} vs Total Credit Closing: ${totalClosingCr.toLocaleString("en-IN")}. Difference: ${Math.abs(difference).toLocaleString("en-IN")}. Please verify your exported trial balance from the accounting software before uploading.`
    );
  }
  const allOpeningZero = totalOpeningDr === 0 && totalOpeningCr === 0 && (mode === "full" || mode === "tally_prime");
  if (allOpeningZero) {
    warnings.push(
      `All opening balances are zero. If this is not the first year of accounting, please ensure your export includes opening balances.`
    );
  }
  return {
    rows: rowsWithParents,
    totalOpeningDr: round2(totalOpeningDr),
    totalOpeningCr: round2(totalOpeningCr),
    totalDuringDr: round2(totalDuringDr),
    totalDuringCr: round2(totalDuringCr),
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

// src/data/chartOfAccounts.ts
var CHART_OF_ACCOUNTS = [
  // ══════════════════════════════════════════════════════════════════════════
  // EQUITY
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Paid-up Capital",
    nfrsCategory: "share_capital",
    noteRef: "3.9",
    normalBalance: "credit",
    synonyms: [
      "share capital",
      "paid up capital",
      "capital",
      "equity share capital",
      "issued capital",
      "subscribed capital",
      "issued share capital",
      "authorized capital paid up",
      "ordinary share capital",
      "common stock"
    ]
  },
  {
    label: "Share Premium",
    nfrsCategory: "share_premium",
    noteRef: "3.10",
    normalBalance: "credit",
    synonyms: [
      "securities premium",
      "premium on shares",
      "capital premium",
      "share issue premium",
      "additional paid-in capital"
    ]
  },
  {
    label: "General Reserve",
    nfrsCategory: "general_reserve",
    noteRef: "3.10",
    normalBalance: "credit",
    synonyms: [
      "reserves",
      "reserve fund",
      "general fund",
      "free reserve",
      "revenue reserve",
      "statutory reserve",
      "capital redemption reserve"
    ]
  },
  {
    label: "Retained Earnings",
    nfrsCategory: "retained_earnings",
    noteRef: "3.10",
    normalBalance: "credit",
    synonyms: [
      "retained profit",
      "accumulated profit",
      "profit and loss account",
      "surplus",
      "accumulated surplus",
      "p&l balance",
      "unappropriated profit",
      "profit brought forward",
      "balance of profit and loss",
      "undistributed profit"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // NON-CURRENT BORROWINGS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Term Loan - Bank",
    nfrsCategory: "borrowings_noncurrent_bank",
    noteRef: "3.11",
    normalBalance: "credit",
    bucket: "bank_term_loans",
    synonyms: [
      "bank loan",
      "term loan",
      "secured loan",
      "long term loan",
      "loan from bank",
      "nabil bank loan",
      "sbi loan",
      "nic asia loan",
      "himalayan bank loan",
      "sanima bank loan",
      "global ime loan",
      "kumari bank loan",
      "everest bank loan",
      "nepal investment bank loan",
      "standard chartered loan",
      "citizens bank loan",
      "bank of kathmandu loan",
      "agriculture development bank loan",
      "rastriya banijya bank loan",
      "nepal bank loan",
      "prabhu bank loan",
      "sunrise bank loan",
      "lumbini bank loan",
      "janata bank loan",
      "mahalaxmi bank loan",
      "sindhu bank loan",
      "green development bank loan",
      "muktinath development bank loan",
      "excel development bank loan",
      "garima development bank loan",
      "machhapuchchhre bank loan",
      "century commercial bank loan",
      "prime commercial bank loan",
      "megha bank loan",
      "civil bank loan",
      "siddhartha bank loan"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // TRADE PAYABLES
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Sundry Creditors",
    nfrsCategory: "trade_payables_creditors",
    noteRef: "3.13",
    normalBalance: "credit",
    bucket: "sundry_creditors",
    synonyms: [
      "creditors",
      "accounts payable",
      "trade creditors",
      "sundry creditors control",
      "payable to suppliers",
      "supplier payable",
      "trade payable",
      "creditor control",
      "purchase creditors",
      "vendor payable",
      "creditors for goods",
      "payable to vendors"
    ]
  },
  {
    label: "Advance from Customer",
    nfrsCategory: "trade_payables_advance_customers",
    noteRef: "3.16",
    normalBalance: "credit",
    synonyms: [
      "customer advance",
      "advance received",
      "advance from customers",
      "customer deposit",
      "receipt in advance",
      "deferred income - advance",
      "advance against orders",
      "booking advance",
      "earnest money received"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // CURRENT BORROWINGS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Bank Overdraft",
    nfrsCategory: "borrowings_current_od",
    noteRef: "3.11",
    normalBalance: "credit",
    synonyms: [
      "od",
      "overdraft",
      "bank od",
      "current account overdraft",
      "od account",
      "overdraft facility"
    ]
  },
  {
    label: "Cash Credit",
    nfrsCategory: "borrowings_current_cc",
    noteRef: "3.11",
    normalBalance: "credit",
    synonyms: [
      "cc",
      "cash credit account",
      "cc loan",
      "working capital cc",
      "cc facility"
    ]
  },
  {
    label: "Working Capital Loan",
    nfrsCategory: "borrowings_current_wc",
    noteRef: "3.11",
    normalBalance: "credit",
    synonyms: [
      "wc loan",
      "working capital",
      "short term loan",
      "demand loan",
      "current portion bank",
      "revolving credit",
      "short-term bank loan"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE & STATUTORY PAYABLES
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "TDS Payable",
    nfrsCategory: "tds_payable",
    noteRef: "3.13",
    normalBalance: "credit",
    synonyms: [
      "tds payable",
      "withholding tax payable",
      "tax deducted at source",
      "tds on salary",
      "tds on rent",
      "tds on service fee",
      "tds on audit fee",
      "tds - audit fee",
      "tds - ltd. company",
      "tds- propritership",
      "tds - pvt. ltd",
      "tds- salary",
      "tds - sst",
      "tds - rental",
      "tds - dividend",
      "tds on interest",
      "tds payable-contractor"
    ]
  },
  {
    label: "VAT Payable",
    nfrsCategory: "other_payables",
    noteRef: "3.13",
    normalBalance: "credit",
    synonyms: [
      "vat payable",
      "value added tax payable",
      "vat liability",
      "output vat"
    ]
  },
  {
    label: "Provident Fund Payable",
    nfrsCategory: "employee_payables_pf",
    noteRef: "3.12",
    normalBalance: "credit",
    synonyms: [
      "pf payable",
      "provident fund payable",
      "ssf payable",
      "cit payable",
      "social security fund",
      "employees provident fund",
      "employer pf payable",
      "ssf contribution payable"
    ]
  },
  {
    label: "Staff Bonus Payable",
    nfrsCategory: "employee_payables_bonus",
    noteRef: "3.12",
    normalBalance: "credit",
    synonyms: [
      "bonus payable",
      "employee bonus",
      "profit sharing bonus",
      "staff bonus",
      "performance bonus payable"
    ]
  },
  {
    label: "Audit Fee Payable",
    nfrsCategory: "audit_fee_payable",
    noteRef: "3.13",
    normalBalance: "credit",
    synonyms: [
      "audit fees payable",
      "provision for audit fee",
      "auditor fees",
      "statutory audit fee payable",
      "external auditor payable"
    ]
  },
  {
    label: "Salary Payable",
    nfrsCategory: "employee_payables_salary",
    noteRef: "3.12",
    normalBalance: "credit",
    synonyms: [
      "salary payable",
      "wages payable",
      "outstanding salary",
      "accrued salary",
      "payroll payable",
      "salary outstanding",
      "employee a",
      "employee b",
      "employee c",
      "staff salary payable"
    ]
  },
  {
    label: "Income Tax Payable",
    nfrsCategory: "income_tax_payable",
    noteRef: "3.14",
    normalBalance: "credit",
    synonyms: [
      "income tax payable",
      "corporate tax payable",
      "advance tax recoverable",
      "provision for income tax",
      "income tax provision",
      "current tax liability"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // PPE ASSETS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Land",
    nfrsCategory: "ppe_land",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "land",
      "plot",
      "land and site",
      "land at cost",
      "agricultural land",
      "commercial land",
      "property",
      "land - freehold"
    ]
  },
  {
    label: "Buildings",
    nfrsCategory: "ppe_buildings",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "building",
      "office building",
      "factory building",
      "godown",
      "warehouse",
      "shop",
      "structure",
      "premises",
      "factory",
      "plant building",
      "commercial building",
      "residential building",
      "leasehold improvement",
      "leasehold"
    ]
  },
  {
    label: "Vehicles",
    nfrsCategory: "ppe_vehicles",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "vehicle",
      "motor vehicle",
      "car",
      "motorcycle",
      "truck",
      "van",
      "jeep",
      "bus",
      "tempo",
      "auto",
      "two wheeler",
      "four wheeler",
      "transport",
      "ambulance",
      "tractor"
    ]
  },
  {
    label: "Office Equipment",
    nfrsCategory: "ppe_office_equipment",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "office equipment",
      "equipment",
      "printer",
      "photocopier",
      "fax",
      "air conditioner",
      "ac",
      "generator",
      "ups",
      "telephone set",
      "projector",
      "scanner",
      "inverter",
      "cctv camera"
    ]
  },
  {
    label: "Computers",
    nfrsCategory: "ppe_computers",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "computer",
      "laptop",
      "desktop",
      "server",
      "tablet",
      "it equipment",
      "hardware",
      "computing equipment",
      "network equipment",
      "router",
      "switch"
    ]
  },
  {
    label: "Furniture & Fixtures",
    nfrsCategory: "ppe_furniture",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "furniture",
      "fixture",
      "fitting",
      "sofa",
      "chair",
      "table",
      "desk",
      "shelf",
      "rack",
      "almirah",
      "cupboard",
      "furniture & office equipment",
      "office furniture",
      "partition"
    ]
  },
  {
    label: "Plant & Machinery",
    nfrsCategory: "ppe_plant_machinery",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "plant",
      "machinery",
      "machine",
      "equipment heavy",
      "manufacturing equipment",
      "production machinery",
      "plant equipment",
      "plant and machinery",
      "industrial equipment",
      "generator set",
      "boiler",
      "compressor"
    ]
  },
  {
    label: "Intangible Assets",
    nfrsCategory: "ppe_intangibles",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "software",
      "intangible",
      "patent",
      "trademark",
      "goodwill",
      "licence",
      "license",
      "tally software",
      "erp software",
      "accounting software",
      "computer software",
      "crm software",
      "domain name"
    ]
  },
  {
    label: "Capital Work in Progress",
    nfrsCategory: "ppe_cwip",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "cwip",
      "capital wip",
      "construction in progress",
      "building under construction",
      "work in progress fixed assets",
      "capital expenditure in progress",
      "plant under installation"
    ]
  },
  {
    label: "Accumulated Depreciation",
    nfrsCategory: "accum_depreciation",
    noteRef: "3.1",
    normalBalance: "credit",
    synonyms: [
      "accumulated depreciation",
      "accumulated dep",
      "provision for depreciation",
      "depreciation reserve",
      "depreciation fund",
      "less depreciation",
      "acc. depreciation",
      "total depreciation"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // INVESTMENTS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Investment in Listed Shares",
    nfrsCategory: "investment_listed_trading",
    noteRef: "3.2",
    normalBalance: "debit",
    synonyms: [
      "listed shares",
      "shares",
      "equity shares",
      "mutual fund",
      "stock investment",
      "nepse shares",
      "stock market investment",
      "shares of xyz ltd. (listed company)",
      "investment in listed shares",
      "listed equity",
      "trading securities"
    ]
  },
  {
    label: "Investment in Unlisted Shares",
    nfrsCategory: "investment_unlisted",
    noteRef: "3.2",
    normalBalance: "debit",
    synonyms: [
      "unlisted shares",
      "private company shares",
      "unlisted equity",
      "investment in pvt company",
      "shares of pqr ltd. (unlisted company)",
      "investment in unlisted company",
      "strategic investment"
    ]
  },
  {
    label: "Fixed Deposit (Long-term)",
    nfrsCategory: "investment_fixed_deposit_noncurrent",
    noteRef: "3.2",
    normalBalance: "debit",
    synonyms: [
      "fixed deposit",
      "fd",
      "term deposit long term",
      "recurring deposit",
      "fd more than 1 year",
      "long term fd",
      "term deposit noncurrent"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // OTHER NON-CURRENT ASSETS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Deposits (Non-Current)",
    nfrsCategory: "nca_deposits",
    noteRef: "3.4",
    normalBalance: "debit",
    synonyms: [
      "security deposit",
      "electricity deposit",
      "telephone deposit",
      "rent deposit",
      "leasehold deposit",
      "security deposit landlord",
      "deposit given",
      "advance to landlord long term",
      "deposits"
    ]
  },
  {
    label: "Loans & Advances (Non-Current)",
    nfrsCategory: "nca_loans_advances",
    noteRef: "3.4",
    normalBalance: "debit",
    synonyms: [
      "loan given",
      "advance given",
      "long term advance",
      "loan to subsidiary",
      "advance to directors long term",
      "loan to related party",
      "inter-company loan"
    ]
  },
  {
    label: "Biological Assets",
    nfrsCategory: "nca_other",
    noteRef: "3.5",
    normalBalance: "debit",
    synonyms: [
      "biological assets",
      "livestock",
      "animals",
      "crops",
      "aquaculture",
      "timber",
      "orchards"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // TRADE RECEIVABLES
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Sundry Debtors",
    nfrsCategory: "trade_receivables",
    noteRef: "3.3",
    normalBalance: "debit",
    bucket: "sundry_debtors",
    synonyms: [
      "debtors",
      "accounts receivable",
      "trade debtors",
      "debtor control",
      "trade receivable",
      "receivable from customers",
      "customer receivable",
      "book debts",
      "debtor a",
      "debtor b",
      "debtor c",
      "debtor d",
      "bills receivable"
    ]
  },
  {
    label: "Provision for Impairment on Debtors",
    nfrsCategory: "provision_impairment_debtors",
    noteRef: "3.3",
    normalBalance: "credit",
    synonyms: [
      "provision for bad debts",
      "provision for doubtful debts",
      "bad debt provision",
      "allowance for doubtful accounts",
      "provision impairment",
      "credit loss provision",
      "provision for impairment on debtors"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // OTHER CURRENT ASSETS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Advance to Suppliers",
    nfrsCategory: "other_receivables_advance_supplier",
    noteRef: "3.4",
    normalBalance: "debit",
    synonyms: [
      "advance to supplier",
      "purchase advance",
      "supplier advance",
      "advance payment",
      "advance to vendors",
      "prepaid to supplier",
      "advance for goods",
      "advance to contractor"
    ]
  },
  {
    label: "Prepayments",
    nfrsCategory: "other_receivables_prepayments",
    noteRef: "3.4",
    normalBalance: "debit",
    synonyms: [
      "prepaid expense",
      "prepaid",
      "advance rent",
      "prepaid insurance",
      "advance to landlord",
      "prepaid expenses",
      "payments in advance",
      "prepaid subscriptions",
      "prepaid maintenance"
    ]
  },
  {
    label: "Staff Advance",
    nfrsCategory: "other_receivables_staff_advance",
    noteRef: "3.4",
    normalBalance: "debit",
    synonyms: [
      "staff advance",
      "employee advance",
      "advance to staff",
      "salary advance",
      "loan to employees",
      "advance to employees",
      "personal advance"
    ]
  },
  {
    label: "TDS Receivable",
    nfrsCategory: "other_receivables_tds",
    noteRef: "3.6",
    normalBalance: "debit",
    synonyms: [
      "tds receivable",
      "tds credit",
      "tax deducted at source receivable",
      "withholding tax credit",
      "advance tax",
      "tds balance",
      "tds refundable",
      "advance income tax",
      "self-assessment tax paid",
      "tax paid in advance"
    ]
  },
  {
    label: "Fixed Deposit (Current)",
    nfrsCategory: "bank_fixed_deposit_current",
    noteRef: "3.8",
    normalBalance: "debit",
    synonyms: [
      "fd current",
      "short term fd",
      "fixed deposit less than 1 year",
      "term deposit short term",
      "fd maturing within year",
      "call deposit",
      "short term fixed deposit"
    ]
  },
  {
    label: "Loans & Advances (Current)",
    nfrsCategory: "other_receivables_loans",
    noteRef: "3.4",
    normalBalance: "debit",
    synonyms: [
      "short term advance",
      "loans and advances current",
      "loans & advances (asset)",
      "advance to third party",
      "advance to others",
      "miscellaneous advance"
    ]
  },
  {
    label: "Non-Current Assets Held for Sale",
    nfrsCategory: "other_receivables_other",
    noteRef: "3.6",
    normalBalance: "debit",
    synonyms: [
      "assets held for sale",
      "asset held for sale",
      "non current assets held for sale",
      "disposal group"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // CASH & BANK
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Cash in Hand",
    nfrsCategory: "cash_in_hand",
    noteRef: "3.8",
    normalBalance: "debit",
    synonyms: [
      "cash",
      "petty cash",
      "cash on hand",
      "imprest cash",
      "cash balance",
      "cash at hand",
      "cash in office",
      "vault cash"
    ]
  },
  {
    label: "Bank Balance",
    nfrsCategory: "bank_current_account",
    noteRef: "3.8",
    normalBalance: "debit",
    bucket: "bank_accounts",
    synonyms: [
      "bank",
      "current account",
      "ca",
      "bank balance",
      "bank account",
      "savings account",
      "nabil bank",
      "nic asia bank",
      "himalayan bank",
      "sbi bank",
      "standard chartered bank",
      "global ime bank",
      "kumari bank",
      "everest bank",
      "citizens bank",
      "bank of kathmandu",
      "sanima bank",
      "prabhu bank",
      "sunrise bank",
      "lumbini bank",
      "machhapuchchhre bank",
      "century bank",
      "prime bank",
      "megha bank",
      "civil bank",
      "siddhartha bank",
      "bank c",
      "bank d",
      "bank e",
      "rastriya banijya bank",
      "nepal bank",
      "agricultural development bank",
      "nepal investment bank"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Raw Materials",
    nfrsCategory: "inventory_raw_materials",
    noteRef: "3.7",
    normalBalance: "debit",
    synonyms: [
      "raw material",
      "materials",
      "stock raw material",
      "input material",
      "raw stock",
      "raw materials and consumables",
      "consumables",
      "store and spares"
    ]
  },
  {
    label: "Work in Progress",
    nfrsCategory: "inventory_wip",
    noteRef: "3.7",
    normalBalance: "debit",
    synonyms: [
      "wip",
      "semi-finished goods",
      "work-in-process",
      "goods in process",
      "work-in-progress"
    ]
  },
  {
    label: "Finished Goods",
    nfrsCategory: "inventory_finished_goods",
    noteRef: "3.7",
    normalBalance: "debit",
    synonyms: [
      "finished goods",
      "stock in trade",
      "goods for sale",
      "trading stock",
      "trading goods",
      "merchandise",
      "closing stock",
      "inventory",
      "stock",
      "finished goods and goods for resale"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // REVENUE
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Sales Revenue",
    nfrsCategory: "revenue_sales",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "sales",
      "revenue",
      "turnover",
      "net sales",
      "gross sales",
      "sale of goods",
      "product sales",
      "goods sold",
      "trading revenue",
      "domestic sales",
      "export sales"
    ]
  },
  {
    label: "Service Income",
    nfrsCategory: "revenue_services",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "service income",
      "service revenue",
      "service charge",
      "professional income",
      "consultancy income",
      "fee income",
      "service fees",
      "rendering of services"
    ]
  },
  {
    label: "Interest Income",
    nfrsCategory: "other_income_interest",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "interest income",
      "interest earned",
      "interest on fd",
      "bank interest",
      "interest received",
      "interest on loan given",
      "interest on deposit",
      "interest on call account"
    ]
  },
  {
    label: "Dividend Income",
    nfrsCategory: "other_income_dividend",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "dividend income",
      "dividend received",
      "dividend",
      "bonus share income",
      "cash dividend"
    ]
  },
  {
    label: "Rental Income",
    nfrsCategory: "other_income_rental",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "rental income",
      "rent received",
      "house rent income",
      "property rent",
      "income from rent",
      "lease income"
    ]
  },
  {
    label: "Gain on Sale of Assets",
    nfrsCategory: "other_income_disposal_gain",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "gain on disposal",
      "profit on sale of asset",
      "gain on sale of fixed asset",
      "profit on disposal",
      "gain on disposal of assets"
    ]
  },
  {
    label: "Commission Income",
    nfrsCategory: "other_income_misc",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "commission income",
      "commission received",
      "brokerage income",
      "agency income"
    ]
  },
  {
    label: "Other Income",
    nfrsCategory: "other_income_misc",
    noteRef: "3.17",
    normalBalance: "credit",
    synonyms: [
      "other income",
      "miscellaneous income",
      "sundry income",
      "insurance claim income",
      "scrap sales",
      "rebate received",
      "discount received",
      "other indirect income",
      "gain on fv adjustment of listed share",
      "gain on fair value adjustment"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // PURCHASES / COST OF GOODS SOLD
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Purchases",
    nfrsCategory: "cogs_purchases",
    noteRef: "3.18",
    normalBalance: "debit",
    synonyms: [
      "purchase",
      "goods purchased",
      "material purchased",
      "raw material purchased",
      "trading purchase",
      "import purchase",
      "local purchase",
      "net purchase",
      "purchase of goods"
    ]
  },
  {
    label: "Opening Stock",
    nfrsCategory: "cogs_opening_stock",
    noteRef: "3.18",
    normalBalance: "debit",
    synonyms: [
      "opening stock",
      "opening inventory",
      "stock opening",
      "opening balance stock",
      "inventory opening"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // DIRECT EXPENSES
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Direct Wages",
    nfrsCategory: "direct_wages",
    noteRef: "3.19",
    normalBalance: "debit",
    synonyms: [
      "wages",
      "factory wages",
      "production wages",
      "labour charges",
      "labour cost",
      "packing wages",
      "direct labour",
      "manufacturing labour"
    ]
  },
  {
    label: "Direct Expenses",
    nfrsCategory: "direct_expenses_other",
    noteRef: "3.19",
    normalBalance: "debit",
    synonyms: [
      "direct expenses",
      "factory overhead",
      "production overhead",
      "manufacturing expenses",
      "direct cost",
      "packing charges",
      "carriage inward",
      "freight inward",
      "other direct expenses",
      "import duty",
      "clearing charges"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // EMPLOYEE BENEFIT EXPENSES
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Salaries",
    nfrsCategory: "emp_expense_salaries",
    noteRef: "3.20",
    normalBalance: "debit",
    synonyms: [
      "salary",
      "salaries",
      "staff salary",
      "office salary",
      "monthly salary",
      "management salary",
      "staff cost",
      "wages and salaries",
      "personnel cost",
      "salaries & wages",
      "staff remuneration"
    ]
  },
  {
    label: "Provident Fund Expense",
    nfrsCategory: "emp_expense_pf",
    noteRef: "3.20",
    normalBalance: "debit",
    synonyms: [
      "provident fund expense",
      "pf contribution",
      "ssf contribution",
      "employer pf",
      "employer contribution pf",
      "social security contribution",
      "pf / ssf / cit",
      "ssf expense"
    ]
  },
  {
    label: "Gratuity",
    nfrsCategory: "emp_expense_gratuity",
    noteRef: "3.20",
    normalBalance: "debit",
    synonyms: [
      "gratuity",
      "gratuity expense",
      "gratuity provision",
      "end of service benefit",
      "severance",
      "retirement benefit expense"
    ]
  },
  {
    label: "Staff Welfare",
    nfrsCategory: "emp_expense_welfare",
    noteRef: "3.20",
    normalBalance: "debit",
    synonyms: [
      "staff welfare",
      "employee welfare",
      "medical expense",
      "staff medical",
      "uniform expense",
      "staff training",
      "employee benefit",
      "allowances",
      "leave encashment",
      "other employee related expenses"
    ]
  },
  {
    label: "Staff Bonus",
    nfrsCategory: "emp_expense_bonus",
    noteRef: "3.20",
    normalBalance: "debit",
    synonyms: [
      "staff bonus",
      "bonus expense",
      "employee bonus expense",
      "profit bonus"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // FINANCE COSTS
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Interest Expense",
    nfrsCategory: "finance_cost_interest",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "interest expense",
      "interest paid",
      "interest on loan",
      "bank interest expense",
      "finance charges",
      "interest on overdraft",
      "interest on cc",
      "loan interest",
      "interest on term loan",
      "borrowing cost",
      "interest costs"
    ]
  },
  {
    label: "Bank Charges",
    nfrsCategory: "finance_cost_bank_charges",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "bank charges",
      "bank commission",
      "bank fee",
      "loan processing fee",
      "service charge bank",
      "bank service fee",
      "dd commission",
      "swift charges"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // ADMINISTRATIVE EXPENSES
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Rent",
    nfrsCategory: "admin_rent",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "rent",
      "house rent",
      "office rent",
      "shop rent",
      "warehouse rent",
      "land rent",
      "lease rent",
      "monthly rent",
      "lease rentals"
    ]
  },
  {
    label: "Rates & Taxes",
    nfrsCategory: "admin_rates_taxes",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "rates and taxes",
      "local tax",
      "municipal tax",
      "property tax",
      "road tax",
      "vehicle tax",
      "professional tax",
      "renewal fee",
      "registration fee",
      "ird registration",
      "octroi",
      "dastur",
      "renew dastur",
      "renew charge",
      "company registrar office fee",
      "cro fee",
      "ird fine"
    ]
  },
  {
    label: "Insurance",
    nfrsCategory: "admin_insurance",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "insurance",
      "insurance premium",
      "vehicle insurance",
      "fire insurance",
      "asset insurance",
      "business insurance",
      "marine insurance",
      "insurance expenses"
    ]
  },
  {
    label: "Repairs & Maintenance",
    nfrsCategory: "admin_repairs",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "repairs",
      "maintenance",
      "repair and maintenance",
      "vehicle repair",
      "building repair",
      "machine repair",
      "electrical repair",
      "amc charges",
      "pool a",
      "pool b",
      "pool c",
      "pool d",
      "pool e",
      "annual maintenance charges"
    ]
  },
  {
    label: "Electricity & Water",
    nfrsCategory: "admin_electricity",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "electricity",
      "electricity expense",
      "power expense",
      "water expense",
      "nea bill",
      "electricity bill",
      "utility expense",
      "electricity and water",
      "water & electricity charges",
      "water & electricity expenses"
    ]
  },
  {
    label: "Communication",
    nfrsCategory: "admin_communication",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "telephone",
      "internet",
      "communication expense",
      "mobile bill",
      "telephone expense",
      "broadband",
      "ntc bill",
      "ncell bill",
      "isps",
      "internet & communication expense"
    ]
  },
  {
    label: "Printing & Stationery",
    nfrsCategory: "admin_printing",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "printing",
      "stationery",
      "printing and stationery",
      "office supplies",
      "paper expense",
      "photocopy expense",
      "printing & stationery"
    ]
  },
  {
    label: "Legal & Professional",
    nfrsCategory: "admin_legal_professional",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "legal fee",
      "professional fee",
      "consultancy fee",
      "advocate fee",
      "legal expenses",
      "professional charges",
      "advisory fee",
      "legal and professional",
      "consultancy charges"
    ]
  },
  {
    label: "Audit Fee",
    nfrsCategory: "admin_audit_fee",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "audit fee",
      "audit fees",
      "statutory audit fee",
      "external audit fee",
      "auditor remuneration",
      "audit fee and expenses"
    ]
  },
  {
    label: "Traveling & Conveyance",
    nfrsCategory: "admin_traveling",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "traveling",
      "conveyance",
      "travel expense",
      "ta da",
      "field allowance",
      "transportation expense",
      "fuel expense",
      "petrol expense",
      "vehicle expense",
      "tour expense",
      "fuel expenses",
      "travelling"
    ]
  },
  {
    label: "Advertisement & Promotion",
    nfrsCategory: "admin_other",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "advertisement",
      "advertising",
      "marketing expense",
      "promotion expense",
      "business promotion",
      "advertisement & business promotion",
      "advertisement expenses"
    ]
  },
  {
    label: "Refreshment Expenses",
    nfrsCategory: "admin_other",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "refreshment",
      "refreshment expense",
      "tea and snacks",
      "staff refreshment",
      "food expense",
      "refreshment expenses",
      "chiya kharcha",
      "staff chiya",
      "atithi satkar",
      "guest entertainment",
      "tea expense"
    ]
  },
  {
    label: "Miscellaneous Expenses",
    nfrsCategory: "admin_other",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "miscellaneous expenses",
      "misc expenses",
      "sundry expenses",
      "general expenses",
      "other overhead",
      "miscellaneous expense",
      "chanda",
      "donation",
      "pooja kharcha",
      "dashain kharcha",
      "tihar kharcha",
      "festival expense"
    ]
  },
  {
    label: "CSR Expenses",
    nfrsCategory: "admin_other",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "csr expenses",
      "corporate social responsibility",
      "csr expense",
      "social responsibility expense"
    ]
  },
  {
    label: "AGM & Board Meeting Expenses",
    nfrsCategory: "admin_other",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "agm expenses",
      "board meeting expenses",
      "annual general meeting expense",
      "board meeting fee",
      "board expenses"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // DEPRECIATION & IMPAIRMENT
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Depreciation Expense",
    nfrsCategory: "depreciation_expense",
    noteRef: "3.1",
    normalBalance: "debit",
    synonyms: [
      "depreciation",
      "depreciation expense",
      "depreciation charge",
      "depreciation on fixed assets",
      "amortization",
      "amortisation"
    ]
  },
  {
    label: "Impairment Expense",
    nfrsCategory: "impairment_expense",
    noteRef: "3.21",
    normalBalance: "debit",
    synonyms: [
      "impairment",
      "impairment loss",
      "write off",
      "bad debt written off",
      "provision expense",
      "impairment on receivables",
      "impairment on unlisted shares",
      "loss on fair fv adjustment of listed share",
      "fair value loss",
      "loss on fair value adjustment"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // INCOME TAX
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Income Tax Expense",
    nfrsCategory: "income_tax_expense",
    noteRef: "3.23",
    normalBalance: "debit",
    synonyms: [
      "income tax",
      "corporate tax",
      "company tax",
      "income tax provision",
      "deferred tax expense",
      "current tax",
      "tax on profit"
    ]
  },
  // ══════════════════════════════════════════════════════════════════════════
  // OTHER ADMIN / CATCH-ALL
  // ══════════════════════════════════════════════════════════════════════════
  {
    label: "Other Administrative Expenses",
    nfrsCategory: "admin_other",
    noteRef: "3.22",
    normalBalance: "debit",
    synonyms: [
      "other expenses",
      "administrative expense",
      "office expense",
      "general overhead",
      "indirect expenses",
      "indirect expense"
    ]
  }
];

// server/services/accountMatcher.ts
var CONFIDENCE_THRESHOLD = 80;
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
  if (levenshteinCache.size >= CACHE_LIMIT) {
    levenshteinCache.clear();
  }
  const m = a.length;
  const n = b.length;
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Array(n + 1).fill(0);
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
  const result = dp[m][n];
  levenshteinCache.set(key, result);
  return result;
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
  const overlapCount = shorter.filter((t) => longerSet.has(t)).length;
  const tokenScore = shorter.length > 0 ? overlapCount / shorter.length * 100 : 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const editScore = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;
  return Math.min(100, Math.round(0.7 * tokenScore + 0.3 * editScore));
}
var KEYWORD_BUCKETS = [
  // Trade receivables / debtors
  { pattern: /\b(debtor|accounts? receivable|trade receivable|customer receivable)\b/i, nfrsCategory: "trade_receivables", confidence: 85 },
  // Trade payables / creditors
  { pattern: /\b(creditor|accounts? payable|trade payable|supplier payable)\b/i, nfrsCategory: "trade_payables_creditors", confidence: 85 },
  // Cash
  { pattern: /\bpetty cash\b/i, nfrsCategory: "cash_in_hand", confidence: 92 },
  { pattern: /\bcash\b/i, nfrsCategory: "cash_in_hand", confidence: 80 },
  // Bank borrowings
  { pattern: /\b(term loan|long term loan|bank loan)\b/i, nfrsCategory: "borrowings_noncurrent_bank", confidence: 88 },
  // Fixed deposits
  { pattern: /\b(fd|fixed deposit)\b/i, nfrsCategory: "bank_fixed_deposit_current", confidence: 85 },
  // Bank accounts
  { pattern: /\bbank\b/i, nfrsCategory: "bank_current_account", confidence: 80 },
  // PPE categories
  { pattern: /\b(land|plot|property)\b/i, nfrsCategory: "ppe_land", confidence: 82 },
  { pattern: /\bbuilding/i, nfrsCategory: "ppe_buildings", confidence: 82 },
  { pattern: /\b(vehicle|motor vehicle|car)\b/i, nfrsCategory: "ppe_vehicles", confidence: 82 },
  { pattern: /\b(computer|laptop|desktop|server)\b/i, nfrsCategory: "ppe_computers", confidence: 82 },
  { pattern: /\b(furniture|fixture|fitting)\b/i, nfrsCategory: "ppe_furniture", confidence: 82 },
  { pattern: /\b(plant|machinery|machine)\b/i, nfrsCategory: "ppe_plant_machinery", confidence: 82 },
  { pattern: /\b(software|intangible|patent|trademark)\b/i, nfrsCategory: "ppe_intangibles", confidence: 82 },
  { pattern: /\b(cwip|capital wip|construction in progress|work in progress)\b/i, nfrsCategory: "ppe_cwip", confidence: 82 },
  // Accumulated depreciation
  { pattern: /\baccumulated depreciation\b/i, nfrsCategory: "accum_depreciation", confidence: 92 },
  { pattern: /\bless.?:?\s*(accumulated|accum)?\s*depreciation\b/i, nfrsCategory: "accum_depreciation", confidence: 90 },
  // Employee salaries
  { pattern: /\b(salary|salaries|wages and salary)\b/i, nfrsCategory: "emp_expense_salaries", confidence: 82 },
  // PF/SSF
  { pattern: /\b(provident fund|pf|ssf|cit)\b.*expense/i, nfrsCategory: "emp_expense_pf", confidence: 85 },
  { pattern: /\b(provident fund|pf|ssf|cit)\b/i, nfrsCategory: "emp_expense_pf", confidence: 78 },
  // Finance costs
  { pattern: /\b(interest expense|loan interest|interest paid)\b/i, nfrsCategory: "finance_cost_interest", confidence: 87 },
  { pattern: /\b(bank charge|bank commission|bank fee)\b/i, nfrsCategory: "finance_cost_bank_charges", confidence: 87 },
  // TDS — disambiguation handled separately
  { pattern: /\btds\b/i, nfrsCategory: "tds_payable", confidence: 80 },
  // default; overridden by context
  // VAT
  { pattern: /\bvat payable\b/i, nfrsCategory: "other_payables", confidence: 90 },
  { pattern: /\binput vat\b/i, nfrsCategory: "other_receivables_other", confidence: 88 },
  // Revenue
  { pattern: /\b(sales?|revenue|turnover)\b/i, nfrsCategory: "revenue_sales", confidence: 82 },
  { pattern: /\bservice income\b/i, nfrsCategory: "revenue_services", confidence: 90 },
  // Purchases / COGS
  { pattern: /\b(purchase|goods purchased|raw material purchased)\b/i, nfrsCategory: "cogs_purchases", confidence: 82 },
  // Admin expenses
  { pattern: /\b(rent|office rent|house rent)\b.*expense/i, nfrsCategory: "admin_rent", confidence: 82 },
  // Depreciation expense
  { pattern: /\b(depreciation)\b/i, nfrsCategory: "depreciation_expense", confidence: 85 },
  // Income tax
  { pattern: /\b(income tax|corporate tax)\b.*expense/i, nfrsCategory: "income_tax_expense", confidence: 87 },
  // Share capital
  { pattern: /\b(share capital|paid.?up capital)\b/i, nfrsCategory: "share_capital", confidence: 92 },
  // Retained earnings
  { pattern: /\b(retained earnings|profit and loss)\b/i, nfrsCategory: "retained_earnings", confidence: 90 },
  // Inventory
  { pattern: /\b(inventory|closing stock|stock in trade|finished goods)\b/i, nfrsCategory: "inventory_finished_goods", confidence: 80 },
  // Biological assets
  { pattern: /\b(biological asset|livestock|aquaculture|crops)\b/i, nfrsCategory: "biological_assets", confidence: 85 },
  // Security deposit
  { pattern: /\b(security deposit|guarantee margin|refundable deposit)\b/i, nfrsCategory: "nca_deposits", confidence: 85 },
  // CSR provision
  { pattern: /\b(csr provision|provision for csr|corporate social responsibility provision)\b/i, nfrsCategory: "provisions_current", confidence: 87 },
  // Dividend payable
  { pattern: /\bdividend payable\b/i, nfrsCategory: "dividend_payable", confidence: 90 },
  // Related party
  { pattern: /\b(director loan|loan from director|loan from partner)\b/i, nfrsCategory: "related_party_payable", confidence: 88 },
  { pattern: /\b(loan to director|receivable from related party|loan to partner)\b/i, nfrsCategory: "related_party_receivable", confidence: 88 },
  // Staff advance
  { pattern: /\bstaff advance\b/i, nfrsCategory: "other_receivables_staff_advance", confidence: 85 },
  // Provision for bad debts / impairment on debtors
  { pattern: /\b(provision for bad debts?|provision for doubtful debts?|provision for impairment on debtors?)\b/i, nfrsCategory: "provision_impairment_debtors", confidence: 90 },
  // Provision for impairment on investment
  { pattern: /\bprovision for impairment on investment\b/i, nfrsCategory: "provision_impairment_investment", confidence: 90 },
  // NCA held for sale
  { pattern: /\b(assets? held for sale|non.?current assets? held for sale)\b/i, nfrsCategory: "nca_held_for_sale", confidence: 88 },
  // Advance tax / TDS asset
  { pattern: /\b(advance tax|advance income tax|tds receivable|tax deducted at source.*asset)\b/i, nfrsCategory: "other_receivables_tds", confidence: 88 }
];
var NEPALI_ROMANIZED_ENTRIES = [
  // Land
  {
    patterns: [/\bjameen\b/i, /\bjalin\b/i, /\bjamiyn\b/i],
    nfrsCategory: "ppe_land",
    confidence: 82
  },
  // Buildings
  {
    patterns: [/\bbhawan\b/i, /\bghar\b/i, /\bimarat\b/i, /\bbhavan\b/i],
    nfrsCategory: "ppe_buildings",
    confidence: 82
  },
  // Inventory / goods
  {
    patterns: [/\bsaman\b/i, /\bmaal\b/i, /\bmal\b/i, /\bsaaman\b/i, /\baamal\b/i, /\bkharcha saman\b/i],
    nfrsCategory: "inventory_finished_goods",
    confidence: 80
  },
  // Cash
  {
    patterns: [/\bnakad\b/i, /\bnakaad\b/i, /\bnaqad\b/i],
    nfrsCategory: "cash_in_hand",
    confidence: 85
  },
  // Trade receivables / debtors
  {
    patterns: [/\bdhani\b/i, /\bbujandar\b/i, /\bpaune\b/i, /\bpaunekha\b/i],
    nfrsCategory: "trade_receivables",
    confidence: 80
  },
  // Trade payables / creditors
  {
    patterns: [/\blenidar\b/i, /\bkharidan\b/i, /\btirnu parne\b/i],
    nfrsCategory: "trade_payables_creditors",
    confidence: 80
  },
  // TDS — default to payable; overridden by context check
  {
    patterns: [/\btdas\b/i, /\btda\b/i],
    nfrsCategory: "tds_payable",
    confidence: 80
  },
  // Share capital
  {
    patterns: [/\bpanjikaran\b/i, /\bdarta\b/i, /\bsheyer kapital\b/i],
    nfrsCategory: "share_capital",
    confidence: 80
  },
  // VAT / other payables
  {
    patterns: [/\bhulak\b/i, /\bhulak khata\b/i, /\bvat\b/i],
    nfrsCategory: "other_payables",
    confidence: 78
  },
  // Vehicles
  {
    patterns: [/\bgadi\b/i, /\bsawari\b/i, /\bmotor\b/i],
    nfrsCategory: "ppe_vehicles",
    confidence: 80
  },
  // Furniture
  {
    patterns: [/\bfurnichar\b/i, /\bsajawat\b/i],
    nfrsCategory: "ppe_furniture",
    confidence: 80
  },
  // Salary
  {
    patterns: [/\btankhwah\b/i, /\btlb\b/i, /\btankhah\b/i],
    nfrsCategory: "emp_expense_salaries",
    confidence: 82
  },
  // Gratuity
  {
    patterns: [/\bupadhan\b/i, /\bkaryamuktibhatta\b/i],
    nfrsCategory: "emp_expense_gratuity",
    confidence: 82
  },
  // Rent
  {
    patterns: [/\bbhada\b/i, /\bkiraya\b/i],
    nfrsCategory: "admin_rent",
    confidence: 82
  },
  // Electricity
  {
    patterns: [/\bbidhyut\b/i, /\bwidyut\b/i, /\bbidyut\b/i],
    nfrsCategory: "admin_electricity",
    confidence: 82
  },
  // Retained earnings / P&L
  {
    patterns: [/\bafi ko nakafaa\b/i, /\bnaafaa\b/i, /\bnafaa\b/i],
    nfrsCategory: "retained_earnings",
    confidence: 78
  }
];
var ASSET_CURRENT_CATEGORIES = [
  "trade_receivables",
  "cash_in_hand",
  "bank_current_account",
  "bank_savings_account",
  "bank_fixed_deposit_current",
  "inventory_raw_materials",
  "inventory_wip",
  "inventory_finished_goods",
  "other_receivables_tds",
  "other_receivables_prepayments",
  "other_receivables_staff_advance",
  "other_receivables_loans",
  "other_receivables_advance_supplier",
  "other_receivables_other",
  "provision_impairment_debtors"
];
var ASSET_NONCURRENT_CATEGORIES = [
  "ppe_land",
  "ppe_buildings",
  "ppe_vehicles",
  "ppe_office_equipment",
  "ppe_computers",
  "ppe_furniture",
  "ppe_plant_machinery",
  "ppe_intangibles",
  "ppe_cwip",
  "accum_depreciation",
  "investment_listed_trading",
  "investment_unlisted",
  "investment_fixed_deposit_noncurrent",
  "nca_deposits",
  "nca_loans_advances",
  "nca_other",
  "biological_assets",
  "nca_held_for_sale",
  "related_party_receivable",
  "provision_impairment_investment"
];
var LIABILITY_CURRENT_CATEGORIES = [
  "trade_payables_creditors",
  "trade_payables_advance_customers",
  "borrowings_current_od",
  "borrowings_current_cc",
  "borrowings_current_wc",
  "borrowings_current_portion_lt",
  "income_tax_payable",
  "tds_payable",
  "other_payables",
  "audit_fee_payable",
  "employee_payables_salary",
  "employee_payables_bonus",
  "employee_payables_pf",
  "provisions_current",
  "dividend_payable",
  "related_party_payable"
];
var LIABILITY_NONCURRENT_CATEGORIES = [
  "borrowings_noncurrent_bank",
  "borrowings_noncurrent_other",
  "deferred_tax_liability",
  "employee_benefit_gratuity",
  "provisions_noncurrent",
  "related_party_payable"
];
var EQUITY_CATEGORIES = [
  "share_capital",
  "share_premium",
  "general_reserve",
  "retained_earnings",
  "other_reserves"
];
var INCOME_CATEGORIES = [
  "revenue_sales",
  "revenue_services",
  "other_income_interest",
  "other_income_dividend",
  "other_income_rental",
  "other_income_disposal_gain",
  "other_income_misc"
];
var EXPENSE_CATEGORIES = [
  "cogs_purchases",
  "cogs_opening_stock",
  "direct_wages",
  "direct_expenses_other",
  "emp_expense_salaries",
  "emp_expense_pf",
  "emp_expense_gratuity",
  "emp_expense_welfare",
  "emp_expense_bonus",
  "emp_expense_other",
  "finance_cost_interest",
  "finance_cost_bank_charges",
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
  "admin_other",
  "depreciation_expense",
  "impairment_expense",
  "income_tax_expense"
];
var EMPLOYEE_EXPENSE_CATEGORIES = [
  "emp_expense_salaries",
  "emp_expense_pf",
  "emp_expense_gratuity",
  "emp_expense_welfare",
  "emp_expense_bonus",
  "emp_expense_other"
];
var PARENT_GROUP_CONTEXT_MAP = [
  // ── Current Assets ──────────────────────────────────────────────────────────
  {
    patterns: [
      /\bcurrent assets?\b/i,
      /\b(ca)\b/i,
      /\bcurrent asset group\b/i,
      /\bchalu sampatti\b/i
    ],
    allowedCategories: ASSET_CURRENT_CATEGORIES,
    confidence: 75
    // boost confidence when parent group context matches
  },
  // ── Non-Current / Fixed Assets ───────────────────────────────────────────────
  {
    patterns: [
      /\bnon.?current assets?\b/i,
      /\bfixed assets?\b/i,
      /\b(nca)\b/i,
      /\bproperty plant.*(equipment|ppne)\b/i,
      /\bppe\b/i,
      /\bsthir sampatti\b/i,
      /\bsthayee sampatti\b/i
    ],
    allowedCategories: ASSET_NONCURRENT_CATEGORIES,
    confidence: 75
  },
  // ── Current Liabilities ──────────────────────────────────────────────────────
  {
    patterns: [
      /\bcurrent liabilit/i,
      /\b(cl)\b/i,
      /\bchalu dayitwa\b/i,
      /\bcurrent creditors?\b/i
    ],
    allowedCategories: LIABILITY_CURRENT_CATEGORIES,
    confidence: 75
  },
  // ── Non-Current Liabilities ──────────────────────────────────────────────────
  {
    patterns: [
      /\bnon.?current liabilit/i,
      /\b(ncl)\b/i,
      /\bdirghkalin dayitwa\b/i,
      /\blong.?term liabilit/i
    ],
    allowedCategories: LIABILITY_NONCURRENT_CATEGORIES,
    confidence: 75
  },
  // ── Equity / Capital ─────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(equity|capital account|shareholders? equity|owner.*equity)\b/i,
      /\bpunjee\b/i,
      /\bkapital\b/i
    ],
    allowedCategories: EQUITY_CATEGORIES,
    confidence: 78
  },
  // ── Revenue / Income ─────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(income|revenue|sales|direct income|indirect income|other income)\b/i,
      /\baamdani\b/i,
      /\bbikri\b/i
    ],
    allowedCategories: INCOME_CATEGORIES,
    confidence: 75
  },
  // ── Expenses ─────────────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(expenses?|overheads?|direct expenses?|indirect expenses?|operating expenses?)\b/i,
      /\bkharcha\b/i
    ],
    allowedCategories: EXPENSE_CATEGORIES,
    confidence: 72
  },
  // ── Employee / HR Expenses ───────────────────────────────────────────────────
  {
    patterns: [
      /\b(employee benefit expenses?|staff expenses?|hr expenses?|personnel expenses?)\b/i,
      /\bkarmachari kharcha\b/i
    ],
    allowedCategories: EMPLOYEE_EXPENSE_CATEGORIES,
    confidence: 78
  }
];
function getContextCategories(parentGroup) {
  if (!parentGroup || parentGroup.trim() === "") return null;
  for (const entry of PARENT_GROUP_CONTEXT_MAP) {
    for (const pattern of entry.patterns) {
      if (pattern.test(parentGroup)) {
        return { categories: entry.allowedCategories, confidence: entry.confidence };
      }
    }
  }
  return null;
}
function disambiguateTDS(parentGroup, closingBalance) {
  const pg = (parentGroup ?? "").toLowerCase();
  const isLiabilityContext = /liabilit/i.test(pg) || /current liabilit/i.test(pg) || /payable/i.test(pg) || /cl\b/i.test(pg);
  const isAssetContext = /current assets?/i.test(pg) || /\bca\b/i.test(pg) || /non.?current assets?/i.test(pg) || /advance tax/i.test(pg) || /receivable/i.test(pg);
  if (isLiabilityContext) return "tds_payable";
  if (isAssetContext) return "other_receivables_tds";
  if (closingBalance > 0) return "other_receivables_tds";
  if (closingBalance < 0) return "tds_payable";
  return "tds_payable";
}
function matchSingleAccount(rawLabel, rowIndex, parentGroup = "", closingBalance = 0) {
  const trimmed = rawLabel.trim();
  for (const entry of CHART_OF_ACCOUNTS) {
    if (normalize(trimmed) === normalize(entry.label)) {
      return {
        rowIndex,
        rawLabel: trimmed,
        matchedLabel: entry.label,
        nfrsCategory: entry.nfrsCategory,
        confidence: 100,
        method: "exact",
        candidates: [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: 100 }],
        needsReview: false
      };
    }
  }
  for (const entry of CHART_OF_ACCOUNTS) {
    for (const syn of entry.synonyms ?? []) {
      if (normalize(trimmed) === normalize(syn)) {
        return {
          rowIndex,
          rawLabel: trimmed,
          matchedLabel: entry.label,
          nfrsCategory: entry.nfrsCategory,
          confidence: 95,
          method: "synonym",
          candidates: [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: 95 }],
          needsReview: false
        };
      }
    }
  }
  for (const entry of NEPALI_ROMANIZED_ENTRIES) {
    for (const pattern of entry.patterns) {
      if (pattern.test(trimmed)) {
        let nfrsCategory = entry.nfrsCategory;
        if ((nfrsCategory === "tds_payable" || nfrsCategory === "other_receivables_tds") && /\btds|tdas|tda\b/i.test(trimmed)) {
          nfrsCategory = disambiguateTDS(parentGroup, closingBalance);
        }
        const catEntries = CHART_OF_ACCOUNTS.filter((e) => e.nfrsCategory === nfrsCategory);
        const bestEntry = catEntries[0] ?? null;
        return {
          rowIndex,
          rawLabel: trimmed,
          matchedLabel: bestEntry?.label ?? null,
          nfrsCategory,
          confidence: entry.confidence,
          method: "nepali_romanized",
          candidates: catEntries.slice(0, 5).map((e) => ({
            label: e.label,
            nfrsCategory: e.nfrsCategory,
            confidence: entry.confidence
          })),
          needsReview: entry.confidence < CONFIDENCE_THRESHOLD
        };
      }
    }
  }
  for (const { pattern, nfrsCategory: rawCategory, confidence } of KEYWORD_BUCKETS) {
    if (pattern.test(trimmed)) {
      let nfrsCategory = rawCategory;
      if (rawCategory === "tds_payable" && /\btds\b/i.test(trimmed)) {
        nfrsCategory = disambiguateTDS(parentGroup, closingBalance);
      }
      const catEntries = CHART_OF_ACCOUNTS.filter((e) => e.nfrsCategory === nfrsCategory);
      const bestEntry = catEntries[0] ?? null;
      return {
        rowIndex,
        rawLabel: trimmed,
        matchedLabel: bestEntry?.label ?? null,
        nfrsCategory,
        confidence,
        method: "keyword",
        candidates: catEntries.slice(0, 5).map((e) => ({
          label: e.label,
          nfrsCategory: e.nfrsCategory,
          confidence
        })),
        needsReview: confidence < CONFIDENCE_THRESHOLD
      };
    }
  }
  const contextResult = getContextCategories(parentGroup);
  if (contextResult) {
    const allowedSet = new Set(contextResult.categories);
    const scored2 = CHART_OF_ACCOUNTS.filter((entry) => allowedSet.has(entry.nfrsCategory)).flatMap((entry) => {
      const labelScore = similarityScore(trimmed, entry.label);
      const synScores = (entry.synonyms ?? []).map((s) => similarityScore(trimmed, s));
      const best = Math.max(labelScore, ...synScores, 0);
      return [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: best }];
    }).sort((a, b) => b.confidence - a.confidence);
    const top2 = scored2[0];
    if (top2 && top2.confidence >= 65) {
      const boostedConf = Math.min(100, Math.round(top2.confidence * 1.08));
      return {
        rowIndex,
        rawLabel: trimmed,
        matchedLabel: top2.label,
        nfrsCategory: top2.nfrsCategory,
        confidence: boostedConf,
        method: "context",
        candidates: scored2.slice(0, 5).map((s) => ({
          ...s,
          nfrsCategory: s.nfrsCategory
        })),
        needsReview: boostedConf < CONFIDENCE_THRESHOLD
      };
    }
  }
  const scored = CHART_OF_ACCOUNTS.flatMap((entry) => {
    const labelScore = similarityScore(trimmed, entry.label);
    const synScores = (entry.synonyms ?? []).map((s) => similarityScore(trimmed, s));
    const best = Math.max(labelScore, ...synScores, 0);
    return [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: best }];
  }).sort((a, b) => b.confidence - a.confidence);
  const top = scored[0];
  const candidates = scored.slice(0, 5);
  if (top && top.confidence >= 75) {
    return {
      rowIndex,
      rawLabel: trimmed,
      matchedLabel: top.label,
      nfrsCategory: top.nfrsCategory,
      confidence: top.confidence,
      method: "fuzzy",
      candidates: candidates.map((c) => ({ ...c, nfrsCategory: c.nfrsCategory })),
      needsReview: top.confidence < CONFIDENCE_THRESHOLD
    };
  }
  return {
    rowIndex,
    rawLabel: trimmed,
    matchedLabel: null,
    nfrsCategory: "unclassified",
    confidence: top?.confidence ?? 0,
    method: "unmatched",
    candidates: candidates.map((c) => ({ ...c, nfrsCategory: c.nfrsCategory })),
    needsReview: true
  };
}
function matchAllAccounts(rows) {
  return rows.map((row) => {
    if (row.isGroupRow) {
      return {
        rowIndex: row.rowIndex,
        rawLabel: row.rawLabel,
        matchedLabel: null,
        nfrsCategory: "unclassified",
        confidence: 0,
        method: "unmatched",
        candidates: [],
        needsReview: false,
        // group rows don't need user review
        userOverride: false
      };
    }
    const closingBalance = (row.closingDr ?? 0) - (row.closingCr ?? 0);
    return matchSingleAccount(
      row.rawLabel,
      row.rowIndex,
      row.parentGroup ?? "",
      closingBalance
    );
  });
}

// src/data/nfrsCategories.ts
var NFRS_CATEGORY_INFO = [
  // ── Non-Current Assets — PPE ──────────────────────────────────────────────
  {
    value: "ppe_land",
    label: "Land",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Freehold and leasehold land held for business operations."
  },
  {
    value: "ppe_buildings",
    label: "Buildings",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Factory, office and other buildings owned by the company."
  },
  {
    value: "ppe_plant_machinery",
    label: "Plant & Machinery",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Production plant, industrial machinery and equipment."
  },
  {
    value: "ppe_furniture",
    label: "Furniture & Fixtures",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Office furniture, fittings and built-in fixtures."
  },
  {
    value: "ppe_vehicles",
    label: "Vehicles",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Cars, vans, trucks and other motor vehicles."
  },
  {
    value: "ppe_computers",
    label: "Computers & IT Equipment",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Computers, servers, printers and IT peripherals."
  },
  {
    value: "ppe_office_equipment",
    label: "Other Equipment",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Other tangible fixed assets not classified elsewhere."
  },
  {
    value: "ppe_cwip",
    label: "Capital Work-in-Progress",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.2",
    description: "Assets under construction or not yet ready for use."
  },
  {
    value: "accum_depreciation",
    label: "Accumulated Depreciation",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "credit",
    noteRef: "3.1",
    description: "Total depreciation charged on PPE to date (contra-asset)."
  },
  {
    value: "ppe_intangibles",
    label: "Intangible Assets",
    group: "Non-Current Assets \u2014 Property, Plant & Equipment",
    normalBalance: "debit",
    noteRef: "3.3",
    description: "Goodwill, software licences, trademarks and other intangibles."
  },
  // ── Non-Current Assets — Investments ─────────────────────────────────────
  {
    value: "investment_listed_trading",
    label: "Investment in Listed Shares",
    group: "Non-Current Assets \u2014 Investments",
    normalBalance: "debit",
    noteRef: "3.4",
    description: "Investment in equity shares listed on NEPSE."
  },
  {
    value: "investment_unlisted",
    label: "Investment in Unlisted Shares",
    group: "Non-Current Assets \u2014 Investments",
    normalBalance: "debit",
    noteRef: "3.4",
    description: "Investment in private company equity shares not listed on NEPSE."
  },
  {
    value: "investment_unlisted",
    label: "Investment in Mutual Funds",
    group: "Non-Current Assets \u2014 Investments",
    normalBalance: "debit",
    noteRef: "3.4",
    description: "Units held in SEBON-registered mutual funds."
  },
  {
    value: "investment_unlisted",
    label: "Bonds & Debentures",
    group: "Non-Current Assets \u2014 Investments",
    normalBalance: "debit",
    noteRef: "3.4",
    description: "Government securities, corporate bonds and debentures."
  },
  {
    value: "investment_fixed_deposit_noncurrent",
    label: "Fixed Deposit Receipts (FDR)",
    group: "Non-Current Assets \u2014 Investments",
    normalBalance: "debit",
    noteRef: "3.4",
    description: "Long-term fixed deposits placed with banks and financial institutions."
  },
  {
    value: "investment_unlisted",
    label: "Other Investments",
    group: "Non-Current Assets \u2014 Investments",
    normalBalance: "debit",
    noteRef: "3.4",
    description: "Other long-term investments not classified elsewhere."
  },
  // ── Non-Current Assets — Other ────────────────────────────────────────────
  {
    value: "ppe_intangibles",
    label: "Goodwill",
    group: "Non-Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.3",
    description: "Goodwill arising on acquisition of a business."
  },
  {
    value: "nca_other",
    label: "Deferred Tax Asset",
    group: "Non-Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.23",
    description: "Deferred tax asset arising from timing differences."
  },
  {
    value: "nca_other",
    label: "Other Non-Current Assets",
    group: "Non-Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Long-term deposits, security deposits and other NCA not classified above."
  },
  {
    value: "nca_loans_advances",
    label: "Long-term Loans & Advances",
    group: "Non-Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Loans and advances recoverable after twelve months."
  },
  // ── Current Assets — Trade Receivables ───────────────────────────────────
  {
    value: "trade_receivables",
    label: "Trade Receivables (Debtors)",
    group: "Current Assets \u2014 Trade Receivables",
    normalBalance: "debit",
    noteRef: "3.5",
    description: "Amounts owed by customers for goods/services already delivered."
  },
  {
    value: "provision_impairment_debtors",
    label: "Less: Allowance for Doubtful Debts",
    group: "Current Assets \u2014 Trade Receivables",
    normalBalance: "credit",
    noteRef: "3.5",
    description: "Provision for estimated uncollectable trade receivables (contra-asset)."
  },
  {
    value: "trade_receivables",
    label: "Bills Receivable",
    group: "Current Assets \u2014 Trade Receivables",
    normalBalance: "debit",
    noteRef: "3.5",
    description: "Promissory notes and bills of exchange receivable."
  },
  // ── Current Assets — Cash & Bank ─────────────────────────────────────────
  {
    value: "cash_in_hand",
    label: "Cash in Hand",
    group: "Current Assets \u2014 Cash & Bank",
    normalBalance: "debit",
    noteRef: "3.8",
    description: "Physical cash held at premises and petty cash."
  },
  {
    value: "bank_current_account",
    label: "Bank \u2014 Current Account",
    group: "Current Assets \u2014 Cash & Bank",
    normalBalance: "debit",
    noteRef: "3.8",
    description: "Balances in bank current / cheque accounts."
  },
  {
    value: "bank_savings_account",
    label: "Bank \u2014 Savings Account",
    group: "Current Assets \u2014 Cash & Bank",
    normalBalance: "debit",
    noteRef: "3.8",
    description: "Balances in bank savings accounts."
  },
  {
    value: "bank_current_account",
    label: "Bank Overdraft (Asset Balance)",
    group: "Current Assets \u2014 Cash & Bank",
    normalBalance: "debit",
    noteRef: "3.8",
    description: "Temporary debit balance on an overdraft facility (asset side)."
  },
  {
    value: "bank_fixed_deposit_current",
    label: "Short-term Fixed Deposits (\u22643 months)",
    group: "Current Assets \u2014 Cash & Bank",
    normalBalance: "debit",
    noteRef: "3.8",
    description: "Fixed deposits maturing within three months, treated as cash equivalents."
  },
  // ── Current Assets — Inventories ──────────────────────────────────────────
  {
    value: "inventory_raw_materials",
    label: "Inventories \u2014 Raw Materials",
    group: "Current Assets \u2014 Inventories",
    normalBalance: "debit",
    noteRef: "3.7",
    description: "Raw materials and components held for production."
  },
  {
    value: "inventory_wip",
    label: "Inventories \u2014 Work-in-Progress",
    group: "Current Assets \u2014 Inventories",
    normalBalance: "debit",
    noteRef: "3.7",
    description: "Goods partially manufactured and awaiting completion."
  },
  {
    value: "inventory_finished_goods",
    label: "Inventories \u2014 Finished Goods",
    group: "Current Assets \u2014 Inventories",
    normalBalance: "debit",
    noteRef: "3.7",
    description: "Completed goods held for sale."
  },
  {
    value: "inventory_finished_goods",
    label: "Inventories \u2014 Trading / Stock-in-Trade",
    group: "Current Assets \u2014 Inventories",
    normalBalance: "debit",
    noteRef: "3.7",
    description: "Goods purchased for resale without further processing."
  },
  {
    value: "inventory_raw_materials",
    label: "Inventories \u2014 Consumables & Stores",
    group: "Current Assets \u2014 Inventories",
    normalBalance: "debit",
    noteRef: "3.7",
    description: "Office consumables, packing materials and factory stores."
  },
  // ── Current Assets — Other ────────────────────────────────────────────────
  {
    value: "other_receivables_tds",
    label: "Advance Income Tax / TDS Receivable",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Tax paid in advance and TDS deducted at source on income."
  },
  {
    value: "other_receivables_other",
    label: "VAT Receivable (Input Tax)",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Input VAT credit available for set-off against output VAT."
  },
  {
    value: "other_receivables_prepayments",
    label: "Prepaid Expenses",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Expenses paid in advance for future periods."
  },
  {
    value: "other_receivables_other",
    label: "Accrued Income / Interest Receivable",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Income earned but not yet received or invoiced."
  },
  {
    value: "other_receivables_staff_advance",
    label: "Loans & Advances to Staff",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Short-term advances and salary advances to employees."
  },
  {
    value: "other_receivables_loans",
    label: "Loans & Advances to Others",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Other short-term advances and deposits recoverable."
  },
  {
    value: "other_receivables_other",
    label: "Other Current Assets",
    group: "Current Assets \u2014 Other",
    normalBalance: "debit",
    noteRef: "3.6",
    description: "Miscellaneous current assets not classified elsewhere."
  },
  // ── Equity ────────────────────────────────────────────────────────────────
  {
    value: "share_capital",
    label: "Share Capital",
    group: "Equity",
    normalBalance: "credit",
    noteRef: "3.9",
    description: "Paid-up share capital \u2014 authorised and issued ordinary shares."
  },
  {
    value: "share_premium",
    label: "Share Premium / Securities Premium",
    group: "Equity",
    normalBalance: "credit",
    noteRef: "3.9",
    description: "Premium received on issue of shares above face value."
  },
  {
    value: "general_reserve",
    label: "General Reserve",
    group: "Equity",
    normalBalance: "credit",
    noteRef: "3.10",
    description: "Accumulated general reserve appropriated from retained earnings."
  },
  {
    value: "retained_earnings",
    label: "Retained Earnings / Accumulated Profit",
    group: "Equity",
    normalBalance: "credit",
    noteRef: "3.10",
    description: "Cumulative profit/(loss) retained in the business after dividends."
  },
  {
    value: "other_reserves",
    label: "Other Reserves",
    group: "Equity",
    normalBalance: "credit",
    noteRef: "3.10",
    description: "Capital reserve, revaluation reserve and other specific reserves."
  },
  {
    value: "other_reserves",
    label: "Proprietor's Capital (Sole Trade/Partnership)",
    group: "Equity",
    normalBalance: "credit",
    noteRef: "3.9",
    description: "Capital contributed by proprietor or partners in non-corporate entities."
  },
  // ── Non-Current Liabilities ───────────────────────────────────────────────
  {
    value: "borrowings_noncurrent_bank",
    label: "Long-term Loan \u2014 Bank",
    group: "Non-Current Liabilities",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Term loans from banks repayable after twelve months."
  },
  {
    value: "borrowings_noncurrent_other",
    label: "Long-term Loan \u2014 Others",
    group: "Non-Current Liabilities",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Long-term loans from NBFIs, related parties or other sources."
  },
  {
    value: "borrowings_noncurrent_other",
    label: "Debentures / Bonds Issued",
    group: "Non-Current Liabilities",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Long-term debt instruments issued by the company."
  },
  {
    value: "deferred_tax_liability",
    label: "Deferred Tax Liability",
    group: "Non-Current Liabilities",
    normalBalance: "credit",
    noteRef: "3.23",
    description: "Deferred tax liability arising from timing differences."
  },
  {
    value: "employee_benefit_gratuity",
    label: "Provision for Gratuity (Non-current)",
    group: "Non-Current Liabilities",
    normalBalance: "credit",
    noteRef: "3.12",
    description: "Long-term portion of defined benefit gratuity obligation."
  },
  {
    value: "provisions_noncurrent",
    label: "Other Non-Current Liabilities",
    group: "Non-Current Liabilities",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Other long-term obligations not classified elsewhere."
  },
  // ── Current Liabilities — Borrowings ──────────────────────────────────────
  {
    value: "borrowings_current_od",
    label: "Bank Overdraft",
    group: "Current Liabilities \u2014 Borrowings",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Bank overdraft balance (credit balance on OD/CC account)."
  },
  {
    value: "borrowings_current_wc",
    label: "Short-term Loans & Working Capital",
    group: "Current Liabilities \u2014 Borrowings",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Cash credit, working capital demand loans and other short-term bank facilities."
  },
  {
    value: "borrowings_current_portion_lt",
    label: "Current Portion of Long-term Loan",
    group: "Current Liabilities \u2014 Borrowings",
    normalBalance: "credit",
    noteRef: "3.11",
    description: "Instalments of long-term loans due within twelve months."
  },
  // ── Current Liabilities — Trade Payables ──────────────────────────────────
  {
    value: "trade_payables_creditors",
    label: "Trade Payables (Creditors)",
    group: "Current Liabilities \u2014 Trade Payables",
    normalBalance: "credit",
    noteRef: "3.13",
    description: "Amounts owed to suppliers for goods and services received."
  },
  {
    value: "trade_payables_creditors",
    label: "Bills Payable",
    group: "Current Liabilities \u2014 Trade Payables",
    normalBalance: "credit",
    noteRef: "3.13",
    description: "Promissory notes and bills of exchange payable to creditors."
  },
  {
    value: "trade_payables_advance_customers",
    label: "Advance from Customers",
    group: "Current Liabilities \u2014 Trade Payables",
    normalBalance: "credit",
    noteRef: "3.14",
    description: "Deposits and advance payments received from customers before delivery."
  },
  // ── Current Liabilities — Employee & Statutory ────────────────────────────
  {
    value: "employee_payables_salary",
    label: "Salary & Wages Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.12",
    description: "Accrued salaries and wages payable to employees."
  },
  {
    value: "employee_payables_bonus",
    label: "Staff Bonus Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.12",
    description: "Staff bonus accrued and payable (10% of net profit per Bonus Act 2030)."
  },
  {
    value: "employee_payables_pf",
    label: "PF / SSF Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.12",
    description: "Provident fund and Social Security Fund contributions payable."
  },
  {
    value: "tds_payable",
    label: "TDS / Withholding Tax Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.15",
    description: "Tax deducted at source pending deposit to IRD."
  },
  {
    value: "other_payables",
    label: "VAT Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.15",
    description: "Net VAT liability (output tax less input tax) payable to IRD."
  },
  {
    value: "income_tax_payable",
    label: "Income Tax Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.15",
    description: "Current-year income tax liability net of advance tax paid."
  },
  {
    value: "audit_fee_payable",
    label: "Audit Fee Payable",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.16",
    description: "Statutory audit fee accrued and payable to auditors."
  },
  {
    value: "provisions_current",
    label: "Other Provisions",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.16",
    description: "Other accruals and provisions for known obligations."
  },
  {
    value: "other_payables",
    label: "Other Current Liabilities",
    group: "Current Liabilities \u2014 Employee & Statutory",
    normalBalance: "credit",
    noteRef: "3.14",
    description: "Miscellaneous current liabilities not classified elsewhere."
  },
  // ── Income ────────────────────────────────────────────────────────────────
  {
    value: "revenue_sales",
    label: "Revenue \u2014 Sales of Goods",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Revenue from sale of goods, net of returns and trade discounts."
  },
  {
    value: "revenue_services",
    label: "Revenue \u2014 Service Income",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Revenue from rendering of services."
  },
  {
    value: "other_income_misc",
    label: "Revenue \u2014 Other Operating Income",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Other income directly related to business operations."
  },
  {
    value: "other_income_interest",
    label: "Interest Income",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Interest earned on bank deposits, loans and investments."
  },
  {
    value: "other_income_dividend",
    label: "Dividend Income",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Dividends received from investments in shares."
  },
  {
    value: "other_income_rental",
    label: "Rental Income",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Income from renting out property or equipment."
  },
  {
    value: "other_income_misc",
    label: "Other Income",
    group: "Income",
    normalBalance: "credit",
    noteRef: "3.17",
    description: "Gains, miscellaneous income and receipts not from operations."
  },
  // ── Cost of Goods Sold ────────────────────────────────────────────────────
  {
    value: "cogs_purchases",
    label: "Purchases",
    group: "Cost of Goods Sold",
    normalBalance: "debit",
    noteRef: "3.18",
    description: "Cost of goods purchased for trading or raw materials for production."
  },
  {
    value: "direct_expenses_other",
    label: "Direct Expenses",
    group: "Cost of Goods Sold",
    normalBalance: "debit",
    noteRef: "3.19",
    description: "Direct labour, freight, packing and other costs directly attributable to production."
  },
  {
    value: "cogs_opening_stock",
    label: "Opening Stock",
    group: "Cost of Goods Sold",
    normalBalance: "debit",
    noteRef: "3.18",
    description: "Inventory at the beginning of the reporting period."
  },
  {
    value: "inventory_finished_goods",
    label: "Closing Stock",
    group: "Cost of Goods Sold",
    normalBalance: "credit",
    noteRef: "3.18",
    description: "Inventory at the end of the reporting period."
  },
  // ── Employee Expenses ─────────────────────────────────────────────────────
  {
    value: "emp_expense_salaries",
    label: "Salaries & Wages",
    group: "Employee Expenses",
    normalBalance: "debit",
    noteRef: "3.20",
    description: "Gross salaries, wages and allowances paid to employees."
  },
  {
    value: "emp_expense_pf",
    label: "PF / SSF Contribution (Employer)",
    group: "Employee Expenses",
    normalBalance: "debit",
    noteRef: "3.20",
    description: "Employer's contribution to Provident Fund and Social Security Fund."
  },
  {
    value: "emp_expense_gratuity",
    label: "Gratuity Expense",
    group: "Employee Expenses",
    normalBalance: "debit",
    noteRef: "3.20",
    description: "Gratuity expense accrued for the period per actuarial estimate."
  },
  {
    value: "emp_expense_other",
    label: "Leave Encashment Expense",
    group: "Employee Expenses",
    normalBalance: "debit",
    noteRef: "3.20",
    description: "Expense for accumulated leave liability of employees."
  },
  {
    value: "emp_expense_bonus",
    label: "Staff Bonus Expense",
    group: "Employee Expenses",
    normalBalance: "debit",
    noteRef: "3.20",
    description: "Staff bonus charged to income statement (10% of net profit before tax)."
  },
  {
    value: "emp_expense_welfare",
    label: "Staff Welfare Expenses",
    group: "Employee Expenses",
    normalBalance: "debit",
    noteRef: "3.20",
    description: "Medical, canteen, training, uniform and other staff welfare costs."
  },
  // ── Finance Costs ─────────────────────────────────────────────────────────
  {
    value: "finance_cost_interest",
    label: "Bank Interest Expense",
    group: "Finance Costs",
    normalBalance: "debit",
    noteRef: "3.21",
    description: "Interest charged on bank loans, overdrafts and credit facilities."
  },
  {
    value: "finance_cost_bank_charges",
    label: "Bank Charges & Commission",
    group: "Finance Costs",
    normalBalance: "debit",
    noteRef: "3.21",
    description: "Bank service charges, LC commission and other financial charges."
  },
  {
    value: "finance_cost_interest",
    label: "Other Finance Costs",
    group: "Finance Costs",
    normalBalance: "debit",
    noteRef: "3.21",
    description: "Other borrowing costs not separately classified."
  },
  // ── Depreciation & Impairment ─────────────────────────────────────────────
  {
    value: "depreciation_expense",
    label: "Depreciation Expense",
    group: "Depreciation & Impairment",
    normalBalance: "debit",
    noteRef: "3.1",
    description: "Systematic depreciation of PPE charged to income statement."
  },
  {
    value: "impairment_expense",
    label: "Impairment Loss",
    group: "Depreciation & Impairment",
    normalBalance: "debit",
    noteRef: "3.21",
    description: "Impairment write-down of assets below their carrying amount."
  },
  // ── Administrative Expenses ───────────────────────────────────────────────
  {
    value: "admin_rent",
    label: "Rent Expense",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Rent paid for office, factory and business premises."
  },
  {
    value: "admin_electricity",
    label: "Electricity, Water & Utilities",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Utility costs for office and factory operations."
  },
  {
    value: "admin_communication",
    label: "Telephone, Internet & Communication",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Communication costs including internet, mobile and landline."
  },
  {
    value: "admin_printing",
    label: "Printing & Stationery",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Office stationery, printing and photocopying costs."
  },
  {
    value: "admin_repairs",
    label: "Repairs & Maintenance",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Expenditure on repair and maintenance of assets."
  },
  {
    value: "admin_audit_fee",
    label: "Audit Fee",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Statutory audit fee and other professional charges."
  },
  {
    value: "admin_legal_professional",
    label: "Legal & Professional Fees",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Legal fees, consultancy fees and professional charges."
  },
  {
    value: "admin_other",
    label: "Selling & Distribution Expenses",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Sales commission, advertisement, delivery and marketing expenses."
  },
  {
    value: "admin_traveling",
    label: "Travel & Conveyance",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Staff travel, vehicle running costs and conveyance allowances."
  },
  {
    value: "admin_insurance",
    label: "Insurance Premium",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Insurance premiums for assets, stock and business."
  },
  {
    value: "admin_other",
    label: "Miscellaneous Expenses",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Sundry and miscellaneous operational expenses."
  },
  {
    value: "admin_other",
    label: "Other Administrative Expenses",
    group: "Administrative Expenses",
    normalBalance: "debit",
    noteRef: "3.22",
    description: "Other general and administrative costs not separately listed."
  },
  // ── Tax ───────────────────────────────────────────────────────────────────
  {
    value: "income_tax_expense",
    label: "Current Tax Expense",
    group: "Tax",
    normalBalance: "debit",
    noteRef: "3.23",
    description: "Current-year income tax expense based on taxable income."
  },
  {
    value: "income_tax_expense",
    label: "Deferred Tax Expense / (Income)",
    group: "Tax",
    normalBalance: "debit",
    noteRef: "3.23",
    description: "Movement in deferred tax asset or liability for the period."
  },
  // ── Unclassified ──────────────────────────────────────────────────────────
  {
    value: "unclassified",
    label: "Unclassified / Not Mapped",
    group: "Unclassified",
    normalBalance: "debit",
    noteRef: "\u2014",
    description: "Account has not been mapped to an NFRS category \u2014 review required."
  }
];

// server/services/aiAccountMatcher.ts
var aiCache = /* @__PURE__ */ new Map();
function buildCacheKey(accounts) {
  return accounts.map((a) => `${a.rawLabel}:${Math.sign(a.closingBalance ?? 0)}`).join("|");
}
function buildSystemPrompt() {
  return `You are an expert Nepal Chartered Accountant with deep knowledge of:
1. Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by ICAN
2. Nepal Income Tax Act 2058 and its amendments
3. Common accounting software used in Nepal: Tally ERP9, Tally Prime, Busy Accounting, Marg ERP
4. Nepal business terminology: NPR, BS calendar, PAN/VAT, TDS, PF/SSF/CIT, NEPSE, NRB, IRD
5. Double-entry bookkeeping: Dr-balance accounts are typically assets/expenses; Cr-balance accounts are liabilities/equity/income

Your task is to classify trial balance account names into NFRS financial statement categories.
Respond ONLY with a valid JSON array \u2014 no markdown, no explanation, no preamble.`;
}
function buildUserPrompt(accounts, company) {
  const accountLines = accounts.map((a, i) => {
    const balance = a.closingBalance ?? 0;
    const side = balance >= 0 ? "Dr" : "Cr";
    const amount = Math.abs(balance).toLocaleString("en-IN");
    return `${i + 1}. "${a.rawLabel}" [Closing: ${side} NPR ${amount}]`;
  }).join("\n");
  return `CONTEXT: Company type is ${company.companyType}, Fiscal Year ${company.fiscalYear.bsYear}

These account names are from a Nepal business trial balance exported from accounting software.
Each name may be in English or a mixture of English and Nepali transliteration.

IMPORTANT Nepal-specific classification rules:
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
PROVIDENT / RETIREMENT FUNDS:
- "CIT" = Citizens Investment Trust (provident fund type) \u2192 employee_payables_pf
- "SSF" = Social Security Fund \u2192 employee_payables_pf
- "EPF" = Employees Provident Fund \u2192 employee_payables_pf
- "PF" alone or "Provident Fund" \u2192 employee_payables_pf

INVESTMENTS & CAPITAL MARKET:
- "NEPSE" related accounts \u2192 investment_listed_trading
- Share investment, listed shares, demat account \u2192 investment_listed_trading
- Mutual fund, unit trust \u2192 investment_listed_trading
- Fixed deposit (> 1 year) \u2192 investment_fixed_deposit_noncurrent
- Fixed deposit (< 1 year / short term) \u2192 cash_equivalents_fixed_deposit

REGULATORY / GOVERNMENT:
- "NRB" = Nepal Rastra Bank \u2192 admin_rates_taxes (if expense) or bank_current_account (if balance)
- "IRD" = Inland Revenue Department \u2192 income_tax_payable (if payable) or advance_tax (if receivable)
- "OCR" = Office of Company Registrar \u2192 admin_rates_taxes
- "DDR" = Department of Drug Registration \u2192 admin_rates_taxes
- "Municipality fee/renewal" \u2192 admin_rates_taxes

TAX ENTRIES:
- "TDS payable" / "TDS on salary payable" \u2192 tds_payable
- "TDS on rent payable" \u2192 tds_payable
- "TDS on service payable" \u2192 tds_payable
- "Input VAT" / "VAT receivable" \u2192 other_receivables_other (Dr balance)
- "Output VAT payable" / "VAT payable" \u2192 other_payables (Cr balance)
- "Advance income tax" / "Advance tax paid" \u2192 advance_tax_paid
- "Tax payable" / "Income tax payable" \u2192 income_tax_payable

BANK ACCOUNTS:
- Any Nepal bank name (Nabil, NIC Asia, Himalayan, Everest, NIBL, HBL, EBL, Citizens, Kumari, 
  Bank of Kathmandu, NMB, Siddhartha, Global IME, Sunrise, Prabhu, Sanima, Laxmi, Janata, 
  Mega, Century, ADBN, RBB, NBL, Civil, Prime, Standard Chartered, Citibank) with "Current / CA / 
  Savings / OD / CC / Account" \u2192 bank_current_account (Dr balance) or bank_overdraft (Cr balance)
- IMPORTANT: If the account is a Nepal bank name with Cr balance and labeled "OD" or "Overdraft" or "CC" 
  or "Cash Credit" \u2192 bank_overdraft (current liability)
- If the account is a Nepal bank name with Cr balance and labeled "Loan" or "Term Loan" \u2192 
  borrowings_bank_noncurrent (if long-term) else borrowings_bank_current

INVENTORY:
- "Closing Stock" / "Stock in Hand" \u2192 inventory_finished_goods (Dr balance asset)
- "Opening Stock" / "Opening Inventory" \u2192 cogs_opening_stock (expense/COGS)
- "Work in Progress" / "WIP" \u2192 inventory_wip
- "Raw Material" stock \u2192 inventory_raw_material

TRADE ACCOUNTS:
- "Sundry Debtors" / "Trade Debtors" / "Accounts Receivable" \u2192 trade_receivables
- "Sundry Creditors" / "Trade Creditors" / "Accounts Payable" \u2192 trade_payables
- "Purchase" / "Purchases" by itself \u2192 cogs_purchases
- "Sales" / "Revenue" / "Income from [anything]" \u2192 revenue_operations (unless clearly other income)
- "Other Income" / "Miscellaneous Income" / "Sundry Income" \u2192 other_income

EMPLOYEE-RELATED:
- "Staff Bonus" / "Bonus expense" \u2192 emp_expense_bonus (if Dr / expense)
- "Bonus payable" / "Staff bonus payable" \u2192 employee_payables_bonus (if Cr / liability)
- "Dashain Allowance" / "Tihar Allowance" / "Festival bonus" \u2192 emp_expense_welfare
- "Gratuity expense" / "Gratuity provision" \u2192 emp_expense_gratuity
- "Gratuity payable" / "Gratuity fund" \u2192 employee_payables_gratuity
- "Leave encashment" \u2192 emp_expense_leave
- "Salary" / "Wages" / "Remuneration" \u2192 emp_expense_salary
  (A fiscal year suffix like "Salary 2081" does NOT change the category)

ADVANCES & LOANS:
- "Advance to [party name]" / "Staff advance" \u2192 other_receivables_loans (Dr balance = asset)
- "Advance from [party name]" \u2192 advance_from_customers (Cr balance = liability)
- "Loan from director" / "Loan from [director name]" \u2192 related_party_payable
- "Loan from [bank name]" \u2192 borrowings_bank_noncurrent or borrowings_bank_current (based on term)
- "Loan to staff" / "Loan to employee" \u2192 other_receivables_loans

BALANCE-SIDE HINTS (use the Dr/Cr balance as strong evidence):
- Large Cr balance (>1M) on an account named like a person/party \u2192 likely related_party_payable or trade_payables
- Large Cr balance on "Capital" or "Equity" related names \u2192 share_capital or retained_earnings
- Dr balance on "Depreciation" \u2192 this is the accumulated depreciation contra account \u2192 ppe_accumulated_depreciation
- Dr balance on "Prepaid" \u2192 prepaid_expenses
- Cr balance on "Deferred" or "Advance receipt" \u2192 deferred_income

ACCOUNTS TO CLASSIFY:
${accountLines}

Respond ONLY with a valid JSON array (no markdown, no \`\`\`, no text before or after):
[{"rowIndex": 1, "nfrsCategory": "exact_category_value", "confidence": 85, "reasoning": "brief one-line reason"}]

Available categories (use EXACTLY one of these strings):
${NFRS_CATEGORY_INFO.map((i) => i.value).join(", ")}`;
}
async function aiMatchUnresolved(accounts, company, apiKey) {
  if (!accounts.length) return [];
  const cacheKey = buildCacheKey(accounts);
  if (aiCache.has(cacheKey)) {
    console.log("[AI Matcher] Cache hit \u2014 skipping API call");
    return aiCache.get(cacheKey);
  }
  if (!apiKey) {
    console.warn("[AI Matcher] No API key \u2014 returning empty results");
    return [];
  }
  const BATCH_SIZE = 30;
  const allResults = [];
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchResults = await callClaudeAPI(batch, company, apiKey, i);
    allResults.push(...batchResults);
  }
  aiCache.set(cacheKey, allResults);
  return allResults;
}
async function callClaudeAPI(accounts, company, apiKey, indexOffset) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(accounts, company);
  let attempts = 0;
  const MAX_RETRIES = 2;
  while (attempts <= MAX_RETRIES) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
      }
      const data = await response.json();
      const rawText = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
      const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const arrayStart = cleaned.indexOf("[");
      const arrayEnd = cleaned.lastIndexOf("]");
      if (arrayStart === -1 || arrayEnd === -1) {
        throw new Error("AI response did not contain a JSON array");
      }
      const jsonString = cleaned.slice(arrayStart, arrayEnd + 1);
      const parsed = JSON.parse(jsonString);
      return parsed.filter(
        (r) => typeof r.rowIndex === "number" && typeof r.nfrsCategory === "string" && typeof r.confidence === "number"
      ).map((r) => ({
        ...r,
        rowIndex: r.rowIndex + indexOffset - 1,
        // convert 1-based → 0-based + offset
        confidence: Math.min(100, Math.max(0, r.confidence)),
        reasoning: r.reasoning?.slice(0, 200) ?? ""
      }));
    } catch (err) {
      attempts++;
      console.error(`[AI Matcher] Attempt ${attempts} failed:`, err.message);
      if (attempts > MAX_RETRIES) {
        console.error("[AI Matcher] All retries exhausted \u2014 returning empty for this batch");
        return [];
      }
      await new Promise((r) => setTimeout(r, attempts * 1e3));
    }
  }
  return [];
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
    let matchResults = matchAllAccounts(parsed.rows);
    if (req.query.useAI === "true" && process.env.ANTHROPIC_API_KEY) {
      try {
        const aiRes = await aiMatchUnresolved(parsed.rows.map((r) => ({ rawLabel: r.rawLabel, closingBalance: r.closingDr - r.closingCr })), session.company, process.env.ANTHROPIC_API_KEY);
        for (let i = 0; i < matchResults.length; i++) {
          const ai = aiRes.find((a) => a.rowIndex === matchResults[i].rowIndex);
          if (ai && ai.confidence > (matchResults[i].confidence ?? 0)) {
            matchResults[i] = {
              ...matchResults[i],
              nfrsCategory: ai.nfrsCategory,
              confidence: ai.confidence,
              method: "ai",
              needsReview: ai.confidence < 80
            };
          }
        }
      } catch (aiErr) {
        console.warn("[trialBalance.upload] AI matching failed, proceeding with deterministic results:", aiErr);
      }
    }
    const rows = parsed.rows.map((raw, i) => {
      const match = matchResults[i];
      return {
        ...raw,
        nfrsCategory: match?.nfrsCategory ?? "unclassified",
        matchedLabel: match?.matchedLabel ?? null,
        confidence: match?.confidence ?? 0,
        matchMethod: match?.method ?? "unmatched",
        needsReview: match?.needsReview ?? true,
        candidates: match?.candidates ?? [],
        closingBalance: raw.closingDr - raw.closingCr
      };
    });
    const tb = {
      ...parsed,
      rows,
      companyId: req.params.companyId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      uploadedFileName: req.file.originalname
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
function normMonthName(name) {
  const map = {
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
  return map[name.toLowerCase().trim()] ?? 0;
}
function parseBSLocal(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\s\-\/]+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0], 10);
  const month = normMonthName(parts[1]);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(year) || month === 0) return null;
  return { day, month, year };
}
var BS_MONTH_DAYS = [0, 31, 32, 31, 30, 30, 30, 30, 30, 30, 31, 32, 31];
function cumulativeDaysBefore(month, isLeap) {
  let total = 0;
  for (let m = 1; m < month; m++) {
    let d = BS_MONTH_DAYS[m] ?? 30;
    if (m === 9 && isLeap) d = 31;
    if (m === 12 && isLeap) d = 32;
    total += d;
  }
  return total;
}
function calculateSLMDepreciation(cost, residualValue, usefulLifeYears, depreciationFraction) {
  if (cost <= 0 || usefulLifeYears <= 0) return 0;
  const depreciableAmount = Math.max(0, cost - residualValue);
  const annual = depreciableAmount / usefulLifeYears;
  return Math.max(0, annual * depreciationFraction);
}
function calculateWDVDepreciation(writtenDownValue, wdvRatePercent, depreciationFraction) {
  if (writtenDownValue <= 0 || wdvRatePercent <= 0) return 0;
  const annual = writtenDownValue * (wdvRatePercent / 100);
  return Math.max(0, annual * depreciationFraction);
}
function computeFraction(purchaseDateBS, fiscalYearBSStart, totalDaysInFY, isLeap) {
  const parsed = parseBSLocal(purchaseDateBS);
  if (!parsed) return 1;
  const { month, year } = parsed;
  const isInCurrentFY = year === fiscalYearBSStart && month >= 1 && month <= 12 || year === fiscalYearBSStart + 1 && month >= 10 && month <= 12;
  if (!isInCurrentFY) {
    return 1;
  }
  const offsetDays = cumulativeDaysBefore(month, isLeap) + (parsed.day - 1);
  const daysRemaining = Math.max(0, totalDaysInFY - offsetDays);
  return Math.min(1, daysRemaining / totalDaysInFY);
}
function taxPool(category) {
  if (!category) return null;
  const name = (category.name ?? category.id ?? "").toLowerCase();
  if (name.includes("building") || name.includes("structure")) return "A";
  if (name.includes("computer") || name.includes("software") || name.includes("intangible")) return "B";
  if (name.includes("vehicle") || name.includes("furniture") || name.includes("fixture")) return "D";
  return "C";
}
function calculateAssetDepreciation(asset, accumDepnOpening, depreciationFraction, wdvRatePercent) {
  const openingCost = asset.originalCost;
  const closingCost = asset.originalCost + asset.additionalCost - (asset.disposalValue ? asset.originalCost : 0);
  const netBookValueOpening = asset.originalCost + asset.additionalCost - accumDepnOpening;
  if (asset.isFullyDepreciated || netBookValueOpening <= asset.residualValue) {
    return {
      assetId: asset.id,
      assetName: asset.assetName,
      categoryId: asset.categoryId,
      openingCost,
      additions: asset.additionalCost,
      disposals: asset.disposalValue ? openingCost : 0,
      closingCost,
      openingAccumDepn: accumDepnOpening,
      depnForYear: 0,
      depnOnDisposal: 0,
      closingAccumDepn: accumDepnOpening,
      netBookValueOpening,
      netBookValueClosing: Math.max(0, netBookValueOpening),
      gainLossOnDisposal: asset.disposalValue ? asset.disposalValue - Math.max(0, netBookValueOpening) : void 0,
      disposalProceeds: asset.disposalValue
    };
  }
  let depnOnDisposal = 0;
  let gainLossOnDisposal;
  let disposalProceeds;
  const hasDisposal = !!asset.disposalDateBS && asset.disposalValue !== void 0;
  let depnForYear = 0;
  if (asset.depreciationMethod === "StraightLine" /* StraightLine */) {
    depnForYear = calculateSLMDepreciation(
      openingCost + asset.additionalCost,
      asset.residualValue,
      asset.usefulLifeYears,
      depreciationFraction
    );
  } else {
    depnForYear = calculateWDVDepreciation(
      netBookValueOpening,
      wdvRatePercent ?? asset.wdvRate ?? 25,
      depreciationFraction
    );
  }
  depnForYear = Math.min(depnForYear, Math.max(0, netBookValueOpening - asset.residualValue));
  if (hasDisposal && asset.disposalValue !== void 0) {
    const disposalFraction = 1 - depreciationFraction;
    if (asset.depreciationMethod === "StraightLine" /* StraightLine */) {
      depnOnDisposal = calculateSLMDepreciation(
        openingCost + asset.additionalCost,
        asset.residualValue,
        asset.usefulLifeYears,
        disposalFraction
      );
    } else {
      depnOnDisposal = calculateWDVDepreciation(
        netBookValueOpening,
        wdvRatePercent ?? asset.wdvRate ?? 25,
        disposalFraction
      );
    }
    const nbvAtDisposal = netBookValueOpening - depnOnDisposal;
    gainLossOnDisposal = asset.disposalValue - nbvAtDisposal;
    disposalProceeds = asset.disposalValue;
  }
  const closingAccumDepn = accumDepnOpening + depnForYear - depnOnDisposal;
  const netBookValueClosing = Math.max(0, closingCost - closingAccumDepn);
  return {
    assetId: asset.id,
    assetName: asset.assetName,
    categoryId: asset.categoryId,
    openingCost,
    netBookValueOpening,
    additions: asset.additionalCost,
    disposals: hasDisposal ? openingCost : 0,
    closingCost,
    openingAccumDepn: accumDepnOpening,
    depnForYear,
    depnOnDisposal,
    closingAccumDepn,
    netBookValueClosing,
    gainLossOnDisposal,
    disposalProceeds
  };
}
function calculateDepreciationSummary(assets, assetCategories, fiscalYear) {
  const fyBSYear = parseInt(fiscalYear.split("/")[0], 10) || 2081;
  const isLeap = [2073, 2076, 2082, 2085, 2088].includes(fyBSYear);
  const totalDaysInFY = isLeap ? 366 : 365;
  const results = [];
  const summaryMap = /* @__PURE__ */ new Map();
  for (const asset of assets) {
    const category = assetCategories.find((c) => c.id === asset.categoryId);
    const fraction = computeFraction(
      asset.purchaseDateBS,
      fyBSYear,
      totalDaysInFY,
      isLeap
    );
    const result = calculateAssetDepreciation(
      asset,
      asset.accumDepreciationOpening,
      fraction,
      asset.wdvRate
    );
    results.push(result);
    const catId = asset.categoryId;
    const catName = category?.name ?? catId;
    if (!summaryMap.has(catId)) {
      summaryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        openingCost: 0,
        additions: 0,
        disposals: 0,
        closingCost: 0,
        openingAccumDepn: 0,
        depnForYear: 0,
        depnOnDisposal: 0,
        closingAccumDepn: 0,
        netBookValueClosing: 0,
        assets: []
      });
    }
    const cat = summaryMap.get(catId);
    cat.openingCost += result.openingCost;
    cat.additions += result.additions;
    cat.disposals += result.disposals;
    cat.closingCost += result.closingCost;
    cat.openingAccumDepn += result.openingAccumDepn;
    cat.depnForYear += result.depnForYear;
    cat.depnOnDisposal += result.depnOnDisposal;
    cat.closingAccumDepn += result.closingAccumDepn;
    cat.netBookValueClosing += result.netBookValueClosing;
    cat.assets.push(result);
  }
  return { results, summary: Array.from(summaryMap.values()) };
}
var TAX_POOL_META = {
  A: { name: "Buildings & Structures", rate: 0.05 },
  B: { name: "Computers, Software & IT", rate: 0.25 },
  C: { name: "Plant, Machinery & Equipment", rate: 0.2 },
  D: { name: "Vehicles, Furniture & Fixtures", rate: 0.15 }
};
function taxProportion(purchaseDateBS) {
  const parsed = parseBSLocal(purchaseDateBS);
  if (!parsed) return 1;
  const { month } = parsed;
  if (month >= 1 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2 / 3;
  return 1 / 3;
}
function calculateTaxDepreciation(assets, assetCategories, openingPoolBases) {
  const pools = {
    A: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
    B: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
    C: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
    D: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 }
  };
  for (const asset of assets) {
    const cat = assetCategories.find((c) => c.id === asset.categoryId);
    const pool = taxPool(cat);
    if (!pool) continue;
    if (asset.additionalCost > 0 || asset.originalCost > 0) {
      const prop = taxProportion(asset.purchaseDateBS);
      const addAmt = asset.additionalCost;
      if (prop >= 0.99) pools[pool].addFull += addAmt;
      else if (prop >= 0.66) pools[pool].addTwoThirds += addAmt;
      else pools[pool].addOneThird += addAmt;
    }
    if (asset.disposalValue !== void 0) {
      pools[pool].disposals += Math.min(asset.originalCost, asset.disposalValue);
    }
  }
  return ["A", "B", "C", "D"].map((p) => {
    const meta = TAX_POOL_META[p];
    const opening = openingPoolBases[p] ?? 0;
    const { addFull, addTwoThirds, addOneThird, disposals } = pools[p];
    const depreciationBasis = opening + addFull + 2 / 3 * addTwoThirds + 1 / 3 * addOneThird - disposals;
    const effectiveBasis = Math.max(0, depreciationBasis);
    const taxDepreciation = effectiveBasis * meta.rate;
    const closingBasis = Math.max(0, effectiveBasis - taxDepreciation);
    return {
      pool: p,
      poolName: meta.name,
      rate: meta.rate,
      openingBasis: opening,
      additionsFullYear: addFull,
      additionsTwoThirds: addTwoThirds,
      additionsOneThird: addOneThird,
      disposals,
      depreciationBasis: effectiveBasis,
      taxDepreciation,
      closingBasis
    };
  });
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

// server/services/financialEngine.ts
function sumCr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory)).reduce((acc, r) => acc + (r.closingCr ?? 0), 0);
}
function sumDr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory)).reduce((acc, r) => acc + (r.closingDr ?? 0), 0);
}
function sumOpeningDr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory)).reduce((acc, r) => acc + (r.openingDr ?? 0), 0);
}
function sumOpeningCr(rows, ...categories) {
  const catSet = new Set(categories);
  return rows.filter((r) => catSet.has(r.nfrsCategory)).reduce((acc, r) => acc + (r.openingCr ?? 0), 0);
}
var round = (n) => Math.round(n * 100) / 100;
function computeBalanceSheet(tb, adj, is, previousYearBS = {}) {
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
  const accumDepnTB = sumCr(rows, "accum_depreciation");
  const totalAccumDepn = accumDepnTB + adj.totalDepreciationExpense;
  const nca_ppe = Math.max(0, grossPPE - totalAccumDepn);
  const investmentNonCurrent = sumDr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent") - adj.investmentAdjustments.reduce((sum, inv) => sum + (inv.impairmentAmount ?? 0), 0);
  const nca_investments = Math.max(0, investmentNonCurrent);
  const nca_receivables = Math.max(
    0,
    sumDr(rows, "nca_deposits", "nca_loans_advances")
  );
  const nca_other = Math.max(0, sumDr(rows, "other_noncurrent_assets"));
  const totalNonCurrentAssets = round(nca_ppe + nca_investments + nca_receivables + nca_other);
  const ca_investments = 0;
  const grossInventory = sumDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods");
  const ca_inventories = Math.max(0, grossInventory - adj.totalInventoryImpairment);
  const tradeRec = sumDr(rows, "trade_receivables");
  const impairmentOnRec = sumCr(rows, "provision_impairment_debtors");
  const otherRec = sumDr(
    rows,
    "other_receivables_advance_supplier",
    "other_receivables_prepayments",
    "other_receivables_staff_advance",
    "other_receivables_tds",
    "other_receivables_loans"
  );
  const ca_tradeReceivables = Math.max(0, tradeRec - impairmentOnRec + otherRec);
  const ca_cashAndEquivalents = Math.max(
    0,
    sumDr(rows, "cash_in_hand", "bank_current_account", "bank_fixed_deposit_current") - sumCr(rows, "bank_current_account")
    // overdraft offsets bank balance
  );
  const ca_other = Math.max(0, sumDr(rows, "other_current_assets"));
  const totalCurrentAssets = round(ca_investments + ca_inventories + ca_tradeReceivables + ca_cashAndEquivalents + ca_other);
  const totalAssets = round(totalNonCurrentAssets + totalCurrentAssets);
  const eq_shareCapital = round(sumCr(rows, "share_capital", "share_premium"));
  const eq_reserves = round(sumCr(rows, "general_reserve"));
  const openingRetained = sumOpeningCr(rows, "retained_earnings");
  const eq_retainedEarnings = round(sumCr(rows, "retained_earnings") + is.netProfit);
  const totalEquity = round(eq_shareCapital + eq_reserves + eq_retainedEarnings);
  const ncl_borrowings = round(sumCr(rows, "borrowings_noncurrent_bank"));
  const ncl_employeeBenefits = 0;
  const ncl_provisions = 0;
  const ncl_deferredTax = 0;
  const totalNonCurrentLiabilities = round(ncl_borrowings + ncl_employeeBenefits + ncl_provisions + ncl_deferredTax);
  const cl_borrowings = round(
    sumCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc")
  );
  const cl_tradePayables = round(
    sumCr(rows, "trade_payables_creditors", "tds_payable", "other_payables", "audit_fee_payable", "trade_payables_advance_customers")
  );
  const incomeTaxPayable = round(sumCr(rows, "income_tax_payable") + is.incomeTaxExpense);
  const advanceTax = round(sumDr(rows, "other_receivables_tds"));
  const cl_incomeTaxPayable = round(Math.max(0, incomeTaxPayable - advanceTax));
  const cl_provisions = round(
    sumCr(rows, "employee_payables_pf", "employee_payables_bonus", "employee_payables_salary") + is.staffBonus
  );
  const cl_other = 0;
  const totalCurrentLiabilities = round(cl_borrowings + cl_tradePayables + cl_incomeTaxPayable + cl_provisions + cl_other);
  const totalEquityAndLiabilities = round(totalEquity + totalNonCurrentLiabilities + totalCurrentLiabilities);
  const checkDifference = round(totalAssets - totalEquityAndLiabilities);
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
    // Previous year fields
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
function computeIncomeStatement(tb, adj, accountingPolicies, previousYearIS = {}) {
  const rows = tb.rows;
  const revenue = round(sumCr(rows, "revenue_sales", "revenue_services"));
  const interestIncome = round(sumCr(rows, "other_income_interest"));
  const otherIncomeTB = round(
    sumCr(rows, "other_income_dividend", "other_income_rental", "other_income_misc", "other_income_disposal_gain")
  );
  const otherIncome = round(otherIncomeTB + adj.gainOnDisposals);
  const totalIncome = round(revenue + interestIncome + otherIncome);
  const openingStock = round(
    sumOpeningDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods")
  );
  const purchases = round(sumDr(rows, "cogs_purchases", "cogs_opening_stock"));
  const closingStock = round(
    sumDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods")
  );
  const materialConsumed = round(openingStock + purchases - closingStock);
  const directExpenses = round(sumDr(rows, "direct_wages", "direct_expenses_other"));
  const employeeSalaries = round(sumDr(rows, "emp_expense_salaries", "emp_expense_pf", "emp_expense_gratuity", "emp_expense_welfare"));
  const provisionExpenses = adj.provisions.filter((p) => p.provisionType === "gratuity" || p.provisionType === "leave_encashment").reduce((sum, p) => sum + p.additionForYear, 0);
  const employeeBenefitExpense = round(employeeSalaries + provisionExpenses);
  const financeCharges = round(sumDr(rows, "finance_cost_interest", "finance_cost_bank_charges"));
  const depreciation = round(adj.totalDepreciationExpense);
  const impairmentTB = round(sumDr(rows, "impairment_expense"));
  const impairment = round(impairmentTB + adj.totalInventoryImpairment);
  const adminAndOtherExpenses = round(
    sumDr(
      rows,
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
    )
  );
  const totalExpenses = round(materialConsumed + directExpenses + employeeBenefitExpense + financeCharges + depreciation + impairment + adminAndOtherExpenses);
  const profitBeforeStaffBonus = round(totalIncome - totalExpenses);
  const bonusRate = (accountingPolicies.bonusRatePercent ?? 10) / 100;
  const staffBonus = round(
    profitBeforeStaffBonus > 0 ? profitBeforeStaffBonus * bonusRate : 0
  );
  const profitBeforeTax = round(profitBeforeStaffBonus - staffBonus);
  const taxFromAdj = adj.currentTaxExpense ?? 0;
  const taxFromTB = round(sumDr(rows, "income_tax_expense"));
  const incomeTaxExpense = round(taxFromAdj > 0 ? taxFromAdj : taxFromTB);
  const netProfit = round(profitBeforeTax - incomeTaxExpense);
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
    // Previous year
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
function computeChangesInEquity(tb, is, _company) {
  const rows = tb.rows;
  const openingShareCapital = round(sumOpeningCr(rows, "share_capital"));
  const openingSharePremium = round(sumOpeningCr(rows, "share_premium"));
  const openingGeneralReserve = round(sumOpeningCr(rows, "general_reserve"));
  const openingRetainedEarnings = round(sumOpeningCr(rows, "retained_earnings"));
  const openingTotal = round(openingShareCapital + openingSharePremium + openingGeneralReserve + openingRetainedEarnings);
  const addProfitForYear = round(is.netProfit);
  const addNewShareCapital = round(sumCr(rows, "share_capital") - sumOpeningCr(rows, "share_capital"));
  const addSharePremiumOnNewIssue = round(sumCr(rows, "share_premium") - openingSharePremium);
  const addTransferToReserve = 0;
  const lessTransferFromReserve = 0;
  const lessDividendPaid = 0;
  const lessBonusShareIssued = 0;
  const closingShareCapital = round(sumCr(rows, "share_capital"));
  const closingSharePremium = round(sumCr(rows, "share_premium"));
  const closingGeneralReserve = round(sumCr(rows, "general_reserve"));
  const closingRetainedEarnings = round(openingRetainedEarnings + addProfitForYear - lessDividendPaid);
  const closingTotal = round(closingShareCapital + closingSharePremium + closingGeneralReserve + closingRetainedEarnings);
  return {
    cyOpeningShareCapital: openingShareCapital,
    cyOpeningSharePremium: openingSharePremium,
    cyOpeningGeneralReserve: openingGeneralReserve,
    cyOpeningRetainedEarnings: openingRetainedEarnings,
    cyOpeningTotal: openingTotal,
    cyNetProfit: addProfitForYear,
    cyShareCapitalIssued: addNewShareCapital,
    cySharePremiumReceived: addSharePremiumOnNewIssue,
    cyTransferToReserve: addTransferToReserve,
    cyDividends: lessDividendPaid,
    cyClosingShareCapital: closingShareCapital,
    cyClosingSharePremium: closingSharePremium,
    cyClosingGeneralReserve: closingGeneralReserve,
    cyClosingRetainedEarnings: closingRetainedEarnings,
    cyClosingTotal: closingTotal
  };
}
function computeCashFlow(tb, bs, is, adj) {
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
  const closingRec = bs.ca_tradeReceivables;
  const openingRec = round(
    sumOpeningDr(
      rows,
      "trade_receivables",
      "other_receivables_advance_supplier",
      "other_receivables_prepayments",
      "other_receivables_staff_advance",
      "other_receivables_loans"
    )
  );
  const decreaseIncreaseReceivables = round(openingRec - closingRec);
  const closingInv = bs.ca_inventories;
  const openingInv = round(
    sumOpeningDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods")
  );
  const decreaseIncreaseInventory = round(openingInv - closingInv);
  const decreaseIncreaseOtherCurrentAssets = round(
    sumOpeningDr(rows, "other_current_assets") - bs.ca_other
  );
  const closingPayables = bs.cl_tradePayables;
  const openingPayables = round(
    sumOpeningCr(rows, "trade_payables_creditors", "tds_payable", "other_payables", "audit_fee_payable")
  );
  const increaseDecreasePayables = round(closingPayables - openingPayables);
  const increaseDecreaseIncomeTaxPayable = round(bs.cl_incomeTaxPayable - sumOpeningCr(rows, "income_tax_payable"));
  const increaseDecreaseEmployeeLiability = round(
    sumCr(rows, "employee_payables_pf", "employee_payables_bonus", "employee_payables_salary") - sumOpeningCr(rows, "employee_payables_pf", "employee_payables_bonus", "employee_payables_salary")
  );
  const increaseDecreaseProvisions = 0;
  const cashGeneratedFromOperations = round(
    profitBeforeTax + addDepreciation + addImpairment + lessInterestIncome + lessDividendIncome + addInterestExpense + addLossOnDisposal + lessGainOnDisposal + addFVLossOnInvestment + lessFVGainOnInvestment + decreaseIncreaseReceivables + decreaseIncreaseInventory + decreaseIncreaseOtherCurrentAssets + increaseDecreasePayables + increaseDecreaseIncomeTaxPayable + increaseDecreaseEmployeeLiability + increaseDecreaseProvisions
  );
  const interestPaid = -Math.abs(is.financeCharges);
  const incomeTaxPaid = -Math.abs(is.incomeTaxExpense);
  const netCashFromOperating = round(cashGeneratedFromOperations + interestPaid + incomeTaxPaid);
  const proceedsFromPPEDisposal = adj.depreciationResults.reduce((s, r) => s + (r.disposalProceeds ?? 0), 0);
  const proceedsFromInvestmentDisposal = 0;
  const interestReceived = is.interestIncome;
  const dividendReceived = Math.abs(lessDividendIncome);
  const purchaseOfPPE = -adj.assets.reduce((s, a) => s + (a.additionalCost ?? 0), 0);
  const purchaseOfInvestments = -(sumDr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent") - sumOpeningDr(rows, "investment_listed_trading", "investment_unlisted", "investment_fixed_deposit_noncurrent"));
  const netCashFromInvesting = round(
    proceedsFromPPEDisposal + proceedsFromInvestmentDisposal + interestReceived + dividendReceived + purchaseOfPPE + purchaseOfInvestments
  );
  const proceedsFromShareIssue = round(
    sumCr(rows, "share_capital") - sumOpeningCr(rows, "share_capital") + sumCr(rows, "share_premium") - sumOpeningCr(rows, "share_premium")
  );
  const proceedsFromBorrowingsNonCurrent = round(
    Math.max(0, sumCr(rows, "borrowings_noncurrent_bank") - sumOpeningCr(rows, "borrowings_noncurrent_bank"))
  );
  const repaymentOfBorrowingsNonCurrent = round(
    Math.min(0, sumCr(rows, "borrowings_noncurrent_bank") - sumOpeningCr(rows, "borrowings_noncurrent_bank"))
  );
  const proceedsFromBorrowingsCurrent = round(
    Math.max(0, sumCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc") - sumOpeningCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc"))
  );
  const repaymentOfBorrowingsCurrent = round(
    Math.min(0, sumCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc") - sumOpeningCr(rows, "borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc"))
  );
  const dividendPaid = 0;
  const netCashFromFinancing = round(
    proceedsFromShareIssue + proceedsFromBorrowingsNonCurrent + repaymentOfBorrowingsNonCurrent + proceedsFromBorrowingsCurrent + repaymentOfBorrowingsCurrent + dividendPaid
  );
  const netIncreaseDecrease = round(netCashFromOperating + netCashFromInvesting + netCashFromFinancing);
  const openingCash = round(
    sumOpeningDr(rows, "cash_in_hand", "bank_current_account", "bank_fixed_deposit_current") - sumOpeningCr(rows, "bank_current_account")
    // opening overdraft offset
  );
  const closingCash = bs.ca_cashAndEquivalents;
  const reconciliationDifference = round(closingCash - (openingCash + netIncreaseDecrease));
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
    reconciliationDifference
  };
}
function computeNotesData(tb, adj, bs, is) {
  const rows = tb.rows;
  const categoryRecord = (cats) => {
    const out = {};
    for (const row of rows) {
      if (cats.includes(row.nfrsCategory)) {
        const net = round((row.closingCr ?? 0) - (row.closingDr ?? 0));
        const existing = out[row.rawLabel] ?? { cy: 0, py: 0 };
        out[row.rawLabel] = { cy: round(existing.cy + net), py: 0 };
      }
    }
    return out;
  };
  const expenseRecord = (cats) => {
    const out = {};
    for (const row of rows) {
      if (cats.includes(row.nfrsCategory)) {
        const net = round((row.closingDr ?? 0) - (row.closingCr ?? 0));
        const existing = out[row.rawLabel] ?? { cy: 0, py: 0 };
        out[row.rawLabel] = { cy: round(existing.cy + net), py: 0 };
      }
    }
    return out;
  };
  return {
    note31_ppe: adj.depreciationSummary,
    note32_investments: {
      listedShares: adj.investmentAdjustments.filter(
        (i) => i.investmentType === "listed_trading" || i.investmentType === "listed_ats"
      ),
      otherInvestments: adj.investmentAdjustments.filter((i) => i.investmentType === "unlisted")
    },
    note33_tradeReceivables: {
      grossReceivables_cy: round(sumDr(rows, "trade_receivables")),
      grossReceivables_py: 0,
      provisionForImpairment_cy: round(sumCr(rows, "provision_impairment_debtors")),
      provisionForImpairment_py: 0,
      netReceivables_cy: bs.ca_tradeReceivables,
      netReceivables_py: 0
    },
    note34_otherReceivables: {
      "Loans and Advances": { cy: round(sumDr(rows, "other_receivables_loans", "nca_loans_advances")), py: 0 },
      "Prepayments": { cy: round(sumDr(rows, "other_receivables_prepayments")), py: 0 },
      "Deposits": { cy: round(sumDr(rows, "nca_deposits")), py: 0 },
      "Staff Advances": { cy: round(sumDr(rows, "other_receivables_staff_advance")), py: 0 },
      "Advance to Suppliers": { cy: round(sumDr(rows, "other_receivables_advance_supplier")), py: 0 }
    },
    note35_otherNonCurrentAssets: { "Other Non-Current Assets": { cy: bs.nca_other, py: 0 } },
    note36_otherCurrentAssets: { "Other Current Assets": { cy: bs.ca_other, py: 0 } },
    note37_inventories: {
      rawMaterials_cy: round(sumDr(rows, "inventory_raw_materials")),
      rawMaterials_py: 0,
      wip_cy: round(sumDr(rows, "inventory_wip")),
      wip_py: 0,
      finishedGoods_cy: round(sumDr(rows, "inventory_finished_goods")),
      finishedGoods_py: 0,
      totalInventory_cy: bs.ca_inventories,
      totalInventory_py: 0,
      impairmentRecognized_cy: adj.totalInventoryImpairment
    },
    note38_cashAndEquivalents: {
      cashInHand_cy: round(sumDr(rows, "cash_in_hand")),
      cashInHand_py: 0,
      bankBalances: rows.filter((r) => ["bank_current_account", "bank_fixed_deposit_current"].includes(r.nfrsCategory)).map((r) => ({
        bankName: r.rawLabel,
        accountType: r.nfrsCategory === "bank_fixed_deposit_current" ? "fixed_deposit" : "current",
        cy: round((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        py: 0
      })),
      totalCash_cy: bs.ca_cashAndEquivalents,
      totalCash_py: 0
    },
    note39_shareCapital: {
      authorizedShares: 0,
      faceValuePerShare: 100,
      issuedShares: 0,
      paidUpShares: 0,
      paidUpAmount_cy: round(sumCr(rows, "share_capital")),
      paidUpAmount_py: round(sumOpeningCr(rows, "share_capital"))
    },
    note310_reserves: {
      "General Reserve": {
        openingCY: round(sumOpeningCr(rows, "general_reserve")),
        additionCY: 0,
        closingCY: round(sumCr(rows, "general_reserve")),
        py: round(sumOpeningCr(rows, "general_reserve"))
      },
      "Retained Earnings": {
        openingCY: round(sumOpeningCr(rows, "retained_earnings")),
        additionCY: is.netProfit,
        closingCY: round(sumCr(rows, "retained_earnings")),
        py: round(sumOpeningCr(rows, "retained_earnings"))
      }
    },
    note311_borrowings: {
      nonCurrentBank: rows.filter((r) => r.nfrsCategory === "borrowings_noncurrent_bank").map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: round(r.closingCr ?? 0),
        amount_py: round(r.openingCr ?? 0),
        interestRate: 0,
        security: ""
      })),
      currentLoans: rows.filter(
        (r) => ["borrowings_current_od", "borrowings_current_cc", "borrowings_current_wc"].includes(r.nfrsCategory)
      ).map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: round(r.closingCr ?? 0),
        amount_py: round(r.openingCr ?? 0),
        loanType: r.nfrsCategory
      }))
    },
    note312_employeeBenefits: {
      "Salary Payable": {
        opening: round(sumOpeningCr(rows, "employee_payables_salary")),
        expense: is.employeeBenefitExpense,
        paid: 0,
        closing: round(sumCr(rows, "employee_payables_salary"))
      },
      "Bonus Payable": {
        opening: round(sumOpeningCr(rows, "employee_payables_bonus")),
        expense: is.staffBonus,
        paid: 0,
        closing: round(sumCr(rows, "employee_payables_bonus"))
      }
    },
    note313_tradePayables: {
      "Trade Payables": { cy: round(sumCr(rows, "trade_payables_creditors")), py: round(sumOpeningCr(rows, "trade_payables_creditors")) },
      "TDS Payable": { cy: round(sumCr(rows, "tds_payable")), py: round(sumOpeningCr(rows, "tds_payable")) },
      "VAT Payable": { cy: round(sumCr(rows, "other_payables")), py: round(sumOpeningCr(rows, "other_payables")) },
      "Audit Fee Payable": { cy: round(sumCr(rows, "audit_fee_payable")), py: round(sumOpeningCr(rows, "audit_fee_payable")) }
    },
    note314_provisions: adj.provisions,
    note317_revenue: {
      "Sale of Goods": { cy: round(sumCr(rows, "revenue_sales")), py: 0 },
      "Rendering of Services": { cy: round(sumCr(rows, "revenue_services")), py: 0 },
      "Interest Income": { cy: is.interestIncome, py: 0 },
      "Other Income": { cy: is.otherIncome, py: 0 }
    },
    note318_materialConsumed: {
      openingInventory: round(sumOpeningDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods")),
      purchases: round(sumDr(rows, "cogs_purchases")),
      closingInventory: round(sumDr(rows, "inventory_raw_materials", "inventory_wip", "inventory_finished_goods")),
      consumed: is.materialConsumed
    },
    note319_directExpenses: expenseRecord(["direct_wages", "direct_expenses_other"]),
    note320_employeeBenefitExpenses: expenseRecord([
      "emp_expense_salaries",
      "emp_expense_pf",
      "emp_expense_gratuity",
      "emp_expense_welfare",
      "emp_expense_bonus"
    ]),
    note321_impairment: [
      { description: "Impairment on Trade Receivables", cy: round(sumDr(rows, "impairment_expense")), py: 0 },
      { description: "Inventory Write-down", cy: adj.totalInventoryImpairment, py: 0 },
      { description: "Investment Impairment", cy: adj.investmentAdjustments.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0), py: 0 }
    ],
    note322_adminExpenses: expenseRecord([
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
    ]),
    note323_incomeTax: {
      currentTax: is.incomeTaxExpense,
      profitBeforeTax: is.profitBeforeTax,
      taxRate: (adj.currentTaxExpense ?? 0) > 0 && is.profitBeforeTax > 0 ? adj.currentTaxExpense / is.profitBeforeTax : 0.25,
      addDisallowableExpenses: {},
      lessAllowableExpenses: {
        "Tax Depreciation (excess over book)": Math.max(
          0,
          adj.taxDepreciationPools.reduce((s, p) => s + p.taxDepreciation, 0) - adj.totalDepreciationExpense
        )
      },
      taxableIncome: adj.taxableProfit ?? is.profitBeforeTax,
      advanceTaxPaid: round(sumDr(rows, "other_receivables_tds")),
      tdsCreditAvailable: 0,
      netTaxPayable: bs.cl_incomeTaxPayable
    }
  };
}
function computeAllFinancials(tb, adj, company, previousYearData) {
  const policies = company.accountingPolicies ?? {
    bonusRatePercent: 10,
    incomeTaxRatePercent: 25,
    gratuityDaysPerYear: 15,
    roundingLevel: 100,
    assetCategories: [],
    depreciationMethod: "StraightLine"
  };
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
  const incomeStatement = computeIncomeStatement(
    tb,
    adj,
    policies,
    pyIS
  );
  const balanceSheet = computeBalanceSheet(
    tb,
    adj,
    incomeStatement,
    pyBS
  );
  const changesInEquity = computeChangesInEquity(tb, incomeStatement, company);
  const cashFlow = computeCashFlow(tb, balanceSheet, incomeStatement, adj);
  const notes = computeNotesData(tb, adj, balanceSheet, incomeStatement);
  return { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes };
}

// server/routes/financials.ts
var router4 = Router4();
router4.post("/:companyId/generate", asyncHandler(async (req, res) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const missing = [];
  if (!session?.company) missing.push("company profile");
  if (!session?.trialBalance) missing.push("trial balance");
  if (!session?.adjustments) missing.push("year-end adjustments");
  if (missing.length > 0) return res.status(400).json({ error: `Missing data: ${missing.join(", ")}.` });
  const result = computeAllFinancials(session.trialBalance, session.adjustments, session.company, session.company.previousYearData);
  sessionStore.set(req.params.companyId, {
    adjustments: { ...session.adjustments, taxableProfit: result.incomeStatement.profitBeforeTax, currentTaxExpense: result.incomeStatement.incomeTaxExpense },
    financials: result
  });
  session.financials = result;
  return res.json(result);
}));
router4.get("/:companyId/balance-sheet", asyncHandler(async (req, res) => {
  const s = sessionStore.get(req.params.companyId);
  if (!s?.financials?.balanceSheet) return res.status(404).json({ error: "Not generated yet." });
  return res.json(s.financials.balanceSheet);
}));
router4.get("/:companyId/income-statement", asyncHandler(async (req, res) => {
  const s = sessionStore.get(req.params.companyId);
  if (!s?.financials?.incomeStatement) return res.status(404).json({ error: "Not generated yet." });
  return res.json(s.financials.incomeStatement);
}));
router4.get("/:companyId/cash-flow", asyncHandler(async (req, res) => {
  const s = sessionStore.get(req.params.companyId);
  if (!s?.financials?.cashFlow) return res.status(404).json({ error: "Not generated yet." });
  return res.json(s.financials.cashFlow);
}));
router4.get("/:companyId/changes-in-equity", asyncHandler(async (req, res) => {
  const s = sessionStore.get(req.params.companyId);
  if (!s?.financials?.changesInEquity) return res.status(404).json({ error: "Not generated yet." });
  return res.json(s.financials.changesInEquity);
}));
router4.get("/:companyId/notes", asyncHandler(async (req, res) => {
  const s = sessionStore.get(req.params.companyId);
  if (!s?.financials?.notes) return res.status(404).json({ error: "Not generated yet." });
  return res.json(s.financials.notes);
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
      fy.bsYear,
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
    { label: "Fiscal Year", value: company.fiscalYear?.bsYear ?? "", name: "FiscalYear" },
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
    ["Fiscal Year", company.fiscalYear?.bsYear ?? ""],
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
  const fy = company.fiscalYear?.bsYear ?? "";
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
    fiscalYear: company.fiscalYear?.bsYear ?? "",
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
  const fy = company.fiscalYear?.bsYear ?? "";
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
    fiscalYear: company.fiscalYear?.bsYear ?? "",
    roundingLevel: 100
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = { oddHeader: `&C${company.companyName ?? ""}`, oddFooter: "&CPage &P of &N" };
}
function writeCashFlowStatement(ws, cf, company) {
  ws.columns = [{ width: 50 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsYear ?? "";
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
  const fy = company.fiscalYear?.bsYear ?? "";
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
  const rows = [
    ["Authorised Share Capital (shares)", note39.authorizedShares],
    ["Issued and Fully Paid Shares (shares)", note39.issuedShares],
    ["Paid-up Capital (NPR)", note39.paidUpAmount_cy]
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
  note311.nonCurrentBank?.forEach((b) => {
    const row = ws.getRow(r++);
    [b.lenderName, `${b.interestRate ?? 0}%`, b.security ?? "", b.amount_cy, b.amount_py].forEach((v, i) => {
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
  note311.currentLoans?.forEach((b) => {
    const row = ws.getRow(r++);
    [b.lenderName, b.loanType ?? "", "", b.amount_cy, b.amount_py].forEach((v, i) => {
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
      fiscalYear: company.fiscalYear?.bsYear ?? ""
    });
    writeNote2_CriticalJudgments(wb, {
      companyName: company.companyName ?? "",
      fiscalYear: company.fiscalYear?.bsYear ?? ""
    });
    writeNote31_PPE(addSheet("Note 3.1 - PPE", "16A34A"), notes.note31_ppe);
    writeGenericNoteRecord(addSheet("Note 3.2 - Investments", "16A34A"), "3.2  Investments", {});
    writeGenericNoteRecord(addSheet("Note 3.3 - Receivables", "16A34A"), "3.3  Trade Receivables", { "Net Trade Receivables": { cy: notes.note33_tradeReceivables.netReceivables_cy, py: notes.note33_tradeReceivables.netReceivables_py } });
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
      (notes.note321_impairment ?? []).map((n) => [n.description, { cy: n.cy, py: n.py }])
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
    version: "1.0.0",
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
var SESSION_MAX_AGE_HOURS = 24;
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
