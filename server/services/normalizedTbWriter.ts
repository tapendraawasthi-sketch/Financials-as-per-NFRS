// Export a normalized trial balance (standard 6-column Dr/Cr layout) to Excel.
import ExcelJS from 'exceljs';
import type { RawTBRow } from '../../src/types/trialBalance.js';

const HEADERS = [
  'Account Name',
  'Opening Dr', 'Opening Cr',
  'During Dr', 'During Cr',
  'Adjustment Dr', 'Adjustment Cr',
  'Closing Dr', 'Closing Cr',
  'Parent Group',
];

export async function writeNormalizedTrialBalance(
  rows: RawTBRow[],
  meta?: { companyName?: string; fiscalYear?: string; filename?: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Trial Balance');

  if (meta?.companyName) {
    ws.addRow([meta.companyName]);
    ws.getRow(1).font = { bold: true, size: 14 };
  }
  if (meta?.fiscalYear) {
    ws.addRow([`Fiscal Year: ${meta.fiscalYear}`]);
  }
  ws.addRow([]);

  const headerRow = ws.addRow(HEADERS);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFDA' },
  };

  for (const row of rows) {
    const indent = '  '.repeat(Math.min(4, Math.floor(row.rawIndentSpaces / 2)));
    const label = row.isGroupRow ? row.rawLabel.toUpperCase() : `${indent}${row.rawLabel}`;
    const dataRow = ws.addRow([
      label,
      row.isGroupRow ? '' : row.openingDr || '',
      row.isGroupRow ? '' : row.openingCr || '',
      row.isGroupRow ? '' : row.duringDr || '',
      row.isGroupRow ? '' : row.duringCr || '',
      row.isGroupRow ? '' : row.adjustmentDr || '',
      row.isGroupRow ? '' : row.adjustmentCr || '',
      row.isGroupRow ? '' : row.closingDr || '',
      row.isGroupRow ? '' : row.closingCr || '',
      row.parentGroup || '',
    ]);
    if (row.isGroupRow) {
      dataRow.font = { bold: true };
    }
  }

  ws.columns = [
    { width: 40 },
    { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 },
    { width: 24 },
  ];

  for (let c = 2; c <= 9; c++) {
    ws.getColumn(c).numFmt = '#,##0.00';
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
