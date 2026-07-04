// ===== server/services/journalParser.ts =====
import ExcelJS from 'exceljs';
import type { JournalEntryGroup, JournalLine } from '../../src/types/adjustments.js';
import {
  JOURNAL_HEADER_ALIASES,
  JOURNAL_COL,
  JOURNAL_DATA_START_ROW,
  JOURNAL_HEADER_ROW,
} from './journalStandardSchema.js';

export interface ParsedJournalResult {
  groups: JournalEntryGroup[];
  warnings: string[];
  /** @deprecated Flat entries for backward compatibility during migration */
  entries: Array<{
    id: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    source: 'Upload';
  }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface JournalParseError {
  code: string;
  message: string;
  details?: string[];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s()./]/g, '');
}

function parseAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[,₨\s]/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cellText(value: unknown): string {
  return String(value ?? '').trim();
}

function isFullyBlankRow(
  drCr: string,
  particulars: string,
  drAmount: number | null,
  crAmount: number | null,
  sNo: string,
): boolean {
  return !sNo && !drCr && !particulars && (drAmount == null || drAmount === 0) && (crAmount == null || crAmount === 0);
}

function useStandardTemplateLayout(ws: ExcelJS.Worksheet): boolean {
  const headerCell = ws.getRow(JOURNAL_HEADER_ROW).getCell(JOURNAL_COL.particulars).value;
  const normalized = normalizeHeader(headerCell);
  return normalized === 'particulars' || normalized === 'description';
}

function detectHeaderRow(ws: ExcelJS.Worksheet): { row: number; colMap: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const colMap: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = JOURNAL_HEADER_ALIASES[normalizeHeader(cell.value)];
      if (key) colMap[key] = colNumber;
    });
    if (colMap.particulars && colMap.drCr && colMap.drAmount && colMap.crAmount) {
      return { row: r, colMap };
    }
  }
  return null;
}

function finalizeGroup(group: {
  groupId: string;
  narration: string;
  lines: JournalLine[];
}): JournalEntryGroup {
  const totalDr = group.lines.filter((l) => l.lineType === 'Dr').reduce((s, l) => s + l.amount, 0);
  const totalCr = group.lines.filter((l) => l.lineType === 'Cr').reduce((s, l) => s + l.amount, 0);
  return {
    groupId: group.groupId,
    narration: group.narration,
    lines: group.lines,
    totalDr,
    totalCr,
    isBalanced: Math.abs(totalDr - totalCr) <= 1,
  };
}

function groupsToFlatEntries(groups: JournalEntryGroup[]): ParsedJournalResult['entries'] {
  const entries: ParsedJournalResult['entries'] = [];
  for (const group of groups) {
    const drLines = group.lines.filter((l) => l.lineType === 'Dr');
    const crLines = group.lines.filter((l) => l.lineType === 'Cr');
    const pairs = Math.min(drLines.length, crLines.length);
    for (let i = 0; i < pairs; i++) {
      entries.push({
        id: `upload-${group.groupId}-${i}`,
        description: group.narration || drLines[i].account,
        debitAccount: drLines[i].account,
        creditAccount: crLines[i].account,
        amount: Math.min(drLines[i].amount, crLines[i].amount),
        source: 'Upload',
      });
    }
  }
  return entries;
}

function parseGroupedRows(
  ws: ExcelJS.Worksheet,
  startRow: number,
  getRowValues: (rowNum: number) => {
    sNo: string;
    drCr: string;
    particulars: string;
    drAmount: number | null;
    crAmount: number | null;
    linkedTo: string;
  },
): ParsedJournalResult {
  const warnings: string[] = [];
  const rawGroups: Array<{ groupId: string; narration: string; lines: JournalLine[] }> = [];
  let current: { groupId: string; narration: string; lines: JournalLine[] } | null = null;
  let lineCounter = 0;

  for (let rowNum = startRow; rowNum <= ws.rowCount; rowNum++) {
    const { sNo, drCr, particulars, drAmount, crAmount, linkedTo } = getRowValues(rowNum);

    if (particulars.toLowerCase().startsWith('check:') || particulars.toLowerCase().startsWith('total')) {
      break;
    }

    if (isFullyBlankRow(drCr, particulars, drAmount, crAmount, sNo)) {
      if (current && current.lines.length > 0) {
        rawGroups.push(current);
        current = null;
      }
      continue;
    }

    const sNoNum = sNo ? parseAmount(sNo) : null;
    if (sNo && sNoNum != null && sNoNum > 0) {
      if (current && current.lines.length > 0) rawGroups.push(current);
      current = { groupId: String(sNoNum), narration: '', lines: [] };
    }

    if (!drCr && !drAmount && !crAmount && particulars) {
      if (current) current.narration = particulars;
      continue;
    }

    const drCrNorm = drCr.toUpperCase();
    if (!current) {
      current = { groupId: sNo || `ROW-${rowNum}`, narration: '', lines: [] };
    }

    if (!drCrNorm || !particulars) {
      warnings.push(`Row ${rowNum}: missing Dr/Cr or Particulars — skipped.`);
      continue;
    }

    const isDr = drCrNorm === 'DR' || drCrNorm === 'DEBIT';
    const isCr = drCrNorm === 'CR' || drCrNorm === 'CREDIT';
    if (!isDr && !isCr) {
      warnings.push(`Row ${rowNum}: invalid Dr/Cr value "${drCr}" — skipped.`);
      continue;
    }

    const amount = isDr ? drAmount : crAmount;
    if (amount == null || amount <= 0) {
      warnings.push(`Row ${rowNum}: missing or invalid amount — skipped.`);
      continue;
    }

    lineCounter++;
    current.lines.push({
      id: `upload-line-${rowNum}-${lineCounter}`,
      groupId: current.groupId,
      lineType: isDr ? 'Dr' : 'Cr',
      account: particulars,
      amount,
      linkedTo: linkedTo || 'Trial',
      source: 'Upload',
    });
  }

  if (current && current.lines.length > 0) rawGroups.push(current);

  const groups: JournalEntryGroup[] = [];
  for (const raw of rawGroups) {
    const group = finalizeGroup(raw);
    const hasDr = group.lines.some((l) => l.lineType === 'Dr');
    const hasCr = group.lines.some((l) => l.lineType === 'Cr');
    const missingFields = group.lines.some((l) => !l.account || l.amount <= 0);

    if (!group.isBalanced || group.lines.length === 0 || !hasDr || !hasCr || missingFields) {
      const reasons: string[] = [];
      if (!group.isBalanced) reasons.push(`imbalance NPR ${Math.abs(group.totalDr - group.totalCr).toLocaleString('en-IN')}`);
      if (!hasDr || !hasCr) reasons.push('needs at least one Dr and one Cr line');
      if (missingFields) reasons.push('incomplete line data');
      if (group.lines.length === 0) reasons.push('no lines');
      warnings.push(`Group ${group.groupId} skipped: ${reasons.join('; ')}.`);
      continue;
    }
    groups.push(group);
  }

  const entries = groupsToFlatEntries(groups);
  const totalDebit = groups.reduce((s, g) => s + g.totalDr, 0);
  const totalCredit = groups.reduce((s, g) => s + g.totalCr, 0);

  return {
    groups,
    warnings,
    entries,
    totalDebit,
    totalCredit,
    isBalanced: groups.every((g) => g.isBalanced),
  };
}

function parseFromStandardTemplate(ws: ExcelJS.Worksheet): ParsedJournalResult {
  return parseGroupedRows(ws, JOURNAL_DATA_START_ROW, (rowNum) => {
    const row = ws.getRow(rowNum);
    return {
      sNo: cellText(row.getCell(JOURNAL_COL.sNo).value),
      drCr: cellText(row.getCell(JOURNAL_COL.drCr).value),
      particulars: cellText(row.getCell(JOURNAL_COL.particulars).value),
      drAmount: parseAmount(row.getCell(JOURNAL_COL.drAmount).value),
      crAmount: parseAmount(row.getCell(JOURNAL_COL.crAmount).value),
      linkedTo: cellText(row.getCell(JOURNAL_COL.linkedTo).value),
    };
  });
}

function parseFromDetectedHeaders(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  colMap: Record<string, number>,
): ParsedJournalResult {
  return parseGroupedRows(ws, headerRow + 1, (rowNum) => {
    const row = ws.getRow(rowNum);
    const sNoCol = colMap.sNo;
    return {
      sNo: sNoCol ? cellText(row.getCell(sNoCol).value) : '',
      drCr: cellText(row.getCell(colMap.drCr).value),
      particulars: cellText(row.getCell(colMap.particulars).value),
      drAmount: parseAmount(row.getCell(colMap.drAmount).value),
      crAmount: parseAmount(row.getCell(colMap.crAmount).value),
      linkedTo: colMap.linkedTo ? cellText(row.getCell(colMap.linkedTo).value) : '',
    };
  });
}

export async function parseJournalEntries(buffer: Buffer): Promise<ParsedJournalResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('Adjustment Journal')
    ?? wb.worksheets.find((sheet) => {
      for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
        const row = sheet.getRow(r);
        let foundParticulars = false;
        let foundDrCr = false;
        row.eachCell({ includeEmpty: false }, (cell) => {
          const key = JOURNAL_HEADER_ALIASES[normalizeHeader(cell.value)];
          if (key === 'particulars') foundParticulars = true;
          if (key === 'drCr') foundDrCr = true;
        });
        if (foundParticulars && foundDrCr) return true;
      }
      return false;
    })
    ?? wb.worksheets[0];

  if (!ws) {
    throw { code: 'NO_SHEET', message: 'The uploaded file contains no worksheets.' } as JournalParseError;
  }

  if (useStandardTemplateLayout(ws)) {
    return parseFromStandardTemplate(ws);
  }

  const detected = detectHeaderRow(ws);
  if (!detected) {
    throw {
      code: 'INVALID_FORMAT',
      message: 'Could not find journal entry columns. Use the downloaded template or ensure columns: S.No., Dr/Cr, Particulars, Dr. Amount, Cr. Amount.',
    } as JournalParseError;
  }

  return parseFromDetectedHeaders(ws, detected.row, detected.colMap);
}

export function validateJournalEntries(result: ParsedJournalResult, _tolerance = 1): JournalParseError | null {
  if (result.groups.length === 0) {
    return {
      code: 'NO_ENTRIES',
      message: 'No journal entries found. Fill at least one row in the template or click "No adjustment entries to upload".',
      details: result.warnings.length > 0 ? result.warnings : undefined,
    };
  }
  return null;
}
