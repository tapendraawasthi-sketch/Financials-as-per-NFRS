// ===== server/services/tbTemplateWriter.ts =====
import ExcelJS from 'exceljs';
import {
  applyHeaderStyle,
  applySubHeaderStyle,
  applyInputStyle,
  COLORS,
  NUMBER_FORMAT,
} from './excelWriter.js';
import {
  buildSectionAccounts,
  CY_AMOUNT_COLS,
  PY_AMOUNT_COLS,
  TOTAL_COLS,
  STANDARD_TB_COLUMNS,
  HEADER_ROW_INDEX,
} from './tbStandardSchema.js';

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

export async function generateTrialBalanceTemplate(): Promise<Buffer> {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NFRS Reporter';
    wb.created = new Date();
    const ws = wb.addWorksheet('Trial Balance');

    ws.getColumn(1).width = 40;
    for (const col of [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS]) {
      ws.getColumn(col).width = 14;
    }

    ws.mergeCells(1, 1, 1, TOTAL_COLS);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = '[COMPANY NAME]';
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyHeaderStyle(titleCell);
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, TOTAL_COLS);
    const subtitleCell = ws.getCell(2, 1);
    subtitleCell.value = 'NAS FOR MEs — TRIAL BALANCE TEMPLATE';
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyHeaderStyle(subtitleCell);

    ws.mergeCells(3, 1, 3, TOTAL_COLS);
    const noteCell = ws.getCell(3, 1);
    noteCell.value =
      'Fill in GREEN cells only. Do not rename or delete account labels or section headers. You may insert extra rows within a section to add accounts not listed here.';
    noteCell.font = { name: 'Arial', size: 10, italic: true };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getRow(3).height = 36;

    const headerRow = ws.getRow(HEADER_ROW_INDEX);
    for (const colDef of STANDARD_TB_COLUMNS) {
      if (colDef.block === 'spacer' || !colDef.header) continue;
      const c = headerRow.getCell(colDef.col);
      c.value = colDef.header;
      applySubHeaderStyle(c);
      c.alignment = { horizontal: colDef.col === 1 || colDef.col === 12 ? 'left' : 'center', vertical: 'middle' };
    }

    let currentRow = HEADER_ROW_INDEX + 1;
    const sections = buildSectionAccounts();

    for (const { header, accounts } of sections) {
      ws.mergeCells(currentRow, 1, currentRow, TOTAL_COLS);
      const sectionCell = ws.getRow(currentRow).getCell(1);
      sectionCell.value = header;
      sectionCell.font = { name: 'Arial', size: 10, bold: true };
      sectionCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${COLORS.SUBHEADER_BG}` },
      };
      sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      for (const account of accounts) {
        const row = ws.getRow(currentRow);
        row.getCell(1).value = account.displayLabel;
        row.getCell(1).font = { name: 'Arial', size: 10 };

        for (const col of [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS]) {
          const cell = row.getCell(col);
          cell.value = null;
          applyInputStyle(cell);
          cell.numFmt = NUMBER_FORMAT;
          cell.alignment = { horizontal: 'right' };
        }
        currentRow++;
      }
    }

    const dataStartRow = HEADER_ROW_INDEX + 1;
    const dataEndRow = currentRow - 1;
    const totalRow = ws.getRow(currentRow);
    totalRow.getCell(1).value = 'GRAND TOTAL';
    totalRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };

    const doubleTop = { style: 'double' as const, color: { argb: 'FF1E40AF' } };
    for (const col of [...CY_AMOUNT_COLS, ...PY_AMOUNT_COLS]) {
      const cell = totalRow.getCell(col);
      const letter = colLetter(col);
      cell.value = { formula: `SUM(${letter}${dataStartRow}:${letter}${dataEndRow})`, result: 0 };
      cell.numFmt = NUMBER_FORMAT;
      cell.alignment = { horizontal: 'right' };
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = { top: doubleTop };
    }

    ws.views = [{ state: 'frozen', ySplit: HEADER_ROW_INDEX }];

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('[tbTemplateWriter] Error generating trial balance template:', error);
    throw error;
  }
}
