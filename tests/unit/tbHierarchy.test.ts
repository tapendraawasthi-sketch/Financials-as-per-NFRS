import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveClosingBalances,
  assignParentGroups,
  finalizeRawTBRows,
  isTallyNamingDescendant,
  postProcessTallyGroupedHierarchy,
} from '../../server/services/tbHierarchy.js';
import type { RawTBRow } from '../../src/types/trialBalance.js';

function leaf(partial: Partial<RawTBRow> & Pick<RawTBRow, 'rawLabel'>): RawTBRow {
  return {
    rowIndex: 0,
    rawLabel: partial.rawLabel,
    openingDr: 0,
    openingCr: 0,
    duringDr: 0,
    duringCr: 0,
    adjustmentDr: 0,
    adjustmentCr: 0,
    closingDr: 0,
    closingCr: 0,
    rowLevel: 2,
    isGroupRow: false,
    parentGroup: '',
    rawIndentSpaces: 0,
    ...partial,
  };
}

describe('tbHierarchy', () => {
  it('derives closing balance from opening and during columns', () => {
    const row = deriveClosingBalances(leaf({
      rawLabel: 'Cash',
      openingDr: 1000,
      duringDr: 500,
      duringCr: 200,
    }));
    assert.equal(row.closingDr, 1300);
    assert.equal(row.closingCr, 0);
  });

  it('assigns parentGroup from group headers above leaf rows', () => {
    const rows: RawTBRow[] = [
      { ...leaf({ rawLabel: 'Property, Plant & Equipment' }), isGroupRow: true, rowLevel: 0, rowIndex: 0 },
      { ...leaf({ rawLabel: 'Building' }), closingDr: 500000, rowIndex: 1, rawIndentSpaces: 4 },
    ];
    const assigned = assignParentGroups(rows);
    assert.equal(assigned[1].parentGroup, 'Property, Plant & Equipment');
  });

  it('finalizeRawTBRows excludes group rows from totals', () => {
    const result = finalizeRawTBRows([
      { ...leaf({ rawLabel: 'Assets' }), isGroupRow: true, rowLevel: 0 },
      { ...leaf({ rawLabel: 'Cash' }), closingDr: 100, closingCr: 0 },
      { ...leaf({ rawLabel: 'Capital' }), closingDr: 0, closingCr: 100 },
    ]);
    assert.equal(result.totals.totalClosingDr, 100);
    assert.equal(result.totals.totalClosingCr, 100);
    assert.equal(result.totals.isBalanced, true);
  });

  it('detects Tally naming hierarchy for Purchase: IMPORT style labels', () => {
    assert.equal(
      isTallyNamingDescendant('Purchase: IMPORT', 'Purchase IMPORT: Raw Materials'),
      true,
    );
    assert.equal(
      isTallyNamingDescendant('Purchase: IMPORT', 'Purchase: LOCAL'),
      false,
    );
  });

  it('postProcessTallyGroupedHierarchy excludes sub-group aggregates from leaf totals', () => {
    const rows: RawTBRow[] = [
      { ...leaf({ rawLabel: 'Purchase' }), isGroupRow: false, rowIndex: 0, rawIndentSpaces: 4, closingDr: 1000 },
      { ...leaf({ rawLabel: 'Purchase: IMPORT' }), isGroupRow: false, rowIndex: 1, rawIndentSpaces: 4, closingDr: 600 },
      { ...leaf({ rawLabel: 'Purchase IMPORT: Raw Materials' }), isGroupRow: false, rowIndex: 2, rawIndentSpaces: 8, closingDr: 600 },
      { ...leaf({ rawLabel: 'Purchase: LOCAL' }), isGroupRow: false, rowIndex: 3, rawIndentSpaces: 4, closingDr: 400 },
      { ...leaf({ rawLabel: 'Purchase LOCAL: Raw Materials' }), isGroupRow: false, rowIndex: 4, rawIndentSpaces: 8, closingDr: 400 },
    ];
    const processed = postProcessTallyGroupedHierarchy(rows);
    const purchase = processed.find((r) => r.rawLabel === 'Purchase');
    const purchaseImport = processed.find((r) => r.rawLabel === 'Purchase: IMPORT');
    const importRaw = processed.find((r) => r.rawLabel === 'Purchase IMPORT: Raw Materials');
    const localRaw = processed.find((r) => r.rawLabel === 'Purchase LOCAL: Raw Materials');
    assert.ok(purchase?.isGroupRow);
    assert.ok(purchaseImport?.isGroupRow);
    assert.equal(importRaw?.isGroupRow, false);
    assert.equal(localRaw?.isGroupRow, false);
    const totals = finalizeRawTBRows(processed, { tallyGrouped: true }).totals;
    assert.equal(totals.totalClosingDr, 1000);
    assert.equal(totals.totalClosingCr, 0);
    assert.equal(totals.isBalanced, false);
  });
});

describe('financialEngine cash flow dividend', () => {
  it('does not zero dividend paid when prior-year tax was paid', async () => {
    const { computeCashFlow } = await import('../../server/services/financialEngine.js');
    const row = (cat: string, dr: number, cr: number, openingCr = 0) => ({
      rowIndex: 0,
      rawLabel: cat,
      nfrsCategory: cat,
      closingDr: dr,
      closingCr: cr,
      openingDr: 0,
      openingCr: openingCr,
      duringDr: 0,
      duringCr: 0,
      adjustmentDr: 0,
      adjustmentCr: 0,
      isGroupRow: false,
      parentGroup: '',
      rawIndentSpaces: 0,
      displayLabel: cat,
      matchMethod: 'exact' as const,
      confidence: 100,
      needsReview: false,
      userOverride: false,
    });

    const cf = computeCashFlow(
      {
        rows: [
          row('share_capital', 0, 1_000_000),
          row('dividend_payable', 0, 50_000, 100_000),
          row('cash_in_hand', 500_000, 0),
        ],
      } as any,
      {
        incomeTaxPaidPY: 25_000,
        dividendPayable: 100_000,
      } as any,
      { profitBeforeTax: 0 } as any,
      { ca_cashAndEquivalents: 500_000 } as any,
    );

    assert.ok(cf.dividendPaid < 0, 'dividend paid should be negative outflow');
    assert.notEqual(cf.dividendPaid, 0, 'dividend paid must not be zeroed by incomeTaxPaidPY');
  });
});
