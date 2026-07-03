// Trial balance parser — accepts XLSX, XLS, or CSV in ANY reasonable
// column layout, auto-detects headers, and returns a normalised row set
// with six column pairs (opening, during, adjustment — Dr and Cr each).
//
// Enhanced to handle:
//   - Indent-based hierarchy (Tally, Swastik, Business Accountant Nepal)
//   - Tally Prime export format
//   - Simple net balance format (3-column)
//   - Single net balance column format
//   - Parent group context tracking
//   - Enhanced validation and balance checks

import ExcelJS from 'exceljs';
import type { RawTBRow, RawTBParseResult } from '../../src/types/trialBalance.js';

export type { RawTBRow, RawTBParseResult };

// ---------------------------------------------------------------------------
// Column-header keyword dictionaries
// ---------------------------------------------------------------------------
const COL_HINTS: Record<string, string[]> = {
  label: [
    'particular', 'account', 'ledger', 'description', 'head', 'name', 'title', 'narration',
    'particulars', 'ledger name', 'account name', 'account head',
  ],
  openingDr: [
    'opening dr', 'op dr', 'opening debit', 'op debit', 'opening balance dr', 'opn dr',
    'opening balance dr', 'op balance dr', 'opening bal dr', 'ob dr', 'opening',
    'open dr', 'open debit', 'opening dr balance',
  ],
  openingCr: [
    'opening cr', 'op cr', 'opening credit', 'op credit', 'opening balance cr', 'opn cr',
    'opening balance cr', 'op balance cr', 'opening bal cr', 'ob cr',
    'open cr', 'open credit', 'opening cr balance',
  ],
  duringDr: [
    'during dr', 'transaction dr', 'dur dr', 'movement dr', 'during year dr',
    'receipt', 'dr total', 'transaction debit', 'total debit', 'transactions dr',
    'during period dr', 'period dr',
    // bare 'debit' / 'dr' intentionally omitted — too ambiguous with closing columns
  ],
  duringCr: [
    'during cr', 'transaction cr', 'dur cr', 'movement cr', 'during year cr',
    'payment', 'cr total', 'transaction credit', 'total credit', 'transactions cr',
    'during period cr', 'period cr',
    // bare 'credit' / 'cr' intentionally omitted — too ambiguous with closing columns
  ],
  adjustmentDr: [
    'adj dr', 'adjustment dr', 'year end adj dr', 'adjustment debit', 'jv dr',
    'adjustments dr', 'year-end dr',
  ],
  adjustmentCr: [
    'adj cr', 'adjustment cr', 'year end adj cr', 'adjustment credit', 'jv cr',
    'adjustments cr', 'year-end cr',
  ],
  closingDr: [
    'closing dr', 'balance dr', 'closing debit', 'net dr', 'closing balance dr',
    'closing balance dr', 'cl balance dr', 'closing bal dr', 'cb dr', 'balance dr',
    'close dr', 'closing debit balance', 'cl dr', 'debit balance',
  ],
  closingCr: [
    'closing cr', 'balance cr', 'closing credit', 'net cr', 'closing balance cr',
    'closing balance cr', 'cl balance cr', 'closing bal cr', 'cb cr', 'balance cr',
    'close cr', 'closing credit balance', 'cl cr', 'credit balance',
  ],
};

/** Subtotal row label patterns to skip (will generate a warning). */
const SUBTOTAL_PATTERNS = /^(total|grand total|sum|sub.?total|net total|account total)/i;

// ---------------------------------------------------------------------------
// Utility: toNumber
// ---------------------------------------------------------------------------
function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  const isNeg = /^\(.*\)$/.test(str);
  const cleaned = str
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/[()]/g, '')
    .replace(/NPR/gi, '')
    .replace(/Rs\.?/gi, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNeg ? -Math.abs(num) : num;
}

// ---------------------------------------------------------------------------
// Utility: normalise a cell value to a lower-case string for matching
// ---------------------------------------------------------------------------
function normCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Utility: count leading whitespace (spaces or tab-equivalents)
// ---------------------------------------------------------------------------
function countLeadingSpaces(label: string): number {
  const match = label.match(/^(\s+)/);
  if (!match) return 0;
  // Count tabs as 4 spaces each
  return match[1].replace(/\t/g, '    ').length;
}

// ---------------------------------------------------------------------------
// Detect row level based on indentation and amount presence
// ---------------------------------------------------------------------------
/**
 * Determines if a row is a group/parent row or a leaf ledger row.
 * 
 * Logic:
 *  - Count leading whitespace in the label
 *  - Check if all amount columns are empty/zero
 *  - Return: rowLevel (0=group, 1=subgroup, 2=leaf), isGroupRow, rawIndentSpaces
 */
function detectRowLevel(
  label: string,
  amounts: number[],
  isBold = false,
): { rowLevel: number; isGroupRow: boolean; rawIndentSpaces: number } {
  const rawIndentSpaces = countLeadingSpaces(label);
  const trimmed = label.trim();
  const hasAnyAmount = amounts.some((a) => a !== 0);

  const isGroupRow =
  (rawIndentSpaces === 0 && !hasAnyAmount) ||
  KNOWN_GROUP_NAMES.test(trimmed) ||
  (isBold && !hasAnyAmount);

  const rowLevel = isGroupRow ? 0 : rawIndentSpaces > 0 ? 1 : 2;

  return { rowLevel, isGroupRow, rawIndentSpaces };
}

// ---------------------------------------------------------------------------
// Header detection — scans first MAX_HEADER_SCAN rows for keyword matches
// ---------------------------------------------------------------------------
const MAX_HEADER_SCAN = 25;

const KNOWN_GROUP_NAMES = /^(capital account|non.?current liabilities?|current liabilities?|property.? plant|direct income|indirect income|employee benefit|administrative expenses?|sundry debtors?|sundry creditors?|fixed assets?|current assets?|equity|expenses?|income|loans?|investments?|provisions?)/i;

/** Map bare "debit"/"credit" or "dr"/"cr" headers to closing columns in simple layouts. */
function resolveAmbiguousClosingColumns(
  row: unknown[],
  colMap: Record<string, number>,
): Record<string, number> {
  const cells = row.map((c) => normCell(c));
  const resolved = { ...colMap };

  const hasClosing =
    resolved.closingDr !== undefined || resolved.closingCr !== undefined;
  const hasDuring = resolved.duringDr !== undefined || resolved.duringCr !== undefined;
  const hasOpening =
    resolved.openingDr !== undefined || resolved.openingCr !== undefined;
  const hasAdjustment =
    resolved.adjustmentDr !== undefined || resolved.adjustmentCr !== undefined;

  // Simple Account | Dr | Cr exports: only label + two amount columns
  if (!hasClosing && hasDuring && !hasOpening && !hasAdjustment) {
    const amountFields = ['duringDr', 'duringCr'] as const;
    const amountCount = amountFields.filter((f) => resolved[f] !== undefined).length;
    if (amountCount === 2) {
      resolved.closingDr = resolved.duringDr;
      resolved.closingCr = resolved.duringCr;
      delete resolved.duringDr;
      delete resolved.duringCr;
      return resolved;
    }
  }

  // Scan for standalone debit/credit/dr/cr headers not yet mapped
  if (!hasClosing) {
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const isDebit =
        cell === 'debit' || cell === 'dr' || cell === 'dr.' || cell.endsWith(' dr');
      const isCredit =
        cell === 'credit' || cell === 'cr' || cell === 'cr.' || cell.endsWith(' cr');
      if (isDebit && resolved.closingDr === undefined && resolved.duringDr === undefined) {
        resolved.closingDr = c;
      } else if (isCredit && resolved.closingCr === undefined && resolved.duringCr === undefined) {
        resolved.closingCr = c;
      }
    }
  }

  return resolved;
}

function detectColumns(
  matrix: unknown[][],
): { colMap: Record<string, number>; headerRowIndex: number } | null {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const row = matrix[r] ?? [];
    const colMap: Record<string, number> = {};

    for (let c = 0; c < row.length; c++) {
      const cell = normCell(row[c]);
      for (const [fieldName, hints] of Object.entries(COL_HINTS)) {
        if (colMap[fieldName] !== undefined) continue; // already found
        for (const hint of hints) {
          if (cell === hint || cell.includes(hint)) {
            colMap[fieldName] = c;
            break;
          }
        }
      }
    }

    const resolvedMap = resolveAmbiguousClosingColumns(row, colMap);

    // We need at least a label column and one amount column
    if (resolvedMap['label'] !== undefined) {
      const amountCols = Object.keys(resolvedMap).filter((k) => k !== 'label');
      if (amountCols.length >= 1) {
        return { colMap: resolvedMap, headerRowIndex: r };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Detect Tally Prime format specifically
// Tally Prime: Particulars | Opening Dr | Opening Cr | Debit | Credit | Closing Dr | Closing Cr
// ---------------------------------------------------------------------------
function detectTallyPrimeFormat(
  matrix: unknown[][],
): { isTallyPrime: boolean; headerRowIndex: number; colMap: Record<string, number> } {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const row = matrix[r] ?? [];
    const cells = row.map((c) => normCell(c));

    // Look for the characteristic Tally Prime header pattern
    const hasParticulars = cells.some((c) => c === 'particulars' || c === 'ledger' || c === 'account');
    const hasDebit = cells.some((c) => c === 'debit');
    const hasCredit = cells.some((c) => c === 'credit');
    const hasClosingDr = cells.some((c) =>
      c.includes('closing') && (c.includes('dr') || c.includes('debit'))
    );
    const hasClosingCr = cells.some((c) =>
      c.includes('closing') && (c.includes('cr') || c.includes('credit'))
    );

    if (hasParticulars && hasDebit && hasCredit && (hasClosingDr || hasClosingCr)) {
      const colMap: Record<string, number> = {};
      cells.forEach((cell, i) => {
        if (cell === 'particulars' || cell === 'ledger' || cell === 'account') colMap['label'] = i;
        else if ((cell === 'opening' || cell.includes('opening') && cell.includes('dr'))) colMap['openingDr'] = i;
        else if (cell.includes('opening') && cell.includes('cr')) colMap['openingCr'] = i;
        else if (cell === 'debit' && colMap['duringDr'] === undefined) colMap['duringDr'] = i;
        else if (cell === 'credit' && colMap['duringCr'] === undefined) colMap['duringCr'] = i;
        else if (cell.includes('closing') && (cell.includes('dr') || cell.includes('debit'))) colMap['closingDr'] = i;
        else if (cell.includes('closing') && (cell.includes('cr') || cell.includes('credit'))) colMap['closingCr'] = i;
      });
      if (colMap['label'] !== undefined) {
        return { isTallyPrime: true, headerRowIndex: r, colMap };
      }
    }
  }
  return { isTallyPrime: false, headerRowIndex: -1, colMap: {} };
}

// ---------------------------------------------------------------------------
// Detect the format type of the file
// ---------------------------------------------------------------------------
type FileFormat = 'full' | '3col' | '2col' | '1col' | 'tally_prime';

function detectFormat(
  matrix: unknown[][],
  detection: { colMap: Record<string, number>; headerRowIndex: number } | null,
): { format: FileFormat; colMap: Record<string, number>; headerRowIndex: number } {
  // First check for Tally Prime
  const tallyCheck = detectTallyPrimeFormat(matrix);
  if (tallyCheck.isTallyPrime) {
    return {
      format: 'tally_prime',
      colMap: tallyCheck.colMap,
      headerRowIndex: tallyCheck.headerRowIndex,
    };
  }

  if (detection) {
    return { format: 'full', colMap: detection.colMap, headerRowIndex: detection.headerRowIndex };
  }

  // Try to detect simple formats by looking at data rows
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN + 5); r++) {
    const row = (matrix[r] ?? []).filter(
      (c) => c !== null && c !== undefined && c !== '',
    );
    if (row.length === 3) {
      const secondIsNum = typeof row[1] === 'number' || !isNaN(parseFloat(String(row[1] ?? '')));
      const thirdIsNum = typeof row[2] === 'number' || !isNaN(parseFloat(String(row[2] ?? '')));
      if (secondIsNum && thirdIsNum) {
        return {
          format: '3col',
          colMap: { label: 0, closingDr: 1, closingCr: 2 },
          headerRowIndex: 0,
        };
      }
    }
    if (row.length === 2) {
      const secondIsNum = typeof row[1] === 'number' || !isNaN(parseFloat(String(row[1] ?? '')));
      if (secondIsNum) {
        // Check if values include negatives (net balance format)
        return {
          format: '2col',
          colMap: { label: 0, closingDr: 1 },
          headerRowIndex: 0,
        };
      }
    }
    if (row.length === 2 || row.length === 3) {
      const labelCell = normCell(row[0]);
      const hasLabel = COL_HINTS.label.some((h) => labelCell === h || labelCell.includes(h));
      if (!hasLabel && row.length === 2) {
        const secondIsNum = typeof row[1] === 'number' || !isNaN(parseFloat(String(row[1] ?? '')));
        if (secondIsNum) {
          return {
            format: '1col',
            colMap: { label: 0, closingDr: 1 },
            headerRowIndex: 0,
          };
        }
      }
    }
  }

  // Default to 3-col if nothing else
  return {
    format: '3col',
    colMap: { label: 0, closingDr: 1, closingCr: 2 },
    headerRowIndex: 0,
  };
}

// ---------------------------------------------------------------------------
// Row extraction — maps a raw matrix row to a RawTBRow
// ---------------------------------------------------------------------------
function extractRow(
  matRow: unknown[],
  rowIndex: number,
  colMap: Record<string, number>,
  format: FileFormat,
): RawTBRow {
  const g = (key: string): number => {
    const idx = colMap[key];
    return idx !== undefined ? toNumber(matRow[idx]) : 0;
  };

  const rawLabelCell = String(matRow[colMap['label'] ?? 0] ?? '');
  const rawLabel = rawLabelCell.trim();
  const rawIndentSpaces = countLeadingSpaces(rawLabelCell);

  // ── Handle different formats ────────────────────────────────────────────
  let openingDr = 0, openingCr = 0, duringDr = 0, duringCr = 0;
  let adjustmentDr = 0, adjustmentCr = 0, closingDr = 0, closingCr = 0;

  switch (format) {
    case 'tally_prime': {
      openingDr = g('openingDr');
      openingCr = g('openingCr');
      duringDr = g('duringDr');
      duringCr = g('duringCr');
      adjustmentDr = 0;
      adjustmentCr = 0;

      const hasClosingDr = colMap['closingDr'] !== undefined;
      const hasClosingCr = colMap['closingCr'] !== undefined;

      if (hasClosingDr || hasClosingCr) {
        // Tally Prime exports separate Closing Dr / Closing Cr columns — use them directly
        closingDr = g('closingDr');
        closingCr = g('closingCr');
      } else {
        // Fallback: single balance column with optional Dr/Cr indicator
        const balanceAmt = g('closingDr') || g('closingCr') || g('duringDr');
        const drCrIdx = colMap['drCr'];
        const drCrVal = drCrIdx !== undefined ? normCell(matRow[drCrIdx]) : '';
        if (drCrVal.includes('cr') || drCrVal === 'c') {
          closingCr = Math.abs(balanceAmt);
          closingDr = 0;
        } else {
          closingDr = Math.abs(balanceAmt);
          closingCr = 0;
        }
      }
      break;
    }
    case '3col': {
      closingDr = g('closingDr');
      closingCr = g('closingCr');
      break;
    }
    case '2col': {
      // Net balance: positive = Dr, negative = Cr
      const amt = g('closingDr');
      if (amt >= 0) {
        closingDr = amt;
        closingCr = 0;
      } else {
        closingDr = 0;
        closingCr = Math.abs(amt);
      }
      break;
    }
    case '1col': {
      // Single balance column
      const amt = g('closingDr');
      if (amt >= 0) {
        closingDr = amt;
      } else {
        closingCr = Math.abs(amt);
      }
      break;
    }
    case 'full':
    default: {
      openingDr = g('openingDr');
      openingCr = g('openingCr');
      duringDr = g('duringDr');
      duringCr = g('duringCr');
      adjustmentDr = g('adjustmentDr');
      adjustmentCr = g('adjustmentCr');

      // Derive closing if not present
      const hasClosingDr = colMap['closingDr'] !== undefined;
      const hasClosingCr = colMap['closingCr'] !== undefined;
      closingDr = hasClosingDr
        ? g('closingDr')
        : openingDr + duringDr + adjustmentDr;
      closingCr = hasClosingCr
        ? g('closingCr')
        : openingCr + duringCr + adjustmentCr;
      break;
    }
  }

  // ── Detect row level from indentation and amount presence ────────────────
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
    parentGroup: '',    // filled in during the parent-tracking pass
    rawIndentSpaces,
  };
}

// ---------------------------------------------------------------------------
// CSV parser — respects quoted fields
// ---------------------------------------------------------------------------
function parseCSVText(text: string): unknown[][] {
  const lines = text.split(/\r?\n/);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }).filter((row) => row.some((c) => c !== ''));
}

// ---------------------------------------------------------------------------
// Parent group tracking — assigns parentGroup to each leaf row
// ---------------------------------------------------------------------------
/**
 * After extracting all rows, do a second pass to assign parentGroup.
 * Logic:
 *   - Maintain a stack of group rows with their indent levels
 *   - For each leaf row, the parentGroup is the nearest group row above it
 *     with a smaller or equal indent level
 */
function assignParentGroups(rows: RawTBRow[]): RawTBRow[] {
  const groupStack: Array<{ label: string; indentSpaces: number; level: number }> = [];

  return rows.map((row) => {
    if (row.isGroupRow) {
      // Pop any groups with deeper or equal indentation (we've moved back up in hierarchy)
      while (
        groupStack.length > 0 &&
        groupStack[groupStack.length - 1].indentSpaces >= row.rawIndentSpaces
      ) {
        groupStack.pop();
      }
      // Push this group onto the stack
      groupStack.push({
        label: row.rawLabel,
        indentSpaces: row.rawIndentSpaces,
        level: row.rowLevel,
      });
      return { ...row, parentGroup: groupStack.length > 1 ? groupStack[groupStack.length - 2].label : '' };
    } else {
      // For leaf rows, find the nearest parent group
      // The parent is the group at the top of the stack (if any)
      const parentGroup = groupStack.length > 0
        ? groupStack[groupStack.length - 1].label
        : '';
      return { ...row, parentGroup };
    }
  });
}

function worksheetToMatrix(ws: ExcelJS.Worksheet): unknown[][] {
  const matrix: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v !== null && typeof v === 'object') {
        if ('richText' in v)
          cells.push((v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join(''));
        else if ('result' in v)
          cells.push((v as ExcelJS.CellFormulaValue).result);
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

function isSecondarySheetName(name: string): boolean {
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

function findSecondaryWorksheet(
  workbook: ExcelJS.Workbook,
  primaryName: string,
): ExcelJS.Worksheet | null {
  const candidates: { ws: ExcelJS.Worksheet; score: number }[] = [];

  for (const ws of workbook.worksheets) {
    if (ws.name === primaryName) continue;
    if (!isSecondarySheetName(ws.name)) continue;

    const n = ws.name.trim().toLowerCase();
    let score = 0;
    if (/\bpy\b/.test(n) || n === 'py') score += 50;
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

function parseSecondaryMatrix(matrix: unknown[][]): RawTBRow[] | null {
  try {
    return parseMatrix(matrix).rows;
  } catch {
    return null;
  }
}

function buildColMapInRange(
  row: unknown[],
  labelCol: number,
  startCol: number,
  endCol: number,
): Record<string, number> {
  const colMap: Record<string, number> = { label: labelCol };
  for (let c = startCol; c <= endCol; c++) {
    const cell = normCell(row[c]);
    for (const [fieldName, hints] of Object.entries(COL_HINTS)) {
      if (fieldName === 'label' || colMap[fieldName] !== undefined) continue;
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

/**
 * Detect ICAN-style Trial Balance with Current Year and Previous Year blocks
 * side-by-side on one sheet (e.g. cols B–J = CY, cols L–T = PY).
 */
function detectDualYearColumns(
  matrix: unknown[][],
): {
  cyColMap: Record<string, number>;
  pyColMap: Record<string, number>;
  headerRowIndex: number;
} | null {
  for (let r = 0; r < Math.min(matrix.length, MAX_HEADER_SCAN); r++) {
    const row = matrix[r] ?? [];
    const cells = row.map((c) => normCell(c));

    const labelCol = cells.findIndex((c) =>
      COL_HINTS.label.some((h) => c === h || c.includes(h)),
    );
    if (labelCol === -1) continue;

    const hasPY = cells.some(
      (c) => c.includes('previous year') || c.includes('last year') || c === 'py',
    );
    const hasCY = cells.some((c) => c.includes('current year') || c === 'cy');

    // Find two "opening dr" column anchors (start of each year block)
    const openingDrCols: number[] = [];
    for (let c = labelCol + 1; c < row.length; c++) {
      const cell = cells[c];
      if (cell.includes('opening') && (cell.includes('dr') || cell.includes('debit'))) {
        openingDrCols.push(c);
      }
    }

    if (openingDrCols.length < 2) {
      // Also try matching two "closing dr" anchors
      const closingDrCols: number[] = [];
      for (let c = labelCol + 1; c < row.length; c++) {
        const cell = cells[c];
        if (cell.includes('closing') && (cell.includes('dr') || cell.includes('debit'))) {
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

    const cyAmounts = Object.keys(cyColMap).filter((k) => k !== 'label');
    const pyAmounts = Object.keys(pyColMap).filter((k) => k !== 'label');
    if (cyAmounts.length >= 1 && pyAmounts.length >= 1) {
      return { cyColMap, pyColMap, headerRowIndex: r };
    }
  }
  return null;
}

function parseMatrixWithColMap(
  matrix: unknown[][],
  colMap: Record<string, number>,
  headerRowIndex: number,
  mode: FileFormat,
  warningsPrefix: string[] = [],
): RawTBParseResult {
  const warnings = [...warningsPrefix];
  const rows: RawTBRow[] = [];
  const skippedSubtotals: string[] = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const matRow = matrix[r] ?? [];
    const labelVal = matRow[colMap['label'] ?? 0];
    const label = String(labelVal ?? '').trim();
    if (!label) continue;
    if (SUBTOTAL_PATTERNS.test(label)) {
      skippedSubtotals.push(label);
      continue;
    }
    const row = extractRow(matRow, r, colMap, mode);
    if (!row.rawLabel) continue;
    if (
      !row.isGroupRow &&
      row.closingDr === 0 &&
      row.closingCr === 0 &&
      row.openingDr === 0 &&
      row.openingCr === 0
    ) {
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
    throw Object.assign(new Error('No data rows found.'), { status: 400, code: 'NO_DATA_ROWS' });
  }

  let totalOpeningDr = 0,
    totalOpeningCr = 0,
    totalDuringDr = 0,
    totalDuringCr = 0;
  let totalClosingDr = 0,
    totalClosingCr = 0;
  for (const row of rowsWithParents) {
    if (row.isGroupRow) continue;
    totalOpeningDr += row.openingDr;
    totalOpeningCr += row.openingCr;
    totalDuringDr += row.duringDr;
    totalDuringCr += row.duringCr;
    totalClosingDr += row.closingDr;
    totalClosingCr += row.closingCr;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  totalClosingDr = round2(totalClosingDr);
  totalClosingCr = round2(totalClosingCr);
  const difference = round2(totalClosingDr - totalClosingCr);
  const isBalanced = Math.abs(difference) < 1.0;

  if (!isBalanced) {
    warnings.push(
      `Trial Balance not balanced. Difference: ${Math.abs(difference).toLocaleString('en-IN')}.`,
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
    detectedFormat: mode,
  };
}

export function parseMatrix(matrix: unknown[][]): RawTBParseResult {
  const warnings: string[] = [];
  const headerDetection = detectColumns(matrix);
  const { format, colMap, headerRowIndex } = detectFormat(matrix, headerDetection);
  const mode = format;

  if (mode === '3col') {
    warnings.push('Treating file as 3-column (label, debit, credit) layout.');
  } else if (mode === '2col') {
    warnings.push('Treating file as 2-column net balance layout (positive=Dr, negative=Cr).');
  } else if (mode === '1col') {
    warnings.push('Treating file as single balance column layout.');
  }

  if (mode === 'full' && colMap['label'] === undefined) {
    throw Object.assign(
      new Error('Could not detect column headers.'),
      { status: 400, code: 'NO_HEADERS' },
    );
  }

  return parseMatrixWithColMap(matrix, colMap, headerRowIndex, mode, warnings);
}

/** Parse CY+PY side-by-side layout from a single worksheet matrix. */
export function parseDualYearMatrix(matrix: unknown[][]): {
  currentYear: RawTBParseResult;
  previousYear: RawTBRow[];
} | null {
  const dual = detectDualYearColumns(matrix);
  if (!dual) return null;

  const warnings = [
    'Detected Current Year and Previous Year columns side-by-side on one sheet.',
  ];
  const currentYear = parseMatrixWithColMap(
    matrix,
    dual.cyColMap,
    dual.headerRowIndex,
    'full',
    warnings,
  );
  const previousYear = parseMatrixWithColMap(
    matrix,
    dual.pyColMap,
    dual.headerRowIndex,
    'full',
    [],
  ).rows;

  return { currentYear, previousYear };
}

export interface WorkbookMetadata {
  format: 'mes_template' | 'generic';
  companyName?: string;
  fullAddress?: string;
  fiscalYear?: string;
  chairperson?: string;
  director?: string;
  accountsHead?: string;
  auditorName?: string;
  auditFirmName?: string;
}

export type ParseTBResult = RawTBParseResult & {
  previousYearData: RawTBRow[] | null;
  workbookMetadata?: WorkbookMetadata | null;
};

function cellPlainValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val !== null && 'result' in val) {
    return String((val as ExcelJS.CellFormulaValue).result ?? '').trim();
  }
  return String(val).trim();
}

/** Extract company/fiscal metadata from ICAN MEs workbook "Enter Details" sheet. */
export function extractWorkbookMetadata(workbook: ExcelJS.Workbook): WorkbookMetadata | null {
  const enterDetails = workbook.getWorksheet('Enter Details');
  if (!enterDetails) return null;

  const fields = new Map<string, string>();
  enterDetails.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values as unknown[];
    const label = normCell(vals[2]);
    const value = cellPlainValue(vals[3]);
    if (label && value) fields.set(label, value);
  });

  if (fields.size === 0) return null;

  return {
    format: 'mes_template',
    companyName: fields.get('name of entity'),
    fullAddress: fields.get('address'),
    fiscalYear: fields.get('this year'),
    chairperson: fields.get('chairperson'),
    director: fields.get('director'),
    accountsHead: fields.get('accounts head'),
    auditorName: fields.get('auditor'),
    auditFirmName: fields.get('name of audit firm'),
  };
}

/** Parse CSV buffer using the same logic as Excel uploads. */
export function parseCsv(buffer: Buffer): ParseTBResult {
  let text = buffer.toString('utf-8');
  if (text.includes('\ufffd')) {
    text = buffer.toString('latin1');
  }
  return { ...parseMatrix(parseCSVText(text)), previousYearData: null };
}

// ---------------------------------------------------------------------------
// Main export: parseTrialBalance
// ---------------------------------------------------------------------------
export async function parseTrialBalance(
  buffer: Buffer,
  filename: string,
): Promise<ParseTBResult> {
  // --- Validation guards ---
  if (!buffer || buffer.length === 0) {
    throw Object.assign(
      new Error('The uploaded file is empty. Please upload a valid Excel or CSV file.'),
      { status: 400, code: 'EMPTY_FILE' }
    );
  }

  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  // ── Read file into matrix ────────────────────────────────────────────────
  if (ext === '.csv') {
    return parseCsv(buffer);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      'Could not read the uploaded file as an Excel workbook. ' +
      'If the file is in .xls (old format), please re-save it as .xlsx in Excel first.',
    );
  }

  const primaryWs =
    workbook.getWorksheet('Trial Balance') ??
    workbook.getWorksheet('TB') ??
    workbook.worksheets[0];
  if (!primaryWs) {
    throw new Error('The uploaded workbook has no worksheets.');
  }

  const matrix = worksheetToMatrix(primaryWs);
  if (matrix.length === 0) {
    throw new Error('The uploaded file appears to be empty.');
  }

  // Prefer CY+PY side-by-side layout (ICAN reference format) when detected
  const dualYear = parseDualYearMatrix(matrix);
  let result: RawTBParseResult;
  let previousYearData: RawTBRow[] | null = null;

  if (dualYear) {
    result = dualYear.currentYear;
    previousYearData = dualYear.previousYear;
    result.warnings.push(
      `Previous year data extracted from side-by-side columns (${previousYearData.length} rows).`,
    );
  } else {
    result = parseMatrix(matrix);
  }

  // Fall back to a separate PY worksheet if side-by-side block was not found
  if (!previousYearData) {
    const secondaryWs = findSecondaryWorksheet(workbook, primaryWs.name);
    if (secondaryWs) {
      const secondaryMatrix = worksheetToMatrix(secondaryWs);
      previousYearData = parseSecondaryMatrix(secondaryMatrix);
      if (previousYearData) {
        result.warnings.push(
          `Previous year data loaded from sheet "${secondaryWs.name}" (${previousYearData.length} rows).`,
        );
      }
    }
  }

  const workbookMetadata = extractWorkbookMetadata(workbook);
  if (workbookMetadata) {
    result.warnings.push(
      `Detected ICAN MEs workbook template for "${workbookMetadata.companyName ?? 'entity'}".`,
    );
  }

  return { ...result, previousYearData, workbookMetadata };
}
