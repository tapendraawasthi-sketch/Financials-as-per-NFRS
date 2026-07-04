// tests/unit/journalParser.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { parseJournalEntries, validateJournalEntries } from '../../server/services/journalParser.js';
import {
  JOURNAL_COL,
  JOURNAL_DATA_START_ROW,
  JOURNAL_HEADER_ROW,
} from '../../server/services/journalStandardSchema.js';

async function buildTestWorkbook(rows: Array<{
  sNo?: number | null;
  drCr: 'Dr' | 'Cr';
  particulars: string;
  drAmount?: number | null;
  crAmount?: number | null;
}>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Adjustment Journal');

  const headers = ['S.No.', 'Dr/Cr', 'Particulars', 'Dr. Amount', 'Cr. Amount', 'Linked to'];
  headers.forEach((h, i) => {
    ws.getRow(JOURNAL_HEADER_ROW).getCell(i + 1).value = h;
  });

  rows.forEach((row, idx) => {
    const r = ws.getRow(JOURNAL_DATA_START_ROW + idx);
    if (row.sNo != null) r.getCell(JOURNAL_COL.sNo).value = row.sNo;
    r.getCell(JOURNAL_COL.drCr).value = row.drCr;
    r.getCell(JOURNAL_COL.particulars).value = row.particulars;
    if (row.drAmount != null) r.getCell(JOURNAL_COL.drAmount).value = row.drAmount;
    if (row.crAmount != null) r.getCell(JOURNAL_COL.crAmount).value = row.crAmount;
    r.getCell(JOURNAL_COL.linkedTo).value = 'Trial';
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe('journalParser', () => {
  it('parses grouped multi-line journal entries', async () => {
    const buffer = await buildTestWorkbook([
      { sNo: 1, drCr: 'Dr', particulars: 'Audit Fee Expense', drAmount: 25000 },
      { drCr: 'Cr', particulars: 'Audit Fee Payable', crAmount: 25000 },
      { sNo: 2, drCr: 'Dr', particulars: 'Depreciation', drAmount: 100000 },
      { drCr: 'Cr', particulars: 'Accumulated Depreciation', crAmount: 100000 },
    ]);

    const result = await parseJournalEntries(buffer);
    assert.equal(result.groups.length, 2);
    assert.equal(result.totalDebit, 125000);
    assert.equal(validateJournalEntries(result), null);
  });

  it('returns no entries when only example rows present', async () => {
    const buffer = await buildTestWorkbook([]);

    const result = await parseJournalEntries(buffer);
    assert.equal(result.groups.length, 0);
    assert.equal(validateJournalEntries(result)?.code, 'NO_ENTRIES');
  });

  it('skips unbalanced groups with warning', async () => {
    const buffer = await buildTestWorkbook([
      { sNo: 1, drCr: 'Dr', particulars: 'Expense A', drAmount: 50000 },
      { drCr: 'Cr', particulars: 'Payable A', crAmount: 40000 },
    ]);

    const result = await parseJournalEntries(buffer);
    assert.equal(result.groups.length, 0);
    assert.ok(result.warnings.some((w) => w.includes('skipped')));
  });
});
