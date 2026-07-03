// ===== server/services/tbTemplateWriter.ts =====
import ExcelJS from 'exceljs';
import { CHART_OF_ACCOUNTS } from '../../src/data/chartOfAccounts.js';
import {
  applyHeaderStyle,
  applySubHeaderStyle,
  applyInputStyle,
  COLORS,
  NUMBER_FORMAT,
} from './excelWriter.js';

const TOTAL_COLS = 19;
const CY_AMOUNT_COLS = [2, 3, 4, 5, 6, 7, 8, 9];
const PY_AMOUNT_COLS = [12, 13, 14, 15, 16, 17, 18, 19];

const SECTION_MAP: { prefixes: string[]; header: string }[] = [
  { prefixes: ['BS Equity'], header: 'CAPITAL ACCOUNT & RESERVES' },
  { prefixes: ['BS NCL Borrowings'], header: 'NON-CURRENT LIABILITIES - LOANS & BORROWINGS' },
  { prefixes: ['BS NCL Employee Benefits'], header: 'NON-CURRENT LIABILITIES - EMPLOYEE BENEFITS' },
  { prefixes: ['BS NCL Provisions'], header: 'NON-CURRENT LIABILITIES - PROVISIONS' },
  { prefixes: ['BS NCL'], header: 'NON-CURRENT LIABILITIES - OTHER' },
  { prefixes: ['BS CL Trade Payables'], header: 'CURRENT LIABILITIES - TRADE PAYABLES' },
  { prefixes: ['BS CL Borrowings'], header: 'CURRENT LIABILITIES - LOANS & BORROWINGS' },
  { prefixes: ['BS CL Tax'], header: 'CURRENT LIABILITIES - TAX PAYABLE' },
  { prefixes: ['BS CL Employee'], header: 'CURRENT LIABILITIES - EMPLOYEE PAYABLES' },
  { prefixes: ['BS CL Provisions'], header: 'CURRENT LIABILITIES - PROVISIONS' },
  { prefixes: ['BS CL Other'], header: 'CURRENT LIABILITIES - OTHER' },
  { prefixes: ['BS CA Tax'], header: 'CURRENT ASSETS - ADVANCE TAX' },
  { prefixes: ['BS NCA PPE'], header: 'PROPERTY, PLANT & EQUIPMENT' },
  { prefixes: ['BS NCA/CA Investments', 'BS NCA Investments'], header: 'INVESTMENTS' },
  { prefixes: ['BS NCA'], header: 'OTHER NON-CURRENT ASSETS' },
  { prefixes: ['BS CA Inventory'], header: 'CURRENT ASSETS - INVENTORY' },
  { prefixes: ['BS CA Receivables'], header: 'CURRENT ASSETS - TRADE RECEIVABLES' },
  { prefixes: ['BS CA Other Receivables'], header: 'CURRENT ASSETS - OTHER RECEIVABLES' },
  { prefixes: ['BS CA Cash'], header: 'CURRENT ASSETS - CASH & BANK' },
  { prefixes: ['BS CA'], header: 'CURRENT ASSETS - OTHER' },
  { prefixes: ['IS Revenue'], header: 'DIRECT INCOME' },
  { prefixes: ['IS Other Income'], header: 'INDIRECT INCOME' },
  { prefixes: ['IS COGS'], header: 'DIRECT EXPENSES' },
  { prefixes: ['IS Employee Benefits'], header: 'EMPLOYEE BENEFIT EXPENSES' },
  { prefixes: ['IS Finance Costs'], header: 'FINANCE COSTS' },
  { prefixes: ['IS Depreciation'], header: 'DEPRECIATION' },
  { prefixes: ['IS Impairment'], header: 'IMPAIRMENT EXPENSES' },
  { prefixes: ['IS Admin'], header: 'ADMINISTRATIVE EXPENSES' },
  { prefixes: ['IS Tax'], header: 'INCOME TAX EXPENSE' },
];

function resolveSectionHeader(statementLine: string): string | null {
  for (const { prefixes, header } of SECTION_MAP) {
    for (const prefix of prefixes) {
      if (statementLine.startsWith(prefix)) return header;
    }
  }
  return null;
}

function buildSectionAccounts(): { header: string; accounts: { displayLabel: string }[] }[] {
  const sectionAccounts = new Map<string, { displayLabel: string }[]>();
  const sectionOrder: string[] = [];

  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup || entry.statementLine === 'N/A') continue;
    const header = resolveSectionHeader(entry.statementLine);
    if (!header) continue;
    if (!sectionAccounts.has(header)) {
      sectionAccounts.set(header, []);
      sectionOrder.push(header);
    }
    sectionAccounts.get(header)!.push({ displayLabel: entry.displayLabel });
  }

  return SECTION_MAP
    .map(({ header }) => header)
    .filter((header) => sectionAccounts.has(header))
    .map((header) => ({ header, accounts: sectionAccounts.get(header)! }));
}

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

    const cyHeaders = [
      'Particulars',
      'Opening Dr.',
      'Opening Cr.',
      'During Dr.',
      'During Cr.',
      'Adjustment Dr.',
      'Adjustment Cr.',
      'Closing Dr.',
      'Closing Cr.',
    ];
    const headerRow = ws.getRow(5);
    cyHeaders.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      applySubHeaderStyle(c);
      c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    });
    cyHeaders.forEach((h, i) => {
      const c = headerRow.getCell(11 + i);
      c.value = h;
      applySubHeaderStyle(c);
      c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    });

    let currentRow = 6;
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

    const dataStartRow = 6;
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

    ws.views = [{ state: 'frozen', ySplit: 5 }];

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('[tbTemplateWriter] Error generating trial balance template:', error);
    throw error;
  }
}
