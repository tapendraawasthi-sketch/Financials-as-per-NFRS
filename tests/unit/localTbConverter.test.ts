import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertTrialBalanceLocally, heuristicFallbackClassify } from '../../server/services/localTbConverter.js';
import { classifyAll } from '../../server/services/accountMatcher.js';
import { parseMatrix } from '../../server/services/tbParser.js';
import { SAMPLE_TRIAL_BALANCE_CSV } from '../../src/data/sampleData.js';

describe('localTbConverter', () => {
  it('classifies every leaf row from a messy 3-column matrix', async () => {
    const matrix = [
      ['Account', 'Debit', 'Credit'],
      ['  Cash at Bank', 50000, 0],
      ['  Accounts Payable', 0, 30000],
      ['Sales Revenue', 0, 120000],
      ['Rent Expense', 24000, 0],
    ];
    const parsed = parseMatrix(matrix);
    const classified = heuristicFallbackClassify(classifyAll(parsed.rows));
    const leafRows = classified.filter((r) => !r.isGroupRow);
    assert.ok(leafRows.length >= 4);
    for (const row of leafRows) {
      assert.notEqual(row.nfrsCategory, 'unclassified');
      assert.ok(row.nfrsCategory);
    }
    assert.ok(parsed.totalClosingDr > 0 || parsed.totalClosingCr > 0);
  });

  it('converts sample CSV end-to-end with local_intelligent format', async () => {
    const result = await convertTrialBalanceLocally(
      Buffer.from(SAMPLE_TRIAL_BALANCE_CSV, 'utf-8'),
      'sample.csv',
    );
    assert.equal(result.detectedFormat, 'local_intelligent');
    assert.ok(result.rows.length > 0);
    const leafRows = result.rows.filter((r) => !r.isGroupRow);
    assert.ok(leafRows.length > 0);
    const classified = heuristicFallbackClassify(classifyAll(leafRows));
    for (const row of classified) {
      assert.notEqual(row.nfrsCategory, 'unclassified');
    }
    assert.ok(result.warnings.some((w) => w.includes('auto-classified')));
  });
});
