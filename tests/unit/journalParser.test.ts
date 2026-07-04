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
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  type?: string;
}>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Adjustment Journal');

  const headers = ['#', 'Description', 'Dr Account', 'Cr Account', 'Amount (NPR)', 'Type'];
  headers.forEach((h, i) => {
    ws.getRow(JOURNAL_HEADER_ROW).getCell(i + 1).value = h;
  });

  rows.forEach((row, idx) => {
    const r = ws.getRow(JOURNAL_DATA_START_ROW + idx);
    r.getCell(JOURNAL_COL.rowNum).value = idx + 1;
    r.getCell(JOURNAL_COL.description).value = row.description;
    r.getCell(JOURNAL_COL.debitAccount).value = row.debitAccount;
    r.getCell(JOURNAL_COL.creditAccount).value = row.creditAccount;
    r.getCell(JOURNAL_COL.amount).value = row.amount;
    if (row.type) r.getCell(JOURNAL_COL.type).value = row.type;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe('journalParser', () => {
  it('parses standard template rows', async () => {
    const buffer = await buildTestWorkbook([
      {
        description: 'Audit fee accrual',
        debitAccount: 'Audit Fee Expense',
        creditAccount: 'Audit Fee Payable',
        amount: 25000,
        type: 'OTHER',
      },
      {
        description: 'Depreciation for the year',
        debitAccount: 'Depreciation Expense',
        creditAccount: 'Accumulated Depreciation',
        amount: 100000,
        type: 'DEPN',
      },
    ]);

    const result = await parseJournalEntries(buffer);
    assert.equal(result.entries.length, 2);
    assert.equal(result.totalDebit, 125000);
    assert.equal(validateJournalEntries(result), null);
  });

  it('skips example and empty rows', async () => {
    const buffer = await buildTestWorkbook([
      {
        description: 'e.g. Audit fee accrual for the year',
        debitAccount: 'Audit Fee Expense',
        creditAccount: 'Audit Fee Payable',
        amount: 50000,
      },
    ]);

    const result = await parseJournalEntries(buffer);
    assert.equal(result.entries.length, 0);
    assert.equal(validateJournalEntries(result)?.code, 'NO_ENTRIES');
  });
});
