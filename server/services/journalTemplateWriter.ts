// ===== server/services/journalTemplateWriter.ts =====
import ExcelJS from 'exceljs';
import {
  applyHeaderStyle,
  applySubHeaderStyle,
  applyInputStyle,
  COLORS,
  NUMBER_FORMAT,
} from './excelWriter.js';
import {
  JOURNAL_HEADERS,
  JOURNAL_DATA_START_ROW,
  JOURNAL_HEADER_ROW,
  JOURNAL_TEMPLATE_ROWS,
  JOURNAL_COL,
  JOURNAL_TYPE_OPTIONS,
} from './journalStandardSchema.js';

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

export async function generateJournalEntryTemplate(companyName?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NFRS Reporter';
  wb.created = new Date();
  const ws = wb.addWorksheet('Adjustment Journal');

  ws.getColumn(JOURNAL_COL.rowNum).width = 6;
  ws.getColumn(JOURNAL_COL.description).width = 36;
  ws.getColumn(JOURNAL_COL.debitAccount).width = 28;
  ws.getColumn(JOURNAL_COL.creditAccount).width = 28;
  ws.getColumn(JOURNAL_COL.amount).width = 16;
  ws.getColumn(JOURNAL_COL.type).width = 12;

  const totalCols = JOURNAL_HEADERS.length;

  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = companyName?.trim() || '[COMPANY NAME]';
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderStyle(titleCell);
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, totalCols);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = 'YEAR-END ADJUSTMENT JOURNAL ENTRIES';
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderStyle(subtitleCell);

  ws.mergeCells(3, 1, 3, totalCols);
  const noteCell = ws.getCell(3, 1);
  noteCell.value =
    'Fill in GREEN cells only — one journal entry per row. Each entry must have equal Dr and Cr amounts. '
    + 'Leave unused rows blank. Type is optional (DEPN, PROV, INV, INV-FV, TAX, OTHER).';
  noteCell.font = { name: 'Arial', size: 10, italic: true };
  noteCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(3).height = 40;

  const headerRow = ws.getRow(JOURNAL_HEADER_ROW);
  JOURNAL_HEADERS.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle(c);
    c.alignment = { horizontal: i === 0 ? 'center' : 'left', vertical: 'middle' };
  });

  const exampleRow = ws.getRow(JOURNAL_DATA_START_ROW);
  exampleRow.getCell(JOURNAL_COL.rowNum).value = 1;
  exampleRow.getCell(JOURNAL_COL.description).value = 'e.g. Audit fee accrual for the year';
  exampleRow.getCell(JOURNAL_COL.debitAccount).value = 'Audit Fee Expense';
  exampleRow.getCell(JOURNAL_COL.creditAccount).value = 'Audit Fee Payable';
  exampleRow.getCell(JOURNAL_COL.amount).value = 50000;
  exampleRow.getCell(JOURNAL_COL.type).value = 'OTHER';
  for (let col = JOURNAL_COL.description; col <= JOURNAL_COL.type; col++) {
    applyInputStyle(exampleRow.getCell(col));
  }
  exampleRow.getCell(JOURNAL_COL.amount).numFmt = NUMBER_FORMAT;
  exampleRow.getCell(JOURNAL_COL.amount).alignment = { horizontal: 'right' };

  for (let r = JOURNAL_DATA_START_ROW + 1; r < JOURNAL_DATA_START_ROW + JOURNAL_TEMPLATE_ROWS; r++) {
    const row = ws.getRow(r);
    row.getCell(JOURNAL_COL.rowNum).value = r - JOURNAL_DATA_START_ROW + 1;
    for (let col = JOURNAL_COL.description; col <= JOURNAL_COL.type; col++) {
      applyInputStyle(row.getCell(col));
    }
    row.getCell(JOURNAL_COL.amount).numFmt = NUMBER_FORMAT;
    row.getCell(JOURNAL_COL.amount).alignment = { horizontal: 'right' };
  }

  const totalRow = JOURNAL_DATA_START_ROW + JOURNAL_TEMPLATE_ROWS;
  const firstDataRow = JOURNAL_DATA_START_ROW;
  const lastDataRow = totalRow - 1;
  const amountCol = colLetter(JOURNAL_COL.amount);

  ws.getRow(totalRow).getCell(JOURNAL_COL.description).value = 'TOTAL (Dr must equal Cr)';
  ws.getRow(totalRow).getCell(JOURNAL_COL.description).font = { name: 'Arial', size: 10, bold: true };
  ws.getRow(totalRow).getCell(JOURNAL_COL.debitAccount).value = 'Total Dr / Cr:';
  ws.getRow(totalRow).getCell(JOURNAL_COL.debitAccount).font = { name: 'Arial', size: 10, bold: true };
  ws.getRow(totalRow).getCell(JOURNAL_COL.amount).value = {
    formula: `SUM(${amountCol}${firstDataRow}:${amountCol}${lastDataRow})`,
  };
  ws.getRow(totalRow).getCell(JOURNAL_COL.amount).numFmt = NUMBER_FORMAT;
  ws.getRow(totalRow).getCell(JOURNAL_COL.amount).font = { name: 'Arial', size: 10, bold: true };
  ws.getRow(totalRow).getCell(JOURNAL_COL.amount).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TOTAL_BG}` },
  };

  ws.views = [{ state: 'frozen', ySplit: JOURNAL_HEADER_ROW, activeCell: 'B6' }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { JOURNAL_TYPE_OPTIONS };
