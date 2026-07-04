import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeListedShareMetrics } from '../../src/utils/investmentCalculations.js';
import { computeAdvanceTaxInterest } from '../../src/utils/advanceTaxCalculations.js';
import { ADVANCE_TAX_CHECKPOINTS } from '../../src/data/advanceTaxCheckpoints.js';

describe('investmentCalculations', () => {
  it('computes closing units and FV gain from per-script roll-forward', () => {
    const metrics = computeListedShareMetrics({
      openingUnits: 100,
      unitsPurchased: 20,
      unitsSold: 30,
      openingLtp: 100,
      closingLtp: 120,
      soldUnitGainLoss: 500,
    });
    assert.equal(metrics.closingUnits, 90);
    assert.equal(metrics.openingFv, 10_000);
    assert.equal(metrics.closingFv, 10_800);
    assert.equal(metrics.fvGainLoss, 800);
    assert.equal(metrics.soldUnitGainLoss, 500);
  });
});

describe('advanceTaxCalculations', () => {
  it('computes Section 118 interest from days late', () => {
    const installments = ADVANCE_TAX_CHECKPOINTS.map((cp, i) => ({
      checkpoint: cp.checkpoint,
      cumulativePercent: cp.cumulativePercent,
      paidAmount: [0, 0, 0][i],
      daysLate: cp.defaultDaysLate,
    }));
    const result = computeAdvanceTaxInterest(1_000_000, installments);
    assert.equal(result.installments[0].requiredAmount, 400_000);
    assert.ok(result.totalInterest118 > 0);
    assert.equal(result.finalShortfall, 900_000);
    assert.ok(result.totalInterest119 > 0);
  });
});
