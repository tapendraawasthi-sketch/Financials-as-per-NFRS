// ===== server/services/journalParser.ts =====
import ExcelJS from 'exceljs';
import type { JournalEntry } from '../../src/types/index.js';
import {
  JOURNAL_HEADER_ALIASES,
  JOURNAL_COL,
  JOURNAL_DATA_START_ROW,
  JOURNAL_HEADER_ROW,
  type JournalEntryType,
} from './journalStandardSchema.js';

export interface ParsedJournalResult {
  entries: JournalEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  warnings: string[];
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

function isRowEmpty(values: Record<string, unknown>): boolean {
  return !values.description && !values.debitAccount && !values.creditAccount
    && (values.amount == null || values.amount === 0);
}

function detectHeaderRow(ws: ExcelJS.Worksheet): { row: number; colMap: Record<string, number> } | null {
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const colMap: Record<string, number> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = JOURNAL_HEADER_ALIASES[normalizeHeader(cell.value)];
      if (key && key !== 'rowNum') {
        colMap[key] = colNumber;
      }
    });
    if (colMap.description && colMap.debitAccount && colMap.creditAccount && colMap.amount) {
      return { row: r, colMap };
    }
  }
  return null;
}

function useStandardTemplateLayout(ws: ExcelJS.Worksheet): boolean {
  const headerCell = ws.getRow(JOURNAL_HEADER_ROW).getCell(JOURNAL_COL.description).value;
  return normalizeHeader(headerCell) === 'description';
}

function parseFromStandardTemplate(ws: ExcelJS.Worksheet): ParsedJournalResult {
  const entries: JournalEntry[] = [];
  const warnings: string[] = [];
  let rowNum = JOURNAL_DATA_START_ROW;

  while (rowNum <= ws.rowCount) {
    const row = ws.getRow(rowNum);
    const description = String(row.getCell(JOURNAL_COL.description).value ?? '').trim();
    const debitAccount = String(row.getCell(JOURNAL_COL.debitAccount).value ?? '').trim();
    const creditAccount = String(row.getCell(JOURNAL_COL.creditAccount).value ?? '').trim();
    const amount = parseAmount(row.getCell(JOURNAL_COL.amount).value);
    const typeRaw = String(row.getCell(JOURNAL_COL.type).value ?? '').trim().toUpperCase();

    if (
      description.toLowerCase().startsWith('e.g.')
      || description.toLowerCase().startsWith('eg.')
      || description.toLowerCase().startsWith('example')
    ) {
      rowNum++;
      continue;
    }

    if (
      description.toLowerCase().startsWith('total')
      || description.toLowerCase().includes('dr must equal cr')
    ) {
      break;
    }

    if (isRowEmpty({ description, debitAccount, creditAccount, amount })) {
      rowNum++;
      continue;
    }

    if (!description) warnings.push(`Row ${rowNum}: missing description — skipped.`);
    if (!debitAccount) warnings.push(`Row ${rowNum}: missing Dr Account — skipped.`);
    if (!creditAccount) warnings.push(`Row ${rowNum}: missing Cr Account — skipped.`);
    if (amount == null || amount <= 0) warnings.push(`Row ${rowNum}: invalid amount — skipped.`);

    if (description && debitAccount && creditAccount && amount != null && amount > 0) {
      entries.push({
        id: `upload-${rowNum}`,
        description,
        debitAccount,
        creditAccount,
        amount,
        ...(typeRaw ? { type: typeRaw as JournalEntryType } : {}),
      });
    }

    rowNum++;
  }

  const totalDebit = entries.reduce((s, e) => s + e.amount, 0);
  const totalCredit = totalDebit;
  return {
    entries,
    totalDebit,
    totalCredit,
    isBalanced: true,
    warnings,
  };
}

function parseFromDetectedHeaders(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  colMap: Record<string, number>,
): ParsedJournalResult {
  const entries: JournalEntry[] = [];
  const warnings: string[] = [];

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const description = String(row.getCell(colMap.description).value ?? '').trim();
    const debitAccount = String(row.getCell(colMap.debitAccount).value ?? '').trim();
    const creditAccount = String(row.getCell(colMap.creditAccount).value ?? '').trim();
    const amount = parseAmount(row.getCell(colMap.amount).value);
    const typeCol = colMap.type;
    const typeRaw = typeCol ? String(row.getCell(typeCol).value ?? '').trim().toUpperCase() : '';

    if (isRowEmpty({ description, debitAccount, creditAccount, amount })) continue;
    if (description.toLowerCase().startsWith('total')) break;

    if (!description || !debitAccount || !creditAccount || amount == null || amount <= 0) {
      warnings.push(`Row ${r}: incomplete entry — skipped.`);
      continue;
    }

    entries.push({
      id: `upload-${r}`,
      description,
      debitAccount,
      creditAccount,
      amount,
      ...(typeRaw ? { type: typeRaw as JournalEntryType } : {}),
    });
  }

  const totalDebit = entries.reduce((s, e) => s + e.amount, 0);
  return {
    entries,
    totalDebit,
    totalCredit: totalDebit,
    isBalanced: true,
    warnings,
  };
}

export async function parseJournalEntries(buffer: Buffer): Promise<ParsedJournalResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('Adjustment Journal')
    ?? wb.worksheets.find((sheet) => {
      for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
        const row = sheet.getRow(r);
        let foundDesc = false;
        let foundDr = false;
        row.eachCell({ includeEmpty: false }, (cell) => {
          const key = JOURNAL_HEADER_ALIASES[normalizeHeader(cell.value)];
          if (key === 'description') foundDesc = true;
          if (key === 'debitAccount') foundDr = true;
        });
        if (foundDesc && foundDr) return true;
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
      message: 'Could not find journal entry columns. Use the downloaded template or ensure columns: Description, Dr Account, Cr Account, Amount.',
    } as JournalParseError;
  }

  return parseFromDetectedHeaders(ws, detected.row, detected.colMap);
}

export function validateJournalEntries(result: ParsedJournalResult, tolerance = 1): JournalParseError | null {
  if (result.entries.length === 0) {
    return {
      code: 'NO_ENTRIES',
      message: 'No journal entries found. Fill at least one row in the template or click "No adjustment entries to upload".',
    };
  }

  const imbalance = Math.abs(result.totalDebit - result.totalCredit);
  if (imbalance > tolerance) {
    return {
      code: 'NOT_BALANCED',
      message: `Journal entries are not balanced. Total Dr/Cr difference: NPR ${imbalance.toLocaleString('en-IN')}.`,
    };
  }

  return null;
}
