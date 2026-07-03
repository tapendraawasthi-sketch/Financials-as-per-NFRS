import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectAdjustmentRelevance } from '../../src/utils/adjustmentRelevance.js';

describe('adjustmentRelevance', () => {
  it('detects PPE, inventory, and investment sections from mapped TB rows', () => {
    const relevance = detectAdjustmentRelevance([
      {
        rowIndex: 0,
        rawLabel: 'Building',
        nfrsCategory: 'ppe_buildings',
        closingDr: 1_000_000,
        closingCr: 0,
        openingDr: 0,
        openingCr: 0,
        duringDr: 0,
        duringCr: 0,
        adjustmentDr: 0,
        adjustmentCr: 0,
      },
      {
        rowIndex: 1,
        rawLabel: 'Inventory',
        nfrsCategory: 'inventory_raw_materials',
        closingDr: 25_000,
        closingCr: 0,
        openingDr: 0,
        openingCr: 0,
        duringDr: 0,
        duringCr: 0,
        adjustmentDr: 0,
        adjustmentCr: 0,
      },
      {
        rowIndex: 2,
        rawLabel: 'Listed Shares',
        nfrsCategory: 'investment_listed_trading',
        closingDr: 150_000,
        closingCr: 0,
        openingDr: 0,
        openingCr: 0,
        duringDr: 0,
        duringCr: 0,
        adjustmentDr: 0,
        adjustmentCr: 0,
      },
    ]);

    assert.equal(relevance.hasPPE, true);
    assert.equal(relevance.hasInventory, true);
    assert.equal(relevance.hasInvestments, true);
  });
});
