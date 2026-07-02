// ===== server/services/tbParser.ts =====
// Trial balance parser — accepts XLSX, XLS, or CSV in ANY reasonable
// column layout, auto-detects headers, and returns a normalised row set
// with six column pairs (opening, during, adjustment — Dr and Cr each).

import ExcelJS from 'exceljs';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface RawTBRow {
  rowIndex: number;
  rawLabel: string;
  openingDr: number;
  openingCr: number;
  duringDr: number;
  duringCr: number;
  adjustmentDr: number;
  adjustmentCr: number;
  closingDr: number;
  closingCr: number;
}

export interface RawTBParseResult {
  rows: RawTBRow[];
  totalOpeningDr: number;
  totalOpeningCr: number;
  totalDuringDr: number;
  totalDuringCr: number;
  totalClosingDr: number;
  totalClosingCr: number;
  isBalanced: boolean;
  difference: number;
  warnings: string[];
  detectedColumns: Record<string, number>;
  headerRowIndex: number;
}

// ---------------------------------------------------------------------------
// Column-header keyword dictionaries
// ---------------------------------------------------------------------------
const COL_HINTS: Record<string, string[]> = {
  label:        ['particular', 'account', 'ledger', 'description', 'head', 'name', 'title', 'narration'],
  openingDr:    ['opening dr', 'op dr', 'opening debit', 'op debit', 'opening balance dr', 'opn dr'],
  openingCr:    ['opening cr', 'op cr', 'opening credit', 'op credit', 'opening balance cr', 'opn cr'],
  duringDr:     ['during dr', 'transaction dr', 'dur dr', 'movement dr', 'debit', 'dr', 'during year dr', 'receipt'],
  duringCr:     ['during cr', 'transaction cr', 'dur cr', 'movement cr', 'credit', 'cr', 'during year cr', 'payment'],
  adjustmentDr: ['adj dr', 'adjustment dr', 'year end adj dr', 'adjustment debit', 'jv dr'],
  adjustmentCr: ['adj cr', 'adjustment cr', 'year end adj cr', 'adjustment credit', 'jv cr'],
  closingDr:    ['closing dr', 'balance dr', 'closing debit', 'net dr', 'closing balance dr'],
  closingCr:    ['closing cr', 'balance cr', 'closing credit', 'net cr', 'closing balance cr'],
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
// Header detection — scans first MAX_HEADER_SCAN rows for keyword matches
// ---------------------------------------------------------------------------
const MAX_HEADER_SCAN = 15;

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

    // We need at least a label column and one amount column
    if (colMap['label'] !== undefined) {
      const amountCols = Object.keys(colMap).filter((k) => k !== 'label');
      if (amountCols.length >= 1) {
        return { colMap, headerRowIndex: r };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Simplified fallback layouts
// ---------------------------------------------------------------------------
function detectSimplifiedLayout(
  matrix: unknown[][],
  startRow: number,
): { colMap: Record<string, number>; mode: '3col' | '2col' } | null {
  // Find first data row (non-empty row after startRow)
  for (let r = startRow; r < matrix.length; r++) {
    const row = (matrix[r] ?? []).filter(
      (c) => c !== null && c !== undefined && c !== '',
    );
    if (row.length === 3) return { colMap: { label: 0, closingDr: 1, closingCr: 2 }, mode: '3col' };
    if (row.length === 2) return { colMap: { label: 0, closingDr: 1 }, mode: '2col' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row extraction — maps a raw matrix row to a RawTBRow
// ---------------------------------------------------------------------------
function extractRow(
  matRow: unknown[],
  rowIndex: number,
  colMap: Record<string, number>,
  mode: 'full' | '3col' | '2col',
): RawTBRow {
  const g = (key: string): number => {
    const idx = colMap[key];
    return idx !== undefined ? toNumber(matRow[idx]) : 0;
  };

  const rawLabel = String(matRow[colMap['label'] ?? 0] ?? '').trim();

  if (mode === '3col') {
    return {
      rowIndex, rawLabel,
      openingDr: 0, openingCr: 0,
      duringDr: 0, duringCr: 0,
      adjustmentDr: 0, adjustmentCr: 0,
      closingDr: g('closingDr'),
      closingCr: g('closingCr'),
    };
  }

  if (mode === '2col') {
    const amt = g('closingDr'); // positive = debit, negative = credit
    return {
      rowIndex, rawLabel,
      openingDr: 0, openingCr: 0,
      duringDr: 0, duringCr: 0,
      adjustmentDr: 0, adjustmentCr: 0,
      closingDr: amt >= 0 ? amt : 0,
      closingCr: amt < 0 ? -amt : 0,
    };
  }

  // Full layout
  const openingDr    = g('openingDr');
  const openingCr    = g('openingCr');
  const duringDr     = g('duringDr');
  const duringCr     = g('duringCr');
  const adjustmentDr = g('adjustmentDr');
  const adjustmentCr = g('adjustmentCr');

  // Derive closing if not present
  const hasClosingDr = colMap['closingDr'] !== undefined;
  const hasClosingCr = colMap['closingCr'] !== undefined;
  const closingDr = hasClosingDr
    ? g('closingDr')
    : openingDr + duringDr + adjustmentDr;
  const closingCr = hasClosingCr
    ? g('closingCr')
    : openingCr + duringCr + adjustmentCr;

  return {
    rowIndex, rawLabel,
    openingDr, openingCr,
    duringDr, duringCr,
    adjustmentDr, adjustmentCr,
    closingDr, closingCr,
  };
}

// ---------------------------------------------------------------------------
// CSV parser — respects quoted fields
// ---------------------------------------------------------------------------
function parseCSV(text: string): unknown[][] {
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
// Main export: parseTrialBalance
// ---------------------------------------------------------------------------
export async function parseTrialBalance(
  buffer: Buffer,
  filename: string,
): Promise<RawTBParseResult> {
  // --- Validation guards (add before existing parsing logic) ---
  if (!buffer || buffer.length === 0) {
    throw Object.assign(
      new Error('The uploaded file is empty. Please upload a valid Excel or CSV file.'),
      { status: 400, code: 'EMPTY_FILE' }
    );
  }

  const warnings: string[] = [];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  let matrix: unknown[][] = [];

  // ── Read file into matrix ────────────────────────────────────────────────
  if (ext === '.csv') {
    const text = buffer.toString('utf-8');
    matrix = parseCSV(text);
  } else {
    // XLSX or XLS
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch (e) {
      throw new Error(
        'Could not read the uploaded file as an Excel workbook. ' +
        'If the file is in .xls (old format), please re-save it as .xlsx in Excel first.',
      );
    }

    const ws = workbook.worksheets[0];
    if (!ws) {
      throw new Error('The uploaded workbook has no worksheets.');
    }

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
  }

  if (matrix.length === 0) {
    throw new Error('The uploaded file appears to be empty.');
  }

  // ── Detect columns ───────────────────────────────────────────────────────
  const detection = detectColumns(matrix);
  let headerRowIndex = 0;
  let colMap: Record<string, number> = {};
  let mode: 'full' | '3col' | '2col' = 'full';

  if (detection) {
    headerRowIndex = detection.headerRowIndex;
    colMap = detection.colMap;
  } else {
    // Fallback: try simplified layout
    const simplified = detectSimplifiedLayout(matrix, 0);
    if (simplified) {
      mode = simplified.mode;
      colMap = simplified.colMap;
      warnings.push(
        `Could not detect a standard TB header row. ` +
        `Treating file as a ${mode === '3col' ? '3-column (label, debit, credit)' : '2-column (label, net amount)'} layout. ` +
        `Please verify the imported data carefully.`,
      );
    } else {
      warnings.push(
        'Could not detect column headers. Assuming columns A=Account, B=Debit, C=Credit. ' +
        'If this is wrong, please add a header row to your file.',
      );
      colMap = { label: 0, closingDr: 1, closingCr: 2 };
      mode = '3col';
    }
  }

  if (!detection && colMap['label'] === undefined) {
    throw Object.assign(
      new Error(
        'Could not detect column headers. Please ensure your file has clear column headers for account name and amounts.'
      ),
      { status: 400, code: 'NO_HEADERS' }
    );
  }

  // ── Extract rows ─────────────────────────────────────────────────────────
  const rows: RawTBRow[] = [];
  const skippedSubtotals: string[] = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const matRow = matrix[r] ?? [];

    // Skip empty rows
    const labelVal = matRow[colMap['label'] ?? 0];
    const label = String(labelVal ?? '').trim();
    if (!label) continue;

    // Skip obvious subtotal rows — warn
    if (SUBTOTAL_PATTERNS.test(label)) {
      skippedSubtotals.push(label);
      continue;
    }

    const row = extractRow(matRow, r, colMap, mode);
    if (row.rawLabel === '') continue;

    // Validate: if closing is provided, check it matches derived
    if (
      colMap['closingDr'] !== undefined &&
      colMap['openingDr'] !== undefined
    ) {
      const derivedDr = row.openingDr + row.duringDr + row.adjustmentDr;
      const derivedCr = row.openingCr + row.duringCr + row.adjustmentCr;
      if (Math.abs(derivedDr - row.closingDr) > 1.5 || Math.abs(derivedCr - row.closingCr) > 1.5) {
        warnings.push(
          `"${label}" (row ${r + 1}): opening + during + adjustment does not reconcile to closing ` +
          `(Dr: ${derivedDr.toFixed(0)} vs ${row.closingDr.toFixed(0)}, ` +
          `Cr: ${derivedCr.toFixed(0)} vs ${row.closingCr.toFixed(0)}).`,
        );
      }
    }

    rows.push(row);
  }

  if (skippedSubtotals.length > 0) {
    warnings.push(
      `${skippedSubtotals.length} subtotal row(s) were automatically skipped to avoid double-counting: ` +
      `"${skippedSubtotals.slice(0, 3).join('", "')}". ` +
      (skippedSubtotals.length > 3 ? `…and ${skippedSubtotals.length - 3} more.` : ''),
    );
  }

  if (rows.length === 0) {
    throw Object.assign(
      new Error('No data rows found in the uploaded file. Please check your export and ensure it contains account entries.'),
      { status: 400, code: 'NO_DATA_ROWS' }
    );
  }

  // Row limit warning (do NOT throw — add to warnings)
  if (rows.length > 2000) {
    warnings.push(
      `File contains ${rows.length} rows which exceeds the recommended limit of 2000. Processing may be slow. Consider filtering inactive accounts before uploading.`
    );
  }

  // ── Compute totals ───────────────────────────────────────────────────────
  let totalOpeningDr = 0, totalOpeningCr = 0;
  let totalDuringDr = 0, totalDuringCr = 0;
  let totalClosingDr = 0, totalClosingCr = 0;

  for (const row of rows) {
    totalOpeningDr += row.openingDr;
    totalOpeningCr += row.openingCr;
    totalDuringDr  += row.duringDr;
    totalDuringCr  += row.duringCr;
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
      `Trial balance does not foot: total closing debit NPR ${totalClosingDr.toLocaleString()} ` +
      `≠ total closing credit NPR ${totalClosingCr.toLocaleString()} ` +
      `(difference: NPR ${difference.toLocaleString()}). ` +
      `This must be corrected before financial statements can be generated.`,
    );
  }

  return {
    rows,
    totalOpeningDr: round2(totalOpeningDr),
    totalOpeningCr: round2(totalOpeningCr),
    totalDuringDr:  round2(totalDuringDr),
    totalDuringCr:  round2(totalDuringCr),
    totalClosingDr,
    totalClosingCr,
    isBalanced,
    difference,
    warnings,
    detectedColumns: colMap,
    headerRowIndex,
  };
}
