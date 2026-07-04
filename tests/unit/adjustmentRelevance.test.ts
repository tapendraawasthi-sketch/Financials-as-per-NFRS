import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectAdjustmentRelevance } from '../../src/utils/adjustmentRelevance.js';

const baseRow = {
  openingDr: 0,
  openingCr: 0,
  duringDr: 0,
  duringCr: 0,
  adjustmentDr: 0,
  adjustmentCr: 0,
  isGroupRow: false,
};

describe('adjustmentRelevance', () => {
  it('detects PPE, inventory, and investment sections from mapped TB rows', () => {
    const relevance = detectAdjustmentRelevance([
      {
        ...baseRow,
        rowIndex: 0,
        rawLabel: 'Building',
        nfrsCategory: 'ppe_buildings',
        closingDr: 1_000_000,
        closingCr: 0,
      },
      {
        ...baseRow,
        rowIndex: 1,
        rawLabel: 'Inventory',
        nfrsCategory: 'inventory_raw_materials',
        closingDr: 25_000,
        closingCr: 0,
      },
      {
        ...baseRow,
        rowIndex: 2,
        rawLabel: 'Listed Shares',
        nfrsCategory: 'investment_listed_trading',
        closingDr: 150_000,
        closingCr: 0,
      },
    ]);

    assert.equal(relevance.hasPPE, true);
    assert.equal(relevance.hasInventory, true);
    assert.equal(relevance.hasInvestments, true);
    assert.equal(relevance.ppeAccountCount, 1);
  });

  it('detects borrowings, receivables, employee benefits, and disposal indicators', () => {
    const relevance = detectAdjustmentRelevance([
      {
        ...baseRow,
        rowIndex: 0,
        rawLabel: 'Bank Loan',
        nfrsCategory: 'borrowings_noncurrent_bank',
        closingDr: 0,
        closingCr: 500_000,
      },
      {
        ...baseRow,
        rowIndex: 1,
        rawLabel: 'Debtors',
        nfrsCategory: 'trade_receivables',
        closingDr: 120_000,
        closingCr: 0,
      },
      {
        ...baseRow,
        rowIndex: 2,
        rawLabel: 'Gratuity',
        nfrsCategory: 'employee_benefit_gratuity',
        closingDr: 0,
        closingCr: 40_000,
      },
      {
        ...baseRow,
        rowIndex: 3,
        rawLabel: 'Gain on sale',
        nfrsCategory: 'other_income_disposal_gain',
        closingDr: 0,
        closingCr: 15_000,
      },
    ]);

    assert.equal(relevance.hasBorrowings, true);
    assert.equal(relevance.hasTradeReceivables, true);
    assert.equal(relevance.hasEmployeeBenefits, true);
    assert.equal(relevance.hasDisposalIndicators, true);
    assert.equal(relevance.provisionApplicability.gratuity, true);
    assert.equal(relevance.provisionApplicability.doubtful, true);
  });

  it('derives provision applicability and NAS flags from company profile', () => {
    const relevance = detectAdjustmentRelevance([], {
      name: 'Sample Co',
      auditor: 'Jane Auditor',
      nasCompliance: {
        governmentGrants: true,
        foreignCurrency: true,
        leaseArrangements: true,
      },
    } as any);

    assert.equal(relevance.provisionApplicability.audit, true);
    assert.equal(relevance.provisionApplicability.bonus, true);
    assert.equal(relevance.provisionApplicability.gratuity, false);
    assert.equal(relevance.nasFlags.governmentGrants, true);
    assert.equal(relevance.nasFlags.foreignCurrency, true);
    assert.equal(relevance.nasFlags.leaseArrangements, true);
  });

  it('ignores group rows and zero-balance accounts', () => {
    const relevance = detectAdjustmentRelevance([
      {
        ...baseRow,
        rowIndex: 0,
        rawLabel: 'PPE Group',
        nfrsCategory: 'ppe_buildings',
        closingDr: 0,
        closingCr: 0,
        isGroupRow: true,
      },
      {
        ...baseRow,
        rowIndex: 1,
        rawLabel: 'Empty PPE',
        nfrsCategory: 'ppe_vehicles',
        closingDr: 0,
        closingCr: 0,
      },
    ]);

    assert.equal(relevance.hasPPE, false);
    assert.equal(relevance.ppeAccountCount, 0);
  });
});
