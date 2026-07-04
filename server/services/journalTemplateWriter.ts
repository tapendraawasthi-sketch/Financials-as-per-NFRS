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

export async function generateJournalEntryTemplate(companyName?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NFRS Reporter';
  wb.created = new Date();
  const ws = wb.addWorksheet('Adjustment Journal');

  ws.getColumn(JOURNAL_COL.sNo).width = 8;
  ws.getColumn(JOURNAL_COL.drCr).width = 8;
  ws.getColumn(JOURNAL_COL.particulars).width = 36;
  ws.getColumn(JOURNAL_COL.drAmount).width = 16;
  ws.getColumn(JOURNAL_COL.crAmount).width = 16;
  ws.getColumn(JOURNAL_COL.linkedTo).width = 12;

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
    'Fill in GREEN cells only — one journal entry may span multiple rows (S.No. on first line only). '
    + 'Each row is either Dr or Cr. Leave unused rows blank.';
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

  const writeExampleRow = (
    rowNum: number,
    sNo: number | null,
    drCr: 'Dr' | 'Cr',
    particulars: string,
    drAmount: number | null,
    crAmount: number | null,
    linkedTo = 'Trial',
  ) => {
    const row = ws.getRow(rowNum);
    if (sNo != null) row.getCell(JOURNAL_COL.sNo).value = sNo;
    row.getCell(JOURNAL_COL.drCr).value = drCr;
    row.getCell(JOURNAL_COL.particulars).value = particulars;
    if (drAmount != null) row.getCell(JOURNAL_COL.drAmount).value = drAmount;
    if (crAmount != null) row.getCell(JOURNAL_COL.crAmount).value = crAmount;
    row.getCell(JOURNAL_COL.linkedTo).value = linkedTo;
    for (const col of [JOURNAL_COL.drCr, JOURNAL_COL.particulars, JOURNAL_COL.drAmount, JOURNAL_COL.crAmount, JOURNAL_COL.linkedTo]) {
      applyInputStyle(row.getCell(col));
    }
    row.getCell(JOURNAL_COL.drAmount).numFmt = NUMBER_FORMAT;
    row.getCell(JOURNAL_COL.crAmount).numFmt = NUMBER_FORMAT;
    row.getCell(JOURNAL_COL.drAmount).alignment = { horizontal: 'right' };
    row.getCell(JOURNAL_COL.crAmount).alignment = { horizontal: 'right' };
  };

  let r = JOURNAL_DATA_START_ROW;
  writeExampleRow(r++, 1, 'Dr', 'Depreciation', 907506, null);
  writeExampleRow(r++, null, 'Cr', 'Accumulated Depreciation', null, 907506);
  const narrRow = ws.getRow(r++);
  narrRow.getCell(JOURNAL_COL.particulars).value = '(Being depreciation charged)';
  narrRow.getCell(JOURNAL_COL.particulars).font = { name: 'Arial', size: 10, italic: true };
  r++; // blank separator
  writeExampleRow(r++, 2, 'Dr', 'Audit Fee Expense', 50000, null);
  writeExampleRow(r++, null, 'Cr', 'Audit Fee Payable', null, 50000);
  r++; // blank separator

  const templateStart = r;
  for (let i = 0; i < JOURNAL_TEMPLATE_ROWS; i++) {
    const row = ws.getRow(templateStart + i);
    applyInputStyle(row.getCell(JOURNAL_COL.sNo));
    applyInputStyle(row.getCell(JOURNAL_COL.particulars));
    applyInputStyle(row.getCell(JOURNAL_COL.drAmount));
    applyInputStyle(row.getCell(JOURNAL_COL.crAmount));
    applyInputStyle(row.getCell(JOURNAL_COL.linkedTo));
    row.getCell(JOURNAL_COL.drAmount).numFmt = NUMBER_FORMAT;
    row.getCell(JOURNAL_COL.crAmount).numFmt = NUMBER_FORMAT;
    row.getCell(JOURNAL_COL.drAmount).alignment = { horizontal: 'right' };
    row.getCell(JOURNAL_COL.crAmount).alignment = { horizontal: 'right' };
    row.getCell(JOURNAL_COL.drCr).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Dr,Cr"'],
      showErrorMessage: true,
      errorTitle: 'Invalid',
      error: 'Select Dr or Cr',
    };
    applyInputStyle(row.getCell(JOURNAL_COL.drCr));
  }

  const checkRow = templateStart + JOURNAL_TEMPLATE_ROWS + 1;
  ws.mergeCells(checkRow, 1, checkRow, totalCols);
  const checkCell = ws.getCell(checkRow, 1);
  checkCell.value = 'Check: Dr Total must equal Cr Total per S.No.';
  checkCell.font = { name: 'Arial', size: 10, italic: true, bold: true };
  checkCell.alignment = { horizontal: 'center' };

  ws.views = [{ state: 'frozen', ySplit: JOURNAL_HEADER_ROW, activeCell: 'B6' }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { JOURNAL_TYPE_OPTIONS };
