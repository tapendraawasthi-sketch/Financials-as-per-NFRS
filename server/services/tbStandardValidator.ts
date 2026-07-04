import ExcelJS from 'exceljs';
import { toNumber } from './tbParser.js';
import {
  buildSectionAccounts,
  CY_AMOUNT_COLS,
  getExpectedSectionOrder,
  HEADER_ROW_INDEX,
  PY_AMOUNT_COLS,
  STANDARD_TB_COLUMNS,
  TOTAL_COLS,
} from './tbStandardSchema.js';

export interface TbDiagnosticIssue {
  severity: 'error' | 'warning';
  category: 'structure' | 'headers' | 'sections' | 'accounts' | 'balances' | 'arithmetic';
  message: string;
  sheetName?: string;
  rowNumber?: number;
  columnLetter?: string;
  suggestedFix?: string;
}

export interface TbStandardValidationResult {
  isStandardFormat: boolean;
  issues: TbDiagnosticIssue[];
  matchedAccountCount: number;
  totalExpectedAccounts: number;
  detectedSections: string[];
  missingSections: string[];
  unexpectedSections: string[];
}

const ROUNDING_TOLERANCE = 1000;

function colLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function cellText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val !== null && 'formula' in (val as Record<string, unknown>)) {
    const result = (val as { result?: unknown }).result;
    return result === null || result === undefined ? '' : String(result).trim();
  }
  return String(val).trim();
}

function normLabel(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  return (
    workbook.getWorksheet('Trial Balance') ??
    workbook.getWorksheet('TB') ??
    workbook.worksheets[0] ??
    null
  );
}

function parseMergeRef(ref: string): { top: number; left: number; bottom: number; right: number } | null {
  const parts = ref.split(':');
  if (parts.length !== 2) return null;
  const parseCell = (cell: string): { row: number; col: number } | null => {
    const match = cell.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    const letters = match[1].toUpperCase();
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return { row: parseInt(match[2], 10), col };
  };
  const start = parseCell(parts[0]);
  const end = parseCell(parts[1]);
  if (!start || !end) return null;
  return { top: start.row, left: start.col, bottom: end.row, right: end.col };
}

function getMergedRanges(ws: ExcelJS.Worksheet): Array<{ top: number; left: number; bottom: number; right: number }> {
  const merges: string[] = ((ws as unknown as { model?: { merges?: string[] } }).model?.merges) ?? [];
  return merges.map(parseMergeRef).filter((r): r is NonNullable<typeof r> => r !== null);
}

function isSectionHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, merges: ReturnType<typeof getMergedRanges>): boolean {
  const label = cellText(ws.getRow(rowNum).getCell(1).value);
  if (!label || label.toUpperCase() === 'GRAND TOTAL') return false;

  const hasWideMerge = merges.some(
    (m) => m.top <= rowNum && m.bottom >= rowNum && m.left === 1 && m.right >= 10,
  );
  if (hasWideMerge) return true;

  const hasAmounts = [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS].some((col) => {
    const v = ws.getRow(rowNum).getCell(col).value;
    return v !== null && v !== undefined && cellText(v) !== '' && toNumber(v) !== 0;
  });
  return !hasAmounts && label === label.toUpperCase() && label.length > 3;
}

function collectSectionHeaders(ws: ExcelJS.Worksheet): { header: string; rowNumber: number }[] {
  const merges = getMergedRanges(ws);
  const sections: { header: string; rowNumber: number }[] = [];
  const lastRow = ws.rowCount;
  for (let rowNum = HEADER_ROW_INDEX + 1; rowNum <= lastRow; rowNum++) {
    if (!isSectionHeaderRow(ws, rowNum, merges)) continue;
    const header = cellText(ws.getRow(rowNum).getCell(1).value);
    if (header.toUpperCase() === 'OTHER ACCOUNTS') continue;
    sections.push({ header, rowNumber: rowNum });
  }
  return sections;
}

function collectAccountLabels(ws: ExcelJS.Worksheet): Set<string> {
  const merges = getMergedRanges(ws);
  const labels = new Set<string>();
  const lastRow = ws.rowCount;
  for (let rowNum = HEADER_ROW_INDEX + 1; rowNum <= lastRow; rowNum++) {
    const label = cellText(ws.getRow(rowNum).getCell(1).value);
    if (!label || label.toUpperCase() === 'GRAND TOTAL') continue;
    if (isSectionHeaderRow(ws, rowNum, merges)) continue;
    labels.add(normLabel(label));
  }
  return labels;
}

function findLikelyMistypedRow(
  ws: ExcelJS.Worksheet,
  imbalance: number,
): { label: string; rowNumber: number; suggestedFix: string } | null {
  const merges = getMergedRanges(ws);
  const target = Math.abs(imbalance);
  let best: { label: string; rowNumber: number; suggestedFix: string; improvement: number } | null = null;

  for (let rowNum = HEADER_ROW_INDEX + 1; rowNum <= ws.rowCount; rowNum++) {
    const label = cellText(ws.getRow(rowNum).getCell(1).value);
    if (!label || isSectionHeaderRow(ws, rowNum, merges)) continue;

    const closingDr = toNumber(ws.getRow(rowNum).getCell(8).value);
    const closingCr = toNumber(ws.getRow(rowNum).getCell(9).value);

    const swapImbalance = Math.abs(
      (closingCr - closingDr) - (target * Math.sign(imbalance)),
    );
    const swapImprovement = target - swapImbalance;
    if (swapImprovement >= target * 0.9) {
      const candidate = {
        label,
        rowNumber: rowNum,
        suggestedFix: `Try swapping Closing Dr and Closing Cr on row ${rowNum} ('${label}').`,
        improvement: swapImprovement,
      };
      if (!best || candidate.improvement > best.improvement) best = candidate;
    }

    for (const [col, side] of [[8, 'Dr'], [9, 'Cr']] as const) {
      const val = toNumber(ws.getRow(rowNum).getCell(col).value);
      if (val <= 0) continue;
      const digits = String(Math.round(val));
      for (let i = 0; i < digits.length; i++) {
        const shortened = parseInt(digits.slice(0, i) + digits.slice(i + 1), 10) || 0;
        const delta = val - shortened;
        if (Math.abs(Math.abs(delta) - target) <= target * 0.1) {
          const candidate = {
            label,
            rowNumber: rowNum,
            suggestedFix: `Row ${rowNum} ('${label}'): removing one digit from Closing ${side} (${val.toLocaleString('en-IN')}) may fix most of the imbalance.`,
            improvement: target * 0.9,
          };
          if (!best || candidate.improvement > best.improvement) best = candidate;
        }
      }
    }
  }

  return best ? { label: best.label, rowNumber: best.rowNumber, suggestedFix: best.suggestedFix } : null;
}

export function validateStandardTemplate(workbook: ExcelJS.Workbook): TbStandardValidationResult {
  const issues: TbDiagnosticIssue[] = [];
  const ws = getWorksheet(workbook);
  const sheetName = ws?.name ?? 'unknown';

  if (!ws) {
    issues.push({
      severity: 'error',
      category: 'structure',
      message: 'Workbook has no worksheets.',
    });
    return {
      isStandardFormat: false,
      issues,
      matchedAccountCount: 0,
      totalExpectedAccounts: buildSectionAccounts().reduce((n, s) => n + s.accounts.length, 0),
      detectedSections: [],
      missingSections: getExpectedSectionOrder(),
      unexpectedSections: [],
    };
  }

  const expectedSheetName = 'Trial Balance';
  if (ws.name !== expectedSheetName && workbook.worksheets[0]?.name !== ws.name) {
    issues.push({
      severity: 'error',
      category: 'structure',
      message: `Expected worksheet named '${expectedSheetName}' or the first sheet; found '${ws.name}'.`,
      sheetName: ws.name,
    });
  }

  const actualColCount = ws.columnCount || TOTAL_COLS;
  if (actualColCount < TOTAL_COLS) {
    issues.push({
      severity: 'error',
      category: 'structure',
      message: `Worksheet has ${actualColCount} columns but the standard template requires at least ${TOTAL_COLS}.`,
      sheetName: ws.name,
    });
  }

  const headerRow = ws.getRow(HEADER_ROW_INDEX);
  for (const keyCol of [1, 2, 11, 12]) {
    if (!cellText(headerRow.getCell(keyCol).value)) {
      issues.push({
        severity: 'error',
        category: 'structure',
        message: `Header row (row ${HEADER_ROW_INDEX}) is empty in column ${colLetter(keyCol)}.`,
        sheetName: ws.name,
        rowNumber: HEADER_ROW_INDEX,
        columnLetter: colLetter(keyCol),
      });
    }
  }

  for (const colDef of STANDARD_TB_COLUMNS) {
    if (colDef.block === 'spacer' || !colDef.header) continue;
    const actual = cellText(headerRow.getCell(colDef.col).value);
    const expected = colDef.header;
    if (normLabel(actual) !== normLabel(expected)) {
      issues.push({
        severity: 'error',
        category: 'headers',
        message: `Column ${colLetter(colDef.col)} header is '${actual || '(empty)'}' but the standard template expects '${expected}' in this position — your columns may be shifted or renamed.`,
        sheetName: ws.name,
        rowNumber: HEADER_ROW_INDEX,
        columnLetter: colLetter(colDef.col),
        suggestedFix: `Rename column ${colLetter(colDef.col)} to '${expected}'.`,
      });
    }
  }

  const expectedSections = getExpectedSectionOrder();
  const detectedSectionEntries = collectSectionHeaders(ws);
  const detectedSections = detectedSectionEntries.map((s) => s.header);
  const detectedSet = new Set(detectedSections);
  const expectedSet = new Set(expectedSections);

  const missingSections: string[] = [];
  let lastMatchedRow = HEADER_ROW_INDEX;
  for (const expected of expectedSections) {
    if (detectedSet.has(expected)) {
      const found = detectedSectionEntries.find((s) => s.header === expected);
      if (found) lastMatchedRow = found.rowNumber;
      continue;
    }
    missingSections.push(expected);
    issues.push({
      severity: 'error',
      category: 'sections',
      message: `Missing section '${expected}' — it should appear after row ${lastMatchedRow}.`,
      sheetName: ws.name,
      rowNumber: lastMatchedRow + 1,
      suggestedFix: `Add the section header '${expected}' in the expected order.`,
    });
  }

  const unexpectedSections: string[] = [];
  for (const detected of detectedSections) {
    if (!expectedSet.has(detected)) {
      unexpectedSections.push(detected);
      const entry = detectedSectionEntries.find((s) => s.header === detected);
      issues.push({
        severity: 'warning',
        category: 'sections',
        message: `Unexpected section header '${detected}' — custom accounts should be placed under 'OTHER ACCOUNTS' instead of as a new section.`,
        sheetName: ws.name,
        rowNumber: entry?.rowNumber,
        suggestedFix: `Move accounts under '${detected}' into the 'OTHER ACCOUNTS' section or an appropriate standard section.`,
      });
    }
  }

  const sheetLabels = collectAccountLabels(ws);
  const sectionAccounts = buildSectionAccounts();
  let matchedAccountCount = 0;
  let totalExpectedAccounts = 0;

  for (const section of sectionAccounts) {
    for (const account of section.accounts) {
      totalExpectedAccounts++;
      if (sheetLabels.has(normLabel(account.displayLabel))) {
        matchedAccountCount++;
      } else {
        issues.push({
          severity: 'warning',
          category: 'accounts',
          message: `Expected account '${account.displayLabel}' from section '${section.header}' was not found — leave the row blank if not applicable, but do not delete it.`,
          sheetName: ws.name,
          suggestedFix: `Ensure the row label '${account.displayLabel}' exists under section '${section.header}'.`,
        });
      }
    }
  }

  const merges = getMergedRanges(ws);
  for (let rowNum = HEADER_ROW_INDEX + 1; rowNum <= ws.rowCount; rowNum++) {
    const label = cellText(ws.getRow(rowNum).getCell(1).value);
    if (!label || isSectionHeaderRow(ws, rowNum, merges) || label.toUpperCase() === 'GRAND TOTAL') continue;

    const openingDr = toNumber(ws.getRow(rowNum).getCell(2).value);
    const openingCr = toNumber(ws.getRow(rowNum).getCell(3).value);
    const duringDr = toNumber(ws.getRow(rowNum).getCell(4).value);
    const duringCr = toNumber(ws.getRow(rowNum).getCell(5).value);
    const adjDr = toNumber(ws.getRow(rowNum).getCell(6).value);
    const adjCr = toNumber(ws.getRow(rowNum).getCell(7).value);
    const closingDr = toNumber(ws.getRow(rowNum).getCell(8).value);
    const closingCr = toNumber(ws.getRow(rowNum).getCell(9).value);

    const hasNumeric =
      openingDr || openingCr || duringDr || duringCr || adjDr || adjCr || closingDr || closingCr;
    if (!hasNumeric) continue;

    const expectedClosingDr = openingDr + duringDr + adjDr;
    const expectedClosingCr = openingCr + duringCr + adjCr;

    if (Math.abs(expectedClosingDr - closingDr) > 1) {
      issues.push({
        severity: 'warning',
        category: 'arithmetic',
        message: `Row ${rowNum} ('${label}'): Opening + During + Adjustment Dr = ${expectedClosingDr.toLocaleString('en-IN')} but Closing Dr. shows ${closingDr.toLocaleString('en-IN')} — check for a data entry error.`,
        sheetName: ws.name,
        rowNumber: rowNum,
        columnLetter: colLetter(8),
      });
    }
    if (Math.abs(expectedClosingCr - closingCr) > 1) {
      issues.push({
        severity: 'warning',
        category: 'arithmetic',
        message: `Row ${rowNum} ('${label}'): Opening + During + Adjustment Cr = ${expectedClosingCr.toLocaleString('en-IN')} but Closing Cr. shows ${closingCr.toLocaleString('en-IN')} — check for a data entry error.`,
        sheetName: ws.name,
        rowNumber: rowNum,
        columnLetter: colLetter(9),
      });
    }
  }

  let sumClosingDr = 0;
  let sumClosingCr = 0;
  for (let rowNum = HEADER_ROW_INDEX + 1; rowNum <= ws.rowCount; rowNum++) {
    sumClosingDr += toNumber(ws.getRow(rowNum).getCell(8).value);
    sumClosingCr += toNumber(ws.getRow(rowNum).getCell(9).value);
  }

  const imbalance = sumClosingDr - sumClosingCr;
  if (Math.abs(imbalance) > ROUNDING_TOLERANCE) {
    const likely = findLikelyMistypedRow(ws, imbalance);
    issues.push({
      severity: 'error',
      category: 'balances',
      message: `Closing Dr total (${sumClosingDr.toLocaleString('en-IN')}) and Closing Cr total (${sumClosingCr.toLocaleString('en-IN')}) differ by NPR ${Math.abs(imbalance).toLocaleString('en-IN')}.`,
      sheetName: ws.name,
      suggestedFix: likely?.suggestedFix ??
        'No single obviously mistyped row was found — please review manually.',
    });
  }

  const isStandardFormat = !issues.some((i) => i.severity === 'error');

  return {
    isStandardFormat,
    issues,
    matchedAccountCount,
    totalExpectedAccounts,
    detectedSections,
    missingSections,
    unexpectedSections,
  };
}
