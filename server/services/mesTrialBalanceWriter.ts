// MEs-format dual-year Trial Balance sheet (21 columns, CY + PY blocks).
import ExcelJS from 'exceljs';
import type { CompanyProfile, ParsedTrialBalance } from '../../src/types/index.js';
import type { MappedTBRow, RawTBRow } from '../../src/types/trialBalance.js';
import {
  buildSectionAccounts,
  CY_AMOUNT_COLS,
  PY_AMOUNT_COLS,
  TOTAL_COLS,
} from './tbStandardSchema.js';

const NUMBER_FORMAT = '#,##0.00';
const SUBHEADER_BG = 'E2EFDA';
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E3A5F' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
}

function applySubHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 10, bold: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SUBHEADER_BG}` } };
  cell.border = THIN_BORDER as ExcelJS.Borders;
}

function applyInputStyle(cell: ExcelJS.Cell): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
}

export const MES_TB_TOTAL_COLS = TOTAL_COLS;
export const MES_TB_CY_COLS = CY_AMOUNT_COLS;
export const MES_TB_PY_COLS = PY_AMOUNT_COLS;

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

function normLabel(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function indexRows(rows: MappedTBRow[]): Map<string, MappedTBRow> {
  const map = new Map<string, MappedTBRow>();
  for (const row of rows) {
    if (row.isGroupRow) continue;
    map.set(normLabel(row.rawLabel), row);
    if (row.displayLabel) map.set(normLabel(row.displayLabel), row);
    if (row.nfrsCategory) map.set(String(row.nfrsCategory), row);
  }
  return map;
}

function indexPyRows(rows: RawTBRow[] | null | undefined): Map<string, RawTBRow> {
  const map = new Map<string, RawTBRow>();
  for (const row of rows ?? []) {
    if (row.isGroupRow) continue;
    map.set(normLabel(row.rawLabel), row);
  }
  return map;
}

function adjustedBalance(r: RawTBRow | MappedTBRow): number {
  return (r.openingDr ?? 0) - (r.openingCr ?? 0)
    + (r.duringDr ?? 0) - (r.duringCr ?? 0)
    + (r.adjustmentDr ?? 0) - (r.adjustmentCr ?? 0);
}

function writeAmountCells(
  row: ExcelJS.Row,
  rowNum: number,
  cols: number[],
  amounts: number[],
  styled = false,
): void {
  // cols: Opening Dr, Opening Cr, During Dr, During Cr, Adj Dr, Adj Cr, Adj Balance, Closing Dr, Closing Cr
  const [od, oc, dd, dc, ad, ac, , cd, cc] = amounts;
  const dataCols = [od, oc, dd, dc, ad, ac];
  dataCols.forEach((amt, i) => {
    const cell = row.getCell(cols[i]);
    cell.value = amt || null;
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: 'right' };
    if (styled) applyInputStyle(cell);
    cell.border = THIN_BORDER as ExcelJS.Borders;
  });

  const adjBalCol = cols[6];
  const adjCell = row.getCell(adjBalCol);
  const odL = colLetter(cols[0]);
  const ocL = colLetter(cols[1]);
  const ddL = colLetter(cols[2]);
  const dcL = colLetter(cols[3]);
  const adL = colLetter(cols[4]);
  const acL = colLetter(cols[5]);
  adjCell.value = {
    formula: `${odL}${rowNum}-${ocL}${rowNum}+${ddL}${rowNum}-${dcL}${rowNum}+${adL}${rowNum}-${acL}${rowNum}`,
    result: adjustedBalance({ openingDr: od, openingCr: oc, duringDr: dd, duringCr: dc, adjustmentDr: ad, adjustmentCr: ac } as MappedTBRow),
  };
  adjCell.numFmt = NUMBER_FORMAT;
  adjCell.alignment = { horizontal: 'right' };
  adjCell.border = THIN_BORDER as ExcelJS.Borders;

  [cd, cc].forEach((amt, i) => {
    const cell = row.getCell(cols[7 + i]);
    cell.value = amt || null;
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: 'right' };
    if (styled) applyInputStyle(cell);
    cell.border = THIN_BORDER as ExcelJS.Borders;
  });
}

function rowAmounts(r: RawTBRow | MappedTBRow): number[] {
  return [
    r.openingDr, r.openingCr, r.duringDr, r.duringCr,
    r.adjustmentDr, r.adjustmentCr, adjustedBalance(r),
    r.closingDr, r.closingCr,
  ];
}

export function writeMesFormatTrialBalance(
  ws: ExcelJS.Worksheet,
  tb: ParsedTrialBalance,
  company?: CompanyProfile,
  options?: { incomeStatementNetProfit?: number },
): void {
  ws.getColumn(1).width = 42;
  for (const col of [...MES_TB_CY_COLS, ...MES_TB_PY_COLS]) {
    ws.getColumn(col).width = 14;
  }

  const companyName = company?.companyName ?? tb.companyName ?? '[COMPANY NAME]';
  const fy = company?.fiscalYear?.bsFY ?? tb.fiscalYear ?? '';

  ws.mergeCells(1, 1, 1, MES_TB_TOTAL_COLS);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = companyName;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderStyle(titleCell);
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, MES_TB_TOTAL_COLS);
  const subCell = ws.getCell(2, 1);
  subCell.value = `TRIAL BALANCE — FISCAL YEAR ${fy}`;
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderStyle(subCell);

  ws.mergeCells(3, 1, 3, 10);
  ws.getCell(3, 1).value = 'CURRENT YEAR';
  ws.getCell(3, 1).font = { name: 'Arial', size: 10, bold: true };
  ws.getCell(3, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(3, 12, 3, MES_TB_TOTAL_COLS);
  ws.getCell(3, 12).value = 'PREVIOUS YEAR';
  ws.getCell(3, 12).font = { name: 'Arial', size: 10, bold: true };
  ws.getCell(3, 12).alignment = { horizontal: 'center' };

  const cyHeaders = [
    'Particulars', 'Opening Dr.', 'Opening Cr.', 'During Dr.', 'During Cr.',
    'Adjustment Dr.', 'Adjustment Cr.', 'Adjusted Balance', 'Closing Dr.', 'Closing Cr.',
  ];
  const headerRow = ws.getRow(5);
  cyHeaders.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle(c);
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
  });
  cyHeaders.forEach((h, i) => {
    const c = headerRow.getCell(12 + i);
    c.value = h;
    applySubHeaderStyle(c);
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
  });

  const cyIndex = indexRows(tb.rows);
  const pyIndex = indexPyRows(tb.previousYearData ?? undefined);
  const matchedCy = new Set<MappedTBRow>();
  let currentRow = 6;
  const dataStartRow = currentRow;

  for (const { header, accounts } of buildSectionAccounts()) {
    ws.mergeCells(currentRow, 1, currentRow, MES_TB_TOTAL_COLS);
    const sectionCell = ws.getRow(currentRow).getCell(1);
    sectionCell.value = header;
    sectionCell.font = { name: 'Arial', size: 10, bold: true };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${SUBHEADER_BG}` } };
    currentRow++;

    for (const account of accounts) {
      const cyRow = cyIndex.get(normLabel(account.displayLabel))
        ?? cyIndex.get(account.category);
      if (!cyRow) continue;
      matchedCy.add(cyRow);

      const pyRow = pyIndex.get(normLabel(account.displayLabel))
        ?? pyIndex.get(normLabel(cyRow.rawLabel));

      const row = ws.getRow(currentRow);
      row.getCell(1).value = account.displayLabel;
      row.getCell(1).font = { name: 'Arial', size: 10 };
      writeAmountCells(row, currentRow, MES_TB_CY_COLS, rowAmounts(cyRow));
      if (pyRow) {
        writeAmountCells(row, currentRow, MES_TB_PY_COLS, rowAmounts(pyRow));
      } else {
        writeAmountCells(row, currentRow, MES_TB_PY_COLS, [0, 0, 0, 0, 0, 0, 0, 0, 0], true);
      }
      currentRow++;
    }
  }

  const unmatched = tb.rows.filter((r) => !r.isGroupRow && !matchedCy.has(r));
  if (unmatched.length > 0) {
    ws.mergeCells(currentRow, 1, currentRow, MES_TB_TOTAL_COLS);
    ws.getRow(currentRow).getCell(1).value = 'OTHER ACCOUNTS';
    ws.getRow(currentRow).getCell(1).font = { name: 'Arial', size: 10, bold: true };
    currentRow++;

    for (const cyRow of unmatched) {
      const pyRow = pyIndex.get(normLabel(cyRow.rawLabel));
      const row = ws.getRow(currentRow);
      row.getCell(1).value = cyRow.displayLabel ?? cyRow.rawLabel;
      writeAmountCells(row, currentRow, MES_TB_CY_COLS, rowAmounts(cyRow));
      if (pyRow) writeAmountCells(row, currentRow, MES_TB_PY_COLS, rowAmounts(pyRow));
      else writeAmountCells(row, currentRow, MES_TB_PY_COLS, [0, 0, 0, 0, 0, 0, 0, 0, 0], true);
      currentRow++;
    }
  }

  const dataEndRow = currentRow - 1;
  const totalRow = ws.getRow(currentRow);
  totalRow.getCell(1).value = 'GRAND TOTAL';
  totalRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };

  const doubleTop = { style: 'double' as const, color: { argb: 'FF1E40AF' } };
  for (const col of [...MES_TB_CY_COLS, ...MES_TB_PY_COLS]) {
    const cell = totalRow.getCell(col);
    const letter = colLetter(col);
    cell.value = { formula: `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`, result: 0 };
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: 'right' };
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.border = { top: doubleTop };
  }

  // Profit tie-out: TB profit vs IS profit
  const closingCrCol = colLetter(MES_TB_CY_COLS[8]);
  const closingDrCol = colLetter(MES_TB_CY_COLS[7]);
  const tieOutRow = currentRow + 2;
  ws.getRow(tieOutRow).getCell(1).value = 'Profit (Trial Balance)';
  ws.getRow(tieOutRow).getCell(1).font = { name: 'Arial', size: 10, bold: true };
  ws.getRow(tieOutRow).getCell(closingCrCol).value = {
    formula: `${closingCrCol}${currentRow}-${closingDrCol}${currentRow}`,
    result: 0,
  };
  ws.getRow(tieOutRow).getCell(closingCrCol).numFmt = NUMBER_FORMAT;

  ws.getRow(tieOutRow + 1).getCell(1).value = 'Profit (Income Statement)';
  ws.getRow(tieOutRow + 1).getCell(1).font = { name: 'Arial', size: 10, bold: true };
  const isProfit = options?.incomeStatementNetProfit ?? null;
  ws.getRow(tieOutRow + 1).getCell(closingCrCol).value = isProfit;
  ws.getRow(tieOutRow + 1).getCell(closingCrCol).numFmt = NUMBER_FORMAT;

  ws.getRow(tieOutRow + 2).getCell(1).value = 'Tie-out (should be zero difference)';
  ws.getRow(tieOutRow + 2).getCell(1).font = { name: 'Arial', size: 10, italic: true };
  ws.getRow(tieOutRow + 2).getCell(closingCrCol).value = {
    formula: `${closingCrCol}${tieOutRow}-${closingCrCol}${tieOutRow + 1}`,
    result: 0,
  };
  ws.getRow(tieOutRow + 2).getCell(closingCrCol).numFmt = NUMBER_FORMAT;

  ws.views = [{ state: 'frozen', ySplit: 5 }];
}
