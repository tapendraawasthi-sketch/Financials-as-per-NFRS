import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCreditorReconciliation,
  checkDebtorReconciliation,
  validateSubledgerTotals,
} from '../../src/utils/subledgerValidation.js';

describe('subledgerValidation', () => {
  it('flags debtor mismatch against trial balance', () => {
    const result = validateSubledgerTotals(
      { debtors: [{ debitBalance: 120_000 }] },
      100_000,
      0,
    );

    assert.equal(result.isValid, false);
    assert.match(result.warnings[0], /Debtor subledger total/i);
  });

  it('accepts debtor totals within tolerance', () => {
    const result = validateSubledgerTotals(
      { debtors: [{ debitBalance: 100_000 }] },
      100_000,
      0,
    );

    assert.equal(result.isValid, true);
    assert.equal(result.debtorTotal, 100_000);
  });

  it('checks creditor reconciliation helper', () => {
    const balanced = checkCreditorReconciliation(250_000, 250_000, true);
    const mismatched = checkCreditorReconciliation(240_000, 250_000, true);

    assert.equal(balanced.isBalanced, true);
    assert.equal(mismatched.isBalanced, false);
    assert.equal(mismatched.diff, 10_000);
  });

  it('ignores empty debtor lists for reconciliation warnings', () => {
    const check = checkDebtorReconciliation(0, 500_000, false);
    assert.equal(check.isBalanced, true);
  });
});
