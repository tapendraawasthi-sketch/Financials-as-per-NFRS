// ===== server/services/excelWriter.ts =====
import ExcelJS from 'exceljs';
import { FISCAL_YEARS } from '../../src/data/fiscalYears.js';
import type {
  CompanyProfile,
  ParsedTrialBalance,
  BalanceSheet,
  IncomeStatement,
  ChangesInEquity,
  CashFlowStatement,
  NotesData,
  YearEndAdjustments,
  DepreciationSummary,
} from '../../src/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COLORS = {
  BRAND_BLUE:   '1E40AF',
  HEADER_BG:    '1E3A8A',
  SUBHEADER_BG: 'DBEAFE',
  TOTAL_BG:     'EFF6FF',
  AMOUNT_BG:    'F8FAFC',
  GREEN_INPUT:  '86EFAC',
  YELLOW_NOTE:  'FEF9C3',
  WHITE:        'FFFFFF',
  BORDER_COLOR: 'CBD5E1',
  RED:          'DC2626',
  LIGHT_GRAY:   'F1F5F9',
};

const FONTS = {
  HEADING:    { name: 'Arial', size: 12, bold: true,  color: { argb: `FF${COLORS.WHITE}` } },
  SUBHEADING: { name: 'Arial', size: 10, bold: true,  color: { argb: `FF${COLORS.BRAND_BLUE}` } },
  BODY:       { name: 'Arial', size: 10 },
  AMOUNT:     { name: 'Arial', size: 10 },
  TOTAL:      { name: 'Arial', size: 10, bold: true },
  NOTE_REF:   { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } },
  TITLE:      { name: 'Arial', size: 14, bold: true,  color: { argb: `FF${COLORS.WHITE}` } },
};

const NUMBER_FORMAT     = '#,##0';
const NUMBER_FORMAT_DEC = '#,##0.00';
const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${COLORS.BORDER_COLOR}` } };
const MEDIUM_BORDER: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: `FF${COLORS.BRAND_BLUE}` } };

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------
function applyHeaderFill(cell: ExcelJS.Cell, colorHex: string = COLORS.HEADER_BG): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${colorHex}` } };
}

function applyAllBorders(cell: ExcelJS.Cell): void {
  cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
}

function setTotalRowStyle(ws: ExcelJS.Worksheet, row: number, lastCol: string = 'D'): void {
  const exRow = ws.getRow(row);
  exRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { ...FONTS.TOTAL };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
    cell.border = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER };
  });
}

function writeSectionHeader(ws: ExcelJS.Worksheet, row: number, text: string, lastColIndex: number = 4): void {
  const exRow = ws.getRow(row);
  const cell = exRow.getCell(1);
  ws.mergeCells(row, 1, row, lastColIndex);
  cell.value = text;
  cell.font = { ...FONTS.HEADING };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  applyHeaderFill(cell, COLORS.HEADER_BG);
  exRow.height = 18;
}

function writeStatementHeader(
  ws: ExcelJS.Worksheet,
  companyName: string,
  statementTitle: string,
  periodLine: string,
  curYearLabel: string,
  prevYearLabel: string,
): number {
  // Row 1: Company name
  ws.mergeCells('A1:F1');
  const r1 = ws.getCell('A1');
  r1.value = companyName.toUpperCase();
  r1.font = FONTS.TITLE;
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderFill(r1, COLORS.HEADER_BG);
  ws.getRow(1).height = 26;

  // Row 2: Statement title
  ws.mergeCells('A2:F2');
  const r2 = ws.getCell('A2');
  r2.value = statementTitle;
  r2.font = { name: 'Arial', size: 12, bold: true };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Row 3: Period
  ws.mergeCells('A3:F3');
  const r3 = ws.getCell('A3');
  r3.value = periodLine;
  r3.font = { name: 'Arial', size: 10, italic: true };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 16;

  // Row 4: Amount note
  ws.mergeCells('A4:F4');
  const r4 = ws.getCell('A4');
  r4.value = 'All amounts in NPR (Nepalese Rupees)';
  r4.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
  r4.alignment = { horizontal: 'right' };
  ws.getRow(4).height = 14;

  // Row 5: Column headers
  const headerRow = ws.getRow(5);
  headerRow.getCell(1).value = 'Particulars';
  headerRow.getCell(2).value = 'Note';
  headerRow.getCell(3).value = curYearLabel;
  headerRow.getCell(4).value = prevYearLabel;
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { ...FONTS.SUBHEADING };
    cell.alignment = { horizontal: Number(cell.col) === 1 ? 'left' : 'center', vertical: 'middle' };
    applyHeaderFill(cell, COLORS.SUBHEADER_BG);
    applyAllBorders(cell);
  });
  headerRow.height = 18;

  ws.views = [{ state: 'frozen', ySplit: 5, xSplit: 0 }];
  return 6; // next data row
}

type AmtRow = { label: string; note?: string; cy?: number; py?: number; isSectionHeader?: boolean; isTotal?: boolean; isSubTotal?: boolean; indent?: number };

function writeAmountRow(ws: ExcelJS.Worksheet, rowNum: number, r: AmtRow): void {
  const exRow = ws.getRow(rowNum);
  if (r.isSectionHeader) {
    writeSectionHeader(ws, rowNum, r.label);
    return;
  }
  const indent = '  '.repeat(r.indent ?? 0);
  const cell1 = exRow.getCell(1); cell1.value = indent + r.label;
  const cell2 = exRow.getCell(2); if (r.note) { cell2.value = r.note; cell2.font = FONTS.NOTE_REF; }
  const cell3 = exRow.getCell(3); cell3.value = r.cy || null; cell3.numFmt = NUMBER_FORMAT; cell3.alignment = { horizontal: 'right' };
  const cell4 = exRow.getCell(4); cell4.value = r.py || null; cell4.numFmt = NUMBER_FORMAT; cell4.alignment = { horizontal: 'right' };
  [cell1, cell2, cell3, cell4].forEach(applyAllBorders);
  if (r.isTotal || r.isSubTotal) {
    [cell1, cell2, cell3, cell4].forEach((c) => {
      c.font = FONTS.TOTAL;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${r.isTotal ? COLORS.TOTAL_BG : COLORS.AMOUNT_BG}` } };
      if (r.isTotal) c.border = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER };
    });
  }
  exRow.height = 15;
}

function writeSignatureLine(ws: ExcelJS.Worksheet, startRow: number, company: CompanyProfile): void {
  ws.getRow(startRow).getCell(1).value = 'The notes referred to above form an integral part of these financial statements.';
  ws.getRow(startRow).getCell(1).font = { name: 'Arial', size: 9, italic: true };

  const sigRow = startRow + 2;
  ws.getRow(sigRow).getCell(1).value = 'For and on behalf of the Board of Directors';
  ws.getRow(sigRow).getCell(1).font = { name: 'Arial', size: 9 };

  const nameRow = sigRow + 3;
  ws.getRow(nameRow).getCell(1).value = company.chairperson ?? 'Chairperson';
  ws.getRow(nameRow).getCell(3).value = company.director ?? 'Director';

  const audRow = nameRow + 2;
  ws.getRow(audRow).getCell(1).value = `For ${company.auditorInfo?.auditorFirmName ?? 'Audit Firm'}`;
  ws.getRow(audRow + 1).getCell(1).value = company.auditorInfo?.auditorName ?? 'Auditor';
  ws.getRow(audRow + 2).getCell(1).value = company.auditorInfo?.position ?? 'Engagement Partner';
}

// ---------------------------------------------------------------------------
// Per-sheet writer functions
// ---------------------------------------------------------------------------

export function writeWorkings(
  ws: ExcelJS.Worksheet,
  company: CompanyProfile,
  wb: ExcelJS.Workbook,
): void {
  // Hide this sheet from regular users
  ws.state = 'veryHidden';

  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 12;

  // ── SECTION 1: Fiscal Year Lookup Table ────────────────────────────────────
  const fyTableHeaderRow = ws.getRow(1);
  ['BS Year', 'Start BS', 'End BS', 'Start AD', 'End AD', 'Days in Year'].forEach((h, i) => {
    const cell = fyTableHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  fyTableHeaderRow.height = 18;

  FISCAL_YEARS.forEach((fy, idx) => {
    const row = ws.getRow(2 + idx);
    [
      fy.bsFY,
      fy.startDateBS,
      fy.endDateBS,
      fy.startDateAD,
      fy.endDateAD,
      fy.isLeapYear ? 366 : 365,
    ].forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: ci === 0 ? 'center' : 'left' };
      if (idx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBFF' } };
      }
    });
  });

  // Define named range for VLOOKUP in other sheets
  const fyLastRow = 1 + FISCAL_YEARS.length;
  try {
    wb.definedNames.add(
      `Workings!$A$2:$F$${fyLastRow}`,
      'FiscalYearTable'
    );
  } catch {
    // Named ranges may not be supported in all ExcelJS versions — skip gracefully
  }

  // ── SECTION 2: Company Parameters ─────────────────────────────────────────
  const paramStart = 30;
  const params: Array<{ label: string; value: string | number; name?: string }> = [
    { label: 'Company Name', value: company.companyName ?? '', name: 'CompanyName' },
    { label: 'Fiscal Year', value: company.fiscalYear?.bsFY ?? '', name: 'FiscalYear' },
    { label: 'End Date BS', value: company.fiscalYear?.endDateBS ?? '', name: 'YearEndDateBS' },
    { label: 'End Date AD', value: company.fiscalYear?.endDateAD ?? '', name: 'YearEndDateAD' },
    { label: 'Start Date BS', value: company.fiscalYear?.startDateBS ?? '', name: 'YearStartDateBS' },
    { label: 'Start Date AD', value: company.fiscalYear?.startDateAD ?? '', name: 'YearStartDateAD' },
    { label: 'Rounding Level (NPR)', value: company.accountingPolicies?.roundingLevel ?? 1, name: 'RoundingLevel' },
    { label: 'Income Tax Rate %', value: company.accountingPolicies?.incomeTaxRatePercent ?? 25, name: 'TaxRate' },
    { label: 'Staff Bonus Rate %', value: 10, name: 'BonusRate' },
    { label: 'PAN/VAT Number', value: company.panVatNumber ?? '' },
    { label: 'Registration No.', value: company.registrationNumber ?? '' },
  ];

  const paramSectionHeader = ws.getRow(paramStart - 1);
  paramSectionHeader.getCell(1).value = '▶ Company Parameters';
  paramSectionHeader.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E3A5F' } };
  paramSectionHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
  ws.mergeCells(paramStart - 1, 1, paramStart - 1, 6);

  params.forEach(({ label, value, name }, idx) => {
    const rowNum = paramStart + idx;
    const row = ws.getRow(rowNum);

    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { size: 9, color: { argb: 'FF374151' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBFF' } };

    const valueCell = row.getCell(2);
    valueCell.value = value;
    valueCell.font = { bold: true, size: 9 };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    valueCell.alignment = { horizontal: 'left' };

    // Register as named range so other sheets can reference it
    if (name) {
      try {
        wb.definedNames.add(`Workings!$B$${rowNum}`, name);
      } catch {
        // skip if not supported
      }
    }
  });

  // ── SECTION 3: Validation Dashboard ───────────────────────────────────────
  const valStart = 55;

  const valHeader = ws.getRow(valStart - 1);
  valHeader.getCell(1).value = '▶ Validation Dashboard';
  valHeader.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E3A5F' } };
  valHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
  ws.mergeCells(valStart - 1, 1, valStart - 1, 6);

  // Sub-headers
  const valColHeaders = ws.getRow(valStart);
  ['Check', 'Formula / Description', 'Result', 'Status'].forEach((h, i) => {
    const cell = valColHeaders.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EEF5' } };
  });

  const validationChecks = [
    {
      check: 'Balance Sheet Balance',
      desc: "Assets = Liabilities + Equity (difference must be 0)",
      formula: "='Balance Sheet'!C50-'Balance Sheet'!C80",  // Adjust row refs
    },
    {
      check: 'Cash Flow Reconciliation',
      desc: "Closing Cash (CF) = Closing Cash (BS)",
      formula: "='Cash Flow'!C60-'Balance Sheet'!C35",     // Adjust row refs
    },
    {
      check: 'Trial Balance Balanced',
      desc: "Total Closing Dr = Total Closing Cr",
      formula: "='Trial Balance'!C5-'Trial Balance'!D5",   // Adjust row refs
    },
    {
      check: 'Net Profit Tie',
      desc: "IS Net Profit = Equity change",
      formula: "='Income Statement'!C45-'Changes in Equity'!F15",  // Adjust
    },
  ];

  validationChecks.forEach((check, idx) => {
    const row = ws.getRow(valStart + 1 + idx);
    row.getCell(1).value = check.check;
    row.getCell(1).font = { size: 9 };
    row.getCell(2).value = check.desc;
    row.getCell(2).font = { size: 9, color: { argb: 'FF6B7280' } };

    // Result cell — shows the formula difference
    const resultCell = row.getCell(3);
    resultCell.value = { formula: check.formula.replace(/^=/, ''), result: 0 };
    resultCell.numFmt = '#,##0.00;(#,##0.00);"✓ OK"';
    resultCell.font = { bold: true, size: 9 };

    // Status cell — green if 0, red if not
    const statusCell = row.getCell(4);
    const resultCellAddress = `C${valStart + 1 + idx}`;
    statusCell.value = {
      formula: `IF(ABS(${resultCellAddress})<1,"✓ OK","⚠ CHECK")`,
      result: '✓ OK',
    };
    statusCell.font = { bold: true, size: 9 };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  });
}

function writeInstructions(ws: ExcelJS.Worksheet): void {
  ws.getRow(1).getCell(1).value = 'NFRS FINANCIAL REPORTER — USER GUIDE';
  ws.getRow(1).getCell(1).font = { name: 'Arial', size: 14, bold: true };

  const instructions = [
    ['Green cells', 'Input cells — enter your values here'],
    ['Blue headers', 'Automatically calculated — do not edit'],
    ['Printing', 'Use File → Print → set paper A4, scale to fit'],
    ['Trial Balance', 'Enter opening and closing balances for each account'],
    ['Balance Sheet', 'Auto-calculated from Trial Balance'],
    ['Income Statement', 'Auto-calculated from Trial Balance'],
    ['Notes', 'Detailed disclosures for each Balance Sheet line'],
    ['Depreciation', 'See Note 3.1 for full PPE schedule'],
  ];

  instructions.forEach(([term, desc], i) => {
    ws.getRow(i + 3).getCell(1).value = term;
    ws.getRow(i + 3).getCell(1).font = { name: 'Arial', size: 10, bold: true };
    ws.getRow(i + 3).getCell(2).value = desc;
    ws.getRow(i + 3).getCell(2).font = { name: 'Arial', size: 10 };
  });
}

function writeEnterDetails(ws: ExcelJS.Worksheet, company: CompanyProfile): void {
  const fields: [string, string][] = [
    ['Company Name',       company.companyName ?? ''],
    ['PAN / VAT Number',   company.panVatNumber ?? ''],
    ['Registration No.',   company.registrationNumber ?? ''],
    ['Company Type',       company.companyType ?? ''],
    ['Fiscal Year',        company.fiscalYear?.bsFY ?? ''],
    ['Chairperson',        company.chairperson ?? ''],
    ['Director',           company.director ?? ''],
    ['Accounts Head',      company.accountsHead ?? ''],
    ['Auditor Name',       company.auditorInfo?.auditorName ?? ''],
    ['Audit Firm',         company.auditorInfo?.auditorFirmName ?? ''],
  ];

  fields.forEach(([label, value], i) => {
    const row = ws.getRow(i + 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    const vc = row.getCell(2);
    vc.value = value;
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.GREEN_INPUT}` } };
    vc.border = THIN_BORDER as ExcelJS.Borders;
  });
}

export function writeBalanceSheet(ws: ExcelJS.Worksheet, bs: BalanceSheet, company: CompanyProfile): void {
  ws.columns = [
    { key: 'A', width: 42 },
    { key: 'B', width: 8 },
    { key: 'C', width: 18 },
    { key: 'D', width: 18 },
  ];

  const fy = company.fiscalYear?.bsFY ?? '';
  const [startBS, endBS] = fy.split('/').map((y: string) => y.trim());

  let row = writeStatementHeader(
    ws,
    company.companyName ?? 'Company',
    'STATEMENT OF FINANCIAL POSITION',
    `As at 31 Ashadh ${endBS ?? ''} (15 July 2025)`,
    `31 Ashadh ${endBS ?? ''}`,
    `31 Ashadh ${startBS ?? ''}`,
  );

  const rows: AmtRow[] = [
    { label: 'A.  NON-CURRENT ASSETS', isSectionHeader: true },
    { label: 'Property, Plant and Equipment',   note: '3.1', cy: bs.nca_ppe,         py: bs.nca_ppe_py,         indent: 1 },
    { label: 'Investments',                     note: '3.2', cy: bs.nca_investments,  py: bs.nca_investments_py, indent: 1 },
    { label: 'Other Receivables (Non-current)', note: '3.4', cy: bs.nca_receivables,  py: bs.nca_receivables_py, indent: 1 },
    { label: 'Other Non-Current Assets',        note: '3.5', cy: bs.nca_other,        py: bs.nca_other_py,       indent: 1 },
    { label: 'Total Non-Current Assets', cy: bs.totalNonCurrentAssets, py: bs.totalNonCurrentAssets_py, isSubTotal: true },
    { label: 'B.  CURRENT ASSETS', isSectionHeader: true },
    { label: 'Investments (Current)',            note: '3.2', cy: bs.ca_investments,      py: bs.ca_investments_py,       indent: 1 },
    { label: 'Inventories',                     note: '3.7', cy: bs.ca_inventories,      py: bs.ca_inventories_py,       indent: 1 },
    { label: 'Trade and Other Receivables',     note: '3.3', cy: bs.ca_tradeReceivables, py: bs.ca_tradeReceivables_py,  indent: 1 },
    { label: 'Cash and Cash Equivalents',       note: '3.8', cy: bs.ca_cashAndEquivalents, py: bs.ca_cashAndEquivalents_py, indent: 1 },
    { label: 'Other Current Assets',            note: '3.6', cy: bs.ca_other,            py: bs.ca_other_py,             indent: 1 },
    { label: 'Total Current Assets', cy: bs.totalCurrentAssets, py: bs.totalCurrentAssets_py, isSubTotal: true },
    { label: 'TOTAL ASSETS', cy: bs.totalAssets, py: bs.totalAssets_py, isTotal: true },
    { label: 'C.  EQUITY', isSectionHeader: true },
    { label: 'Share Capital',      note: '3.9',  cy: bs.eq_shareCapital,    py: bs.eq_shareCapital_py,    indent: 1 },
    { label: 'Reserves',           note: '3.10', cy: bs.eq_reserves,        py: bs.eq_reserves_py,        indent: 1 },
    { label: 'Retained Earnings',               cy: bs.eq_retainedEarnings, py: bs.eq_retainedEarnings_py, indent: 1 },
    { label: 'Total Equity', cy: bs.totalEquity, py: bs.totalEquity_py, isSubTotal: true },
    { label: 'D.  NON-CURRENT LIABILITIES', isSectionHeader: true },
    { label: 'Loans and Borrowings',            note: '3.11', cy: bs.ncl_borrowings,       py: bs.ncl_borrowings_py,       indent: 1 },
    { label: 'Employee Benefit Liabilities',    note: '3.12', cy: bs.ncl_employeeBenefits, py: bs.ncl_employeeBenefits_py, indent: 1 },
    { label: 'Provisions',                                    cy: bs.ncl_provisions,       py: bs.ncl_provisions_py,       indent: 1 },
    { label: 'Total Non-Current Liabilities', cy: bs.totalNonCurrentLiabilities, py: bs.totalNonCurrentLiabilities_py, isSubTotal: true },
    { label: 'E.  CURRENT LIABILITIES', isSectionHeader: true },
    { label: 'Loans and Borrowings',            note: '3.11', cy: bs.cl_borrowings,     py: bs.cl_borrowings_py,     indent: 1 },
    { label: 'Trade and Other Payables',        note: '3.13', cy: bs.cl_tradePayables,  py: bs.cl_tradePayables_py,  indent: 1 },
    { label: 'Income Tax Liability',                          cy: bs.cl_incomeTaxPayable, py: bs.cl_incomeTaxPayable_py, indent: 1 },
    { label: 'Employee Benefit Liability',      note: '3.12', cy: bs.cl_provisions,     py: bs.cl_provisions_py,     indent: 1 },
    { label: 'Other Current Liabilities',                     cy: bs.cl_other,          py: bs.cl_other_py,          indent: 1 },
    { label: 'Total Current Liabilities', cy: bs.totalCurrentLiabilities, py: bs.totalCurrentLiabilities_py, isSubTotal: true },
    { label: 'TOTAL EQUITY AND LIABILITIES', cy: bs.totalEquityAndLiabilities, py: bs.totalEquityAndLiabilities_py, isTotal: true },
  ];

  rows.forEach((r) => { writeAmountRow(ws, row, r); row++; });

  // Balance check
  const checkCell = ws.getRow(row).getCell(3);
  checkCell.value = { formula: `=C${row - rows.length + rows.findIndex(r => r.isTotal && r.label.includes('TOTAL ASSETS')) + 6}-C${row - 1}` };
  checkCell.numFmt = NUMBER_FORMAT;
  ws.getRow(row).getCell(1).value = 'Balance Check (must be zero):';
  ws.getRow(row).getCell(1).font = { name: 'Arial', size: 9, italic: true };
  row++;

  writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? '',
    roundingLevel: 100,
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = {
    oddHeader: `&C${company.companyName ?? ''}`,
    oddFooter: '&CPage &P of &N',
  };
}

export function writeIncomeStatement(ws: ExcelJS.Worksheet, is: IncomeStatement, company: CompanyProfile): void {
  ws.columns = [{ width: 42 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? '';
  const [startBS, endBS] = fy.split('/').map((y: string) => y.trim());

  let row = writeStatementHeader(
    ws,
    company.companyName ?? '',
    'STATEMENT OF INCOME',
    `For the Year Ended 31 Ashadh ${endBS ?? ''}`,
    fy, `${startBS ?? ''}-${(Number(startBS) - 1).toString().slice(-2)}/${startBS}`,
  );

  const rows: AmtRow[] = [
    { label: 'INCOME', isSectionHeader: true },
    { label: 'Revenue from Operations',     note: '3.17', cy: is.revenue,        py: is.revenue_py,        indent: 1 },
    { label: 'Interest Income',                          cy: is.interestIncome,  py: is.interestIncome_py,  indent: 1 },
    { label: 'Other Income',                             cy: is.otherIncome,     py: is.otherIncome_py,    indent: 1 },
    { label: 'Total Income', cy: is.totalIncome, py: is.totalIncome_py, isSubTotal: true },
    { label: 'EXPENSES', isSectionHeader: true },
    { label: 'Material Consumed',           note: '3.18', cy: is.materialConsumed,         py: is.materialConsumed_py,         indent: 1 },
    { label: 'Direct Expenses',             note: '3.19', cy: is.directExpenses,           py: is.directExpenses_py,           indent: 1 },
    { label: 'Employee Benefit Expenses',   note: '3.20', cy: is.employeeBenefitExpense,   py: is.employeeBenefitExpense_py,   indent: 1 },
    { label: 'Finance Costs',                            cy: is.financeCharges,            py: is.financeCharges_py,           indent: 1 },
    { label: 'Depreciation',               note: '3.1',  cy: is.depreciation,             py: is.depreciation_py,             indent: 1 },
    { label: 'Impairment Losses',          note: '3.21', cy: is.impairment,               py: is.impairment_py,               indent: 1 },
    { label: 'Administrative & Other Exp', note: '3.22', cy: is.adminAndOtherExpenses,    py: is.adminAndOtherExpenses_py,    indent: 1 },
    { label: 'Total Expenses', cy: is.totalExpenses, py: is.totalExpenses_py, isSubTotal: true },
    { label: 'Profit/(Loss) before Staff Bonus', cy: is.profitBeforeStaffBonus, py: is.profitBeforeStaffBonus_py, isSubTotal: true },
    { label: 'Less: Staff Bonus', cy: is.staffBonus, py: is.staffBonus_py, indent: 1 },
    { label: 'Profit/(Loss) before Tax', cy: is.profitBeforeTax, py: is.profitBeforeTax_py, isSubTotal: true },
    { label: 'Less: Income Tax Expense',   note: '3.23', cy: is.incomeTaxExpense, py: is.incomeTaxExpense_py, indent: 1 },
    { label: 'Net Profit/(Loss) for the Year', cy: is.netProfit, py: is.netProfit_py, isTotal: true },
  ];

  rows.forEach((r) => { writeAmountRow(ws, row, r); row++; });
  writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? '',
    roundingLevel: 100,
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = { oddHeader: `&C${company.companyName ?? ''}`, oddFooter: '&CPage &P of &N' };
}

export function writeCashFlowStatement(ws: ExcelJS.Worksheet, cf: CashFlowStatement, company: CompanyProfile): void {
  ws.columns = [{ width: 50 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? '';
  const [, endBS] = fy.split('/').map((y: string) => y.trim());
  let row = writeStatementHeader(ws, company.companyName ?? '', 'STATEMENT OF CASH FLOWS (Indirect Method)', `For the Year Ended 31 Ashadh ${endBS ?? ''}`, fy, '');

  const rows: AmtRow[] = [
    { label: 'A.  CASH FLOWS FROM OPERATING ACTIVITIES', isSectionHeader: true },
    { label: 'Profit Before Tax', cy: cf.profitBeforeTax, py: 0, indent: 1 },
    { label: 'Adjustments for:', cy: 0, py: 0, indent: 1 },
    { label: 'Depreciation', cy: cf.addDepreciation, py: 0, indent: 2 },
    { label: 'Impairment Losses', cy: cf.addImpairment, py: 0, indent: 2 },
    { label: 'Interest Income', cy: cf.lessInterestIncome, py: 0, indent: 2 },
    { label: 'Dividend Income', cy: cf.lessDividendIncome, py: 0, indent: 2 },
    { label: 'Interest Expense', cy: cf.addInterestExpense, py: 0, indent: 2 },
    { label: 'Loss/(Gain) on Disposal of Assets', cy: cf.addLossOnDisposal + cf.lessGainOnDisposal, py: 0, indent: 2 },
    { label: 'FV Loss/(Gain) on Investments', cy: cf.addFVLossOnInvestment + cf.lessFVGainOnInvestment, py: 0, indent: 2 },
    { label: 'Changes in Working Capital:', cy: 0, py: 0, indent: 1 },
    { label: '(Increase)/Decrease in Receivables', cy: cf.decreaseIncreaseReceivables, py: 0, indent: 2 },
    { label: '(Increase)/Decrease in Inventories', cy: cf.decreaseIncreaseInventory, py: 0, indent: 2 },
    { label: '(Increase)/Decrease in Other Current Assets', cy: cf.decreaseIncreaseOtherCurrentAssets, py: 0, indent: 2 },
    { label: 'Increase/(Decrease) in Payables', cy: cf.increaseDecreasePayables, py: 0, indent: 2 },
    { label: 'Increase/(Decrease) in Tax Payable', cy: cf.increaseDecreaseIncomeTaxPayable, py: 0, indent: 2 },
    { label: 'Increase/(Decrease) in Employee Liabilities', cy: cf.increaseDecreaseEmployeeLiability, py: 0, indent: 2 },
    { label: 'Cash Generated from Operations', cy: cf.cashGeneratedFromOperations, py: 0, isSubTotal: true },
    { label: 'Interest Paid', cy: cf.interestPaid, py: 0, indent: 1 },
    { label: 'Income Tax Paid', cy: cf.incomeTaxPaid, py: 0, indent: 1 },
    { label: 'Net Cash from Operating Activities', cy: cf.netCashFromOperating, py: 0, isSubTotal: true },
    { label: 'B.  CASH FLOWS FROM INVESTING ACTIVITIES', isSectionHeader: true },
    { label: 'Proceeds from Disposal of PPE', cy: cf.proceedsFromPPEDisposal, py: 0, indent: 1 },
    { label: 'Interest Received', cy: cf.interestReceived, py: 0, indent: 1 },
    { label: 'Dividends Received', cy: cf.dividendReceived, py: 0, indent: 1 },
    { label: 'Purchase of PPE', cy: cf.purchaseOfPPE, py: 0, indent: 1 },
    { label: 'Purchase of Investments', cy: cf.purchaseOfInvestments, py: 0, indent: 1 },
    { label: 'Net Cash from Investing Activities', cy: cf.netCashFromInvesting, py: 0, isSubTotal: true },
    { label: 'C.  CASH FLOWS FROM FINANCING ACTIVITIES', isSectionHeader: true },
    { label: 'Proceeds from Issue of Shares', cy: cf.proceedsFromShareIssue, py: 0, indent: 1 },
    { label: 'Proceeds from Non-Current Borrowings', cy: cf.proceedsFromBorrowingsNonCurrent, py: 0, indent: 1 },
    { label: 'Repayment of Non-Current Borrowings', cy: cf.repaymentOfBorrowingsNonCurrent, py: 0, indent: 1 },
    { label: 'Proceeds from Current Borrowings', cy: cf.proceedsFromBorrowingsCurrent, py: 0, indent: 1 },
    { label: 'Repayment of Current Borrowings', cy: cf.repaymentOfBorrowingsCurrent, py: 0, indent: 1 },
    { label: 'Dividends Paid', cy: cf.dividendPaid, py: 0, indent: 1 },
    { label: 'Net Cash from Financing Activities', cy: cf.netCashFromFinancing, py: 0, isSubTotal: true },
    { label: 'NET INCREASE/(DECREASE) IN CASH', cy: cf.netIncreaseDecrease, py: 0, isTotal: true },
    { label: 'Cash and Equivalents at Beginning of Year', cy: cf.openingCash, py: 0, indent: 1 },
    { label: 'Cash and Equivalents at End of Year', cy: cf.closingCash, py: 0, isSubTotal: true },
    { label: 'Reconciliation Difference (should be zero)', cy: cf.reconciliationDifference, py: 0, indent: 1 },
  ];

  rows.forEach((r) => { writeAmountRow(ws, row, r); row++; });
  writeSignatureLine(ws, row + 1, company);
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

export function writeChangesInEquity(ws: ExcelJS.Worksheet, ce: ChangesInEquity, company: CompanyProfile): void {
  ws.columns = [{ width: 36 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? '';
  const [, endBS] = fy.split('/').map((y: string) => y.trim());

  ws.mergeCells('A1:F1');
  const r1 = ws.getCell('A1');
  r1.value = (company.companyName ?? '').toUpperCase();
  r1.font = FONTS.TITLE; r1.alignment = { horizontal: 'center' };
  applyHeaderFill(r1, COLORS.HEADER_BG);

  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = 'STATEMENT OF CHANGES IN EQUITY';
  ws.getCell('A2').font = { name: 'Arial', size: 12, bold: true }; ws.getCell('A2').alignment = { horizontal: 'center' };

  ws.mergeCells('A3:F3');
  ws.getCell('A3').value = `For the Year Ended 31 Ashadh ${endBS ?? ''}`;
  ws.getCell('A3').font = { name: 'Arial', size: 10, italic: true }; ws.getCell('A3').alignment = { horizontal: 'center' };

  const hRow = ws.getRow(5);
  ['Particulars', 'Share Capital', 'Share Premium', 'General Reserve', 'Retained Earnings', 'Total'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h; c.font = FONTS.SUBHEADING;
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
    applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c);
  });

  const ceRows: [string, number, number, number, number, number][] = [
    ['Opening Balance (1 Shrawan)', ce.cyOpeningShareCapital ?? 0, ce.cyOpeningSharePremium ?? 0, ce.cyOpeningGeneralReserve ?? 0, ce.cyOpeningRetainedEarnings ?? 0, ce.cyOpeningTotal ?? 0],
    ['Profit for the Year', 0, 0, 0, ce.cyNetProfit ?? 0, ce.cyNetProfit ?? 0],
    ['Issue of Share Capital', ce.cyShareCapitalIssued ?? 0, ce.cySharePremiumReceived ?? 0, 0, 0, (ce.cyShareCapitalIssued ?? 0) + (ce.cySharePremiumReceived ?? 0)],
    ['Transfer to General Reserve', 0, 0, ce.cyTransferToReserve ?? 0, -(ce.cyTransferToReserve ?? 0), 0],
    ['Dividends Paid', 0, 0, 0, -(ce.cyDividends ?? 0), -(ce.cyDividends ?? 0)],
    ['Closing Balance (31 Ashadh)', ce.cyClosingShareCapital ?? 0, ce.cyClosingSharePremium ?? 0, ce.cyClosingGeneralReserve ?? 0, ce.cyClosingRetainedEarnings ?? 0, ce.cyClosingTotal ?? 0],
  ];

  ceRows.forEach(([label, sc, sp, gr, re, total], idx) => {
    const r = ws.getRow(6 + idx);
    [label, sc, sp, gr, re, total].forEach((val, ci) => {
      const cell = r.getCell(ci + 1);
      if (ci === 0) { cell.value = val as string; }
      else { cell.value = (val as number) || null; cell.numFmt = NUMBER_FORMAT; cell.alignment = { horizontal: 'right' }; }
      applyAllBorders(cell);
      if (idx === ceRows.length - 1) { cell.font = FONTS.TOTAL; applyHeaderFill(cell, COLORS.TOTAL_BG); }
    });
    r.height = 15;
  });
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

export function writeNote31_PPE(ws: ExcelJS.Worksheet, depnSummary: DepreciationSummary[]): void {
  ws.getRow(1).getCell(1).value = '3.1  Property, Plant and Equipment';
  ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };

  const categories = depnSummary.map((d) => d.categoryName);
  const headers = ['Particulars', ...categories, 'Total'];

  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h; c.font = FONTS.SUBHEADING;
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
    applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c);
  });

  const costRows: [string, (d: DepreciationSummary) => number][] = [
    ['Balance at Beginning of Year', (d) => d.openingCost],
    ['Additions during the Year',    (d) => d.additions],
    ['Disposals during the Year',    (d) => -d.disposals],
    ['Balance at End of Year',       (d) => d.closingCost],
  ];

  let r = 4;
  ws.getRow(r).getCell(1).value = 'COST'; ws.getRow(r).getCell(1).font = FONTS.SUBHEADING; r++;

  costRows.forEach(([label, fn]) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = '  ' + label;
    let total = 0;
    depnSummary.forEach((d, i) => {
      const v = fn(d);
      row.getCell(i + 2).value = v || null;
      row.getCell(i + 2).numFmt = NUMBER_FORMAT;
      row.getCell(i + 2).alignment = { horizontal: 'right' };
      total += v;
    });
    row.getCell(depnSummary.length + 2).value = total || null;
    row.getCell(depnSummary.length + 2).numFmt = NUMBER_FORMAT;
    row.getCell(depnSummary.length + 2).alignment = { horizontal: 'right' };
    row.height = 15;
  });

  ws.getRow(r).getCell(1).value = 'ACCUMULATED DEPRECIATION'; ws.getRow(r).getCell(1).font = FONTS.SUBHEADING; r++;

  const depnRows: [string, (d: DepreciationSummary) => number][] = [
    ['Balance at Beginning of Year', (d) => d.openingAccumDepn],
    ['Charge for the Year',          (d) => d.depnForYear],
    ['On Disposals',                 (d) => -d.depnOnDisposal],
    ['Balance at End of Year',       (d) => d.closingAccumDepn],
  ];

  depnRows.forEach(([label, fn]) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = '  ' + label;
    let total = 0;
    depnSummary.forEach((d, i) => {
      const v = fn(d);
      row.getCell(i + 2).value = v || null;
      row.getCell(i + 2).numFmt = NUMBER_FORMAT;
      row.getCell(i + 2).alignment = { horizontal: 'right' };
      total += v;
    });
    row.getCell(depnSummary.length + 2).value = total || null;
    row.getCell(depnSummary.length + 2).numFmt = NUMBER_FORMAT;
    row.getCell(depnSummary.length + 2).alignment = { horizontal: 'right' };
    row.height = 15;
  });

  ws.getRow(r).getCell(1).value = 'NET BOOK VALUE'; ws.getRow(r).getCell(1).font = FONTS.SUBHEADING; r++;
  const nbvRows: [string, (d: DepreciationSummary) => number][] = [
    ['At Beginning of Year', (d) => d.openingCost - d.openingAccumDepn],
    ['At End of Year',       (d) => d.netBookValueClosing],
  ];
  nbvRows.forEach(([label, fn]) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = '  ' + label; row.getCell(1).font = FONTS.TOTAL;
    let total = 0;
    depnSummary.forEach((d, i) => {
      const v = fn(d);
      const c = row.getCell(i + 2);
      c.value = v || null; c.numFmt = NUMBER_FORMAT; c.alignment = { horizontal: 'right' }; c.font = FONTS.TOTAL;
      applyHeaderFill(c, COLORS.TOTAL_BG); total += v;
    });
    const tc = row.getCell(depnSummary.length + 2);
    tc.value = total || null; tc.numFmt = NUMBER_FORMAT; tc.alignment = { horizontal: 'right' }; tc.font = FONTS.TOTAL;
    applyHeaderFill(tc, COLORS.TOTAL_BG);
    row.height = 15;
  });
}

export function writeNote37_Inventories(ws: ExcelJS.Worksheet, note37: NotesData['note37_inventories']): void {
  ws.getRow(1).getCell(1).value = '3.7  Inventories'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const headers = ['Particulars', 'Current Year', 'Previous Year'];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c); });
  const rows: [string, number, number][] = [
    ['Raw Materials and Consumables', note37.rawMaterials_cy, note37.rawMaterials_py],
    ['Work in Progress',              note37.wip_cy,          note37.wip_py],
    ['Finished Goods and Goods for Resale', note37.finishedGoods_cy, note37.finishedGoods_py],
    ['Total',                         note37.totalInventory_cy, note37.totalInventory_py],
  ];
  rows.forEach(([label, cy, py], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = label; if (i === rows.length - 1) { r.getCell(1).font = FONTS.TOTAL; }
    [cy, py].forEach((v, ci) => { const c = r.getCell(ci + 2); c.value = v || null; c.numFmt = NUMBER_FORMAT; c.alignment = { horizontal: 'right' }; if (i === rows.length - 1) { c.font = FONTS.TOTAL; applyHeaderFill(c, COLORS.TOTAL_BG); } applyAllBorders(c); });
  });
}

export function writeNote38_Cash(ws: ExcelJS.Worksheet, note38: NotesData['note38_cashAndEquivalents']): void {
  ws.getRow(1).getCell(1).value = '3.8  Cash and Cash Equivalents'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const hRow = ws.getRow(3);
  ['Particulars', 'Current Year', 'Previous Year'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c); });
  let r = 4;
  const cashRow = ws.getRow(r++);
  cashRow.getCell(1).value = 'Cash in Hand'; cashRow.getCell(2).value = note38.cashInHand_cy || null; cashRow.getCell(2).numFmt = NUMBER_FORMAT; cashRow.getCell(2).alignment = { horizontal: 'right' };
  note38.bankBalances?.forEach((b: { bankName: string; cy?: number }) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = b.bankName; row.getCell(2).value = b.cy || null; row.getCell(2).numFmt = NUMBER_FORMAT; row.getCell(2).alignment = { horizontal: 'right' };
  });
  const totRow = ws.getRow(r);
  totRow.getCell(1).value = 'Total Cash and Equivalents'; totRow.getCell(1).font = FONTS.TOTAL;
  totRow.getCell(2).value = note38.totalCash_cy || null; totRow.getCell(2).numFmt = NUMBER_FORMAT; totRow.getCell(2).alignment = { horizontal: 'right' }; totRow.getCell(2).font = FONTS.TOTAL;
  applyHeaderFill(totRow.getCell(2), COLORS.TOTAL_BG);
}

export function writeNote39_ShareCapital(ws: ExcelJS.Worksheet, note39: NotesData['note39_shareCapital']): void {
  ws.getRow(1).getCell(1).value = '3.9  Share Capital'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const n39 = note39 as Record<string, unknown>;
  const ordinary = n39.ordinaryShares as Record<string, number> | undefined;
  const rows: [string, number][] = ordinary ? [
    ['Authorised Share Capital (shares)', ordinary.authorizedShares ?? 0],
    ['Issued and Fully Paid Shares (shares)', ordinary.closingIssuedShares ?? 0],
    ['Paid-up Capital (NPR)', ordinary.closingPaidUp ?? 0],
  ] : [
    ['Authorised Share Capital (shares)', (n39.authorizedShares as number) ?? 0],
    ['Issued and Fully Paid Shares (shares)', (n39.issuedShares as number) ?? 0],
    ['Paid-up Capital (NPR)', (n39.paidUpAmount_cy as number) ?? 0],
  ];
  rows.forEach(([label, val], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = label; r.getCell(2).value = val || null; r.getCell(2).numFmt = NUMBER_FORMAT; r.getCell(2).alignment = { horizontal: 'right' };
  });
}

export function writeNote311_Borrowings(ws: ExcelJS.Worksheet, note311: NotesData['note311_borrowings']): void {
  ws.getRow(1).getCell(1).value = '3.11  Loans and Borrowings'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  ws.getRow(2).getCell(1).value = 'Non-Current Borrowings'; ws.getRow(2).getCell(1).font = FONTS.SUBHEADING;
  const hRow = ws.getRow(3);
  ['Lender', 'Interest Rate %', 'Security', 'Current Year', 'Previous Year'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c); });
  let r = 4;
  const n311 = note311 as Record<string, unknown>;
  const nonCurrent = (n311.nonCurrentBank as Array<Record<string, unknown>>)
    ?? (n311.nonCurrent as Array<Record<string, unknown>>)
    ?? [];
  nonCurrent.forEach((b) => {
    const row = ws.getRow(r++);
    [b.lenderName, `${b.interestRate ?? 0}%`, b.security ?? '', b.amount_cy ?? b.balance_cy, b.amount_py ?? b.balance_py].forEach((v, i) => {
      const c = row.getCell(i + 1); c.value = v || null;
      if (i >= 3) { c.numFmt = NUMBER_FORMAT; c.alignment = { horizontal: 'right' }; }
    });
  });
  r++;
  ws.getRow(r).getCell(1).value = 'Current Borrowings'; ws.getRow(r).getCell(1).font = FONTS.SUBHEADING; r++;
  const currentLoans = (n311.currentLoans as Array<Record<string, unknown>>)
    ?? (n311.current as Array<Record<string, unknown>>)
    ?? [];
  currentLoans.forEach((b) => {
    const row = ws.getRow(r++);
    [b.lenderName, b.loanType ?? b.type, '', b.amount_cy ?? b.balance_cy, b.amount_py ?? b.balance_py].forEach((v, i) => {
      const c = row.getCell(i + 1); c.value = v || null;
      if (i >= 3) { c.numFmt = NUMBER_FORMAT; c.alignment = { horizontal: 'right' }; }
    });
  });
}

export function writeNote323_Tax(ws: ExcelJS.Worksheet, note323: NotesData['note323_incomeTax']): void {
  ws.getRow(1).getCell(1).value = '3.23  Income Tax'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const items: [string, number][] = [
    ['Profit Before Tax (per Income Statement)', note323.profitBeforeTax],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v as number] as [string, number]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, -(v as number)] as [string, number]),
    ['Taxable Income', note323.taxableIncome],
    [`Income Tax at ${(note323.taxRate * 100).toFixed(0)}%`, note323.currentTax],
    ['Less: Advance Tax / TDS Credit', -note323.advanceTaxPaid],
    ['Net Tax Payable', note323.netTaxPayable],
  ];
  items.forEach(([label, val], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = label; r.getCell(2).value = val || null;
    r.getCell(2).numFmt = NUMBER_FORMAT; r.getCell(2).alignment = { horizontal: 'right' };
  });
}

export function writeSundryDebtors(ws: ExcelJS.Worksheet, tb: ParsedTrialBalance): void {
  ws.getRow(1).getCell(1).value = 'Sundry Debtors'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const hRow = ws.getRow(3);
  ['Account Name', 'Closing Dr', 'Closing Cr', 'Net Balance'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); });
  const debtors = tb.rows.filter((r) => r.nfrsCategory === 'trade_receivables');
  debtors.forEach((d, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = d.rawLabel; r.getCell(2).value = d.closingDr || null; r.getCell(3).value = d.closingCr || null;
    r.getCell(4).value = (d.closingDr ?? 0) - (d.closingCr ?? 0) || null;
    [2, 3, 4].forEach((c) => { r.getCell(c).numFmt = NUMBER_FORMAT; r.getCell(c).alignment = { horizontal: 'right' }; });
  });
}

export function writeSundryCreditors(ws: ExcelJS.Worksheet, tb: ParsedTrialBalance): void {
  ws.getRow(1).getCell(1).value = 'Sundry Creditors'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const hRow = ws.getRow(3);
  ['Account Name', 'Closing Dr', 'Closing Cr', 'Net Balance'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); });
  const creditors = tb.rows.filter((r) => r.nfrsCategory === 'trade_payables_creditors');
  creditors.forEach((d, i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = d.rawLabel; r.getCell(2).value = d.closingDr || null; r.getCell(3).value = d.closingCr || null;
    r.getCell(4).value = (d.closingCr ?? 0) - (d.closingDr ?? 0) || null;
    [2, 3, 4].forEach((c) => { r.getCell(c).numFmt = NUMBER_FORMAT; r.getCell(c).alignment = { horizontal: 'right' }; });
  });
}

export function writeBankAccounts(ws: ExcelJS.Worksheet, note38: NotesData['note38_cashAndEquivalents']): void {
  ws.getRow(1).getCell(1).value = 'Bank Accounts'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const hRow = ws.getRow(3);
  ['Bank Name', 'Account Type', 'Current Year', 'Previous Year'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); });
  (note38.bankBalances ?? []).forEach((b: { bankName: string; accountType?: string; cy?: number; py?: number }, i: number) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = b.bankName; r.getCell(2).value = b.accountType;
    r.getCell(3).value = b.cy || null; r.getCell(3).numFmt = NUMBER_FORMAT; r.getCell(3).alignment = { horizontal: 'right' };
    r.getCell(4).value = b.py || null; r.getCell(4).numFmt = NUMBER_FORMAT; r.getCell(4).alignment = { horizontal: 'right' };
  });
}

export function writeTrialBalance(ws: ExcelJS.Worksheet, tb: ParsedTrialBalance): void {
  ws.columns = [
    { key: 'label', width: 40 }, { key: 'cat', width: 28 }, { key: 'note', width: 8 },
    { key: 'opdr', width: 14 }, { key: 'opcr', width: 14 }, { key: 'durdr', width: 14 },
    { key: 'durcr', width: 14 }, { key: 'adjdr', width: 14 }, { key: 'adjcr', width: 14 },
    { key: 'cldr', width: 14 }, { key: 'clcr', width: 14 }, { key: 'net', width: 16 },
  ];
  const headers = ['Account Name', 'NFRS Category', 'Note', 'Opening Dr', 'Opening Cr', 'During Dr', 'During Cr', 'Adj Dr', 'Adj Cr', 'Closing Dr', 'Closing Cr', 'Net Balance'];
  const hRow = ws.getRow(1);
  headers.forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c); });
  tb.rows.forEach((row, idx) => {
    const r = ws.getRow(2 + idx);
    const vals = [row.rawLabel, row.nfrsCategory, row.matchedLabel ?? '', row.openingDr, row.openingCr, row.duringDr, row.duringCr, row.adjustmentDr, row.adjustmentCr, row.closingDr, row.closingCr, (row.closingDr ?? 0) - (row.closingCr ?? 0)];
    vals.forEach((v, i) => {
      const c = r.getCell(i + 1); c.value = v || null;
      if (i >= 3) { c.numFmt = NUMBER_FORMAT; c.alignment = { horizontal: 'right' }; }
      applyAllBorders(c);
    });
    r.height = 14;
  });
}

export function writeAdjustments(ws: ExcelJS.Worksheet, adj: YearEndAdjustments): void {
  ws.getRow(1).getCell(1).value = 'Adjustment Journal Entries'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const hRow = ws.getRow(3);
  ['#', 'Description', 'Dr Account', 'Cr Account', 'Amount', 'Note Ref', 'Source'].forEach((h, i) => {
    const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c);
  });
  adj.journalEntries.forEach((je, i) => {
    const r = ws.getRow(4 + i);
    [i + 1, je.description, je.debitAccount, je.creditAccount, je.amount, je.linkedNoteRef ?? '', je.isSystemGenerated ? 'System' : 'Manual'].forEach((v, ci) => {
      const c = r.getCell(ci + 1); c.value = v || null;
      if (ci === 4) { c.numFmt = NUMBER_FORMAT; c.alignment = { horizontal: 'right' }; }
      applyAllBorders(c);
    });
  });
}

export function writeTaxCalculation(ws: ExcelJS.Worksheet, note323: NotesData['note323_incomeTax']): void {
  ws.getRow(1).getCell(1).value = 'Income Tax Computation'; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  ws.getRow(2).getCell(1).value = `Tax Rate: ${(note323.taxRate * 100).toFixed(0)}%`;
  const items: [string, number][] = [
    ['Profit Before Tax', note323.profitBeforeTax],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v as number] as [string, number]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, v as number] as [string, number]),
    ['Taxable Income', note323.taxableIncome],
    ['Income Tax', note323.currentTax],
    ['Advance Tax / TDS Credit', note323.advanceTaxPaid + note323.tdsCreditAvailable],
    ['Net Tax Payable', note323.netTaxPayable],
  ];
  items.forEach(([label, val], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = label; r.getCell(2).value = val || null;
    r.getCell(2).numFmt = NUMBER_FORMAT; r.getCell(2).alignment = { horizontal: 'right' };
  });
}

type CyPyRecord = Record<string, { cy: number; py: number }>;

/** Convert notesEngine output to the flat structure expected by Excel sheet writers. */
function normalizeNotesForExcel(
  notes: NotesData,
  is: IncomeStatement,
  bs: BalanceSheet,
): NotesData {
  if (notes.note34_otherReceivables || notes.note317_revenue) {
    return {
      ...notes,
      note38_cashAndEquivalents: notes.note38_cashAndEquivalents ?? notes.note38_cashEquivalents ?? {
        cashInHand_cy: 0, cashInHand_py: 0, bankBalances: [], totalCash_cy: 0, totalCash_py: 0,
      },
      note323_incomeTax: notes.note323_incomeTax ?? notes.note323_taxExpense,
      note321_impairment: notes.note321_impairment ?? [],
    };
  }

  const n34 = notes.note34_otherCurrentAssets as Record<string, number> | undefined;
  const n35 = notes.note35_biologicalAssets as Record<string, number> | undefined;
  const n36 = notes.note36_heldForSale as { total?: number } | undefined;
  const n37 = notes.note37_inventories as Record<string, unknown> | undefined;
  const n38 = notes.note38_cashEquivalents as {
    cashInHand_cy?: number; cashInHand_py?: number;
    bankAccounts?: Array<{ bankName: string; accountType: string; closingBalance: number; openingBalance: number }>;
    totalCash_cy?: number; totalCash_py?: number;
  } | undefined;
  const n39 = notes.note39_shareCapital as { ordinaryShares?: Record<string, number> } | undefined;
  const n310 = notes.note310_reserves as Record<string, { opening?: number; closing?: number }> | undefined;
  const n311 = notes.note311_borrowings as {
    nonCurrent?: Array<{ lenderName: string; interestRate?: number; secured?: boolean; balance_cy: number; balance_py: number }>;
    current?: Array<{ lenderName: string; type?: string; balance_cy: number; balance_py: number }>;
  } | undefined;
  const n312 = notes.note312_employeeBenefits as Record<string, unknown> | undefined;
  const n313 = notes.note313_tradePayables as Record<string, number> | undefined;
  const n317 = notes.note317_revenueDetailed as Record<string, { cy: number; py: number }> | undefined;
  const n318 = notes.note318_materialConsumed as Record<string, number> | undefined;
  const n320 = notes.note320_employeeExpenses as Record<string, { cy: number; py: number }> | undefined;
  const n322 = notes.note322_adminExpenses as { lineItems?: Array<{ label: string; cy: number; py: number }> } | undefined;
  const n323 = notes.note323_taxExpense as {
    reconciliation?: {
      profitBeforeTax: number;
      disallowableExpenses: Record<string, number>;
      allowableDeductions: Record<string, number>;
      taxableProfit: number;
      totalCurrentTax: number;
    };
    effectiveTaxRate?: number;
    advanceTaxPaid?: number;
    tdsCreditAvailable?: number;
    netTaxPayable?: number;
  } | undefined;

  const note31_ppe = (notes.note31_ppe ?? []).map((item) => {
    const d = item as DepreciationSummary & { nbvClosing?: number };
    return {
      ...d,
      netBookValueClosing: d.netBookValueClosing ?? d.nbvClosing ?? Math.max(0, (d.closingCost ?? 0) - (d.closingAccumDepn ?? 0)),
    };
  });

  const note37_inventories = n37?.rawMaterials
    ? {
        rawMaterials_cy: (n37.rawMaterials as { closing: number }).closing ?? 0,
        rawMaterials_py: (n37.rawMaterials as { opening: number }).opening ?? 0,
        wip_cy: (n37.wip as { closing: number }).closing ?? 0,
        wip_py: (n37.wip as { opening: number }).opening ?? 0,
        finishedGoods_cy: (n37.finishedGoods as { closing: number }).closing ?? 0,
        finishedGoods_py: (n37.finishedGoods as { opening: number }).opening ?? 0,
        totalInventory_cy: (n37.totalClosing as number) ?? bs.ca_inventories,
        totalInventory_py: (n37.totalOpening as number) ?? 0,
      }
    : notes.note37_inventories;

  const note38_cashAndEquivalents = {
    cashInHand_cy: n38?.cashInHand_cy ?? 0,
    cashInHand_py: n38?.cashInHand_py ?? 0,
    bankBalances: (n38?.bankAccounts ?? []).map((b) => ({
      bankName: b.bankName,
      accountType: b.accountType,
      cy: b.closingBalance,
      py: b.openingBalance,
    })),
    totalCash_cy: n38?.totalCash_cy ?? bs.ca_cashAndEquivalents,
    totalCash_py: n38?.totalCash_py ?? 0,
  };

  const os = n39?.ordinaryShares ?? {};
  const note39_shareCapital = {
    authorizedShares: os.authorizedShares ?? 0,
    issuedShares: os.closingIssuedShares ?? 0,
    faceValuePerShare: os.parValuePerShare ?? 100,
    paidUpAmount_cy: os.closingPaidUp ?? bs.eq_shareCapital,
    paidUpAmount_py: os.openingPaidUp ?? 0,
  };

  const note310_reserves: Record<string, { closingCY: number; py: number }> = {};
  if (n310) {
    if (n310.sharePremium) {
      note310_reserves['Share Premium'] = { closingCY: n310.sharePremium.closing ?? 0, py: n310.sharePremium.opening ?? 0 };
    }
    if (n310.generalReserve) {
      note310_reserves['General Reserve'] = { closingCY: n310.generalReserve.closing ?? 0, py: n310.generalReserve.opening ?? 0 };
    }
    if (n310.retainedEarnings) {
      note310_reserves['Retained Earnings'] = { closingCY: n310.retainedEarnings.closing ?? 0, py: n310.retainedEarnings.opening ?? 0 };
    }
  }

  const note311_borrowings = {
    nonCurrentBank: (n311?.nonCurrent ?? []).map((b) => ({
      lenderName: b.lenderName,
      amount_cy: b.balance_cy,
      amount_py: b.balance_py,
      interestRate: b.interestRate ?? 0,
      security: b.secured ? 'Secured' : '',
    })),
    currentLoans: (n311?.current ?? []).map((b) => ({
      lenderName: b.lenderName,
      amount_cy: b.balance_cy,
      amount_py: b.balance_py,
      loanType: b.type ?? 'Loan',
    })),
  };

  const db = n312?.definedBenefit as { openingBalance?: number; closingBalance?: number } | undefined;
  const le = n312?.leaveEncashment as { openingBalance?: number; closingBalance?: number } | undefined;
  const note312_employeeBenefits: Record<string, { opening: number; closing: number }> = {
    Gratuity: { opening: db?.openingBalance ?? 0, closing: db?.closingBalance ?? 0 },
    'Leave Encashment': { opening: le?.openingBalance ?? 0, closing: le?.closingBalance ?? 0 },
    'Salary Payable': { opening: 0, closing: (n312?.salaryPayable as number) ?? 0 },
    'Bonus Payable': { opening: 0, closing: (n312?.bonusPayable as number) ?? 0 },
  };

  const note313_tradePayables: CyPyRecord = n313 ? {
    'Trade Creditors': { cy: n313.tradeCreditors ?? 0, py: n313.tradeCreditors_py ?? 0 },
    'Advance from Customers': { cy: n313.advanceFromCustomers ?? 0, py: 0 },
    'Audit Fee Payable': { cy: n313.auditFeePayable ?? 0, py: n313.auditFeePayable_py ?? 0 },
    'VAT Payable': { cy: n313.vatPayable ?? 0, py: n313.vatPayable_py ?? 0 },
    'TDS Payable': { cy: n313.tdsPayableTotal ?? 0, py: n313.tdsPayableTotal_py ?? 0 },
  } : {};

  const note317_revenue: CyPyRecord = n317 ? {
    'Sale of Goods': n317.saleOfGoods ?? { cy: 0, py: 0 },
    'Rendering of Services': n317.renderingOfServices ?? { cy: 0, py: 0 },
    'Interest Income': n317.interestIncome ?? { cy: 0, py: 0 },
    'Other Income': n317.otherIncome ?? { cy: 0, py: 0 },
  } : {};

  const note318_materialConsumed = n318 ? {
    openingInventory: n318.openingRawMaterial ?? 0,
    purchases: n318.purchasesDuringYear ?? 0,
    closingInventory: n318.closingRawMaterial ?? 0,
    consumed: n318.rawMaterialConsumed ?? is.materialConsumed,
  } : notes.note318_materialConsumed;

  const note319_directExpenses: CyPyRecord = n318 ? {
    'Direct Wages': { cy: n318.directWages ?? 0, py: 0 },
    'Other Direct Expenses': { cy: n318.otherDirectExpenses ?? 0, py: 0 },
  } : (notes.note319_directExpenses ?? {});

  const note320_employeeBenefitExpenses: CyPyRecord = n320 ? {
    'Salaries & Wages': n320.salariesWages ?? { cy: 0, py: 0 },
    'PF / SSF / CIT': n320.pfSsfContribution ?? { cy: 0, py: 0 },
    'Gratuity': n320.gratuityExpense ?? { cy: 0, py: 0 },
    'Staff Bonus': n320.staffBonusExpense ?? { cy: 0, py: 0 },
    'Staff Welfare': n320.staffWelfare ?? { cy: 0, py: 0 },
    'Other Employee Costs': n320.otherEmployeeCosts ?? { cy: 0, py: 0 },
  } : (notes.note320_employeeBenefitExpenses ?? {});

  const note322_adminExpenses: CyPyRecord = n322?.lineItems
    ? Object.fromEntries(n322.lineItems.map((li) => [li.label, { cy: li.cy, py: li.py }]))
    : (notes.note322_adminExpenses ?? {});

  const recon = n323?.reconciliation;
  const note323_incomeTax = {
    profitBeforeTax: recon?.profitBeforeTax ?? is.profitBeforeTax,
    addDisallowableExpenses: recon?.disallowableExpenses ?? {},
    lessAllowableExpenses: recon?.allowableDeductions ?? {},
    taxableIncome: recon?.taxableProfit ?? is.profitBeforeTax,
    currentTax: recon?.totalCurrentTax ?? is.incomeTaxExpense,
    taxRate: n323?.effectiveTaxRate ?? 0.25,
    advanceTaxPaid: n323?.advanceTaxPaid ?? 0,
    tdsCreditAvailable: n323?.tdsCreditAvailable ?? 0,
    netTaxPayable: n323?.netTaxPayable ?? bs.cl_incomeTaxPayable,
  };

  return {
    ...notes,
    note31_ppe,
    note34_otherReceivables: {
      'Security Deposits': { cy: n34?.securityDeposits ?? 0, py: 0 },
      'Advance Income Tax': { cy: n34?.advanceIncomeTax ?? 0, py: 0 },
      'Other Prepaid Expenses': { cy: n34?.otherPrepaidExpenses ?? 0, py: 0 },
    },
    note35_otherNonCurrentAssets: {
      'Biological Assets': { cy: n35?.closingCarrying ?? 0, py: n35?.openingCarrying ?? 0 },
    },
    note36_otherCurrentAssets: {
      'Held for Sale': { cy: n36?.total ?? 0, py: 0 },
    },
    note37_inventories,
    note38_cashAndEquivalents,
    note39_shareCapital,
    note310_reserves,
    note311_borrowings,
    note312_employeeBenefits,
    note313_tradePayables,
    note317_revenue,
    note318_materialConsumed,
    note319_directExpenses,
    note320_employeeBenefitExpenses,
    note321_impairment: notes.note321_impairment ?? [
      { description: 'Impairment on Receivables', cy: is.impairment ?? 0, py: 0 },
    ],
    note322_adminExpenses,
    note323_incomeTax,
  };
}

// Generic note writer for key-value record notes
function writeGenericNoteRecord(ws: ExcelJS.Worksheet, title: string, data?: CyPyRecord | null): void {
  const safeData = data ?? {};
  ws.getRow(1).getCell(1).value = title; ws.getRow(1).getCell(1).font = { name: 'Arial', size: 11, bold: true };
  const hRow = ws.getRow(3);
  ['Particulars', 'Current Year', 'Previous Year'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); applyAllBorders(c); });
  Object.entries(safeData).forEach(([label, vals], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = label; r.getCell(2).value = vals.cy || null; r.getCell(3).value = vals.py || null;
    [2, 3].forEach((ci) => { r.getCell(ci).numFmt = NUMBER_FORMAT; r.getCell(ci).alignment = { horizontal: 'right' }; });
  });
}

// ---------------------------------------------------------------------------
// Main export: generateNFRSWorkbook
// ---------------------------------------------------------------------------
export async function generateNFRSWorkbook(params: {
  company: CompanyProfile;
  trialBalance: ParsedTrialBalance;
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  changesInEquity: ChangesInEquity;
  cashFlow: CashFlowStatement;
  notes: NotesData;
  adjustments: YearEndAdjustments;
}): Promise<Buffer> {
  try {
    const { company, trialBalance, balanceSheet, incomeStatement, changesInEquity, cashFlow, notes: rawNotes, adjustments } = params;
    const notes = normalizeNotesForExcel(rawNotes, incomeStatement, balanceSheet);

    const wb = new ExcelJS.Workbook();
  wb.creator = 'NFRS Reporter';
  wb.lastModifiedBy = 'NFRS Reporter';
  wb.created = new Date();

  const addSheet = (name: string, tabColor?: string) => {
    const ws = wb.addWorksheet(name);
    if (tabColor) ws.properties = { ...ws.properties, tabColor: { argb: `FF${tabColor}` } };
    ws.columns = [{ width: 42 }, { width: 10 }, { width: 18 }, { width: 18 }];
    return ws;
  };

  // Sheet order exactly as specified
  writeWorkings(addSheet('Workings', COLORS.LIGHT_GRAY), company, wb);
  writeInstructions(addSheet('Instructions', COLORS.LIGHT_GRAY));
  writeEnterDetails(addSheet('Enter Details', COLORS.GREEN_INPUT), company);
  writeTrialBalance(addSheet('Trial Balance', COLORS.BRAND_BLUE), trialBalance);
  writeBalanceSheet(addSheet('Balance Sheet', COLORS.BRAND_BLUE), balanceSheet, company);
  writeIncomeStatement(addSheet('Income Statement', COLORS.BRAND_BLUE), incomeStatement, company);
  writeChangesInEquity(addSheet('Change in Equity', COLORS.BRAND_BLUE), changesInEquity, company);
  writeCashFlowStatement(addSheet('Cash Flow', COLORS.BRAND_BLUE), cashFlow, company);
  writeNote1_AccountingPolicies(wb, {
    ...(company.accountingPolicies ?? {}),
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? ''
  });
  writeNote2_CriticalJudgments(wb, {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? ''
  });
  writeNote31_PPE(addSheet('Note 3.1 - PPE', '16A34A'), notes.note31_ppe);
  writeGenericNoteRecord(addSheet('Note 3.2 - Investments', '16A34A'), '3.2  Investments', {});
  writeGenericNoteRecord(addSheet('Note 3.3 - Receivables', '16A34A'), '3.3  Trade Receivables', {
    'Net Trade Receivables': {
      cy: notes.note33_tradeReceivables?.netReceivables_cy ?? 0,
      py: notes.note33_tradeReceivables?.netReceivables_py ?? 0,
    },
  });
  writeGenericNoteRecord(addSheet('Note 3.4 - Other Recv', '16A34A'), '3.4  Other Receivables', notes.note34_otherReceivables);
  writeGenericNoteRecord(addSheet('Note 3.5 - NC Assets', '16A34A'), '3.5  Other Non-Current Assets', notes.note35_otherNonCurrentAssets);
  writeGenericNoteRecord(addSheet('Note 3.6 - CA Other', '16A34A'), '3.6  Other Current Assets', notes.note36_otherCurrentAssets);
  writeNote37_Inventories(addSheet('Note 3.7 - Inventories', '16A34A'), notes.note37_inventories);
  writeNote38_Cash(addSheet('Note 3.8 - Cash', '16A34A'), notes.note38_cashAndEquivalents);
  writeNote39_ShareCapital(addSheet('Note 3.9 - Share Capital', '16A34A'), notes.note39_shareCapital);
  writeGenericNoteRecord(addSheet('Note 3.10 - Reserves', '16A34A'), '3.10  Reserves', Object.fromEntries(
    Object.entries(notes.note310_reserves ?? {}).map(([k, v]) => {
      const entry = v as { closingCY?: number; closing?: number; py?: number; opening?: number };
      return [k, { cy: entry.closingCY ?? entry.closing ?? 0, py: entry.py ?? entry.opening ?? 0 }];
    }),
  ));
  writeNote311_Borrowings(addSheet('Note 3.11 - Borrowings', '16A34A'), notes.note311_borrowings ?? { nonCurrentBank: [], currentLoans: [] });
  writeGenericNoteRecord(addSheet('Note 3.12 - Emp Benefits', '16A34A'), '3.12  Employee Benefits', Object.fromEntries(
    Object.entries(notes.note312_employeeBenefits ?? {}).map(([k, v]) => {
      const entry = v as { closing?: number; opening?: number };
      return [k, { cy: entry.closing ?? 0, py: entry.opening ?? 0 }];
    }),
  ));
  writeGenericNoteRecord(addSheet('Note 3.13 - Payables', '16A34A'), '3.13  Trade and Other Payables', notes.note313_tradePayables);
  writeGenericNoteRecord(addSheet('Note 3.14 - Provisions', '16A34A'), '3.14  Provisions', {});
  writeGenericNoteRecord(addSheet('Note 3.17 - Revenue', '16A34A'), '3.17  Revenue', notes.note317_revenue);
  writeGenericNoteRecord(addSheet('Note 3.18 - Materials', '16A34A'), '3.18  Material Consumed', {
    'Opening Stock': { cy: notes.note318_materialConsumed?.openingInventory ?? 0, py: 0 },
    'Purchases': { cy: notes.note318_materialConsumed?.purchases ?? 0, py: 0 },
    'Less: Closing Stock': { cy: -(notes.note318_materialConsumed?.closingInventory ?? 0), py: 0 },
    'Material Consumed': { cy: notes.note318_materialConsumed?.consumed ?? 0, py: 0 },
  });
  writeGenericNoteRecord(addSheet('Note 3.19 - Direct Exp', '16A34A'), '3.19  Direct Expenses', notes.note319_directExpenses);
  writeGenericNoteRecord(addSheet('Note 3.20 - Emp Expense', '16A34A'), '3.20  Employee Benefit Expenses', notes.note320_employeeBenefitExpenses);
  writeGenericNoteRecord(addSheet('Note 3.21 - Impairment', '16A34A'), '3.21  Impairment', Object.fromEntries(
    (notes.note321_impairment ?? []).map((item: { description: string; cy: number; py: number }) => [item.description, { cy: item.cy, py: item.py }]),
  ));
  writeGenericNoteRecord(addSheet('Note 3.22 - Admin Exp', '16A34A'), '3.22  Administrative Expenses', notes.note322_adminExpenses);
  writeNote323_Tax(addSheet('Note 3.23 - Tax', '16A34A'), notes.note323_incomeTax ?? {
    profitBeforeTax: 0, addDisallowableExpenses: {}, lessAllowableExpenses: {},
    taxableIncome: 0, currentTax: 0, taxRate: 0.25, advanceTaxPaid: 0, tdsCreditAvailable: 0, netTaxPayable: 0,
  });
  writeAdjustments(addSheet('Adjustments', COLORS.LIGHT_GRAY), adjustments);
  writeTaxCalculation(addSheet('Tax Calculation', COLORS.LIGHT_GRAY), notes.note323_incomeTax);
  writeSundryDebtors(addSheet('Sundry Debtors', '16A34A'), trialBalance);
  writeSundryCreditors(addSheet('Sundry Creditors', '16A34A'), trialBalance);
  writeBankAccounts(addSheet('Bank Accounts', '16A34A'), notes.note38_cashAndEquivalents);

  
  applyBalanceSheetCrossReferences(wb, 'Balance Sheet', {
    ppe: 'Note 3.1 - PPE',
    receivables: 'Note 3.3 - Receivables',
    otherReceivables: 'Note 3.4 - Other Recv',
    cash: 'Note 3.8 - Cash',
    shareCapital: 'Note 3.9 - Share Capital',
    borrowings: 'Note 3.11 - Borrowings',
    tax: 'Note 3.23 - Tax',
  }, {
    ppeRow: 8,
    receivablesRow: 16,
    cashRow: 17,
    shareCapitalRow: 22,
    ncBorrowingsRow: 27,
    cBorrowingsRow: 32,
    taxPayableRow: 34,
    totalAssetsRow: 20,
    totalLiabilitiesEquityRow: 38,
  });

  applyIncomeStatementCrossReferences(wb, 'Income Statement', {
    revenue: 'Note 3.17 - Revenue',
    empExpense: 'Note 3.20 - Emp Expense',
    adminExpense: 'Note 3.22 - Admin Exp',
    ppe: 'Note 3.1 - PPE',
    tax: 'Note 3.23 - Tax',
  }, {
    revenueRow: 8,
    empExpenseRow: 15,
    adminExpenseRow: 19,
    depreciationRow: 17,
    taxRow: 24,
  });

  applyCashFlowReconciliation(wb, 'Cash Flow', 'Balance Sheet', {
    openingCashRow: 42,
    closingCashRow: 43,
    netOperatingRow: 26,
    netInvestingRow: 32,
    netFinancingRow: 40,
  });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('[excelWriter] Error generating workbook:', error);
    throw error;
  }
}

/** ICAN-format Excel export (alias for generateNFRSWorkbook). */
export const generateICANExcel = generateNFRSWorkbook;

// ── Cell reference helpers ────────────────────────────────────────────────────

/**
 * Returns an Excel external sheet cell reference formula string.
 * e.g. cellRef("Note 3.1 - PPE", "H", 45) → ='Note 3.1 - PPE'!H45
 */
function cellRef(sheetName: string, col: string, row: number): string {
  // Sheet names with spaces or special chars need single-quote wrapping
  const needsQuotes = /[\s\-!@#$%^&*()+={}\[\]|\\:;"'<>?,./]/.test(sheetName);
  const quotedSheet = needsQuotes ? `'${sheetName}'` : sheetName;
  return `=${quotedSheet}!${col}${row}`;
}

/**
 * Returns a SUM formula across a range on the current sheet.
 * e.g. sumRange("B", 5, 15) → =SUM(B5:B15)
 */
function sumRange(col: string, fromRow: number, toRow: number): string {
  return `=SUM(${col}${fromRow}:${col}${toRow})`;
}

/**
 * Returns a formula that links two cell ranges across sheets and sums them.
 */
function sumCrossSheet(refs: Array<{ sheet: string; col: string; row: number }>): string {
  const parts = refs.map(({ sheet, col, row }) => {
    const needsQuotes = /[\s\-!@#$%^&*()+={}\[\]|\\:;"'<>?,./]/.test(sheet);
    const q = needsQuotes ? `'${sheet}'` : sheet;
    return `${q}!${col}${row}`;
  });
  return `=SUM(${parts.join(',')})`;
}

// ── Row index registry ────────────────────────────────────────────────────────
// After each sheet is written, record the row numbers of key cells so that
// cross-sheet formulas can reference them precisely.

interface SheetRowRegistry {
  ppeNetBookValueRow?: number;       // Note 3.1 — closing NBV total row
  ppeDepreciationRow?: number;       // Note 3.1 — total depreciation for year row
  receivablesNetRow?: number;        // Note 3.3 — net receivables row
  cashTotalRow?: number;             // Note 3.8 — total cash row
  shareCapitalRow?: number;          // Note 3.9 — paid-up capital row
  ncBorrowingsRow?: number;          // Note 3.11 — total NC borrowings row
  cBorrowingsRow?: number;           // Note 3.11 — total C borrowings row
  taxPayableRow?: number;            // Note 3.23 — tax payable row
  revenueTotalRow?: number;          // Note 3.17 — total revenue row
  empExpenseTotalRow?: number;       // Note 3.20 — total employee expense row
  adminExpenseTotalRow?: number;     // Note 3.22 — total admin expense row
  inventoryTotalRow?: number;        // Note 3.7 — total inventory row
}

// This registry is populated by the note writer functions and consumed by
// the main sheet writers to insert cross-reference formulas.
const SHEET_ROW_REGISTRY: SheetRowRegistry = {};

// ── Apply cross-references to Balance Sheet ───────────────────────────────────
/**
 * After all note sheets are written, go back to the Balance Sheet sheet and
 * replace static values in key cells with live cross-sheet formulas.
 *
 * Call this AFTER all note sheets have been added to the workbook.
 */
function applyBalanceSheetCrossReferences(
  wb: import('exceljs').Workbook,
  balanceSheetSheetName: string,
  noteSheetNames: {
    ppe?: string;
    receivables?: string;
    otherReceivables?: string;
    cash?: string;
    shareCapital?: string;
    borrowings?: string;
    tax?: string;
  },
  rowMap: {
    // BS row numbers for each line item (CY column = col C typically)
    ppeRow: number;
    receivablesRow: number;
    cashRow: number;
    shareCapitalRow: number;
    ncBorrowingsRow: number;
    cBorrowingsRow: number;
    taxPayableRow: number;
    totalAssetsRow: number;
    totalLiabilitiesEquityRow: number;
  },
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(balanceSheetSheetName);
  if (!ws) {
    console.warn(`[excelWriter] Balance sheet not found: ${balanceSheetSheetName}`);
    return;
  }

  const setFormula = (rowNum: number, col: string, formula: string) => {
    const cell = ws.getRow(rowNum).getCell(col);
    // Preserve existing formatting — only change the value to a formula
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ''), result: 0 };
    cell.numFmt = existingNumFmt || '#,##0.00;(#,##0.00);"-"';
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' },  // blue tint = cross-reference cell
    };
  };

  // PPE Net Book Value → from Note 3.1 closing NBV total
  if (noteSheetNames.ppe && SHEET_ROW_REGISTRY.ppeNetBookValueRow) {
    setFormula(
      rowMap.ppeRow, cyCol,
      cellRef(noteSheetNames.ppe, 'H', SHEET_ROW_REGISTRY.ppeNetBookValueRow)
    );
  }

  // Trade Receivables → from Note 3.3 net row
  if (noteSheetNames.receivables && SHEET_ROW_REGISTRY.receivablesNetRow) {
    setFormula(
      rowMap.receivablesRow, cyCol,
      cellRef(noteSheetNames.receivables, 'B', SHEET_ROW_REGISTRY.receivablesNetRow)
    );
  }

  // Cash → from Note 3.8 total row
  if (noteSheetNames.cash && SHEET_ROW_REGISTRY.cashTotalRow) {
    setFormula(
      rowMap.cashRow, cyCol,
      cellRef(noteSheetNames.cash, 'B', SHEET_ROW_REGISTRY.cashTotalRow)
    );
  }

  // Share Capital → from Note 3.9
  if (noteSheetNames.shareCapital && SHEET_ROW_REGISTRY.shareCapitalRow) {
    setFormula(
      rowMap.shareCapitalRow, cyCol,
      cellRef(noteSheetNames.shareCapital, 'B', SHEET_ROW_REGISTRY.shareCapitalRow)
    );
  }

  // NC Borrowings → from Note 3.11
  if (noteSheetNames.borrowings && SHEET_ROW_REGISTRY.ncBorrowingsRow) {
    setFormula(
      rowMap.ncBorrowingsRow, cyCol,
      cellRef(noteSheetNames.borrowings, 'D', SHEET_ROW_REGISTRY.ncBorrowingsRow)
    );
  }

  // Current Borrowings → from Note 3.11
  if (noteSheetNames.borrowings && SHEET_ROW_REGISTRY.cBorrowingsRow) {
    setFormula(
      rowMap.cBorrowingsRow, cyCol,
      cellRef(noteSheetNames.borrowings, 'D', SHEET_ROW_REGISTRY.cBorrowingsRow)
    );
  }

  // Total Assets = SUM of all asset rows
  const cell = ws.getRow(rowMap.totalAssetsRow).getCell(cyCol);
  cell.value = { formula: `SUM(${cyCol}5:${cyCol}${rowMap.totalAssetsRow - 1})`, result: 0 };
  cell.numFmt = '#,##0.00;(#,##0.00);"-"';
  cell.font = { bold: true };

  console.log('[excelWriter] Balance sheet cross-references applied.');
}

// ── Apply cross-references to Income Statement ────────────────────────────────
function applyIncomeStatementCrossReferences(
  wb: import('exceljs').Workbook,
  isSheetName: string,
  noteSheetNames: {
    revenue?: string;
    empExpense?: string;
    adminExpense?: string;
    ppe?: string;
    tax?: string;
  },
  rowMap: {
    revenueRow: number;
    empExpenseRow: number;
    adminExpenseRow: number;
    depreciationRow: number;
    taxRow: number;
  },
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(isSheetName);
  if (!ws) return;

  const setFormula = (rowNum: number, col: string, formula: string) => {
    const cell = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ''), result: 0 };
    cell.numFmt = existingNumFmt || '#,##0.00;(#,##0.00);"-"';
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  };

  if (noteSheetNames.revenue && SHEET_ROW_REGISTRY.revenueTotalRow) {
    setFormula(rowMap.revenueRow, cyCol,
      cellRef(noteSheetNames.revenue, 'B', SHEET_ROW_REGISTRY.revenueTotalRow));
  }

  if (noteSheetNames.empExpense && SHEET_ROW_REGISTRY.empExpenseTotalRow) {
    setFormula(rowMap.empExpenseRow, cyCol,
      cellRef(noteSheetNames.empExpense, 'B', SHEET_ROW_REGISTRY.empExpenseTotalRow));
  }

  if (noteSheetNames.adminExpense && SHEET_ROW_REGISTRY.adminExpenseTotalRow) {
    setFormula(rowMap.adminExpenseRow, cyCol,
      cellRef(noteSheetNames.adminExpense, 'B', SHEET_ROW_REGISTRY.adminExpenseTotalRow));
  }

  if (noteSheetNames.ppe && SHEET_ROW_REGISTRY.ppeDepreciationRow) {
    setFormula(rowMap.depreciationRow, cyCol,
      cellRef(noteSheetNames.ppe, 'E', SHEET_ROW_REGISTRY.ppeDepreciationRow));
  }

  console.log('[excelWriter] Income statement cross-references applied.');
}

// ── Apply Cash Flow reconciliation formula ────────────────────────────────────
function applyCashFlowReconciliation(
  wb: import('exceljs').Workbook,
  cfSheetName: string,
  bsSheetName: string,
  rowMap: {
    openingCashRow: number;
    closingCashRow: number;
    netOperatingRow: number;
    netInvestingRow: number;
    netFinancingRow: number;
  },
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(cfSheetName);
  if (!ws) return;

  // Closing cash = Opening + Net Operating + Net Investing + Net Financing
  const closingFormula =
    `${cyCol}${rowMap.openingCashRow}` +
    `+${cyCol}${rowMap.netOperatingRow}` +
    `+${cyCol}${rowMap.netInvestingRow}` +
    `+${cyCol}${rowMap.netFinancingRow}`;

  const cell = ws.getRow(rowMap.closingCashRow).getCell(cyCol);
  cell.value = { formula: closingFormula, result: 0 };
  cell.numFmt = '#,##0.00;(#,##0.00);"-"';
  cell.font = { bold: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

  console.log('[excelWriter] Cash flow reconciliation formula applied.');
}

// Export registry and helpers for use in generateNFRSWorkbook

interface AccountingPoliciesForNote {
  depreciationMethod?: string;         // 'SLM' | 'WDV'
  inventoryCostFormula?: string;       // 'FIFO' | 'WeightedAverage' | 'SpecificIdentification'
  hasGratuityLiability?: boolean;
  hasLeaveEncashment?: boolean;
  incomeTaxRatePercent?: number;
  roundingLevel?: number;
  dateOfAuthorizationForIssue?: string;
  companyName?: string;
  fiscalYear?: string;
}

/**
 * Note 1 — Significant Accounting Policies
 * Writes a full-text policies sheet using standard Nepal CA language.
 */
export function writeNote1_AccountingPolicies(
  wb: import('exceljs').Workbook,
  policies: AccountingPoliciesForNote,
): import('exceljs').Worksheet {
  const ws = wb.addWorksheet('Note 1 - Policies');
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  ws.getColumn(1).width = 5;   // margin column
  ws.getColumn(2).width = 100; // text column

  let r = 1;

  const addHeading = (text: string, level: 1 | 2 | 3) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = text;
    if (level === 1) {
      cell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF4FF' } };
      row.height = 22;
    } else if (level === 2) {
      cell.font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
      row.height = 18;
    } else {
      cell.font = { bold: true, size: 10 };
    }
    cell.alignment = { wrapText: true, vertical: 'middle' };
  };

  const addPara = (text: string, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = ' '.repeat(indent * 4) + text;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: 'top' };
    row.height = Math.max(15, Math.ceil(text.length / 110) * 14);
  };

  const addBlank = () => { ws.getRow(r++).height = 6; };

  const depMethod = policies.depreciationMethod === 'WDV'
    ? 'Written-Down Value (WDV) method'
    : 'Straight-Line Method (SLM)';

  const inventoryMethod =
    policies.inventoryCostFormula === 'FIFO' ? 'First-In, First-Out (FIFO)'
    : policies.inventoryCostFormula === 'SpecificIdentification' ? 'Specific Identification'
    : 'Weighted Average Cost';

  const taxRate = policies.incomeTaxRatePercent ?? 25;
  const rounding = policies.roundingLevel ?? 100;
  const company = policies.companyName ?? '[Company Name]';
  const fy = policies.fiscalYear ?? '[Fiscal Year]';
  const authDate = policies.dateOfAuthorizationForIssue ?? '[Date]';

  // ── Document Header ──
  addHeading(`${company}`, 1);
  addPara(`Notes to the Financial Statements for the Year Ended ${fy}`);
  addBlank();

  // ── Note 1 ──
  addHeading('NOTE 1: SIGNIFICANT ACCOUNTING POLICIES', 1);
  addBlank();

  // 1.1 Statement of Compliance
  addHeading('1.1 Statement of Compliance', 2);
  addPara(
    `These financial statements have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Accounting Standards Board Nepal (AASB) under authority of the Institute of Chartered Accountants of Nepal (ICAN). Where NAS for MEs does not address a particular transaction or event, appropriate Nepal Accounting Standards (NAS), Nepal Financial Reporting Standards (NFRS), or internationally accepted accounting principles have been applied.`
  );
  addBlank();

  // 1.2 Basis of Preparation
  addHeading('1.2 Basis of Preparation', 2);
  addPara(
    `These financial statements are prepared on the historical cost basis, except for certain financial instruments and investment properties that are measured at fair value as described in the relevant policies below. The financial statements are presented in Nepalese Rupees (NPR) and rounded to the nearest NPR ${rounding.toLocaleString('en-IN')}.`
  );
  addPara(
    `The financial statements are prepared on the going concern basis. The management has assessed the company's ability to continue as a going concern for the foreseeable future and is not aware of any material uncertainties that may cast significant doubt on this assessment.`
  );
  addBlank();

  // 1.3 Fiscal Year
  addHeading('1.3 Reporting Period', 2);
  addPara(
    `The financial statements cover the fiscal year ${fy} in Bikram Sambat (BS) calendar, as mandated for companies registered in Nepal under the Companies Act 2063 and the Income Tax Act 2058. Comparative figures presented are for the immediately preceding fiscal year.`
  );
  addBlank();

  // 1.4 Revenue Recognition
  addHeading('1.4 Revenue Recognition', 2);
  addPara(
    `Revenue is recognised when it is probable that the economic benefits associated with the transaction will flow to the company and the amount of revenue can be measured reliably.`
  );
  addPara(`(a) Sales of Goods: Revenue from the sale of goods is recognised when the significant risks and rewards of ownership have been transferred to the buyer, the company retains neither continuing managerial involvement nor effective control over the goods sold, the amount of revenue can be measured reliably, and it is probable that the economic benefits associated with the transaction will flow to the entity.`, 1);
  addPara(`(b) Revenue from Services: Revenue from services is recognised when services are rendered, by reference to the stage of completion of the service transaction at the end of the reporting period.`, 1);
  addPara(`(c) Interest Income: Interest income is accrued on a time basis by reference to the principal outstanding and the effective interest rate applicable.`, 1);
  addPara(`(d) Dividend Income: Dividend income is recognised when the company's right to receive payment is established.`, 1);
  addBlank();

  // 1.5 PPE
  addHeading('1.5 Property, Plant & Equipment (PPE)', 2);
  addPara(
    `Property, Plant and Equipment are stated at cost less accumulated depreciation and any accumulated impairment losses. Cost includes the purchase price, import duties, non-refundable purchase taxes, and any directly attributable costs of bringing the asset to the location and condition necessary for it to be capable of operating in the manner intended by management.`
  );
  addPara(
    `Depreciation is provided on all PPE, other than freehold land, using the ${depMethod} over the estimated useful lives of the assets. Depreciation commences when the assets are ready for their intended use.`
  );
  addPara(
    `The estimated useful lives and depreciation rates applied are consistent with the rates prescribed under Schedule 2 of the Nepal Income Tax Act 2058 (as amended) and are reviewed annually by management.`
  );
  addPara(
    `An item of PPE is derecognised upon disposal or when no future economic benefits are expected from its use or disposal. Any gain or loss arising on derecognition of the asset (calculated as the difference between the net disposal proceeds and the carrying amount of the asset) is included in the income statement in the period the item is derecognised.`
  );
  addBlank();

  // 1.6 Inventories
  addHeading('1.6 Inventories', 2);
  addPara(
    `Inventories are stated at the lower of cost and net realisable value. Cost is determined using the ${inventoryMethod} method. Net realisable value is the estimated selling price in the ordinary course of business less the estimated costs of completion and the estimated costs necessary to make the sale.`
  );
  addBlank();

  // 1.7 Financial Instruments
  addHeading('1.7 Financial Instruments', 2);
  addPara(
    `Financial assets comprise primarily trade receivables, other receivables, and cash and cash equivalents. They are initially measured at fair value plus transaction costs. Subsequent measurement is at amortised cost using the effective interest method.`
  );
  addPara(
    `Trade receivables are measured at amortised cost, which is their face amount less any allowance for impairment. An allowance for impairment is created when there is objective evidence that the company will be unable to collect the amounts due, based on a review of all outstanding receivables at the balance sheet date.`
  );
  addBlank();

  // 1.8 Investments
  addHeading('1.8 Investments', 2);
  addPara(
    `Investments in listed equity securities are measured at fair value through profit or loss. Investments in unlisted securities and long-term investments are carried at cost less any provision for impairment in value, where no reliable fair value can be estimated.`
  );
  addBlank();

  // 1.9 Employee Benefits
  addHeading('1.9 Employee Benefits', 2);
  addPara(
    `(a) Short-term employee benefits: Salaries, wages, annual leave and other short-term employee benefits are accrued in the period in which the associated services are rendered by employees.`, 1
  );
  if (policies.hasGratuityLiability) {
    addPara(
      `(b) Gratuity: The company recognises a liability for gratuity payable under the Labour Act 2074. The gratuity liability is calculated based on the last drawn monthly salary multiplied by the number of completed years of service, as prescribed under the Act. The charge for the year represents the movement in the liability during the year.`, 1
    );
  }
  if (policies.hasLeaveEncashment) {
    addPara(
      `(c) Leave Encashment: The company accrues a liability for leave encashment based on the accumulated entitled leave balance of employees at the balance sheet date, calculated at the salary rates prevailing at the year end.`, 1
    );
  }
  addPara(
    `(d) Staff Bonus: Provision for staff bonus is made in accordance with the Bonus Act 2030 at the rate of 10% of net profit before tax and before charging such bonus.`, 1
  );
  addPara(
    `(e) Provident Fund and Social Security Fund: The company contributes to the Employee Provident Fund and Social Security Fund as required by law. Contributions are charged to the income statement as incurred.`, 1
  );
  addBlank();

  // 1.10 Income Tax
  addHeading('1.10 Income Tax', 2);
  addPara(
    `Income tax expense represents the sum of current tax and deferred tax. Current tax is the amount of income tax payable in respect of the taxable income for the year, calculated using tax rates enacted or substantially enacted at the balance sheet date. The applicable corporate income tax rate is ${taxRate}% as per the Nepal Income Tax Act 2058 (for the applicable category of company).`
  );
  addPara(
    `Deferred tax is recognised on all temporary differences between the carrying amounts of assets and liabilities for financial reporting purposes and the amounts used for taxation purposes. Deferred tax assets are recognised to the extent that it is probable that future taxable profit will be available against which the temporary differences can be utilised.`
  );
  addBlank();

  // 1.11 Foreign Currency
  addHeading('1.11 Foreign Currency Transactions', 2);
  addPara(
    `Transactions in foreign currencies are recorded at the rate of exchange prevailing on the date of the transaction. Monetary assets and liabilities denominated in foreign currencies are retranslated at the rate of exchange prevailing at the balance sheet date. Exchange differences arising from the settlement of monetary items or from translating monetary items at rates different from those at which they were translated at initial recognition during the period or in previous financial statements are recognised in profit or loss in the period in which they arise.`
  );
  addBlank();

  // 1.12 Authorization
  addHeading('1.12 Authorization for Issue', 2);
  addPara(
    `These financial statements were authorized for issue by the Board of Directors of ${company} on ${authDate}.`
  );
  addBlank();

  return ws;
}

/**
 * Note 2 — Critical Accounting Judgments and Key Sources of Estimation Uncertainty
 */
export function writeNote2_CriticalJudgments(
  wb: import('exceljs').Workbook,
  params: {
    companyName?: string;
    fiscalYear?: string;
  }
): import('exceljs').Worksheet {
  const ws = wb.addWorksheet('Note 2 - Judgments');
  ws.pageSetup = { paperSize: 9, orientation: 'portrait' };
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 100;

  let r = 1;

  const addHeading = (text: string, isMain = false) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = text;
    cell.font = isMain
      ? { bold: true, size: 13, color: { argb: 'FF1E3A5F' } }
      : { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    if (isMain) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF4FF' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    row.height = isMain ? 22 : 18;
  };

  const addPara = (text: string, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(2);
    cell.value = ' '.repeat(indent * 4) + text;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: 'top' };
    row.height = Math.max(15, Math.ceil(text.length / 110) * 14);
  };

  const addBlank = () => { ws.getRow(r++).height = 6; };

  const company = params.companyName ?? '[Company Name]';
  const fy = params.fiscalYear ?? '[Fiscal Year]';

  addHeading(`${company}`, true);
  addPara(`Notes to the Financial Statements for the Year Ended ${fy}`);
  addBlank();

  addHeading('NOTE 2: CRITICAL ACCOUNTING JUDGMENTS AND KEY SOURCES OF ESTIMATION UNCERTAINTY', true);
  addBlank();

  addPara(
    `In the application of the company's accounting policies, management is required to make judgments, estimates and assumptions about the carrying amounts of assets and liabilities that are not readily apparent from other sources. The estimates and associated assumptions are based on historical experience and other factors that are considered to be relevant. Actual results may differ from these estimates.`
  );
  addBlank();

  addPara('The estimates and underlying assumptions are reviewed on an ongoing basis. Revisions to accounting estimates are recognised in the period in which the estimate is revised if the revision affects only that period, or in the period of the revision and future periods if the revision affects both current and future periods.');
  addBlank();

  // Critical Judgments
  addHeading('2.1 Critical Judgments in Applying Accounting Policies', false);
  addBlank();

  addHeading('Useful Lives of PPE', false);
  addPara(
    `Management determines the estimated useful lives and related depreciation charges for the company's PPE. This estimate is based on the expected physical and technical obsolescence of assets, industry norms, and the condition of the assets. Depreciation methods and estimated useful lives are reviewed annually and adjusted if appropriate.`
  );
  addBlank();

  addHeading('Impairment of Trade Receivables', false);
  addPara(
    `Management assesses the recoverability of trade receivables based on a review of individual debtor balances, past experience, and current economic conditions. A provision for impairment is created for receivables where there is objective evidence of impairment. The assessment involves significant judgment as to the likelihood and timing of recovery.`
  );
  addBlank();

  addHeading('Inventory Valuation', false);
  addPara(
    `The company estimates net realisable value for slow-moving and obsolete inventory items. These estimates take into account anticipated selling prices, costs to completion, and selling costs. Actual realisable values may differ from estimates.`
  );
  addBlank();

  // Key Sources of Estimation Uncertainty
  addHeading('2.2 Key Sources of Estimation Uncertainty', false);
  addBlank();

  addHeading('Income Tax', false);
  addPara(
    `The company is subject to income tax in Nepal. Significant judgment is required in determining the provision for income taxes. There are transactions and calculations for which the ultimate tax determination is uncertain. Where the final tax outcome of these matters is different from the amounts initially recorded, such differences will impact the income tax and deferred tax provisions in the period in which such determination is made.`
  );
  addBlank();

  addHeading('Employee Benefit Provisions', false);
  addPara(
    `The cost of defined benefit obligations (gratuity and leave encashment) is determined using actuarial assumptions. The principal assumptions used in the estimation are salary growth rates, employee attrition rates, and retirement ages. Changes in these assumptions will impact the carrying amount of the obligation.`
  );
  addBlank();

  addHeading('Depreciation and Residual Values', false);
  addPara(
    `The company reviews residual values and useful lives of assets at each reporting date. Estimation of residual values inherently involves uncertainty about future market conditions and the company's future plans for asset disposal.`
  );
  addBlank();

  addHeading('Provisions and Contingencies', false);
  addPara(
    `Provisions are recognised when the company has a present obligation (legal or constructive) as a result of a past event, it is probable that the company will be required to settle the obligation, and a reliable estimate can be made of the amount of the obligation. The amount recognised as a provision is the best estimate of the consideration required to settle the present obligation at the balance sheet date. Contingencies are disclosed in Note 3.16.`
  );
  addBlank();

  return ws;
}

// ── Compliance Statement in Balance Sheet sheet ───────────────────────────────
/**
 * Appends the ICAN compliance statement text block to the bottom of
 * the Balance Sheet sheet, below the main financial data.
 */
export function appendComplianceStatement(
  ws: import('exceljs').Worksheet,
  params: {
    companyName: string;
    fiscalYear: string;
    roundingLevel: number;
    authorizationDate?: string;
  },
  startRow: number,
): void {
  let r = startRow + 2; // leave gap

  const addRow = (text: string, bold = false, italic = false, indent = 0) => {
    const row = ws.getRow(r++);
    const cell = row.getCell(1);
    cell.value = text;
    cell.font = { bold, italic, size: 9, color: { argb: 'FF374151' } };
    cell.alignment = { wrapText: true, vertical: 'top', indent };
    row.height = Math.max(12, Math.ceil(text.length / 120) * 11);
  };

  const divider = ws.getRow(r++);
  const divCell = divider.getCell(1);
  divCell.border = { top: { style: 'medium', color: { argb: 'FF1E3A5F' } } };
  ws.mergeCells(r - 1, 1, r - 1, 5);

  addRow('NOTES TO FINANCIAL STATEMENTS', true, false);
  addRow('');

  addRow('1. STATEMENT OF COMPLIANCE', true);
  addRow(
    `These financial statements of \${params.companyName} have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Institute of Chartered Accountants of Nepal (ICAN).`,
    false, false, 1
  );
  addRow('');

  addRow('2. BASIS OF PREPARATION', true);
  addRow(
    `These financial statements are prepared on the historical cost basis except for certain financial instruments measured at fair values as described in the accounting policies. The financial statements are presented in Nepalese Rupees (NPR) rounded to the nearest NPR \${params.roundingLevel.toLocaleString('en-IN')}.`,
    false, false, 1
  );
  addRow('');

  addRow('3. AUTHORIZATION FOR ISSUE', true);
  addRow(
    `These financial statements for the fiscal year \${params.fiscalYear} were authorized for issue by the Board of Directors of \${params.companyName} on \${params.authorizationDate ?? '[Board Meeting Date]'}.`,
    false, false, 1
  );
  addRow('');

  addRow(
    'Refer to Note 1 (Significant Accounting Policies) and Note 2 (Critical Accounting Judgments) sheets in this workbook for the complete notes to the financial statements.',
    false, true, 0
  );
}

export {
  cellRef,
  sumRange,
  sumCrossSheet,
  SHEET_ROW_REGISTRY,
  applyBalanceSheetCrossReferences,
  applyIncomeStatementCrossReferences,
  applyCashFlowReconciliation,
};
