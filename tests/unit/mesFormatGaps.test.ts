import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDonationAllowance,
  computeGeneralDeductionUs13,
  DONATION_STATUTORY_CEILING,
  buildLossCarryForwardSchedule,
} from '../../server/services/taxEngine.js';
import { classifyDebtors } from '../../server/services/subledgerRules.js';
import { buildTaxNotesData } from '../../server/services/taxNotesBuilder.js';
import { computeTax } from '../../server/services/taxEngine.js';

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

describe('taxNotesBuilder', () => {
  it('routes income-side items to Note I and expenses to Note II', () => {
    const data = buildTaxNotesData({
      disallowedForTax: [
        { description: 'Dividend income', amount: 50_000, section: 'Exempt', side: 'income', asPerBooks: 50_000 },
        { description: 'Entertainment excess', amount: 10_000, section: 'Sec 21', side: 'expense', asPerBooks: 25_000 },
      ],
      adminLineItems: [{ label: 'Entertainment', cy: 25_000 }],
    });
    assert.equal(data.noteI_income.length, 1);
    assert.equal(data.noteI_income[0].disallowed, 50_000);
    assert.equal(data.totalExpenseDisallowed, 10_000);
    assert.ok(data.noteII_expenses.some((l) => l.label === 'Entertainment' && l.disallowed === 10_000));
  });
});

describe('computeTax income vs expense disallowances', () => {
  it('adds expense disallowances and subtracts income exclusions', () => {
    const result = computeTax({
      accountingProfit: 1_000_000,
      accountingDepreciation: 0,
      taxDepreciation: 0,
      disallowedForTax: [
        { description: 'Entertainment', amount: 20_000, section: 'Sec 21', side: 'expense' },
        { description: 'Dividend', amount: 30_000, section: 'Exempt', side: 'income' },
      ],
      staffBonus: 0,
      profitBeforeBonus: 1_000_000,
      advanceTaxPaid: 0,
      incomeTaxRate: 0.25,
      entityType: 'Company',
    });
    assert.equal(result.taxableIncome, 990_000);
  });
});
