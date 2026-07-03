import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalanceSheet } from '../../server/services/financialEngine.js';
import { SAMPLE_COMPANY } from '../../src/data/sampleData.js';
import type { IncomeStatement, MappedTBRow, YearEndAdjustments } from '../../src/types/index.js';

const emptyAdj = {
  investmentAdjustments: [],
  totalInventoryImpairment: 0,
  totalDepreciationExpense: 0,
  dividendPayable: 0,
  incomeTaxPaidPY: 0,
  incomeTaxProvision: 0,
} as YearEndAdjustments;

const emptyIS = { netProfit: 0 } as IncomeStatement;

function row(category: string, dr: number): MappedTBRow {
  return {
    rowIndex: 0,
    rawLabel: category,
    nfrsCategory: category,
    closingDr: dr,
    closingCr: 0,
    openingDr: 0,
    openingCr: 0,
    duringDr: 0,
    duringCr: 0,
    adjustmentDr: 0,
    adjustmentCr: 0,
  };
}

describe('financialEngine investments', () => {
  it('puts listed trading shares in current investments', () => {
    const bs = computeBalanceSheet(
      { rows: [row('investment_listed_trading', 250_000)] } as any,
      emptyAdj,
      emptyIS,
      SAMPLE_COMPANY,
    );
    assert.equal(bs.ca_investments, 250_000);
    assert.equal(bs.nca_investments, 0);
  });

  it('puts unlisted shares and non-current FD in non-current investments', () => {
    const bs = computeBalanceSheet(
      {
        rows: [
          row('investment_unlisted', 400_000),
          row('investment_fixed_deposit_noncurrent', 100_000),
        ],
      } as any,
      emptyAdj,
      emptyIS,
      SAMPLE_COMPANY,
    );
    assert.equal(bs.nca_investments, 500_000);
    assert.equal(bs.ca_investments, 0);
  });
});
