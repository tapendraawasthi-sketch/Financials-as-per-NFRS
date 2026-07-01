// ===== tbImportParser.ts =====
// Flexible raw trial balance importer. Accepts CSV or XLSX uploads in ANY reasonable column
// layout (not necessarily matching the master template's own Trial Balance sheet layout) and
// extracts {label, debit, credit} rows for downstream classification.
//
// Deterministic only: header detection, numeric coercion, Dr/Cr netting, footing check.
// No AI involvement in this file.

import ExcelJS from "exceljs";

export interface RawTBRow {
  rowIndex: number;
  label: string;
  debit: number;
  credit: number;
}

export interface RawTBParseResult {
  rows: RawTBRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
  warnings: string[];
}

const HEADER_LABEL_HINTS = ["particular", "account", "ledger", "description", "head", "name"];
const HEADER_DEBIT_HINTS = ["debit", "dr", "dr.", "dr amount"];
const HEADER_CREDIT_HINTS = ["credit", "cr", "cr.", "cr amount"];

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/,/g, "").replace(/\s/g, "");
  const isParenNegative = /^\(.*\)$/.test(cleaned);
  const stripped = cleaned.replace(/[()]/g, "");
  const num = parseFloat(stripped);
  if (isNaN(num)) return 0;
  return isParenNegative ? -num : num;
}

/**
 * Scans the first few rows of a 2D array to find the header row and identify
 * which column index holds the account label, debit amount, and credit amount.
 * Falls back to a 3-column assumption (label, debit, credit) if headers are unclear.
 */
function detectColumns(matrix: any[][]): { headerRowIndex: number; labelCol: number; debitCol: number; creditCol: number } | null {
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

export async function parseRawTrialBalance(buffer: Buffer, filename: string): Promise<RawTBParseResult> {
  const warnings: string[] = [];
  let matrix: any[][] = [];

  const isCsv = filename.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const text = buffer.toString("utf-8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    matrix = lines.map((line) => {
      // Simple CSV split respecting quoted fields
      const cells: string[] = [];
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
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.worksheets[0];
    if (!ws) {
      return { rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true, difference: 0, warnings: ["Uploaded workbook has no worksheets."] };
    }
    ws.eachRow({ includeEmpty: true }, (row) => {
      const rowValues: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        if (v !== null && typeof v === "object" && "richText" in (v as any)) {
          rowValues.push((v as any).richText.map((t: any) => t.text).join(""));
        } else if (v !== null && typeof v === "object" && "result" in (v as any)) {
          rowValues.push((v as any).result);
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
      "Could not confidently detect header row (expected columns like 'Particulars/Account', 'Debit', 'Credit'). " +
      "Falling back to assuming column A = account name, column B = debit, column C = credit. Please verify results carefully."
    );
  }

  const rows: RawTBRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (let r = startRow; r < matrix.length; r++) {
    const rowData = matrix[r] || [];
    const rawLabel = rowData[labelCol];
    const label = rawLabel === null || rawLabel === undefined ? "" : String(rawLabel).trim();

    if (!label) continue;
    // Skip obvious total/subtotal rows so they don't get double-counted as an account
    if (/^(total|grand total|sub ?total)\b/i.test(label)) continue;

    const debit = toNumber(rowData[debitCol]);
    const credit = toNumber(rowData[creditCol]);

    if (debit === 0 && credit === 0) continue; // skip blank/zero rows

    rows.push({ rowIndex: r, label, debit, credit });
    totalDebit += debit;
    totalCredit += credit;
  }

  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = Math.abs(difference) < 1.0; // tolerance of NPR 1 for rounding

  if (!isBalanced) {
    warnings.push(
      `Trial balance does NOT foot: total debit ${totalDebit.toLocaleString()} vs total credit ` +
      `${totalCredit.toLocaleString()} (difference ${difference.toLocaleString()}). ` +
      `Review the uploaded file before proceeding -- this must be resolved before financials can be generated.`
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
    warnings,
  };
}
