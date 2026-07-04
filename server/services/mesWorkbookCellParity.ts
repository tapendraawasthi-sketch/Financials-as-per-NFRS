/**
 * Cell-level anchor checks for MEs workbook parity.
 * Committed anchors replace vendoring the full reference .xlsx in-repo.
 */

import type ExcelJS from 'exceljs';
import { MES_ENTER_DETAILS_TITLE, MES_TB_ADJUSTED_BALANCE_HEADER } from './mesWorkbookContract.js';

export interface CellAnchor {
  sheet: string;
  row: number;
  col: number;
  match: 'equals' | 'contains' | 'nonEmpty' | 'hasFormula';
  expected?: string;
  label: string;
}

/** Anchor cells the generator must populate (MEs format contract). */
export const MES_WORKBOOK_CELL_ANCHORS: readonly CellAnchor[] = [
  { sheet: 'Enter Details', row: 1, col: 2, match: 'contains', expected: 'ENTER DETAILS', label: 'Enter Details title' },
  { sheet: 'Enter Details', row: 3, col: 2, match: 'equals', expected: 'name of entity', label: 'First Enter Details label' },
  { sheet: 'Trial Balance', row: 5, col: 8, match: 'equals', expected: MES_TB_ADJUSTED_BALANCE_HEADER, label: 'TB Adjusted Balance header' },
  { sheet: 'Disallow for Tax', row: 3, col: 1, match: 'contains', expected: 'Particulars', label: 'Disallow particulars header' },
  { sheet: 'Disallow for Tax', row: 3, col: 6, match: 'contains', expected: 'Route', label: 'Disallow route header' },
  { sheet: 'Tax Notes', row: 4, col: 1, match: 'contains', expected: 'Note I', label: 'Tax Note I title' },
  { sheet: 'Tax Calculation', row: 6, col: 1, match: 'contains', expected: 'Particulars', label: 'Tax calc header row' },
  { sheet: 'Balance Sheet', row: 1, col: 1, match: 'nonEmpty', label: 'Balance Sheet title row' },
  { sheet: 'Income Statement', row: 1, col: 1, match: 'nonEmpty', label: 'Income Statement title row' },
  { sheet: 'Adjustments', row: 3, col: 2, match: 'contains', expected: 'Description', label: 'Adjustments journal headers' },
] as const;

/** Enter Details column-B labels that must appear (MEs reference layout). */
export const MES_ENTER_DETAILS_REQUIRED_LABELS: readonly string[] = [
  'name of entity',
  'address',
  'this year',
  'last year',
  'income tax rate (%)',
  'type of audit firm',
  'dividend declared (%)',
];

export interface CellParityResult {
  ok: boolean;
  errors: string[];
  checked: number;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && 'formula' in v) return String((v as { formula?: string }).formula ?? '');
  if (typeof v === 'object' && 'richText' in v) {
    return ((v as { richText: Array<{ text: string }> }).richText ?? []).map((r) => r.text).join('');
  }
  return String(v);
}

function checkAnchor(wb: ExcelJS.Workbook, anchor: CellAnchor): string | null {
  const ws = wb.getWorksheet(anchor.sheet);
  if (!ws) return `Sheet "${anchor.sheet}" missing for anchor: ${anchor.label}`;

  const cell = ws.getRow(anchor.row).getCell(anchor.col);
  const text = cellText(cell).trim();

  switch (anchor.match) {
    case 'nonEmpty':
      if (!text) return `${anchor.sheet}!${anchor.row}:${anchor.col} empty (${anchor.label})`;
      break;
    case 'equals':
      if (text !== (anchor.expected ?? '')) {
        return `${anchor.sheet}!R${anchor.row}C${anchor.col}: expected "${anchor.expected}", got "${text}"`;
      }
      break;
    case 'contains':
      if (anchor.expected && !text.toLowerCase().includes(anchor.expected.toLowerCase())) {
        return `${anchor.sheet}!R${anchor.row}C${anchor.col}: expected to contain "${anchor.expected}", got "${text}"`;
      }
      break;
    case 'hasFormula': {
      const v = cell.value;
      if (!v || typeof v !== 'object' || !('formula' in v)) {
        return `${anchor.sheet}!R${anchor.row}C${anchor.col}: expected formula (${anchor.label})`;
      }
      break;
    }
  }
  return null;
}

export function validateCellAnchors(
  wb: ExcelJS.Workbook,
  anchors: readonly CellAnchor[] = MES_WORKBOOK_CELL_ANCHORS,
): CellParityResult {
  const errors: string[] = [];
  for (const anchor of anchors) {
    const err = checkAnchor(wb, anchor);
    if (err) errors.push(err);
  }
  return { ok: errors.length === 0, errors, checked: anchors.length };
}

export function validateEnterDetailsLabels(wb: ExcelJS.Workbook): CellParityResult {
  const ws = wb.getWorksheet('Enter Details');
  const errors: string[] = [];
  if (!ws) {
    return { ok: false, errors: ['Enter Details sheet missing'], checked: 0 };
  }

  const colBLabels: string[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const v = cellText(ws.getRow(r).getCell(2)).trim().toLowerCase();
    if (v) colBLabels.push(v);
  }

  for (const required of MES_ENTER_DETAILS_REQUIRED_LABELS) {
    if (!colBLabels.some((l) => l.includes(required))) {
      errors.push(`Enter Details missing label: "${required}"`);
    }
  }

  const title = cellText(ws.getCell(1, 2));
  if (title !== MES_ENTER_DETAILS_TITLE) {
    errors.push(`Enter Details title: expected "${MES_ENTER_DETAILS_TITLE}", got "${title}"`);
  }

  return {
    ok: errors.length === 0,
    errors,
    checked: MES_ENTER_DETAILS_REQUIRED_LABELS.length + 1,
  };
}

/** Compare header rows (rows 1–6) on shared sheets against a reference workbook. */
export function compareReferenceHeaderParity(
  generated: ExcelJS.Workbook,
  reference: ExcelJS.Workbook,
  sheetNames?: string[],
): CellParityResult {
  const errors: string[] = [];
  const sheets = sheetNames ?? generated.worksheets.map((ws) => ws.name).filter(
    (n) => reference.getWorksheet(n) != null,
  );
  let checked = 0;

  for (const name of sheets) {
    const genWs = generated.getWorksheet(name);
    const refWs = reference.getWorksheet(name);
    if (!genWs || !refWs) continue;

    const maxRow = Math.min(6, genWs.rowCount, refWs.rowCount);
    const maxCol = Math.min(12, genWs.columnCount || 12, refWs.columnCount || 12);

    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const genText = cellText(genWs.getRow(r).getCell(c)).trim();
        const refText = cellText(refWs.getRow(r).getCell(c)).trim();
        if (!refText || refText.startsWith('=')) continue;
        checked++;
        if (genText !== refText) {
          errors.push(`${name}!R${r}C${c}: ref "${refText}" vs gen "${genText}"`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, checked };
}
