import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDonationAllowance,
  computeGeneralDeductionUs13,
  DONATION_STATUTORY_CEILING,
  buildLossCarryForwardSchedule,
} from '../../server/services/taxEngine.js';
import { classifyDebtors } from '../../server/services/subledgerRules.js';

describe('taxEngine MEs-format formulas', () => {
  it('applies three-way donation cap u/s 12', () => {
    assert.equal(computeDonationAllowance(50_000, 2_000_000), 50_000);
    assert.equal(computeDonationAllowance(150_000, 2_000_000), DONATION_STATUTORY_CEILING);
    assert.equal(computeDonationAllowance(50_000, 500_000), 25_000);
  });

  it('computes general deduction u/s 13 excluding material/direct/interest/depreciation/repair', () => {
    const result = computeGeneralDeductionUs13({
      employeeBenefitExpenses: 1_500_000,
      staffBonus: 200_000,
      adminAndOtherExpenses: 600_000,
      repairExpense: 50_000,
      impairment: 57_349.36,
    });
    assert.equal(result, 2_307_349.36);
  });

  it('builds seven-year loss carry-forward schedule', () => {
    const { schedule, totalAllowable } = buildLossCarryForwardSchedule([
      { fiscalYear: '2075/76', amount: 100_000 },
      { fiscalYear: '2076/77', amount: 200_000 },
    ], 250_000);
    assert.equal(schedule.length, 2);
    assert.equal(totalAllowable, 250_000);
    assert.equal(schedule[0].utilized, 100_000);
    assert.equal(schedule[1].utilized, 150_000);
  });
});

describe('subledgerRules', () => {
  it('reclassifies credit-balance debtors to advance from customers', () => {
    const result = classifyDebtors([
      { name: 'Debtor A', balanceCY: 500_000 },
      { name: 'Debtor C', balanceCY: 0, creditBalance: 100_000 },
    ]);
    assert.equal(result.tradeReceivablesCY, 500_000);
    assert.equal(result.advanceFromCustomersCY, 100_000);
    assert.equal(result.classifiedDebtors[1].isAdvanceFromCustomer, true);
  });
});
