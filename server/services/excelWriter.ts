// ===== server/services/excelWriter.ts =====
import ExcelJS from 'exceljs';
import { FISCAL_YEARS, getFiscalYear } from '../../src/data/fiscalYears.js';
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
  AssetItem,
  DepreciationResult,
} from '../../src/types';
import { buildMesEnterDetailsFields } from './mesEnterDetailsFields.js';
import { writeMesFormatTrialBalance } from './mesTrialBalanceWriter.js';

// ---------------------------------------------------------------------------
// Row-map types for live cross-sheet formulas (Session 24 — Gap C4)
// ---------------------------------------------------------------------------
export interface NoteRowMap {
  ppeNetBookValueRow?: number;
  ppeDepreciationRow?: number;
  note32_investmentsRow?: number;
  note33_receivablesRow?: number;
  note34_otherRecvRow?: number;
  note35_ncAssetsRow?: number;
  note36_caOtherRow?: number;
  inventoryTotalRow?: number;
  cashTotalRow?: number;
  shareCapitalRow?: number;
  ncBorrowingsRow?: number;
  cBorrowingsRow?: number;
  note314_incomeTaxRow?: number;
  revenueTotalRow?: number;
  empExpenseTotalRow?: number;
  adminExpenseTotalRow?: number;
  taxPayableRow?: number;
  taxCalcNetPayableRow?: number;
  taxCalcIncomeTaxRow?: number;
  assessableIncomeRow?: number;
  totalTaxLiabilityRow?: number;
  cyTotalRow?: number;
}

export interface TaxCalculationSheetData {
  companyName: string;
  address: string;
  incomeStatement: IncomeStatement;
  otherIncome?: {
    interestIncome?: { cy: number };
    commissionIncome?: { cy: number };
    rentalIncome?: { cy: number };
    dividendReceived?: { cy: number };
    gainOnDisposalAssets?: { cy: number };
    insuranceClaims?: { cy: number };
    miscellaneousIncome?: { cy: number };
  };
  repairExpense?: number;
  taxRate?: number;
  donations?: number;
  lossCarryForward?: number;
  feeSection117?: number;
  lateTaxPaidAmount?: number;
  advanceTaxShortfall?: number;
  taxDepSheetName?: string;
  taxDepTotalRow?: number;
}

export interface TaxProfitReconciliationData {
  fiscalYear: string;
  profitBeforeTax: number;
  bookDepreciation: number;
  dividendExempt: number;
  disallowSheetName: string;
  disallowTotalRow: number;
  taxDepSheetName: string;
  taxDepTotalRow: number;
  taxCalcSheetName: string;
  taxCalcAssessableRow: number;
}

export interface BalanceSheetRowMap {
  ppeRow: number;
  ncaInvestmentsRow: number;
  ncaReceivablesRow: number;
  ncaOtherRow: number;
  totalNcaRow: number;
  caInvestmentsRow: number;
  inventoriesRow: number;
  receivablesRow: number;
  cashRow: number;
  caOtherRow: number;
  totalCaRow: number;
  totalAssetsRow: number;
  shareCapitalRow: number;
  reservesRow: number;
  retainedEarningsRow: number;
  totalEquityRow: number;
  ncBorrowingsRow: number;
  totalNclRow: number;
  cBorrowingsRow: number;
  taxPayableRow: number;
  totalClRow: number;
  totalLiabilitiesEquityRow: number;
}

export interface IncomeStatementRowMap {
  revenueRow: number;
  empExpenseRow: number;
  adminExpenseRow: number;
  depreciationRow: number;
  taxRow: number;
  profitBeforeTaxRow: number;
  netProfitRow: number;
  totalIncomeRow: number;
  totalExpensesRow: number;
}

export interface CashFlowRowMap {
  profitBeforeTaxRow: number;
  openingCashRow: number;
  closingCashRow: number;
  netOperatingRow: number;
  netInvestingRow: number;
  netFinancingRow: number;
}

export interface ChangesInEquityRowMap {
  profitForYearRow: number;
}

export interface WorkbookRowMaps {
  balanceSheet: BalanceSheetRowMap;
  incomeStatement: IncomeStatementRowMap;
  cashFlow: CashFlowRowMap;
  changesInEquity: ChangesInEquityRowMap;
  notes: NoteRowMap;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const COLORS = {
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

export const FONTS = {
  HEADING:    { name: 'Arial', size: 11, bold: true,  color: { argb: `FF${COLORS.WHITE}` } },
  SUBHEADING: { name: 'Arial', size: 10, bold: true,  color: { argb: `FF${COLORS.BRAND_BLUE}` } },
  BODY:       { name: 'Arial', size: 10 },
  AMOUNT:     { name: 'Arial', size: 10 },
  TOTAL:      { name: 'Arial', size: 10, bold: true },
  NOTE_REF:   { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } },
  TITLE:      { name: 'Arial', size: 11, bold: true,  color: { argb: `FF${COLORS.WHITE}` } },
};

export const NUMBER_FORMAT     = '#,##0';
const NUMBER_FORMAT_DEC = '#,##0.00';
const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${COLORS.BORDER_COLOR}` } };
const MEDIUM_BORDER: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: `FF${COLORS.BRAND_BLUE}` } };

// ---------------------------------------------------------------------------
// ICAN cell styling helpers (Session 23 — Gap C7)
// ---------------------------------------------------------------------------
export function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: `FF${COLORS.WHITE}` } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.BRAND_BLUE}` } };
}

export function applySubHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${COLORS.BRAND_BLUE}` } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.SUBHEADER_BG}` } };
}

export function applyInputStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.GREEN_INPUT}` } };
}

function applyAssumptionStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.YELLOW_NOTE}` } };
}

function applyBodyStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 10 };
  cell.fill = undefined;
}

function applyTotalStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: 'Arial', size: 10, bold: true };
  cell.border = { ...cell.border, top: MEDIUM_BORDER };
}

/** @deprecated Use applyHeaderStyle or applySubHeaderStyle */
function applyHeaderFill(cell: ExcelJS.Cell, colorHex: string = COLORS.HEADER_BG): void {
  if (colorHex === COLORS.SUBHEADER_BG) applySubHeaderStyle(cell);
  else applyHeaderStyle(cell);
}

/** @deprecated Use applyInputStyle */
function applyGreenInput(cell: ExcelJS.Cell): void {
  applyInputStyle(cell);
}

function writeNoteSheetTitle(ws: ExcelJS.Worksheet, title: string): void {
  const cell = ws.getRow(1).getCell(1);
  cell.value = title;
  applyHeaderStyle(cell);
}

const PPE_WORKINGS_CLASSES = [
  'Land',
  'Building',
  'Office Equipment/Furniture/Fixtures',
  'Vehicle',
  'Plant & Machinery',
  'Intangibles & Leasehold',
  'WIP',
] as const;

function mapToPPEWorkingsClass(categoryId: string): (typeof PPE_WORKINGS_CLASSES)[number] {
  const c = categoryId.toLowerCase().replace(/[_\s-]/g, '');
  if (c.includes('land') && !c.includes('lease')) return 'Land';
  if (c.includes('building')) return 'Building';
  if (c.includes('office') || c.includes('furniture') || c.includes('fixture') || c.includes('computer')) {
    return 'Office Equipment/Furniture/Fixtures';
  }
  if (c.includes('vehicle')) return 'Vehicle';
  if (c.includes('plant') || c.includes('machinery')) return 'Plant & Machinery';
  if (c.includes('intangible') || c.includes('leasehold') || c.includes('software')) return 'Intangibles & Leasehold';
  if (c.includes('wip') || c.includes('construction') || c.includes('cwip')) return 'WIP';
  return 'Office Equipment/Furniture/Fixtures';
}

function approximateBsDateToSerial(bsDate: string, fiscalYear: string): number | null {
  const fy = getFiscalYear(fiscalYear);
  if (!fy || !bsDate?.trim()) return null;
  const parts = bsDate.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const bsMonths = [
    'shrawan', 'bhadra', 'aswin', 'kartik', 'mangsir', 'poush',
    'magh', 'falgun', 'chaitra', 'baisakh', 'jestha', 'ashadh',
  ];
  const monthIdx = bsMonths.indexOf(parts[1].toLowerCase());
  if (monthIdx < 0) return null;
  const totalDays = fy.endExcelSerial - fy.startExcelSerial;
  const dayFraction = (monthIdx * 30 + (parseInt(parts[0], 10) || 1)) / 365;
  return Math.round(fy.startExcelSerial + totalDays * Math.min(1, dayFraction));
}

function proRataDays(purchaseSerial: number | null, fiscalYear: string): number {
  const fy = getFiscalYear(fiscalYear);
  if (!fy || purchaseSerial == null) return 365;
  if (purchaseSerial <= fy.startExcelSerial) return 365;
  if (purchaseSerial >= fy.endExcelSerial) return 0;
  return fy.endExcelSerial - purchaseSerial;
}

function setAmountCell(cell: ExcelJS.Cell, value: number | null | undefined): void {
  cell.value = value || null;
  cell.numFmt = NUMBER_FORMAT;
  cell.alignment = { horizontal: 'right' };
}

function writeSumTotalRow(
  ws: ExcelJS.Worksheet,
  row: number,
  labelCol: number,
  sumCols: number[],
  fromRow: number,
  toRow: number,
  label = 'Total',
): void {
  const exRow = ws.getRow(row);
  exRow.getCell(labelCol).value = label;
  exRow.getCell(labelCol).font = FONTS.TOTAL;
  sumCols.forEach((col) => {
    const cell = exRow.getCell(col);
    const colLetter = ws.getColumn(col).letter ?? String.fromCharCode(64 + col);
    cell.value = { formula: `SUM(${colLetter}${fromRow}:${colLetter}${toRow})`, result: 0 };
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: 'right' };
    cell.font = FONTS.TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
  });
}

function debtorAgingDays(d: Record<string, unknown>): number {
  if (typeof d.agingDays === 'number') return d.agingDays;
  const cat = String(d.ageCategory ?? '');
  if (cat === '<30days') return 15;
  if (cat === '31-60days') return 45;
  if (cat === '61-90days') return 75;
  if (cat === '>90days') return 120;
  return 0;
}

function agingBucketAmount(amount: number, days: number): [number, number, number, number] {
  if (amount <= 0) return [0, 0, 0, 0];
  if (days <= 30) return [amount, 0, 0, 0];
  if (days <= 60) return [0, amount, 0, 0];
  if (days <= 90) return [0, 0, amount, 0];
  return [0, 0, 0, amount];
}

export function applyAllBorders(cell: ExcelJS.Cell): void {
  cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
}

function setTotalRowStyle(ws: ExcelJS.Worksheet, row: number, lastCol: string = 'D'): void {
  const exRow = ws.getRow(row);
  exRow.eachCell({ includeEmpty: false }, (cell) => {
    applyTotalStyle(cell);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
    cell.border = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER };
  });
}

function writeSectionHeader(ws: ExcelJS.Worksheet, row: number, text: string, lastColIndex: number = 4): void {
  const exRow = ws.getRow(row);
  const cell = exRow.getCell(1);
  ws.mergeCells(row, 1, row, lastColIndex);
  cell.value = text;
  applySubHeaderStyle(cell);
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
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
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderStyle(r1);
  ws.getRow(1).height = 26;

  // Row 2: Statement title
  ws.mergeCells('A2:F2');
  const r2 = ws.getCell('A2');
  r2.value = statementTitle;
  r2.font = { name: 'Arial', size: 11, bold: true };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBodyStyle(r2);
  ws.getRow(2).height = 20;

  // Row 3: Period
  ws.mergeCells('A3:F3');
  const r3 = ws.getCell('A3');
  r3.value = periodLine;
  r3.font = { name: 'Arial', size: 10, italic: true };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBodyStyle(r3);
  ws.getRow(3).height = 16;

  // Row 4: Amount note
  ws.mergeCells('A4:F4');
  const r4 = ws.getCell('A4');
  r4.value = 'All amounts in NPR (Nepalese Rupees)';
  r4.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
  r4.alignment = { horizontal: 'right' };
  applyBodyStyle(r4);
  ws.getRow(4).height = 14;

  // Row 5: Column headers
  const headerRow = ws.getRow(5);
  headerRow.getCell(1).value = 'Particulars';
  headerRow.getCell(2).value = 'Note';
  headerRow.getCell(3).value = curYearLabel;
  headerRow.getCell(4).value = prevYearLabel;
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    applySubHeaderStyle(cell);
    cell.alignment = { horizontal: Number(cell.col) === 1 ? 'left' : 'center', vertical: 'middle' };
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
  const cell1 = exRow.getCell(1); cell1.value = indent + r.label; applyBodyStyle(cell1);
  const cell2 = exRow.getCell(2); if (r.note) { cell2.value = r.note; cell2.font = FONTS.NOTE_REF; } else applyBodyStyle(cell2);
  const cell3 = exRow.getCell(3); cell3.value = r.cy || null; cell3.numFmt = NUMBER_FORMAT; cell3.alignment = { horizontal: 'right' }; applyBodyStyle(cell3);
  const cell4 = exRow.getCell(4); cell4.value = r.py || null; cell4.numFmt = NUMBER_FORMAT; cell4.alignment = { horizontal: 'right' }; applyBodyStyle(cell4);
  [cell1, cell2, cell3, cell4].forEach(applyAllBorders);
  if (r.isTotal || r.isSubTotal) {
    [cell1, cell2, cell3, cell4].forEach((c) => {
      applyTotalStyle(c);
      if (r.isSubTotal) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.AMOUNT_BG}` } };
      }
      if (r.isTotal) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };
        c.border = { top: MEDIUM_BORDER, bottom: MEDIUM_BORDER };
      }
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

function writeEnterDetails(
  ws: ExcelJS.Worksheet,
  company: CompanyProfile,
  adjustments?: YearEndAdjustments,
): void {
  ws.getColumn(1).width = 4;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 36;

  ws.mergeCells(1, 2, 1, 3);
  const title = ws.getCell(1, 2);
  title.value = 'ENTER DETAILS — NAS FOR MEs';
  title.font = { name: 'Arial', size: 12, bold: true };
  title.alignment = { horizontal: 'center' };

  const fields = buildMesEnterDetailsFields(company, adjustments);

  fields.forEach(({ label, value, isNumeric }, i) => {
    const row = ws.getRow(i + 3);
    row.getCell(2).value = label;
    row.getCell(2).font = { name: 'Arial', size: 10, bold: true };
    const vc = row.getCell(3);
    vc.value = value === '' ? null : value;
    if (isNumeric && typeof value === 'number') vc.numFmt = NUMBER_FORMAT;
    applyInputStyle(vc);
    vc.border = THIN_BORDER as ExcelJS.Borders;
  });
}

export function writeBalanceSheet(ws: ExcelJS.Worksheet, bs: BalanceSheet, company: CompanyProfile): BalanceSheetRowMap {
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

  const bsRowMap: BalanceSheetRowMap = {
    ppeRow: 0, ncaInvestmentsRow: 0, ncaReceivablesRow: 0, ncaOtherRow: 0, totalNcaRow: 0,
    caInvestmentsRow: 0, inventoriesRow: 0, receivablesRow: 0, cashRow: 0, caOtherRow: 0, totalCaRow: 0,
    totalAssetsRow: 0, shareCapitalRow: 0, reservesRow: 0, retainedEarningsRow: 0, totalEquityRow: 0,
    ncBorrowingsRow: 0, totalNclRow: 0, cBorrowingsRow: 0, taxPayableRow: 0, totalClRow: 0,
    totalLiabilitiesEquityRow: 0,
  };
  let bsSection = '';
  rows.forEach((r) => {
    if (r.isSectionHeader) bsSection = r.label;
    if (r.label === 'Property, Plant and Equipment') bsRowMap.ppeRow = row;
    if (r.label === 'Investments' && bsSection === 'A.  NON-CURRENT ASSETS') bsRowMap.ncaInvestmentsRow = row;
    if (r.label === 'Other Receivables (Non-current)') bsRowMap.ncaReceivablesRow = row;
    if (r.label === 'Other Non-Current Assets') bsRowMap.ncaOtherRow = row;
    if (r.label === 'Total Non-Current Assets') bsRowMap.totalNcaRow = row;
    if (r.label === 'Investments (Current)') bsRowMap.caInvestmentsRow = row;
    if (r.label === 'Inventories') bsRowMap.inventoriesRow = row;
    if (r.label === 'Trade and Other Receivables') bsRowMap.receivablesRow = row;
    if (r.label === 'Cash and Cash Equivalents') bsRowMap.cashRow = row;
    if (r.label === 'Other Current Assets') bsRowMap.caOtherRow = row;
    if (r.label === 'Total Current Assets') bsRowMap.totalCaRow = row;
    if (r.label === 'Share Capital') bsRowMap.shareCapitalRow = row;
    if (r.label === 'Reserves') bsRowMap.reservesRow = row;
    if (r.label === 'Retained Earnings') bsRowMap.retainedEarningsRow = row;
    if (r.label === 'Total Equity') bsRowMap.totalEquityRow = row;
    if (r.label === 'Loans and Borrowings' && bsSection === 'D.  NON-CURRENT LIABILITIES') bsRowMap.ncBorrowingsRow = row;
    if (r.label === 'Total Non-Current Liabilities') bsRowMap.totalNclRow = row;
    if (r.label === 'Loans and Borrowings' && bsSection === 'E.  CURRENT LIABILITIES') bsRowMap.cBorrowingsRow = row;
    if (r.label === 'Income Tax Liability') bsRowMap.taxPayableRow = row;
    if (r.label === 'Total Current Liabilities') bsRowMap.totalClRow = row;
    if (r.label === 'TOTAL ASSETS') bsRowMap.totalAssetsRow = row;
    if (r.label === 'TOTAL EQUITY AND LIABILITIES') bsRowMap.totalLiabilitiesEquityRow = row;
    writeAmountRow(ws, row, r); row++;
  });

  const applyBsSumFormula = (targetRow: number, fromRow: number, toRow: number, col = 'C') => {
    if (!targetRow || !fromRow || !toRow) return;
    const cell = ws.getRow(targetRow).getCell(col);
    cell.value = fromRow === toRow
      ? { formula: `${col}${fromRow}`, result: cell.value as number ?? 0 }
      : { formula: `SUM(${col}${fromRow}:${col}${toRow})`, result: cell.value as number ?? 0 };
    cell.numFmt = NUMBER_FORMAT;
    applyTotalStyle(cell);
  };

  if (bsRowMap.totalNcaRow && bsRowMap.ppeRow && bsRowMap.ncaOtherRow) {
    applyBsSumFormula(bsRowMap.totalNcaRow, bsRowMap.ppeRow, bsRowMap.ncaOtherRow, 'C');
    applyBsSumFormula(bsRowMap.totalNcaRow, bsRowMap.ppeRow, bsRowMap.ncaOtherRow, 'D');
  }
  if (bsRowMap.totalCaRow && bsRowMap.caInvestmentsRow && bsRowMap.caOtherRow) {
    applyBsSumFormula(bsRowMap.totalCaRow, bsRowMap.caInvestmentsRow, bsRowMap.caOtherRow, 'C');
    applyBsSumFormula(bsRowMap.totalCaRow, bsRowMap.caInvestmentsRow, bsRowMap.caOtherRow, 'D');
  }
  if (bsRowMap.totalEquityRow && bsRowMap.shareCapitalRow && bsRowMap.retainedEarningsRow) {
    applyBsSumFormula(bsRowMap.totalEquityRow, bsRowMap.shareCapitalRow, bsRowMap.retainedEarningsRow, 'C');
    applyBsSumFormula(bsRowMap.totalEquityRow, bsRowMap.shareCapitalRow, bsRowMap.retainedEarningsRow, 'D');
  }

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
  return bsRowMap;
}

export function writeIncomeStatement(ws: ExcelJS.Worksheet, is: IncomeStatement, company: CompanyProfile): IncomeStatementRowMap {
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

  const isRowMap: IncomeStatementRowMap = {
    revenueRow: 0, empExpenseRow: 0, adminExpenseRow: 0, depreciationRow: 0, taxRow: 0,
    profitBeforeTaxRow: 0, netProfitRow: 0, totalIncomeRow: 0, totalExpensesRow: 0,
  };
  const incomeDetailRows: number[] = [];
  const expenseDetailRows: number[] = [];
  let isSection: 'income' | 'expense' | '' = '';

  rows.forEach((r) => {
    if (r.label === 'INCOME') isSection = 'income';
    if (r.label === 'EXPENSES') isSection = 'expense';
    if (r.label === 'Total Income') isSection = '';
    if (r.label === 'Total Expenses') isSection = '';

    if (r.label === 'Revenue from Operations') isRowMap.revenueRow = row;
    if (r.label === 'Employee Benefit Expenses') isRowMap.empExpenseRow = row;
    if (r.label === 'Administrative & Other Exp') isRowMap.adminExpenseRow = row;
    if (r.label === 'Depreciation') isRowMap.depreciationRow = row;
    if (r.label === 'Profit/(Loss) before Tax') isRowMap.profitBeforeTaxRow = row;
    if (r.label === 'Less: Income Tax Expense') isRowMap.taxRow = row;
    if (r.label === 'Net Profit/(Loss) for the Year') isRowMap.netProfitRow = row;
    if (r.label === 'Total Income') isRowMap.totalIncomeRow = row;
    if (r.label === 'Total Expenses') isRowMap.totalExpensesRow = row;

    if (isSection === 'income' && !r.isSectionHeader && !r.isSubTotal) incomeDetailRows.push(row);
    if (isSection === 'expense' && !r.isSectionHeader && !r.isSubTotal) expenseDetailRows.push(row);

    writeAmountRow(ws, row, r); row++;
  });

  const applySumFormula = (targetRow: number, detailRows: number[], col = 'C') => {
    if (!targetRow || detailRows.length === 0) return;
    const cell = ws.getRow(targetRow).getCell(col);
    if (detailRows.length === 1) {
      cell.value = { formula: `${col}${detailRows[0]}`, result: cell.value as number ?? 0 };
    } else {
      cell.value = {
        formula: `SUM(${col}${detailRows[0]}:${col}${detailRows[detailRows.length - 1]})`,
        result: cell.value as number ?? 0,
      };
    }
    cell.numFmt = NUMBER_FORMAT;
    applyTotalStyle(cell);
  };

  applySumFormula(isRowMap.totalIncomeRow, incomeDetailRows, 'C');
  applySumFormula(isRowMap.totalIncomeRow, incomeDetailRows, 'D');
  applySumFormula(isRowMap.totalExpensesRow, expenseDetailRows, 'C');
  applySumFormula(isRowMap.totalExpensesRow, expenseDetailRows, 'D');

  if (isRowMap.profitBeforeTaxRow && isRowMap.totalIncomeRow && isRowMap.totalExpensesRow) {
    const pbtCell = ws.getRow(isRowMap.profitBeforeTaxRow).getCell('C');
    pbtCell.value = {
      formula: `C${isRowMap.totalIncomeRow}-C${isRowMap.totalExpensesRow}`,
      result: pbtCell.value as number ?? 0,
    };
    pbtCell.numFmt = NUMBER_FORMAT;
    applyTotalStyle(pbtCell);
  }

  if (isRowMap.netProfitRow && isRowMap.profitBeforeTaxRow && isRowMap.taxRow) {
    const npCell = ws.getRow(isRowMap.netProfitRow).getCell('C');
    npCell.value = {
      formula: `C${isRowMap.profitBeforeTaxRow}-C${isRowMap.taxRow}`,
      result: npCell.value as number ?? 0,
    };
    npCell.numFmt = NUMBER_FORMAT;
    applyTotalStyle(npCell);
  }
  writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? '',
    roundingLevel: 100,
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
  ws.headerFooter = { oddHeader: `&C${company.companyName ?? ''}`, oddFooter: '&CPage &P of &N' };
  return isRowMap;
}

export function writeCashFlowStatement(ws: ExcelJS.Worksheet, cf: CashFlowStatement, company: CompanyProfile): CashFlowRowMap {
  ws.columns = [{ width: 50 }, { width: 8 }, { width: 18 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? '';
  const [, endBS] = fy.split('/').map((y: string) => y.trim());
  let row = writeStatementHeader(ws, company.companyName ?? '', 'STATEMENT OF CASH FLOWS (Indirect Method)', `For the Year Ended 31 Ashadh ${endBS ?? ''}`, fy, '');

  const cfRowMap: CashFlowRowMap = {
    profitBeforeTaxRow: 0, openingCashRow: 0, closingCashRow: 0,
    netOperatingRow: 0, netInvestingRow: 0, netFinancingRow: 0,
  };

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

  rows.forEach((r) => {
    if (r.label === 'Profit Before Tax') cfRowMap.profitBeforeTaxRow = row;
    if (r.label === 'Net Cash from Operating Activities') cfRowMap.netOperatingRow = row;
    if (r.label === 'Net Cash from Investing Activities') cfRowMap.netInvestingRow = row;
    if (r.label === 'Net Cash from Financing Activities') cfRowMap.netFinancingRow = row;
    if (r.label === 'Cash and Equivalents at Beginning of Year') cfRowMap.openingCashRow = row;
    if (r.label === 'Cash and Equivalents at End of Year') cfRowMap.closingCashRow = row;
    writeAmountRow(ws, row, r);
    row++;
  });
  writeSignatureLine(ws, row + 1, company);
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return cfRowMap;
}

export function writeChangesInEquity(ws: ExcelJS.Worksheet, ce: ChangesInEquity, company: CompanyProfile): ChangesInEquityRowMap {
  ws.columns = [{ width: 36 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 18 }];
  const fy = company.fiscalYear?.bsFY ?? '';
  const [, endBS] = fy.split('/').map((y: string) => y.trim());

  ws.mergeCells('A1:F1');
  const r1 = ws.getCell('A1');
  r1.value = (company.companyName ?? '').toUpperCase();
  r1.alignment = { horizontal: 'center' };
  applyHeaderStyle(r1);

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

  const ceRowMap: ChangesInEquityRowMap = { profitForYearRow: 0 };

  ceRows.forEach(([label, sc, sp, gr, re, total], idx) => {
    const rowNum = 6 + idx;
    if (label === 'Profit for the Year') ceRowMap.profitForYearRow = rowNum;
    const r = ws.getRow(rowNum);
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
  return ceRowMap;
}

export function writeNote31_PPE(
  ws: ExcelJS.Worksheet,
  depnSummary: Array<DepreciationSummary & {
    impairmentLosses?: number;
    securedAmount?: number;
    hasSecuredAssets?: boolean;
    nbvOpening?: number;
    categoryId?: string;
  }>,
): NoteRowMap {
  writeNoteSheetTitle(ws, '3.1  Property, Plant and Equipment');

  const categories = depnSummary.map((d) => d.categoryName);
  const headers = ['Particulars', ...categories, 'Total'];

  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
    applySubHeaderStyle(c);
    applyAllBorders(c);
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

  const depnRows: [string, (d: DepreciationSummary & { impairmentLosses?: number }) => number][] = [
    ['Balance at Beginning of Year', (d) => d.openingAccumDepn],
    ['Charge for the Year',          (d) => d.depnForYear],
    ['Impairment Losses',            (d) => (d as { impairmentLosses?: number }).impairmentLosses ?? 0],
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
  SHEET_ROW_REGISTRY.ppeDepreciationRow = r - depnRows.length + depnRows.findIndex(([label]) => label === 'Charge for the Year');

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
  SHEET_ROW_REGISTRY.ppeNetBookValueRow = r - 1;

  const totalSecured = depnSummary.reduce((s, d) => s + ((d as { securedAmount?: number }).securedAmount ?? 0), 0);
  const hasCwip = depnSummary.some(
    (d) => (d as { categoryId?: string }).categoryId === 'under_construction'
      || /under construction|cwip/i.test(d.categoryName),
  ) && depnSummary.some((d) => d.closingCost > 0 && /under construction|cwip/i.test(d.categoryName));

  if (totalSecured > 0 || hasCwip) {
    r += 1;
    ws.getRow(r).getCell(1).value = 'DISCLOSURES';
    ws.getRow(r).getCell(1).font = FONTS.SUBHEADING;
    r += 1;
  }
  if (totalSecured > 0) {
    const securedClasses = depnSummary
      .filter((d) => (d as { hasSecuredAssets?: boolean }).hasSecuredAssets)
      .map((d) => `${d.categoryName}: NPR ${((d as { securedAmount?: number }).securedAmount ?? 0).toLocaleString('en-IN')}`)
      .join('; ');
    const secRow = ws.getRow(r++);
    secRow.getCell(1).value = `Security (if any): The following PPE classes are pledged as security for borrowings — ${securedClasses}. Total secured carrying amount: NPR ${totalSecured.toLocaleString('en-IN')}.`;
    secRow.getCell(1).font = { name: 'Arial', size: 9, italic: true };
    ws.mergeCells(r - 1, 1, r - 1, depnSummary.length + 2);
  }
  if (hasCwip) {
    const cwipRow = ws.getRow(r++);
    cwipRow.getCell(1).value = 'PPE under construction: Assets under construction are carried at cost and are not depreciated until available for use, in accordance with NAS for MEs.';
    cwipRow.getCell(1).font = { name: 'Arial', size: 9, italic: true };
    ws.mergeCells(r - 1, 1, r - 1, depnSummary.length + 2);
  }

  return {
    ppeNetBookValueRow: r - 1,
    ppeDepreciationRow: SHEET_ROW_REGISTRY.ppeDepreciationRow,
  };
}

export function writeNote37_Inventories(ws: ExcelJS.Worksheet, note37: NotesData['note37_inventories']): NoteRowMap {
  writeNoteSheetTitle(ws, '3.7  Inventories');
  const headers = ['Particulars', 'Current Year', 'Previous Year'];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; applySubHeaderStyle(c); applyAllBorders(c); });
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
  SHEET_ROW_REGISTRY.inventoryTotalRow = 4 + rows.length - 1;
  return { inventoryTotalRow: SHEET_ROW_REGISTRY.inventoryTotalRow };
}

export function writeNote38_Cash(ws: ExcelJS.Worksheet, note38: NotesData['note38_cashAndEquivalents']): NoteRowMap {
  writeNoteSheetTitle(ws, '3.8  Cash and Cash Equivalents');
  const hRow = ws.getRow(3);
  ['Particulars', 'Current Year', 'Previous Year'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; applySubHeaderStyle(c); applyAllBorders(c); });
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
  SHEET_ROW_REGISTRY.cashTotalRow = r;
  return { cashTotalRow: r };
}

export function writeNote39_ShareCapital(ws: ExcelJS.Worksheet, note39: NotesData['note39_shareCapital']): NoteRowMap {
  writeNoteSheetTitle(ws, '3.9  Share Capital');
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
  SHEET_ROW_REGISTRY.shareCapitalRow = 3 + rows.length - 1;
  return { shareCapitalRow: SHEET_ROW_REGISTRY.shareCapitalRow };
}

export function writeNote311_Borrowings(ws: ExcelJS.Worksheet, note311: NotesData['note311_borrowings']): NoteRowMap {
  writeNoteSheetTitle(ws, '3.11  Loans and Borrowings');
  ws.getRow(2).getCell(1).value = 'Non-Current Borrowings';
  applySubHeaderStyle(ws.getRow(2).getCell(1));
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
  SHEET_ROW_REGISTRY.ncBorrowingsRow = r - 1;
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
  SHEET_ROW_REGISTRY.cBorrowingsRow = r - 1;
  return {
    ncBorrowingsRow: SHEET_ROW_REGISTRY.ncBorrowingsRow,
    cBorrowingsRow: SHEET_ROW_REGISTRY.cBorrowingsRow,
  };
}

export function writeNote323_Tax(
  ws: ExcelJS.Worksheet,
  note323: NotesData['note323_incomeTax'],
  taxCalcSheetName?: string,
  taxCalcNetPayableRow?: number,
): NoteRowMap {
  writeNoteSheetTitle(ws, '3.23  Income Tax');
  const items: [string, number | null, boolean][] = [
    ['Profit Before Tax (per Income Statement)', note323.profitBeforeTax, false],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v as number, false] as [string, number, boolean]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, -(v as number), false] as [string, number, boolean]),
    ['Taxable Income', note323.taxableIncome, false],
    [`Income Tax at ${(note323.taxRate * 100).toFixed(0)}%`, note323.currentTax, false],
    ['Less: Advance Tax / TDS Credit', -note323.advanceTaxPaid, false],
    ['Net Tax Payable', null, true],
  ];
  const netRow = 3 + items.length - 1;
  items.forEach(([label, val], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = label;
    applyBodyStyle(r.getCell(1));
    const amountCell = r.getCell(2);
    if (items[i][2] && taxCalcSheetName && taxCalcNetPayableRow) {
      amountCell.value = { formula: cellRef(taxCalcSheetName, 'D', taxCalcNetPayableRow).replace(/^=/, ''), result: note323.netTaxPayable };
    } else {
      amountCell.value = val || null;
    }
    amountCell.numFmt = NUMBER_FORMAT;
    amountCell.alignment = { horizontal: 'right' };
    applyBodyStyle(amountCell);
  });
  SHEET_ROW_REGISTRY.taxPayableRow = netRow;
  return { taxPayableRow: netRow, note314_incomeTaxRow: netRow };
}

export function writePPEWorkingsSheet(
  ws: ExcelJS.Worksheet,
  assets: AssetItem[],
  fiscalYear: string,
  depreciationResults: DepreciationResult[] = [],
): void {
  writeNoteSheetTitle(ws, 'PPE Workings');

  const headers = [
    'Name of Asset', 'Purchase Date (AD serial)', 'Cost', 'Addition', 'Deletion', 'Balance',
    'Sales Value', 'Date of Sales', 'Useful Life (yrs)', 'Days (pro-rata)',
    'Accum Depn opening', 'Depn for year', 'Depn on deletion', 'Accum Depn closing',
    'Closing WDV', 'Opening WDV', 'WDV on disposal date', 'Profit/(Loss) on disposal',
  ];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 32 : 14;
  });

  const depnByAsset = new Map<string, DepreciationResult & Record<string, unknown>>();
  for (const r of depreciationResults) {
    const ext = r as DepreciationResult & Record<string, unknown>;
    const key = String(r.assetId ?? ext.id ?? '');
    if (key) depnByAsset.set(key, ext);
  }

  let row = 4;
  const allAssetRows: number[] = [];

  for (const className of PPE_WORKINGS_CLASSES) {
    const classAssets = assets.filter((a) => mapToPPEWorkingsClass(a.categoryId) === className);
    if (classAssets.length === 0) continue;

    const classHeader = ws.getRow(row++);
    classHeader.getCell(1).value = className;
    classHeader.getCell(1).font = { name: 'Arial', size: 10, bold: true, italic: true };
    ws.mergeCells(row - 1, 1, row - 1, headers.length);

    const firstAssetRow = row;
    for (const asset of classAssets) {
      const depn = depnByAsset.get(asset.id);
      const extDepn = depn as (DepreciationResult & {
        depreciationCY?: number;
        depnOnDisposal?: number;
        accumulatedDepnPY?: number;
        accumulatedDepnCY?: number;
      }) | undefined;

      const cost = asset.originalCost ?? 0;
      const addition = asset.additionalCost ?? 0;
      const deletion = asset.disposed ? cost + addition : 0;
      const balance = cost + addition - deletion;
      const salesValue = asset.disposed ? (asset.disposalValue ?? 0) : 0;
      const accumOpen = asset.accumDepreciationOpening ?? extDepn?.accumulatedDepnPY ?? 0;
      const depnYear = extDepn?.depnForYear ?? extDepn?.depreciationCY ?? 0;
      const depnDeletion = asset.disposed ? (extDepn?.depnOnDisposal ?? 0) : 0;
      const accumClose = accumOpen + depnYear - depnDeletion;
      const openingWdv = cost - accumOpen;
      const closingWdv = balance - accumClose;
      const wdvOnDisposal = asset.disposed ? closingWdv : 0;
      const gainLoss = extDepn?.gainLossOnDisposal ?? (asset.disposed ? salesValue - wdvOnDisposal : 0);

      const purchaseSerial = approximateBsDateToSerial(asset.purchaseDateBS, fiscalYear);
      const disposalSerial = asset.disposalDateBS
        ? approximateBsDateToSerial(asset.disposalDateBS, fiscalYear)
        : null;

      const r = ws.getRow(row++);
      r.getCell(1).value = asset.assetName;

      const purchaseCell = r.getCell(2);
      purchaseCell.value = purchaseSerial;
      applyGreenInput(purchaseCell);
      if (purchaseSerial) purchaseCell.numFmt = '0';

      setAmountCell(r.getCell(3), cost);
      setAmountCell(r.getCell(4), addition || null);
      setAmountCell(r.getCell(5), deletion || null);
      r.getCell(6).value = { formula: `C${row - 1}+D${row - 1}-E${row - 1}`, result: balance };
      r.getCell(6).numFmt = NUMBER_FORMAT;
      r.getCell(6).alignment = { horizontal: 'right' };

      setAmountCell(r.getCell(7), salesValue || null);
      if (asset.disposed && disposalSerial) {
        r.getCell(8).value = disposalSerial;
        r.getCell(8).numFmt = '0';
      }

      const lifeCell = r.getCell(9);
      lifeCell.value = asset.usefulLifeYears || null;
      applyGreenInput(lifeCell);
      lifeCell.alignment = { horizontal: 'right' };

      setAmountCell(r.getCell(10), proRataDays(purchaseSerial, fiscalYear));
      setAmountCell(r.getCell(11), accumOpen || null);
      setAmountCell(r.getCell(12), depnYear || null);
      setAmountCell(r.getCell(13), depnDeletion || null);
      r.getCell(14).value = { formula: `K${row - 1}+L${row - 1}-M${row - 1}`, result: accumClose };
      r.getCell(14).numFmt = NUMBER_FORMAT;
      r.getCell(14).alignment = { horizontal: 'right' };
      r.getCell(15).value = { formula: `F${row - 1}-N${row - 1}`, result: closingWdv };
      r.getCell(15).numFmt = NUMBER_FORMAT;
      r.getCell(15).alignment = { horizontal: 'right' };
      setAmountCell(r.getCell(16), openingWdv || null);
      setAmountCell(r.getCell(17), asset.disposed ? wdvOnDisposal : null);
      setAmountCell(r.getCell(18), asset.disposed ? gainLoss : null);

      allAssetRows.push(row - 1);
    }

    const totalRow = row++;
    writeSumTotalRow(ws, totalRow, 1, [3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18], firstAssetRow, row - 2, `Total — ${className}`);
  }

  if (allAssetRows.length > 0) {
    const first = Math.min(...allAssetRows);
    const last = Math.max(...allAssetRows);
    writeSumTotalRow(ws, row, 1, [3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18], first, last, 'Grand Total');
    ws.getRow(row).getCell(1).font = { name: 'Arial', size: 10, bold: true };
  }
}

export function writeTaxDepreciationSheet(
  ws: ExcelJS.Worksheet,
  taxDepPools: Array<Record<string, unknown>>,
  _fiscalYear: string,
): { totalTaxDepRow: number } {
  writeNoteSheetTitle(ws, 'Tax Depreciation');

  const headers = [
    'Pool Name', 'Opening Depreciation Basis', 'Additions', 'Disposals',
    'Depreciation Basis', 'Absorbed Portion', 'Unabsorbed Portion',
    'Tax Depn Rate', 'Tax Depreciation', 'Closing Basis for Next Year',
  ];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 36 : 18;
  });

  const pools = taxDepPools.length > 0 ? taxDepPools : [{}];
  pools.forEach((pool, i) => {
    const r = ws.getRow(4 + i);
    const rate = Number(pool.rate ?? 0);
    const openingBasis = Number(pool.openingBasis ?? 0);
    const additions = Number(pool.additions ?? 0);
    const disposals = Number(pool.disposals ?? 0);
    const depreciationBasis = Number(pool.depreciationBasis ?? openingBasis + additions - disposals);
    const absorbed = Number(pool.absorbed ?? pool.taxDepreciation ?? 0);
    const unabsorbed = Number(pool.unabsorbed ?? 0);
    const taxDep = Number(pool.taxDepreciation ?? absorbed);
    const closingBasis = Number(pool.closingBasis ?? pool.nextYearBasis ?? Math.max(0, depreciationBasis - taxDep));

    r.getCell(1).value = String(pool.poolName ?? pool.pool ?? '');
    setAmountCell(r.getCell(2), openingBasis || null);
    setAmountCell(r.getCell(3), additions || null);
    setAmountCell(r.getCell(4), disposals || null);
    setAmountCell(r.getCell(5), depreciationBasis || null);
    setAmountCell(r.getCell(6), absorbed || null);
    setAmountCell(r.getCell(7), unabsorbed || null);
    r.getCell(8).value = rate ? rate : null;
    r.getCell(8).numFmt = '0.00%';
    r.getCell(8).alignment = { horizontal: 'right' };
    setAmountCell(r.getCell(9), taxDep || null);
    setAmountCell(r.getCell(10), closingBasis || null);
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });

  const firstDataRow = 4;
  const lastDataRow = 4 + pools.length - 1;
  const totalRow = 4 + pools.length;
  writeSumTotalRow(ws, totalRow, 1, [9], firstDataRow, lastDataRow, 'Total Tax Depreciation');

  const noteRow = ws.getRow(totalRow + 2);
  noteRow.getCell(1).value = 'Copy Closing Basis into Opening Basis each year.';
  noteRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  return { totalTaxDepRow: totalRow };
}

export function writeDisallowForTaxSheet(
  ws: ExcelJS.Worksheet,
  disallowItems: Array<{ description?: string; amount?: number; section?: string; asPerBooks?: number; notes?: string }>,
): { totalDisallowedRow: number } {
  writeNoteSheetTitle(ws, 'Disallow for Tax');

  const headers = ['Particulars', 'As per Books', 'Disallowed Amount', 'Allowed for Tax', 'Notes'];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 40 : 18;
  });

  const items = disallowItems.length > 0 ? disallowItems : Array.from({ length: 5 }, () => ({}));
  items.forEach((item, i) => {
    const r = ws.getRow(4 + i);
    const disallowed = Number(item.amount ?? 0);
    const asPerBooks = Number(item.asPerBooks ?? disallowed);
    const allowed = Math.max(0, asPerBooks - disallowed);

    if (disallowItems.length === 0) {
      for (let ci = 1; ci <= headers.length; ci++) applyGreenInput(r.getCell(ci));
      return;
    }

    r.getCell(1).value = item.description ?? '';
    setAmountCell(r.getCell(2), asPerBooks || null);
    setAmountCell(r.getCell(3), disallowed || null);
    setAmountCell(r.getCell(4), allowed || null);
    r.getCell(5).value = item.section ?? item.notes ?? '';
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });

  const firstDataRow = 4;
  const lastDataRow = 4 + items.length - 1;
  const totalRow = 4 + items.length;
  writeSumTotalRow(ws, totalRow, 1, [2, 3, 4], firstDataRow, lastDataRow, 'Total Disallowed');
  return { totalDisallowedRow: totalRow };
}

export function writeFairValueChangeSheet(
  ws: ExcelJS.Worksheet,
  listedShares: Array<Record<string, unknown>>,
  options?: { trialBalanceFvAdjustment?: number },
): { totalFvGainLossRow: number; verificationMatchRow: number } {
  writeNoteSheetTitle(ws, 'Fair Value Change');

  const headers = [
    'Company Name', 'Opening Units', 'Purchased Units', 'Sold Units', 'Closing Units',
    'Opening LTP (NPR)', 'Closing LTP (NPR)', 'Opening FV', 'Closing FV', 'FV Gain/(Loss)',
  ];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 32 : 16;
  });

  const rows = listedShares.length > 0 ? listedShares : [{}];
  const firstDataRow = 4;
  rows.forEach((share, i) => {
    const r = ws.getRow(firstDataRow + i);
    const rowNum = firstDataRow + i;

    r.getCell(1).value = String(share.companyName ?? share.name ?? share.investmentName ?? '');

    if (listedShares.length === 0) {
      for (let ci = 1; ci <= headers.length; ci++) applyGreenInput(r.getCell(ci));
      return;
    }

    const openingUnits = Number(share.openingUnits ?? share.units ?? 0);
    const purchased = Number(share.purchasedUnits ?? share.purchasesDuringYear ?? share.additions ?? 0);
    const sold = Number(share.soldUnits ?? share.salesDuringYear ?? share.disposals ?? 0);
    const openingLtp = Number(share.openingLtp ?? share.openingLTP ?? share.costPerUnit ?? 0);
    const closingLtp = Number(share.closingLtp ?? share.closingLTP ?? share.ltp ?? 0);
    const openingFv = Number(share.openingFV ?? share.openingBalance ?? share.totalCost ?? 0);

    setAmountCell(r.getCell(2), openingUnits || null);
    setAmountCell(r.getCell(3), purchased || null);
    setAmountCell(r.getCell(4), sold || null);
    r.getCell(5).value = { formula: `B${rowNum}+C${rowNum}-D${rowNum}`, result: openingUnits + purchased - sold };
    r.getCell(5).numFmt = NUMBER_FORMAT;
    r.getCell(5).alignment = { horizontal: 'right' };
    setAmountCell(r.getCell(6), openingLtp || null);
    setAmountCell(r.getCell(7), closingLtp || null);
    setAmountCell(r.getCell(8), openingFv || null);
    r.getCell(9).value = { formula: `E${rowNum}*G${rowNum}`, result: 0 };
    r.getCell(9).numFmt = NUMBER_FORMAT;
    r.getCell(9).alignment = { horizontal: 'right' };
    r.getCell(10).value = { formula: `I${rowNum}-H${rowNum}`, result: 0 };
    r.getCell(10).numFmt = NUMBER_FORMAT;
    r.getCell(10).alignment = { horizontal: 'right' };
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });

  const lastDataRow = firstDataRow + rows.length - 1;
  const totalRow = lastDataRow + 1;
  writeSumTotalRow(ws, totalRow, 1, [10], firstDataRow, lastDataRow, 'Total FV Gain / (Loss)');

  const tbFv = options?.trialBalanceFvAdjustment ?? 0;
  const verifyStart = totalRow + 2;
  ws.getRow(verifyStart).getCell(1).value = 'Verification';
  ws.getRow(verifyStart).getCell(1).font = FONTS.SUBHEADING;
  ws.getRow(verifyStart + 1).getCell(1).value = 'Workings total FV change';
  ws.getRow(verifyStart + 1).getCell(2).value = { formula: `J${totalRow}`, result: 0 };
  ws.getRow(verifyStart + 1).getCell(2).numFmt = NUMBER_FORMAT;
  ws.getRow(verifyStart + 2).getCell(1).value = 'Per trial balance / notes';
  ws.getRow(verifyStart + 2).getCell(2).value = tbFv || null;
  ws.getRow(verifyStart + 2).getCell(2).numFmt = NUMBER_FORMAT;
  ws.getRow(verifyStart + 3).getCell(1).value = 'Match?';
  ws.getRow(verifyStart + 3).getCell(2).value = {
    formula: `ABS(B${verifyStart + 1}-B${verifyStart + 2})<1`,
    result: Math.abs(tbFv) < 1,
  };

  return { totalFvGainLossRow: totalRow, verificationMatchRow: verifyStart + 3 };
}

export function writeSundryDebtors(
  ws: ExcelJS.Worksheet,
  data: { adjustments: YearEndAdjustments; trialBalance: ParsedTrialBalance },
): void {
  writeNoteSheetTitle(ws, 'Sundry Debtors');

  const headers = ['Party Name', 'Dr Balance', 'Cr Balance', '0-30 days', '31-60 days', '61-90 days', '>90 days'];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 36 : 16;
  });

  const rawDebtors = (data.adjustments.debtors ?? []) as Array<Record<string, unknown>>;
  let row = 4;

  if (rawDebtors.length === 0) {
    const noteRow = ws.getRow(row++);
    noteRow.getCell(1).value = 'Subledger not provided — TB balances shown';
    noteRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    ws.mergeCells(row - 1, 1, row - 1, headers.length);

    const tbDebtors = data.trialBalance.rows.filter((r) => r.nfrsCategory === 'trade_receivables');
    const firstDataRow = row;
    tbDebtors.forEach((d) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = d.rawLabel;
      setAmountCell(r.getCell(2), d.closingDr || null);
      setAmountCell(r.getCell(3), d.closingCr || null);
      const net = (d.closingDr ?? 0) - (d.closingCr ?? 0);
      const [b0, b1, b2, b3] = agingBucketAmount(net, 30);
      [b0, b1, b2, b3].forEach((v, i) => setAmountCell(r.getCell(4 + i), v || null));
    });
    if (row > firstDataRow) {
      writeSumTotalRow(ws, row++, 1, [2, 3, 4, 5, 6, 7], firstDataRow, row - 2, 'Total');
    }
    return;
  }

  const firstDataRow = row;
  rawDebtors.forEach((d) => {
    const partyName = String(d.partyName ?? d.name ?? '');
    const debitBalance = Number(d.debitBalance ?? d.totalAmount ?? (d.isAdvanceFromCustomer ? 0 : d.balanceCY) ?? 0);
    const creditBalance = Number(d.creditBalance ?? (d.isAdvanceFromCustomer ? d.balanceCY : 0) ?? 0);
    const days = debtorAgingDays(d);
    const [b0, b1, b2, b3] = agingBucketAmount(debitBalance, days);

    const r = ws.getRow(row++);
    r.getCell(1).value = partyName;
    setAmountCell(r.getCell(2), debitBalance || null);
    setAmountCell(r.getCell(3), creditBalance || null);
    [b0, b1, b2, b3].forEach((v, i) => setAmountCell(r.getCell(4 + i), v || null));
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });

  if (row > firstDataRow) {
    writeSumTotalRow(ws, row, 1, [2, 3, 4, 5, 6, 7], firstDataRow, row - 1, 'Total');
  }
}

export function writeSundryCreditors(
  ws: ExcelJS.Worksheet,
  data: { adjustments: YearEndAdjustments; trialBalance: ParsedTrialBalance },
): void {
  writeNoteSheetTitle(ws, 'Sundry Creditors');

  const headers = ['Party Name', 'Dr Balance', 'Cr Balance'];
  const hRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = FONTS.SUBHEADING;
    applyHeaderFill(c, COLORS.SUBHEADER_BG);
    applyAllBorders(c);
    ws.getColumn(i + 1).width = i === 0 ? 36 : 18;
  });

  const rawCreditors = (data.adjustments.creditors ?? []) as Array<Record<string, unknown>>;
  let row = 4;

  if (rawCreditors.length === 0) {
    const noteRow = ws.getRow(row++);
    noteRow.getCell(1).value = 'Subledger not provided — TB balances shown';
    noteRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    ws.mergeCells(row - 1, 1, row - 1, headers.length);

    const tbCreditors = data.trialBalance.rows.filter((r) => r.nfrsCategory === 'trade_payables_creditors');
    const firstDataRow = row;
    tbCreditors.forEach((d) => {
      const r = ws.getRow(row++);
      r.getCell(1).value = d.rawLabel;
      setAmountCell(r.getCell(2), d.closingDr || null);
      setAmountCell(r.getCell(3), d.closingCr || null);
    });
    if (row > firstDataRow) {
      writeSumTotalRow(ws, row, 1, [2, 3], firstDataRow, row - 1, 'Total');
    }
    return;
  }

  const firstDataRow = row;
  rawCreditors.forEach((d) => {
    const r = ws.getRow(row++);
    r.getCell(1).value = String(d.partyName ?? d.name ?? '');
    setAmountCell(r.getCell(2), Number(d.debitBalance ?? 0) || null);
    setAmountCell(r.getCell(3), Number(d.creditBalance ?? d.totalAmount ?? d.balanceCY ?? 0) || null);
    for (let ci = 1; ci <= headers.length; ci++) applyAllBorders(r.getCell(ci));
  });

  if (row > firstDataRow) {
    writeSumTotalRow(ws, row, 1, [2, 3], firstDataRow, row - 1, 'Total');
  }
}

export function writeBankAccounts(ws: ExcelJS.Worksheet, note38: NotesData['note38_cashAndEquivalents']): void {
  writeNoteSheetTitle(ws, 'Bank Accounts');
  const hRow = ws.getRow(3);
  ['Bank Name', 'Account Type', 'Current Year', 'Previous Year'].forEach((h, i) => { const c = hRow.getCell(i + 1); c.value = h; c.font = FONTS.SUBHEADING; applyHeaderFill(c, COLORS.SUBHEADER_BG); });
  (note38.bankBalances ?? []).forEach((b: { bankName: string; accountType?: string; cy?: number; py?: number }, i: number) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = b.bankName; r.getCell(2).value = b.accountType;
    r.getCell(3).value = b.cy || null; r.getCell(3).numFmt = NUMBER_FORMAT; r.getCell(3).alignment = { horizontal: 'right' };
    r.getCell(4).value = b.py || null; r.getCell(4).numFmt = NUMBER_FORMAT; r.getCell(4).alignment = { horizontal: 'right' };
  });
}

export function writeTrialBalance(
  ws: ExcelJS.Worksheet,
  tb: ParsedTrialBalance,
  company?: CompanyProfile,
): void {
  writeMesFormatTrialBalance(ws, tb, company);
}

export function writeAdjustments(ws: ExcelJS.Worksheet, adj: YearEndAdjustments): void {
  writeNoteSheetTitle(ws, 'Adjustment Journal Entries');
  const hRow = ws.getRow(3);
  ['#', 'Description', 'Dr Account', 'Cr Account', 'Amount', 'Note Ref', 'Source'].forEach((h, i) => {
    const c = hRow.getCell(i + 1); c.value = h; applySubHeaderStyle(c); applyAllBorders(c);
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

export function writeTaxCalculationSheet(
  ws: ExcelJS.Worksheet,
  taxData: TaxCalculationSheetData,
  fiscalYear: string,
): NoteRowMap {
  ws.columns = [{ width: 44 }, { width: 10 }, { width: 18 }, { width: 18 }];

  ws.mergeCells('A1:D1');
  const r1 = ws.getCell('A1');
  r1.value = (taxData.companyName || 'Company Name').toUpperCase();
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  applyHeaderStyle(r1);
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:D2');
  const r2 = ws.getCell('A2');
  r2.value = taxData.address || '';
  r2.font = { name: 'Arial', size: 10 };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBodyStyle(r2);

  ws.mergeCells('A3:D3');
  const r3 = ws.getCell('A3');
  r3.value = 'COMPUTATION OF INCOME TAX';
  r3.font = { name: 'Arial', size: 11, bold: true };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('A4:D4');
  const r4 = ws.getCell('A4');
  r4.value = `FOR FISCAL YEAR ${fiscalYear}`;
  r4.font = { name: 'Arial', size: 10, italic: true };
  r4.alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = ws.getRow(6);
  ['Particulars', 'Note', 'As per Books', 'For Income Tax'].forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle(c);
    c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    applyAllBorders(c);
  });

  const is = taxData.incomeStatement;
  const oi = taxData.otherIncome;
  const repair = taxData.repairExpense ?? 0;
  const interestExp = Number(is.financeCharges ?? is.interestExpenses ?? 0);
  const bookDepn = Number(is.depreciation ?? 0);
  const generalDeduction = Math.max(
    0,
    Number(is.totalExpenses ?? 0) - bookDepn - interestExp - repair,
  );

  const inclusionItems: Array<{ label: string; note?: string; books: number; tax: number | 'exempt' }> = [
    {
      label: 'Sales u/s 7(2)(Kha)',
      note: '3.17',
      books: Number(is.revenue ?? is.revenueFromOperations ?? 0),
      tax: Number(is.revenue ?? is.revenueFromOperations ?? 0),
    },
    {
      label: 'Interest Income',
      books: Number(oi?.interestIncome?.cy ?? is.interestIncome ?? 0),
      tax: Number(oi?.interestIncome?.cy ?? is.interestIncome ?? 0),
    },
    {
      label: 'Commission Income',
      books: Number(oi?.commissionIncome?.cy ?? 0),
      tax: Number(oi?.commissionIncome?.cy ?? 0),
    },
    {
      label: 'Rental Income',
      books: Number(oi?.rentalIncome?.cy ?? 0),
      tax: Number(oi?.rentalIncome?.cy ?? 0),
    },
    {
      label: 'Dividend Income',
      books: Number(oi?.dividendReceived?.cy ?? 0),
      tax: 'exempt',
    },
    {
      label: 'Insurance Claim Income',
      books: Number(oi?.insuranceClaims?.cy ?? 0),
      tax: Number(oi?.insuranceClaims?.cy ?? 0),
    },
    {
      label: 'Gain on Disposal of Assets',
      books: Number(oi?.gainOnDisposalAssets?.cy ?? 0),
      tax: Number(oi?.gainOnDisposalAssets?.cy ?? 0),
    },
    {
      label: 'Other Income',
      books: Number(oi?.miscellaneousIncome?.cy ?? is.otherIncome ?? 0),
      tax: Number(oi?.miscellaneousIncome?.cy ?? is.otherIncome ?? 0),
    },
  ];

  let row = 7;
  writeSectionHeader(ws, row++, 'INCLUSIONS', 4);
  const inclusionStart = row;
  inclusionItems.forEach((item) => {
    const r = ws.getRow(row++);
    r.getCell(1).value = item.label;
    if (item.note) {
      r.getCell(2).value = item.note;
      r.getCell(2).font = FONTS.NOTE_REF;
    }
    setAmountCell(r.getCell(3), item.books || null);
    if (item.tax === 'exempt') {
      setAmountCell(r.getCell(4), 0);
    } else {
      setAmountCell(r.getCell(4), item.tax || null);
    }
    [1, 2, 3, 4].forEach((ci) => applyAllBorders(r.getCell(ci)));
  });
  const inclusionEnd = row - 1;
  const totalInclusionRow = row++;
  writeSumTotalRow(ws, totalInclusionRow, 1, [3, 4], inclusionStart, inclusionEnd, 'Total Inclusion');

  writeSectionHeader(ws, row++, 'DEDUCTIONS', 4);
  const deductionStart = row;
  const deductionRows: Array<{ label: string; note?: string; books: number | null; taxFormula?: string; taxValue?: number | null }> = [
    { label: 'General Deduction u/s 13', books: generalDeduction, taxValue: generalDeduction },
    { label: 'Interest u/s 14', books: interestExp, taxValue: interestExp },
    { label: 'Cost of Trading Stock u/s 15', note: '3.18', books: Number(is.materialConsumed ?? 0), taxValue: Number(is.materialConsumed ?? 0) },
    { label: 'Repair & Improvement u/s 16', books: repair, taxValue: repair },
    { label: 'Depreciation u/s 19', books: bookDepn, taxValue: null },
  ];

  deductionRows.forEach((item, idx) => {
    const r = ws.getRow(row++);
    r.getCell(1).value = item.label;
    if (item.note) {
      r.getCell(2).value = item.note;
      r.getCell(2).font = FONTS.NOTE_REF;
    }
    setAmountCell(r.getCell(3), item.books);
    const taxCell = r.getCell(4);
    if (idx === 4 && taxData.taxDepSheetName && taxData.taxDepTotalRow) {
      taxCell.value = {
        formula: cellRef(taxData.taxDepSheetName, 'I', taxData.taxDepTotalRow).replace(/^=/, ''),
        result: 0,
      };
      taxCell.numFmt = NUMBER_FORMAT;
      taxCell.alignment = { horizontal: 'right' };
    } else {
      setAmountCell(taxCell, item.taxValue ?? null);
    }
    [1, 2, 3, 4].forEach((ci) => applyAllBorders(r.getCell(ci)));
  });
  const deductionEnd = row - 1;
  const totalDeductionRow = row++;
  writeSumTotalRow(ws, totalDeductionRow, 1, [3, 4], deductionStart, deductionEnd, 'Total Deduction');

  const assessableIncomeRow = row++;
  const assessableRow = ws.getRow(assessableIncomeRow);
  assessableRow.getCell(1).value = 'Assessable Income';
  assessableRow.getCell(3).value = {
    formula: `C${totalInclusionRow}-C${totalDeductionRow}`,
    result: 0,
  };
  assessableRow.getCell(4).value = {
    formula: `D${totalInclusionRow}-D${totalDeductionRow}`,
    result: 0,
  };
  [3, 4].forEach((ci) => {
    const c = assessableRow.getCell(ci);
    c.numFmt = NUMBER_FORMAT;
    c.alignment = { horizontal: 'right' };
    applyTotalStyle(c);
    applyAllBorders(c);
  });
  applyAllBorders(assessableRow.getCell(1));

  const donationRow = row++;
  const donationR = ws.getRow(donationRow);
  donationR.getCell(1).value = 'Less: Donation u/s 12';
  const donationCell = donationR.getCell(4);
  donationCell.value = taxData.donations ?? 0;
  donationCell.numFmt = NUMBER_FORMAT;
  donationCell.alignment = { horizontal: 'right' };
  applyInputStyle(donationCell);
  applyAllBorders(donationCell);
  applyAllBorders(donationR.getCell(1));

  const incomeLossRow = row++;
  const incomeLossR = ws.getRow(incomeLossRow);
  incomeLossR.getCell(1).value = 'Income/(Loss)';
  incomeLossR.getCell(4).value = { formula: `D${assessableIncomeRow}-D${donationRow}`, result: 0 };
  incomeLossR.getCell(4).numFmt = NUMBER_FORMAT;
  incomeLossR.getCell(4).alignment = { horizontal: 'right' };
  applyTotalStyle(incomeLossR.getCell(4));
  applyAllBorders(incomeLossR.getCell(1));
  applyAllBorders(incomeLossR.getCell(4));

  const lossCarryRow = row++;
  const lossCarryR = ws.getRow(lossCarryRow);
  lossCarryR.getCell(1).value = 'Carry forward of losses u/s 20';
  const lossCarryCell = lossCarryR.getCell(4);
  lossCarryCell.value = taxData.lossCarryForward ?? 0;
  lossCarryCell.numFmt = NUMBER_FORMAT;
  lossCarryCell.alignment = { horizontal: 'right' };
  applyInputStyle(lossCarryCell);
  applyAllBorders(lossCarryCell);
  applyAllBorders(lossCarryR.getCell(1));

  const taxableIncomeRow = row++;
  const taxableR = ws.getRow(taxableIncomeRow);
  taxableR.getCell(1).value = 'Taxable Income/(Loss)';
  taxableR.getCell(4).value = { formula: `D${incomeLossRow}-D${lossCarryRow}`, result: 0 };
  taxableR.getCell(4).numFmt = NUMBER_FORMAT;
  taxableR.getCell(4).alignment = { horizontal: 'right' };
  applyTotalStyle(taxableR.getCell(4));
  applyAllBorders(taxableR.getCell(1));
  applyAllBorders(taxableR.getCell(4));

  const taxRateRow = row++;
  const taxRateR = ws.getRow(taxRateRow);
  taxRateR.getCell(1).value = 'Income Tax Rate';
  const rateCell = taxRateR.getCell(4);
  rateCell.value = taxData.taxRate ?? 0.25;
  rateCell.numFmt = '0.00%';
  rateCell.alignment = { horizontal: 'right' };
  applyAssumptionStyle(rateCell);
  applyAllBorders(rateCell);
  applyAllBorders(taxRateR.getCell(1));

  const incomeTaxLiabilityRow = row++;
  const incomeTaxR = ws.getRow(incomeTaxLiabilityRow);
  incomeTaxR.getCell(1).value = 'Income Tax Liability';
  incomeTaxR.getCell(4).value = { formula: `MAX(0,D${taxableIncomeRow}*D${taxRateRow})`, result: 0 };
  incomeTaxR.getCell(4).numFmt = NUMBER_FORMAT;
  incomeTaxR.getCell(4).alignment = { horizontal: 'right' };
  applyTotalStyle(incomeTaxR.getCell(4));
  applyAllBorders(incomeTaxR.getCell(1));
  applyAllBorders(incomeTaxR.getCell(4));

  const feeRow = row++;
  const feeR = ws.getRow(feeRow);
  feeR.getCell(1).value = 'Fee u/s 117';
  const feeCell = feeR.getCell(4);
  feeCell.value = taxData.feeSection117 ?? 0;
  feeCell.numFmt = NUMBER_FORMAT;
  feeCell.alignment = { horizontal: 'right' };
  applyInputStyle(feeCell);
  applyAllBorders(feeCell);
  applyAllBorders(feeR.getCell(1));

  const lateTaxInputRow = row + 3;
  const shortfallInputRow = row + 4;

  const interest118Row = row++;
  const int118R = ws.getRow(interest118Row);
  int118R.getCell(1).value = 'Interest u/s 118';
  int118R.getCell(4).value = { formula: `IF(D${lateTaxInputRow}>0,D${lateTaxInputRow}*0.15,0)`, result: 0 };
  int118R.getCell(4).numFmt = NUMBER_FORMAT;
  int118R.getCell(4).alignment = { horizontal: 'right' };
  applyAllBorders(int118R.getCell(1));
  applyAllBorders(int118R.getCell(4));

  const interest119Row = row++;
  const int119R = ws.getRow(interest119Row);
  int119R.getCell(1).value = 'Interest u/s 119';
  int119R.getCell(4).value = { formula: `IF(D${shortfallInputRow}>0,D${shortfallInputRow}*0.15,0)`, result: 0 };
  int119R.getCell(4).numFmt = NUMBER_FORMAT;
  int119R.getCell(4).alignment = { horizontal: 'right' };
  applyAllBorders(int119R.getCell(1));
  applyAllBorders(int119R.getCell(4));

  const totalTaxLiabilityRow = row++;
  const totalTaxR = ws.getRow(totalTaxLiabilityRow);
  totalTaxR.getCell(1).value = 'Total Tax Liability';
  totalTaxR.getCell(4).value = {
    formula: `D${incomeTaxLiabilityRow}+D${feeRow}+D${interest118Row}+D${interest119Row}`,
    result: 0,
  };
  totalTaxR.getCell(4).numFmt = NUMBER_FORMAT;
  totalTaxR.getCell(4).alignment = { horizontal: 'right' };
  applyTotalStyle(totalTaxR.getCell(4));
  applyAllBorders(totalTaxR.getCell(1));
  applyAllBorders(totalTaxR.getCell(4));

  row = lateTaxInputRow;
  const lateTaxR = ws.getRow(lateTaxInputRow);
  lateTaxR.getCell(1).value = 'Tax paid late (input for s118)';
  lateTaxR.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  const lateTaxCell = lateTaxR.getCell(4);
  lateTaxCell.value = taxData.lateTaxPaidAmount ?? 0;
  lateTaxCell.numFmt = NUMBER_FORMAT;
  lateTaxCell.alignment = { horizontal: 'right' };
  applyInputStyle(lateTaxCell);

  const shortfallR = ws.getRow(shortfallInputRow);
  shortfallR.getCell(1).value = 'Advance tax shortfall (input for s119)';
  shortfallR.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  const shortfallCell = shortfallR.getCell(4);
  shortfallCell.value = taxData.advanceTaxShortfall ?? 0;
  shortfallCell.numFmt = NUMBER_FORMAT;
  shortfallCell.alignment = { horizontal: 'right' };
  applyInputStyle(shortfallCell);

  SHEET_ROW_REGISTRY.taxCalcIncomeTaxRow = incomeTaxLiabilityRow;
  SHEET_ROW_REGISTRY.taxCalcNetPayableRow = totalTaxLiabilityRow;
  SHEET_ROW_REGISTRY.assessableIncomeRow = assessableIncomeRow;
  SHEET_ROW_REGISTRY.totalTaxLiabilityRow = totalTaxLiabilityRow;

  return {
    assessableIncomeRow,
    taxableIncomeRow,
    taxCalcIncomeTaxRow: incomeTaxLiabilityRow,
    taxCalcNetPayableRow: totalTaxLiabilityRow,
    totalTaxLiabilityRow,
    note314_incomeTaxRow: totalTaxLiabilityRow,
  };
}

export function writeTaxProfitReconciliationSheet(
  ws: ExcelJS.Worksheet,
  data: TaxProfitReconciliationData,
): { assessableIncomeRow: number; reconciliationCheckRow: number } {
  ws.columns = [{ width: 50 }, { width: 20 }];

  ws.mergeCells('A1:B1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `TAX PROFIT RECONCILIATION FOR FY ${data.fiscalYear}`;
  applyHeaderStyle(titleCell);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const headerRow = ws.getRow(3);
  ['Particulars', 'Amount'].forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle(c);
    applyAllBorders(c);
  });

  let row = 4;
  writeSectionHeader(ws, row++, 'Book Profit to Assessable Income', 2);

  const profitRow = row++;
  ws.getRow(profitRow).getCell(1).value = 'Profit before tax per accounts (from IS)';
  setAmountCell(ws.getRow(profitRow).getCell(2), data.profitBeforeTax || null);

  const depnRow = row++;
  ws.getRow(depnRow).getCell(1).value = 'Add: Depreciation as per books';
  setAmountCell(ws.getRow(depnRow).getCell(2), data.bookDepreciation || null);

  const disallowRow = row++;
  ws.getRow(disallowRow).getCell(1).value = 'Add: Disallowed expenses';
  const disallowCell = ws.getRow(disallowRow).getCell(2);
  disallowCell.value = {
    formula: cellRef(data.disallowSheetName, 'C', data.disallowTotalRow).replace(/^=/, ''),
    result: 0,
  };
  disallowCell.numFmt = NUMBER_FORMAT;
  disallowCell.alignment = { horizontal: 'right' };

  const taxDepRow = row++;
  ws.getRow(taxDepRow).getCell(1).value = 'Less: Tax depreciation';
  const taxDepCell = ws.getRow(taxDepRow).getCell(2);
  taxDepCell.value = {
    formula: `-${cellRef(data.taxDepSheetName, 'I', data.taxDepTotalRow).replace(/^=/, '')}`,
    result: 0,
  };
  taxDepCell.numFmt = NUMBER_FORMAT;
  taxDepCell.alignment = { horizontal: 'right' };

  const exemptRow = row++;
  ws.getRow(exemptRow).getCell(1).value = 'Less: Exempt income (Dividend income)';
  setAmountCell(ws.getRow(exemptRow).getCell(2), data.dividendExempt ? -data.dividendExempt : null);

  const otherAdjRow = row++;
  ws.getRow(otherAdjRow).getCell(1).value = 'Add/Less: Other adjustments';
  const otherAdjCell = ws.getRow(otherAdjRow).getCell(2);
  otherAdjCell.value = 0;
  otherAdjCell.numFmt = NUMBER_FORMAT;
  otherAdjCell.alignment = { horizontal: 'right' };
  applyInputStyle(otherAdjCell);

  const assessableIncomeRow = row++;
  const assessableR = ws.getRow(assessableIncomeRow);
  assessableR.getCell(1).value = 'Assessable Income';
  assessableR.getCell(2).value = {
    formula: `B${profitRow}+B${depnRow}+B${disallowRow}+B${taxDepRow}+B${exemptRow}+B${otherAdjRow}`,
    result: 0,
  };
  assessableR.getCell(2).numFmt = NUMBER_FORMAT;
  assessableR.getCell(2).alignment = { horizontal: 'right' };
  applyTotalStyle(assessableR.getCell(2));

  const reconciliationCheckRow = row + 1;
  const checkR = ws.getRow(reconciliationCheckRow);
  checkR.getCell(1).value = 'Reconciliation Check';
  const taxCalcRef = cellRef(data.taxCalcSheetName, 'D', data.taxCalcAssessableRow).replace(/^=/, '');
  checkR.getCell(2).value = {
    formula: `IF(B${assessableIncomeRow}=${taxCalcRef},"RECONCILED ✓","DIFFERENCE: "&B${assessableIncomeRow}-${taxCalcRef})`,
    result: 'RECONCILED ✓',
  };
  checkR.getCell(2).alignment = { horizontal: 'center' };
  checkR.getCell(2).font = { name: 'Arial', size: 10, bold: true };

  ws.addConditionalFormatting({
    ref: `B${reconciliationCheckRow}`,
    rules: [
      {
        type: 'expression',
        formulae: [`B${assessableIncomeRow}=${taxCalcRef}`],
        priority: 1,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: `FF${COLORS.GREEN_INPUT}` } },
          font: { color: { argb: 'FF166534' }, bold: true },
        },
      },
      {
        type: 'expression',
        formulae: [`B${assessableIncomeRow}<>${taxCalcRef}`],
        priority: 2,
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: `FF${COLORS.RED}` } },
          font: { color: { argb: 'FFFFFFFF' }, bold: true },
        },
      },
    ],
  });

  return { assessableIncomeRow, reconciliationCheckRow };
}

export function writeTaxCalculation(ws: ExcelJS.Worksheet, note323: NotesData['note323_incomeTax']): NoteRowMap {
  writeNoteSheetTitle(ws, 'Income Tax Computation');
  const rateCell = ws.getRow(2).getCell(1);
  rateCell.value = `Tax Rate: ${(note323.taxRate * 100).toFixed(0)}%`;
  applyAssumptionStyle(rateCell);
  const startRow = 4;
  const items: [string, number | null][] = [
    ['Profit Before Tax', note323.profitBeforeTax],
    ...Object.entries(note323.addDisallowableExpenses ?? {}).map(([k, v]) => [`Add: ${k}`, v as number] as [string, number]),
    ...Object.entries(note323.lessAllowableExpenses ?? {}).map(([k, v]) => [`Less: ${k}`, v as number] as [string, number]),
    ['Taxable Income', note323.taxableIncome],
    ['Income Tax', note323.currentTax],
    ['Advance Tax / TDS Credit', note323.advanceTaxPaid + note323.tdsCreditAvailable],
    ['Net Tax Payable (Income Tax Liability)', null],
  ];
  const incomeTaxRow = startRow + items.findIndex(([label]) => label === 'Income Tax');
  const advanceRow = startRow + items.findIndex(([label]) => label === 'Advance Tax / TDS Credit');
  const netPayableRow = startRow + items.length - 1;
  items.forEach(([label, val], i) => {
    const r = ws.getRow(startRow + i);
    r.getCell(1).value = label;
    applyBodyStyle(r.getCell(1));
    const amountCell = r.getCell(2);
    if (label === 'Net Tax Payable (Income Tax Liability)') {
      amountCell.value = { formula: `B${incomeTaxRow}-B${advanceRow}`, result: note323.netTaxPayable };
      applyTotalStyle(amountCell);
    } else {
      amountCell.value = val || null;
      applyBodyStyle(amountCell);
    }
    amountCell.numFmt = NUMBER_FORMAT;
    amountCell.alignment = { horizontal: 'right' };
  });
  SHEET_ROW_REGISTRY.taxCalcNetPayableRow = netPayableRow;
  SHEET_ROW_REGISTRY.taxCalcIncomeTaxRow = incomeTaxRow;
  return { taxCalcNetPayableRow: netPayableRow, taxCalcIncomeTaxRow: incomeTaxRow, note314_incomeTaxRow: netPayableRow };
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
    const d = item as DepreciationSummary & {
      nbvClosing?: number;
      impairmentLosses?: number;
      securedAmount?: number;
      hasSecuredAssets?: boolean;
      categoryId?: string;
    };
    return {
      ...d,
      netBookValueClosing: d.netBookValueClosing ?? d.nbvClosing ?? Math.max(0, (d.closingCost ?? 0) - (d.closingAccumDepn ?? 0)),
      impairmentLosses: d.impairmentLosses ?? 0,
      securedAmount: d.securedAmount ?? 0,
      hasSecuredAssets: d.hasSecuredAssets ?? false,
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
function buildInvestmentsNoteData(
  note32?: NotesData['note32_investments'] | null,
): CyPyRecord {
  const data: CyPyRecord = {};
  if (!note32) return data;

  for (const share of note32.listedShares ?? []) {
    data[`Listed Shares — ${share.companyName}`] = {
      cy: share.carryingAmount ?? share.marketValue ?? 0,
      py: share.openingCost ?? 0,
    };
  }
  for (const share of note32.unlistedShares ?? []) {
    data[`Unlisted Shares — ${share.companyName}`] = {
      cy: share.closingCarrying ?? 0,
      py: share.openingCost ?? 0,
    };
  }
  if ((note32.fdrNonCurrent ?? 0) !== 0) {
    data['Fixed Deposits (Non-current)'] = { cy: note32.fdrNonCurrent ?? 0, py: 0 };
  }
  if ((note32.fdrCurrent ?? 0) !== 0) {
    data['Fixed Deposits (Current)'] = { cy: note32.fdrCurrent ?? 0, py: 0 };
  }
  if ((note32.totalNonCurrent ?? 0) !== 0 && Object.keys(data).length === 0) {
    data['Investments (Non-current)'] = { cy: note32.totalNonCurrent ?? 0, py: 0 };
  }
  if ((note32.totalCurrent ?? 0) !== 0 && Object.keys(data).length === 0) {
    data['Investments (Current)'] = { cy: note32.totalCurrent ?? 0, py: 0 };
  }
  return data;
}

function buildProvisionsNoteData(adjustments: YearEndAdjustments): CyPyRecord {
  const record: CyPyRecord = {};
  for (const provision of adjustments.provisions ?? []) {
    const label = String(provision.provisionType ?? 'Provision')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    record[label] = {
      cy: provision.closingBalance ?? 0,
      py: provision.openingBalance ?? 0,
    };
  }
  if (Object.keys(record).length === 0) {
    record['No provisions recognised'] = { cy: 0, py: 0 };
  }
  return record;
}

function writeDisclosureTextNote(ws: ExcelJS.Worksheet, title: string, body: string): void {
  writeNoteSheetTitle(ws, title);
  ws.mergeCells(3, 1, 10, 3);
  const cell = ws.getCell(3, 1);
  cell.value = body;
  cell.alignment = { wrapText: true, vertical: 'top' };
  cell.font = { name: 'Arial', size: 10 };
}

type TradeReceivablesNoteData = NotesData['note33_tradeReceivables'] & {
  grossReceivables_cy?: number;
  grossReceivables_py?: number;
  provisionMovement?: {
    opening?: number;
    additions?: number;
    writeOffs?: number;
    reversals?: number;
    closing?: number;
  };
  provisionForImpairment_cy?: number;
  provisionForImpairment_py?: number;
  netReceivables_cy?: number;
  netReceivables_py?: number;
  relatedPartyReceivables?: number;
  prepayments?: number;
  tdsReceivable?: number;
  staffAdvances?: number;
  advanceToSuppliers?: number;
  otherLoansAdvances?: number;
  agingAnalysis?: Array<{ bucket: string; amount: number }>;
};

function writeNote33_Receivables(
  ws: ExcelJS.Worksheet,
  note?: TradeReceivablesNoteData | null,
): NoteRowMap {
  writeNoteSheetTitle(ws, '3.3  Trade and Other Receivables');
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;

  const writeHeader = (rowNum: number) => {
    ['Particulars', 'Current Year', 'Previous Year'].forEach((label, idx) => {
      const cell = ws.getRow(rowNum).getCell(idx + 1);
      cell.value = label;
      applySubHeaderStyle(cell);
      applyAllBorders(cell);
      cell.alignment = { horizontal: idx === 0 ? 'left' : 'right' };
    });
  };

  const writeAmountLine = (rowNum: number, label: string, cy?: number, py?: number, bold = false) => {
    const row = ws.getRow(rowNum);
    row.getCell(1).value = label;
    row.getCell(2).value = cy || null;
    row.getCell(3).value = py || null;
    [1, 2, 3].forEach((col) => {
      const cell = row.getCell(col);
      applyBodyStyle(cell);
      applyAllBorders(cell);
      if (col > 1) {
        cell.numFmt = NUMBER_FORMAT;
        cell.alignment = { horizontal: 'right' };
      }
      if (bold) applyTotalStyle(cell);
    });
  };

  let row = 3;
  writeHeader(row++);

  const grossCy = note?.grossReceivables_cy ?? 0;
  const grossPy = note?.grossReceivables_py ?? 0;
  const provisionCy = note?.provisionForImpairment_cy ?? note?.provisionMovement?.closing ?? 0;
  const provisionPy = note?.provisionForImpairment_py ?? note?.provisionMovement?.opening ?? 0;
  const netCy = note?.netReceivables_cy ?? Math.max(0, grossCy - provisionCy);
  const netPy = note?.netReceivables_py ?? Math.max(0, grossPy - provisionPy);

  writeAmountLine(row++, 'Gross Trade Receivables', grossCy, grossPy);
  writeAmountLine(row++, 'Less: Provision for Impairment', -provisionCy, -provisionPy);
  const netRow = row;
  writeAmountLine(row++, 'Net Trade Receivables', netCy, netPy, true);

  const otherLines: Array<[string, number | undefined]> = [
    ['Related Party Receivables', note?.relatedPartyReceivables],
    ['Prepayments', note?.prepayments],
    ['TDS Receivable', note?.tdsReceivable],
    ['Staff Advances', note?.staffAdvances],
    ['Advance to Suppliers', note?.advanceToSuppliers],
    ['Other Loans & Advances', note?.otherLoansAdvances],
  ];
  const visibleOther = otherLines.filter(([, amount]) => (amount ?? 0) !== 0);
  if (visibleOther.length > 0) {
    row++;
    ws.getRow(row).getCell(1).value = 'Other Receivable Components';
    ws.getRow(row).getCell(1).font = FONTS.SUBHEADING;
    row++;
    for (const [label, amount] of visibleOther) {
      writeAmountLine(row++, `  ${label}`, amount, 0);
    }
  }

  const movement = note?.provisionMovement;
  if (movement) {
    row++;
    ws.getRow(row).getCell(1).value = 'Movement in Provision for Doubtful Debts';
    ws.getRow(row).getCell(1).font = FONTS.SUBHEADING;
    row++;
    writeAmountLine(row++, '  Opening Balance', movement.opening, undefined);
    writeAmountLine(row++, '  Additions during the Year', movement.additions, undefined);
    writeAmountLine(row++, '  Write-offs', -(movement.writeOffs ?? 0), undefined);
    writeAmountLine(row++, '  Reversals', -(movement.reversals ?? 0), undefined);
    writeAmountLine(row++, '  Closing Balance', movement.closing, undefined, true);
  }

  const aging = note?.agingAnalysis ?? [];
  if (aging.length > 0) {
    row++;
    ws.getRow(row).getCell(1).value = 'Ageing Analysis of Trade Receivables';
    ws.getRow(row).getCell(1).font = FONTS.SUBHEADING;
    row++;
    writeHeader(row++);
    for (const bucket of aging) {
      writeAmountLine(row++, `  ${bucket.bucket}`, bucket.amount, 0);
    }
  }

  return { note33_receivablesRow: netRow, cyTotalRow: netRow };
}

function writeGenericNoteRecord(ws: ExcelJS.Worksheet, title: string, data?: CyPyRecord | null): NoteRowMap {
  const safeData = data ?? {};
  writeNoteSheetTitle(ws, title);
  const hRow = ws.getRow(3);
  ['Particulars', 'Current Year', 'Previous Year'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    applySubHeaderStyle(c);
    applyAllBorders(c);
  });
  const entries = Object.entries(safeData);
  const dataStartRow = 4;
  entries.forEach(([label, vals], i) => {
    const r = ws.getRow(dataStartRow + i);
    r.getCell(1).value = label;
    applyBodyStyle(r.getCell(1));
    r.getCell(2).value = vals.cy || null;
    r.getCell(3).value = vals.py || null;
    [2, 3].forEach((ci) => {
      const c = r.getCell(ci);
      c.numFmt = NUMBER_FORMAT;
      c.alignment = { horizontal: 'right' };
      applyBodyStyle(c);
    });
  });

  if (entries.length === 0) {
    return { cyTotalRow: dataStartRow };
  }

  const totalRowNum = dataStartRow + entries.length;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.getCell(1).value = 'Total';
  applyBodyStyle(totalRow.getCell(1));
  applyTotalStyle(totalRow.getCell(1));

  const cySum = entries.reduce((s, [, v]) => s + (v.cy ?? 0), 0);
  const pySum = entries.reduce((s, [, v]) => s + (v.py ?? 0), 0);
  const cyCell = totalRow.getCell(2);
  const pyCell = totalRow.getCell(3);

  if (entries.length === 1) {
    cyCell.value = { formula: `B${dataStartRow}`, result: cySum };
    pyCell.value = { formula: `C${dataStartRow}`, result: pySum };
  } else {
    cyCell.value = {
      formula: `SUM(B${dataStartRow}:B${dataStartRow + entries.length - 1})`,
      result: cySum,
    };
    pyCell.value = {
      formula: `SUM(C${dataStartRow}:C${dataStartRow + entries.length - 1})`,
      result: pySum,
    };
  }
  [cyCell, pyCell].forEach((c) => {
    c.numFmt = NUMBER_FORMAT;
    c.alignment = { horizontal: 'right' };
    applyTotalStyle(c);
  });

  return { cyTotalRow: totalRowNum };
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
  writeEnterDetails(addSheet('Enter Details', COLORS.GREEN_INPUT), company, adjustments);
  writeTrialBalance(addSheet('Trial Balance', COLORS.BRAND_BLUE), trialBalance, company);
  const bsRowMap = writeBalanceSheet(addSheet('Balance Sheet', COLORS.BRAND_BLUE), balanceSheet, company);
  const isRowMap = writeIncomeStatement(addSheet('Income Statement', COLORS.BRAND_BLUE), incomeStatement, company);
  const ceRowMap = writeChangesInEquity(addSheet('Change in Equity', COLORS.BRAND_BLUE), changesInEquity, company);
  const cfRowMap = writeCashFlowStatement(addSheet('Cash Flow', COLORS.BRAND_BLUE), cashFlow, company);
  writeNote1_AccountingPolicies(wb, {
    ...(company.accountingPolicies ?? {}),
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? ''
  });
  writeNote2_CriticalJudgments(wb, {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsFY ?? ''
  });
  const taxNoteData = notes.note323_incomeTax ?? {
    profitBeforeTax: 0, addDisallowableExpenses: {}, lessAllowableExpenses: {},
    taxableIncome: 0, currentTax: 0, taxRate: 0.25, advanceTaxPaid: 0, tdsCreditAvailable: 0, netTaxPayable: 0,
  };
  const noteRowMap: NoteRowMap = {
    ...writeNote31_PPE(addSheet('Note 3.1 - PPE', '16A34A'), notes.note31_ppe),
  };
  writeGenericNoteRecord(addSheet('Note 3.21b - Depn Summary', '16A34A'), '3.21  Depreciation Summary', Object.fromEntries(
    (notes.note321_depreciation?.byClass ?? []).map((item: { categoryName: string; depreciationForYear: number }) => [item.categoryName, { cy: item.depreciationForYear, py: 0 }]),
  ));
  Object.assign(noteRowMap, writeGenericNoteRecord(
    addSheet('Note 3.2 - Investments', '16A34A'),
    '3.2  Investments',
    buildInvestmentsNoteData(notes.note32_investments),
  ));
  noteRowMap.note32_investmentsRow = noteRowMap.cyTotalRow;
  const receivablesMap = writeNote33_Receivables(
    addSheet('Note 3.3 - Receivables', '16A34A'),
    notes.note33_tradeReceivables,
  );
  noteRowMap.note33_receivablesRow = receivablesMap.note33_receivablesRow ?? receivablesMap.cyTotalRow;
  SHEET_ROW_REGISTRY.receivablesNetRow = receivablesMap.cyTotalRow;
  const otherRecvMap = writeGenericNoteRecord(addSheet('Note 3.4 - Other Recv', '16A34A'), '3.4  Other Receivables', notes.note34_otherReceivables);
  noteRowMap.note34_otherRecvRow = otherRecvMap.cyTotalRow;
  const ncAssetsMap = writeGenericNoteRecord(addSheet('Note 3.5 - NC Assets', '16A34A'), '3.5  Other Non-Current Assets', notes.note35_otherNonCurrentAssets);
  noteRowMap.note35_ncAssetsRow = ncAssetsMap.cyTotalRow;
  const caOtherMap = writeGenericNoteRecord(addSheet('Note 3.6 - CA Other', '16A34A'), '3.6  Other Current Assets', notes.note36_otherCurrentAssets);
  noteRowMap.note36_caOtherRow = caOtherMap.cyTotalRow;
  Object.assign(noteRowMap, writeNote37_Inventories(addSheet('Note 3.7 - Inventories', '16A34A'), notes.note37_inventories));
  Object.assign(noteRowMap, writeNote38_Cash(addSheet('Note 3.8 - Cash', '16A34A'), notes.note38_cashAndEquivalents));
  Object.assign(noteRowMap, writeNote39_ShareCapital(addSheet('Note 3.9 - Share Capital', '16A34A'), notes.note39_shareCapital));
  writeGenericNoteRecord(addSheet('Note 3.10 - Reserves', '16A34A'), '3.10  Reserves', Object.fromEntries(
    Object.entries(notes.note310_reserves ?? {}).map(([k, v]) => {
      const entry = v as { closingCY?: number; closing?: number; py?: number; opening?: number };
      return [k, { cy: entry.closingCY ?? entry.closing ?? 0, py: entry.py ?? entry.opening ?? 0 }];
    }),
  ));
  Object.assign(noteRowMap, writeNote311_Borrowings(addSheet('Note 3.11 - Borrowings', '16A34A'), notes.note311_borrowings ?? { nonCurrentBank: [], currentLoans: [] }));
  writeGenericNoteRecord(addSheet('Note 3.12 - Emp Benefits', '16A34A'), '3.12  Employee Benefits', Object.fromEntries(
    Object.entries(notes.note312_employeeBenefits ?? {}).map(([k, v]) => {
      const entry = v as { closing?: number; opening?: number };
      return [k, { cy: entry.closing ?? 0, py: entry.opening ?? 0 }];
    }),
  ));
  writeGenericNoteRecord(addSheet('Note 3.13 - Payables', '16A34A'), '3.13  Trade and Other Payables', notes.note313_tradePayables);
  writeGenericNoteRecord(addSheet('Note 3.14 - Provisions', '16A34A'), '3.14  Provisions', buildProvisionsNoteData(adjustments));
  writeGenericNoteRecord(addSheet('Note 3.15 - TDS', '16A34A'), '3.15  TDS Payable', Object.fromEntries(
    (notes.note313_tradePayables?.tdsPayableBreakdown ?? []).map((item: { ledgerName: string; amount: number }) => [item.ledgerName, { cy: item.amount, py: 0 }]),
  ));
  writeGenericNoteRecord(addSheet('Note 3.16 - Dividend', '16A34A'), '3.16  Dividend Payable', {
    'Total Dividend Declared': { cy: notes.note316_dividendPayable?.totalDividendDeclared ?? 0, py: 0 },
    'TDS on Dividend': { cy: notes.note316_dividendPayable?.tdsOnDividend ?? 0, py: 0 },
    'Net Dividend Payable': { cy: notes.note316_dividendPayable?.netDividendPayable ?? 0, py: 0 },
  });
  const revenueMap = writeGenericNoteRecord(addSheet('Note 3.17 - Revenue', '16A34A'), '3.17  Revenue', notes.note317_revenue);
  noteRowMap.revenueTotalRow = revenueMap.cyTotalRow;
  SHEET_ROW_REGISTRY.revenueTotalRow = revenueMap.cyTotalRow;
  writeGenericNoteRecord(addSheet('Note 3.18 - Materials', '16A34A'), '3.18  Material Consumed', {
    'Opening Stock': { cy: notes.note318_materialConsumed?.openingInventory ?? 0, py: 0 },
    'Purchases': { cy: notes.note318_materialConsumed?.purchases ?? 0, py: 0 },
    'Less: Closing Stock': { cy: -(notes.note318_materialConsumed?.closingInventory ?? 0), py: 0 },
    'Material Consumed': { cy: notes.note318_materialConsumed?.consumed ?? 0, py: 0 },
  });
  writeGenericNoteRecord(addSheet('Note 3.19 - Direct Exp', '16A34A'), '3.19  Direct Expenses', notes.note319_directExpenses);
  writeGenericNoteRecord(addSheet('Note 3.19b - Other Income', '16A34A'), '3.19  Other Income (Detail)', {
    'Interest Income': notes.note319_otherIncome?.interestIncome ?? { cy: 0, py: 0 },
    'Commission Income': notes.note319_otherIncome?.commissionIncome ?? { cy: 0, py: 0 },
    'Rental Income': notes.note319_otherIncome?.rentalIncome ?? { cy: 0, py: 0 },
    'Dividend Received': notes.note319_otherIncome?.dividendReceived ?? { cy: 0, py: 0 },
    'Gain on Disposal of Assets': notes.note319_otherIncome?.gainOnDisposalAssets ?? { cy: 0, py: 0 },
    'Miscellaneous Income': notes.note319_otherIncome?.miscellaneousIncome ?? { cy: 0, py: 0 },
  });
  const empExpMap = writeGenericNoteRecord(addSheet('Note 3.20 - Emp Expense', '16A34A'), '3.20  Employee Benefit Expenses', notes.note320_employeeBenefitExpenses);
  noteRowMap.empExpenseTotalRow = empExpMap.cyTotalRow;
  SHEET_ROW_REGISTRY.empExpenseTotalRow = empExpMap.cyTotalRow;
  writeGenericNoteRecord(addSheet('Note 3.21 - Impairment', '16A34A'), '3.21  Impairment', Object.fromEntries(
    (notes.note321_impairment ?? []).map((item: { description: string; cy: number; py: number }) => [item.description, { cy: item.cy, py: item.py }]),
  ));
  const adminExpMap = writeGenericNoteRecord(addSheet('Note 3.22 - Admin Exp', '16A34A'), '3.22  Administrative Expenses', notes.note322_adminExpenses);
  noteRowMap.adminExpenseTotalRow = adminExpMap.cyTotalRow;
  SHEET_ROW_REGISTRY.adminExpenseTotalRow = adminExpMap.cyTotalRow;

  const fiscalYearLabel = company.fiscalYear?.bsFY ?? '';
  const taxDepPools = (
    (adjustments as YearEndAdjustments & { taxDepPool?: Array<Record<string, unknown>> }).taxDepPool?.length
      ? (adjustments as YearEndAdjustments & { taxDepPool?: Array<Record<string, unknown>> }).taxDepPool!
      : (adjustments.taxDepreciationPools ?? []) as Array<Record<string, unknown>>
  );
  const disallowItems = adjustments.disallowedForTax ?? [];
  const taxDepPoolCount = taxDepPools.length > 0 ? taxDepPools.length : 1;
  const disallowItemCount = disallowItems.length > 0 ? disallowItems.length : 5;
  const predictedTaxDepTotalRow = 4 + taxDepPoolCount;
  const predictedDisallowTotalRow = 4 + disallowItemCount;

  const repairExpense = (notes.note322_adminExpenses as { lineItems?: Array<{ label: string; cy: number }> } | undefined)
    ?.lineItems?.find((li) => /repair/i.test(li.label))?.cy ?? 0;

  const taxCalcMap = writeTaxCalculationSheet(
    addSheet('Tax Calculation', COLORS.LIGHT_GRAY),
    {
      companyName: company.companyName ?? '',
      address: company.address ?? '',
      incomeStatement,
      otherIncome: notes.note319_otherIncome as TaxCalculationSheetData['otherIncome'],
      repairExpense,
      taxRate: taxNoteData.taxRate ?? company.incomeTaxRate ?? 0.25,
      taxDepSheetName: 'Tax Depreciation',
      taxDepTotalRow: predictedTaxDepTotalRow,
    },
    fiscalYearLabel,
  );
  Object.assign(noteRowMap, taxCalcMap);
  Object.assign(noteRowMap, writeNote323_Tax(
    addSheet('Note 3.23 - Tax', '16A34A'),
    taxNoteData,
    'Tax Calculation',
    taxCalcMap.taxCalcNetPayableRow,
  ));
  writeGenericNoteRecord(addSheet('Note 3.24 - Related Party', '16A34A'), '3.24  Related Party Disclosures', Object.fromEntries(
    (notes.note324_relatedParty?.relatedParties ?? []).map((p: { partyName: string; outstandingBalance: number }) => [p.partyName, { cy: p.outstandingBalance, py: 0 }]),
  ));
  writeDisclosureTextNote(
    addSheet('Note 3.25 - Contingencies', '16A34A'),
    '3.25  Contingent Liabilities and Commitments',
    notes.note325_contingencies?.defaultText
      ?? 'The Company has no contingent liabilities or commitments as at the reporting date.',
  );
  writeDisclosureTextNote(
    addSheet('Note 3.26 - Subsequent Events', '16A34A'),
    '3.26  Events After Reporting Date',
    notes.note326_subsequentEvents?.defaultText
      ?? 'There are no significant events after the reporting date that require adjustment to or disclosure in these financial statements.',
  );
  writeAdjustments(addSheet('Adjustments', COLORS.LIGHT_GRAY), adjustments);
  const listedSharesData = (
    (adjustments as YearEndAdjustments & { listedShares?: Array<Record<string, unknown>> }).listedShares
    ?? (adjustments.investmentAdjustments ?? [])
      .filter((inv) => {
        const t = (inv as { investmentType?: string; type?: string }).investmentType
          ?? (inv as { type?: string }).type ?? '';
        return t === 'listed_trading' || t === 'listed_ats' || t === 'listed';
      })
      .map((inv) => {
        const i = inv as Record<string, unknown>;
        return {
          companyName: i.investmentName ?? i.name,
          openingUnits: i.units,
          purchasedUnits: 0,
          soldUnits: 0,
          closingUnits: i.units,
          openingLtp: i.costPerUnit,
          closingLtp: i.ltp ?? i.fairValuePerUnit,
          openingFV: i.totalCost,
          closingFV: i.carryingAmount ?? i.marketValue ?? i.totalFairValue,
          fvGainLoss: i.fairValueGainLoss ?? i.gainLossOnFV,
        };
      })
  );
  writePPEWorkingsSheet(
    addSheet('PPE Workings', '16A34A'),
    adjustments.assets ?? [],
    fiscalYearLabel,
    adjustments.depreciationResults ?? [],
  );
  const taxDepMap = writeTaxDepreciationSheet(addSheet('Tax Depreciation', '16A34A'), taxDepPools, fiscalYearLabel);
  const disallowMap = writeDisallowForTaxSheet(addSheet('Disallow for Tax', '16A34A'), disallowItems);
  writeTaxProfitReconciliationSheet(addSheet('Tax Profit Reconciliation', COLORS.LIGHT_GRAY), {
    fiscalYear: fiscalYearLabel,
    profitBeforeTax: incomeStatement.profitBeforeTax ?? 0,
    bookDepreciation: incomeStatement.depreciation ?? 0,
    dividendExempt: Number((notes.note319_otherIncome as { dividendReceived?: { cy: number } } | undefined)?.dividendReceived?.cy ?? 0),
    disallowSheetName: 'Disallow for Tax',
    disallowTotalRow: disallowMap.totalDisallowedRow,
    taxDepSheetName: 'Tax Depreciation',
    taxDepTotalRow: taxDepMap.totalTaxDepRow,
    taxCalcSheetName: 'Tax Calculation',
    taxCalcAssessableRow: taxCalcMap.assessableIncomeRow ?? 0,
  });
  writeFairValueChangeSheet(
    addSheet('Fair Value Change', '16A34A'),
    listedSharesData,
    { trialBalanceFvAdjustment: adjustments.totalInvestmentFVAdjustment ?? 0 },
  );
  writeSundryDebtors(addSheet('Sundry Debtors', '16A34A'), { adjustments, trialBalance });
  writeSundryCreditors(addSheet('Sundry Creditors', '16A34A'), { adjustments, trialBalance });
  writeBankAccounts(addSheet('Bank Accounts', '16A34A'), notes.note38_cashAndEquivalents);

  
  const noteSheetNames = {
    ppe: 'Note 3.1 - PPE',
    investments: 'Note 3.2 - Investments',
    receivables: 'Note 3.3 - Receivables',
    otherReceivables: 'Note 3.4 - Other Recv',
    ncAssets: 'Note 3.5 - NC Assets',
    caOther: 'Note 3.6 - CA Other',
    inventories: 'Note 3.7 - Inventories',
    cash: 'Note 3.8 - Cash',
    shareCapital: 'Note 3.9 - Share Capital',
    borrowings: 'Note 3.11 - Borrowings',
    tax: 'Note 3.23 - Tax',
    taxCalculation: 'Tax Calculation',
  };
  applyBalanceSheetCrossReferences(wb, 'Balance Sheet', noteSheetNames, bsRowMap, noteRowMap);
  applyIncomeStatementCrossReferences(wb, 'Income Statement', {
    revenue: 'Note 3.17 - Revenue',
    empExpense: 'Note 3.20 - Emp Expense',
    adminExpense: 'Note 3.22 - Admin Exp',
    ppe: 'Note 3.1 - PPE',
    tax: 'Note 3.23 - Tax',
    taxCalculation: 'Tax Calculation',
  }, isRowMap, noteRowMap);
  applyCashFlowCrossReferences(wb, 'Cash Flow', 'Income Statement', cfRowMap, isRowMap);
  applyCashFlowReconciliation(wb, 'Cash Flow', 'Balance Sheet', cfRowMap);
  applyChangesInEquityCrossReferences(wb, 'Change in Equity', 'Income Statement', ceRowMap, isRowMap);
  applyWorkingsValidationRefs(wb, {
    balanceSheet: bsRowMap,
    incomeStatement: isRowMap,
    cashFlow: cfRowMap,
    changesInEquity: ceRowMap,
    notes: noteRowMap,
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

interface SheetRowRegistry extends NoteRowMap {
  receivablesNetRow?: number;
}

// This registry is populated by the note writer functions and consumed by
// the main sheet writers to insert cross-reference formulas.
const SHEET_ROW_REGISTRY: SheetRowRegistry = {};

function appendNoteRef(parts: string[], sheet: string | undefined, row: number | undefined, col = 'B'): void {
  if (sheet && row) parts.push(cellRef(sheet, col, row).replace(/^=/, ''));
}

// ── Apply cross-references to Balance Sheet ───────────────────────────────────
function applyBalanceSheetCrossReferences(
  wb: import('exceljs').Workbook,
  balanceSheetSheetName: string,
  noteSheetNames: {
    ppe?: string;
    investments?: string;
    receivables?: string;
    otherReceivables?: string;
    ncAssets?: string;
    caOther?: string;
    inventories?: string;
    cash?: string;
    shareCapital?: string;
    borrowings?: string;
    tax?: string;
    taxCalculation?: string;
  },
  rowMap: BalanceSheetRowMap,
  noteRows: NoteRowMap,
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(balanceSheetSheetName);
  if (!ws) {
    console.warn(`[excelWriter] Balance sheet not found: ${balanceSheetSheetName}`);
    return;
  }

  const setFormula = (rowNum: number, col: string, formula: string) => {
    if (!rowNum) return;
    const cell = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ''), result: 0 };
    cell.numFmt = existingNumFmt || NUMBER_FORMAT;
    cell.font = { name: 'Arial', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  };

  if (noteSheetNames.ppe && noteRows.ppeNetBookValueRow) {
    setFormula(rowMap.ppeRow, cyCol, cellRef(noteSheetNames.ppe, 'H', noteRows.ppeNetBookValueRow));
  }
  if (noteSheetNames.investments && noteRows.note32_investmentsRow) {
    setFormula(rowMap.ncaInvestmentsRow, cyCol, cellRef(noteSheetNames.investments, 'B', noteRows.note32_investmentsRow));
    setFormula(rowMap.caInvestmentsRow, cyCol, cellRef(noteSheetNames.investments, 'B', noteRows.note32_investmentsRow));
  }
  if (noteSheetNames.receivables && noteRows.note33_receivablesRow) {
    setFormula(rowMap.receivablesRow, cyCol, cellRef(noteSheetNames.receivables, 'B', noteRows.note33_receivablesRow));
  }
  if (noteSheetNames.otherReceivables && noteRows.note34_otherRecvRow) {
    setFormula(rowMap.ncaReceivablesRow, cyCol, cellRef(noteSheetNames.otherReceivables, 'B', noteRows.note34_otherRecvRow));
  }
  if (noteSheetNames.ncAssets && noteRows.note35_ncAssetsRow) {
    setFormula(rowMap.ncaOtherRow, cyCol, cellRef(noteSheetNames.ncAssets, 'B', noteRows.note35_ncAssetsRow));
  }
  if (noteSheetNames.caOther && noteRows.note36_caOtherRow) {
    setFormula(rowMap.caOtherRow, cyCol, cellRef(noteSheetNames.caOther, 'B', noteRows.note36_caOtherRow));
  }
  if (noteSheetNames.inventories && noteRows.inventoryTotalRow) {
    setFormula(rowMap.inventoriesRow, cyCol, cellRef(noteSheetNames.inventories, 'B', noteRows.inventoryTotalRow));
  }
  if (noteSheetNames.cash && noteRows.cashTotalRow) {
    setFormula(rowMap.cashRow, cyCol, cellRef(noteSheetNames.cash, 'B', noteRows.cashTotalRow));
  }
  if (noteSheetNames.shareCapital && noteRows.shareCapitalRow) {
    setFormula(rowMap.shareCapitalRow, cyCol, cellRef(noteSheetNames.shareCapital, 'B', noteRows.shareCapitalRow));
  }
  if (noteSheetNames.borrowings && noteRows.ncBorrowingsRow) {
    setFormula(rowMap.ncBorrowingsRow, cyCol, cellRef(noteSheetNames.borrowings, 'D', noteRows.ncBorrowingsRow));
  }
  if (noteSheetNames.borrowings && noteRows.cBorrowingsRow) {
    setFormula(rowMap.cBorrowingsRow, cyCol, cellRef(noteSheetNames.borrowings, 'D', noteRows.cBorrowingsRow));
  }
  if (noteSheetNames.taxCalculation && noteRows.taxCalcNetPayableRow) {
    setFormula(rowMap.taxPayableRow, cyCol, cellRef(noteSheetNames.taxCalculation, 'B', noteRows.taxCalcNetPayableRow));
  } else if (noteSheetNames.tax && noteRows.taxPayableRow) {
    setFormula(rowMap.taxPayableRow, cyCol, cellRef(noteSheetNames.tax, 'B', noteRows.taxPayableRow));
  }

  const assetParts: string[] = [];
  appendNoteRef(assetParts, noteSheetNames.ppe, noteRows.ppeNetBookValueRow, 'H');
  appendNoteRef(assetParts, noteSheetNames.investments, noteRows.note32_investmentsRow);
  appendNoteRef(assetParts, noteSheetNames.otherReceivables, noteRows.note34_otherRecvRow);
  appendNoteRef(assetParts, noteSheetNames.ncAssets, noteRows.note35_ncAssetsRow);
  appendNoteRef(assetParts, noteSheetNames.inventories, noteRows.inventoryTotalRow);
  appendNoteRef(assetParts, noteSheetNames.receivables, noteRows.note33_receivablesRow);
  appendNoteRef(assetParts, noteSheetNames.cash, noteRows.cashTotalRow);
  appendNoteRef(assetParts, noteSheetNames.caOther, noteRows.note36_caOtherRow);

  const totalAssetsCell = ws.getRow(rowMap.totalAssetsRow).getCell(cyCol);
  if (assetParts.length > 0) {
    totalAssetsCell.value = { formula: assetParts.join('+'), result: 0 };
  } else if (rowMap.totalNcaRow && rowMap.totalCaRow) {
    totalAssetsCell.value = { formula: `${cyCol}${rowMap.totalNcaRow}+${cyCol}${rowMap.totalCaRow}`, result: 0 };
  }
  totalAssetsCell.numFmt = NUMBER_FORMAT;
  applyTotalStyle(totalAssetsCell);

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
    taxCalculation?: string;
  },
  rowMap: IncomeStatementRowMap,
  noteRows: NoteRowMap,
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(isSheetName);
  if (!ws) return;

  const setFormula = (rowNum: number, col: string, formula: string) => {
    if (!rowNum) return;
    const cell = ws.getRow(rowNum).getCell(col);
    const existingNumFmt = cell.numFmt;
    cell.value = { formula: formula.replace(/^=/, ''), result: 0 };
    cell.numFmt = existingNumFmt || NUMBER_FORMAT;
    cell.font = { name: 'Arial', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  };

  if (noteSheetNames.revenue && noteRows.revenueTotalRow) {
    setFormula(rowMap.revenueRow, cyCol, cellRef(noteSheetNames.revenue, 'B', noteRows.revenueTotalRow));
  }
  if (noteSheetNames.empExpense && noteRows.empExpenseTotalRow) {
    setFormula(rowMap.empExpenseRow, cyCol, cellRef(noteSheetNames.empExpense, 'B', noteRows.empExpenseTotalRow));
  }
  if (noteSheetNames.adminExpense && noteRows.adminExpenseTotalRow) {
    setFormula(rowMap.adminExpenseRow, cyCol, cellRef(noteSheetNames.adminExpense, 'B', noteRows.adminExpenseTotalRow));
  }
  if (noteSheetNames.ppe && noteRows.ppeDepreciationRow) {
    setFormula(rowMap.depreciationRow, cyCol, cellRef(noteSheetNames.ppe, 'E', noteRows.ppeDepreciationRow));
  }
  if (noteSheetNames.taxCalculation && noteRows.taxCalcIncomeTaxRow) {
    setFormula(rowMap.taxRow, cyCol, cellRef(noteSheetNames.taxCalculation, 'D', noteRows.taxCalcIncomeTaxRow));
  } else if (noteSheetNames.tax && noteRows.taxPayableRow) {
    setFormula(rowMap.taxRow, cyCol, cellRef(noteSheetNames.tax, 'B', noteRows.taxPayableRow));
  }

  console.log('[excelWriter] Income statement cross-references applied.');
}

// ── Apply Cash Flow reconciliation formula ────────────────────────────────────
function applyCashFlowCrossReferences(
  wb: import('exceljs').Workbook,
  cfSheetName: string,
  isSheetName: string,
  cfMap: CashFlowRowMap,
  isMap: IncomeStatementRowMap,
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(cfSheetName);
  if (!ws || !cfMap.profitBeforeTaxRow || !isMap.profitBeforeTaxRow) return;

  const cell = ws.getRow(cfMap.profitBeforeTaxRow).getCell(cyCol);
  cell.value = {
    formula: cellRef(isSheetName, cyCol, isMap.profitBeforeTaxRow).replace(/^=/, ''),
    result: cell.value as number ?? 0,
  };
  cell.numFmt = NUMBER_FORMAT;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
}

function applyChangesInEquityCrossReferences(
  wb: import('exceljs').Workbook,
  ceSheetName: string,
  isSheetName: string,
  ceMap: ChangesInEquityRowMap,
  isMap: IncomeStatementRowMap,
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(ceSheetName);
  if (!ws || !ceMap.profitForYearRow || !isMap.netProfitRow) return;

  const isRef = cellRef(isSheetName, cyCol, isMap.netProfitRow).replace(/^=/, '');
  for (const col of ['E', 'F'] as const) {
    const cell = ws.getRow(ceMap.profitForYearRow).getCell(col);
    cell.value = { formula: isRef, result: cell.value as number ?? 0 };
    cell.numFmt = NUMBER_FORMAT;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  }
}

function applyCashFlowReconciliation(
  wb: import('exceljs').Workbook,
  cfSheetName: string,
  _bsSheetName: string,
  rowMap: CashFlowRowMap,
  cyCol = 'C',
): void {
  const ws = wb.getWorksheet(cfSheetName);
  if (!ws) return;

  const closingFormula =
    `${cyCol}${rowMap.openingCashRow}` +
    `+${cyCol}${rowMap.netOperatingRow}` +
    `+${cyCol}${rowMap.netInvestingRow}` +
    `+${cyCol}${rowMap.netFinancingRow}`;

  const cell = ws.getRow(rowMap.closingCashRow).getCell(cyCol);
  cell.value = { formula: closingFormula, result: 0 };
  cell.numFmt = NUMBER_FORMAT;
  applyTotalStyle(cell);
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.TOTAL_BG}` } };

  console.log('[excelWriter] Cash flow reconciliation formula applied.');
}

function applyWorkingsValidationRefs(wb: import('exceljs').Workbook, maps: WorkbookRowMaps): void {
  const ws = wb.getWorksheet('Workings');
  if (!ws) return;
  const { balanceSheet: bs, incomeStatement: is, cashFlow: cf, changesInEquity: ce } = maps;
  const valStart = 56;
  const checks = [
    {
      formula: `'Balance Sheet'!C${bs.totalAssetsRow}-'Balance Sheet'!C${bs.totalLiabilitiesEquityRow}`,
    },
    {
      formula: `'Cash Flow'!C${cf.closingCashRow}-'Balance Sheet'!C${bs.cashRow}`,
    },
    {
      formula: `'Income Statement'!C${is.netProfitRow}-'Change in Equity'!F${ce.profitForYearRow}`,
    },
  ];
  checks.forEach((check, idx) => {
    const resultCell = ws.getRow(valStart + idx).getCell(3);
    resultCell.value = { formula: check.formula, result: 0 };
    resultCell.numFmt = NUMBER_FORMAT;
    applyBodyStyle(resultCell);
  });
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
    `These financial statements of ${params.companyName} have been prepared in accordance with Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by the Institute of Chartered Accountants of Nepal (ICAN).`,
    false, false, 1
  );
  addRow('');

  addRow('2. BASIS OF PREPARATION', true);
  addRow(
    `These financial statements are prepared on the historical cost basis except for certain financial instruments measured at fair values as described in the accounting policies. The financial statements are presented in Nepalese Rupees (NPR) rounded to the nearest NPR ${params.roundingLevel.toLocaleString('en-IN')}.`,
    false, false, 1
  );
  addRow('');

  addRow('3. AUTHORIZATION FOR ISSUE', true);
  addRow(
    `These financial statements for the fiscal year ${params.fiscalYear} were authorized for issue by the Board of Directors of ${params.companyName} on ${params.authorizationDate ?? '[Board Meeting Date]'}.`,
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
