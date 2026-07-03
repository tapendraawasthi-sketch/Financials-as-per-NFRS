import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseMatrix, parseDualYearMatrix } from '../../server/services/tbParser.ts';
import { SAMPLE_TRIAL_BALANCE_CSV } from '../../src/data/sampleData.ts';

describe('tbParser', () => {
  it('parses the sample 6-column CSV with full format detection', () => {
    const result = parseCsv(Buffer.from(SAMPLE_TRIAL_BALANCE_CSV, 'utf-8'));
    assert.ok(result.rows.length > 0);
    assert.equal(result.detectedFormat, 'full');
    assert.ok(result.totalClosingDr > 0);
    assert.ok(result.totalClosingCr > 0);
    const leafRows = result.rows.filter((r) => !r.isGroupRow);
    assert.ok(leafRows.length >= 80, `Expected many leaf accounts, got ${leafRows.length}`);
    assert.deepEqual(result.detectedColumns, {
      label: 0,
      openingDr: 1,
      openingCr: 2,
      duringDr: 3,
      duringCr: 4,
      closingDr: 5,
      closingCr: 6,
    });
  });

  it('treats Account | Dr | Cr headers as closing columns (not movement)', () => {
    const csv = [
      'Account Name,Dr,Cr',
      'Cash,50000,0',
      'Sales,0,120000',
      'Purchases,80000,0',
      'Capital,0,10000',
    ].join('\n');
    const result = parseCsv(Buffer.from(csv, 'utf-8'));
    const cash = result.rows.find((r) => r.rawLabel === 'Cash' && !r.isGroupRow);
    const sales = result.rows.find((r) => r.rawLabel === 'Sales' && !r.isGroupRow);
    assert.ok(cash);
    assert.ok(sales);
    assert.equal(cash!.closingDr, 50000);
    assert.equal(sales!.closingCr, 120000);
    assert.equal(result.detectedFormat, 'full');
  });

  it('parses Tally Prime closing Dr/Cr columns directly', () => {
    const matrix = [
      ['Particulars', 'Opening Dr', 'Opening Cr', 'Debit', 'Credit', 'Closing Dr', 'Closing Cr'],
      ['Cash Account', 0, 0, 1000, 0, 5000, 0],
      ['Sales Account', 0, 0, 0, 2000, 0, 8000],
    ];
    const result = parseMatrix(matrix);
    assert.equal(result.detectedFormat, 'tally_prime');
    const cash = result.rows.find((r) => r.rawLabel === 'Cash Account');
    const sales = result.rows.find((r) => r.rawLabel === 'Sales Account');
    assert.equal(cash?.closingDr, 5000);
    assert.equal(cash?.closingCr, 0);
    assert.equal(sales?.closingDr, 0);
    assert.equal(sales?.closingCr, 8000);
  });

  it('detects side-by-side Current Year and Previous Year blocks', () => {
    const matrix = [
      ['Particulars', 'Current Year', '', '', '', '', '', '', '', '', 'Previous Year', '', '', '', '', '', '', '', ''],
      ['Particulars', 'Opening Dr.', 'Opening Cr.', 'During Dr.', 'During Cr.', 'Adjustment Dr.', 'Adjustment Cr.', 'Closing Dr.', 'Closing Cr.', '', 'Opening Dr.', 'Opening Cr.', 'During Dr.', 'During Cr.', 'Adjustment Dr.', 'Adjustment Cr.', 'Closing Dr.', 'Closing Cr.'],
      ['Paid-up Capital', 0, 50000000, 0, 1000000, 0, 0, 0, 51000000, '', 0, 50000000, 0, 0, 0, 0, 0, 50000000],
      ['Cash', 0, 0, 50000, 20000, 0, 0, 30000, 0, '', 0, 0, 0, 0, 0, 0, 210000, 0],
    ];
    const dual = parseDualYearMatrix(matrix);
    assert.ok(dual, 'Expected dual-year layout to be detected');
    const cyCapital = dual!.currentYear.rows.find((r) => r.rawLabel === 'Paid-up Capital');
    const pyCapital = dual!.previousYear.find((r) => r.rawLabel === 'Paid-up Capital');
    assert.equal(cyCapital?.closingCr, 51000000);
    assert.equal(pyCapital?.closingCr, 50000000);
  });
});
