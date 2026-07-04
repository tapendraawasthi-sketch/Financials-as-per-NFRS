/**
 * Structural contract for MEs Financials Format workbook output.
 * Used by parity tests; optional comparison when MES_REFERENCE_XLSX_PATH is set.
 */

import type ExcelJS from 'exceljs';

export const MES_CONSOLIDATED_NOTES_SHEET = 'Notes 3.2 to 3.23';

/** Expected tab order from generateNFRSWorkbook (MEs Financials Format.xlsx convention). */
export const MES_WORKBOOK_SHEET_ORDER: readonly string[] = [
  'Workings',
  'Instructions',
  'Enter Details',
  'Trial Balance',
  'Balance Sheet',
  'Income Statement',
  'Change in Equity',
  'Cash Flow',
  'Note 1 - Policies',
  'Note 2 - Judgments',
  'Note 3.1 - PPE',
  'Tax Calculation',
  MES_CONSOLIDATED_NOTES_SHEET,
  'Note 3.24 - Related Party',
  'Note 3.25 - Contingencies',
  'Note 3.26 - Subsequent Events',
  'Adjustments',
  'PPE Workings',
  'Tax Depreciation',
  'Disallow for Tax',
  'Tax Notes',
  'Tax Profit Reconciliation',
  'Fair Value Change',
  'Sundry Debtors',
  'Sundry Creditors',
  'Bank Accounts',
] as const;

/** Key instruction rows that must appear on the Instructions sheet. */
export const MES_INSTRUCTION_KEY_TERMS: readonly string[] = [
  'Enter Details',
  'Trial Balance',
  'Notes 3.2–3.23',
  'Tax Calculation',
  'Disallow for Tax',
  'Fair Value Change',
  'Tax Profit Reconciliation',
];

export const MES_ENTER_DETAILS_TITLE = 'ENTER DETAILS — NAS FOR MEs';

export const MES_TB_ADJUSTED_BALANCE_HEADER = 'Adjusted Balance';

export const MES_DISALLOW_ROUTE_HEADERS = ['Route (I/II)'];

export const MES_TAX_NOTES_SECTIONS = [
  'Note I — Income-side adjustments',
  'Note II — Expense-side disallowances',
];

export interface MesWorkbookValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  sheetNames: string[];
}

export function getWorkbookSheetNames(wb: ExcelJS.Workbook): string[] {
  return wb.worksheets.map((ws) => ws.name);
}

export function validateMesWorkbookStructure(wb: ExcelJS.Workbook): MesWorkbookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sheetNames = getWorkbookSheetNames(wb);

  if (sheetNames.length !== MES_WORKBOOK_SHEET_ORDER.length) {
    errors.push(
      `Expected ${MES_WORKBOOK_SHEET_ORDER.length} sheets, got ${sheetNames.length}`,
    );
  }

  MES_WORKBOOK_SHEET_ORDER.forEach((expected, i) => {
    const actual = sheetNames[i];
    if (actual !== expected) {
      errors.push(`Sheet index ${i}: expected "${expected}", got "${actual ?? '(missing)'}"`);
    }
  });

  for (const name of sheetNames) {
    if (!MES_WORKBOOK_SHEET_ORDER.includes(name)) {
      warnings.push(`Unexpected sheet tab: "${name}"`);
    }
  }

  const instructions = wb.getWorksheet('Instructions');
  if (instructions) {
    const colA = new Set<string>();
    for (let r = 1; r <= instructions.rowCount; r++) {
      const v = instructions.getRow(r).getCell(1).value;
      if (typeof v === 'string') colA.add(v.trim());
    }
    for (const term of MES_INSTRUCTION_KEY_TERMS) {
      const found = [...colA].some((cell) => cell.includes(term) || term.includes(cell));
      if (!found) {
        errors.push(`Instructions sheet missing key term: "${term}"`);
      }
    }
  } else {
    errors.push('Instructions sheet not found');
  }

  const enterDetails = wb.getWorksheet('Enter Details');
  if (enterDetails) {
    const title = enterDetails.getCell(1, 2).value;
    if (String(title ?? '') !== MES_ENTER_DETAILS_TITLE) {
      errors.push(`Enter Details title mismatch: "${title}"`);
    }
  }

  const tb = wb.getWorksheet('Trial Balance');
  if (tb) {
    let hasAdjusted = false;
    for (let r = 1; r <= Math.min(tb.rowCount, 20); r++) {
      for (let c = 1; c <= tb.columnCount; c++) {
        if (tb.getRow(r).getCell(c).value === MES_TB_ADJUSTED_BALANCE_HEADER) {
          hasAdjusted = true;
          break;
        }
      }
    }
    if (!hasAdjusted) {
      errors.push('Trial Balance missing "Adjusted Balance" column header');
    }
  }

  const consolidated = wb.getWorksheet(MES_CONSOLIDATED_NOTES_SHEET);
  if (!consolidated) {
    errors.push(`Missing consolidated notes sheet "${MES_CONSOLIDATED_NOTES_SHEET}"`);
  }

  const disallow = wb.getWorksheet('Disallow for Tax');
  if (disallow) {
    const hRow = disallow.getRow(3);
    const headers: string[] = [];
    for (let c = 1; c <= 8; c++) {
      const v = hRow.getCell(c).value;
      if (v) headers.push(String(v));
    }
    if (!headers.some((h) => h.includes('Route'))) {
      errors.push('Disallow for Tax missing Route (I/II) column');
    }
  }

  const taxNotes = wb.getWorksheet('Tax Notes');
  if (taxNotes) {
    const text = taxNotes.getSheetValues().flat().filter(Boolean).map(String).join(' ');
    for (const section of MES_TAX_NOTES_SECTIONS) {
      if (!text.includes(section.split('—')[0].trim())) {
        errors.push(`Tax Notes sheet missing section: "${section}"`);
      }
    }
  }

  const taxCalc = wb.getWorksheet('Tax Calculation');
  if (taxCalc) {
    const text = taxCalc.getSheetValues().flat().filter(Boolean).map(String).join(' ');
    if (!text.includes('Days Late')) {
      errors.push('Tax Calculation missing Section 118 Days Late column');
    }
    if (!text.includes('Advance Tax Installment Schedule')) {
      errors.push('Tax Calculation missing advance tax installment schedule');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sheetNames,
  };
}

/** Compare sheet order against a reference workbook when the file is available. */
export function compareSheetOrderToReference(
  generated: string[],
  reference: string[],
): string[] {
  const errors: string[] = [];
  const refCore = reference.filter((n) => !n.startsWith('Sheet'));
  const genSet = new Set(generated);

  for (const name of refCore) {
    if (!genSet.has(name) && !name.includes('Chart')) {
      errors.push(`Reference sheet "${name}" not present in generated workbook`);
    }
  }

  const shared = MES_WORKBOOK_SHEET_ORDER.filter((n) => refCore.includes(n));
  for (let i = 0; i < shared.length; i++) {
    const genIdx = generated.indexOf(shared[i]);
    const refIdx = refCore.indexOf(shared[i]);
    if (genIdx >= 0 && refIdx >= 0 && genIdx !== refIdx) {
      errors.push(
        `Sheet "${shared[i]}" order differs: generated index ${genIdx}, reference index ${refIdx}`,
      );
    }
  }

  return errors;
}

export function mesReferenceXlsxPath(): string | undefined {
  return process.env.MES_REFERENCE_XLSX_PATH?.trim() || undefined;
}
