import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveClosingBalances,
  assignParentGroups,
  finalizeRawTBRows,
  markGroupRowsByIndentation,
  shouldIncludeRowInTotals,
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

  it('markGroupRowsByIndentation scans past same-indent siblings for deeper descendants', () => {
    const rows: RawTBRow[] = [
      { ...leaf({ rawLabel: 'Sundry Creditors' }), rawIndentSpaces: 4, duringDr: 100, duringCr: 100 },
      { ...leaf({ rawLabel: 'Business And Other Payable' }), rawIndentSpaces: 4, duringDr: 100, duringCr: 100 },
      { ...leaf({ rawLabel: 'A.N. Tech Solution' }), rawIndentSpaces: 8, duringDr: 50, duringCr: 50 },
    ];
    const marked = markGroupRowsByIndentation(rows);
    assert.equal(marked[0].isGroupRow, true);
    assert.equal(marked[1].isGroupRow, true);
    assert.equal(marked[2].isGroupRow, false);
  });

  it('shouldIncludeRowInTotals includes Tally shorthand headers with leaf breakdown peers', () => {
    const rows: RawTBRow[] = [
      {
        ...leaf({ rawLabel: 'Printing & Stationary' }),
        isGroupRow: true,
        isShorthandAggregate: true,
        rawIndentSpaces: 6,
        duringDr: 43010,
      },
      {
        ...leaf({ rawLabel: 'Printing & Stationary (VAT)' }),
        rawIndentSpaces: 6,
        duringDr: 34901.72,
      },
      {
        ...leaf({ rawLabel: 'Purchase' }),
        isGroupRow: true,
        isShorthandAggregate: true,
        rawIndentSpaces: 4,
        duringDr: 80000,
      },
      {
        ...leaf({ rawLabel: 'Purchase: IMPORT' }),
        isGroupRow: true,
        rawIndentSpaces: 4,
        duringDr: 50000,
      },
    ];
    assert.equal(shouldIncludeRowInTotals(rows[0], rows), true);
    assert.equal(shouldIncludeRowInTotals(rows[2], rows), false);
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
