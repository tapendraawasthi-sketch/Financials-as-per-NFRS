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
export {
  cellRef,
  sumRange,
  sumCrossSheet,
  SHEET_ROW_REGISTRY,
  applyBalanceSheetCrossReferences,
  applyIncomeStatementCrossReferences,
  applyCashFlowReconciliation,
};
