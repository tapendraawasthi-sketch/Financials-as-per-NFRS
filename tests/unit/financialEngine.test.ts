import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalanceSheet, computeCashFlow } from '../../server/services/financialEngine.js';
import { buildNotesData } from '../../server/services/notesEngine.js';
import { SAMPLE_COMPANY } from '../../src/data/sampleData.js';
import type { BalanceSheet, IncomeStatement, MappedTBRow, YearEndAdjustments } from '../../src/types/index.js';

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

describe('financialEngine cash flow', () => {
  it('handles minimal adjustments without depreciationResults or assets', () => {
    const minimalAdj = {
      investmentAdjustments: [],
      totalDepreciationExpense: 0,
      staffBonusProvision: 0,
      gainOnDisposals: 0,
      lossOnDisposals: 0,
    } as YearEndAdjustments;

    const is = { profitBeforeTax: 0, interestIncome: 0, financeCharges: 0, impairment: 0, staffBonus: 0 } as IncomeStatement;
    const bs = { ca_tradeReceivables: 0, ca_inventories: 0, ca_other: 0, cl_tradePayables: 0, cl_incomeTaxPayable: 0, cl_provisions: 0, ca_cashAndEquivalents: 1000 } as BalanceSheet;

    const cf = computeCashFlow(
      { rows: [row('cash_in_hand', 1000)] } as any,
      minimalAdj,
      is,
      bs,
    );

    assert.equal(cf.proceedsFromPPEDisposal, 0);
    assert.ok(cf.purchaseOfPPE === 0);
    assert.equal(cf.closingCash, 1000);
  });
});

describe('notesEngine nasCompliance', () => {
  it('uses company nasCompliance flags for contingencies and subsequent events', () => {
    const notes = buildNotesData({
      tb: { rows: [] } as any,
      adj: emptyAdj,
      bs: {} as BalanceSheet,
      is: emptyIS,
      company: {
        ...SAMPLE_COMPANY,
        nasCompliance: {
          contingentLiabilities: true,
          eventsAfterDate: true,
        },
      },
    });

    assert.equal(notes.note325_contingencies?.hasContingencies, true);
    assert.match(notes.note325_contingencies?.defaultText ?? '', /contingent liabilities/i);
    assert.equal(notes.note326_subsequentEvents?.hasSubsequentEvents, true);
    assert.match(notes.note326_subsequentEvents?.defaultText ?? '', /events after the reporting date/i);
  });

  it('routes government grants and foreign currency flags into note disclosures', () => {
    const notes = buildNotesData({
      tb: {
        rows: [
          {
            rowIndex: 0,
            rawLabel: 'Grant income',
            nfrsCategory: 'other_income_misc',
            closingDr: 0,
            closingCr: 50_000,
            openingDr: 0,
            openingCr: 0,
            duringDr: 0,
            duringCr: 0,
            adjustmentDr: 0,
            adjustmentCr: 0,
            isGroupRow: false,
          },
          {
            rowIndex: 1,
            rawLabel: 'Finance charges',
            nfrsCategory: 'finance_cost_interest',
            closingDr: 12_000,
            closingCr: 0,
            openingDr: 0,
            openingCr: 0,
            duringDr: 0,
            duringCr: 0,
            adjustmentDr: 0,
            adjustmentCr: 0,
            isGroupRow: false,
          },
        ],
      } as any,
      adj: emptyAdj,
      bs: {} as BalanceSheet,
      is: emptyIS,
      company: {
        ...SAMPLE_COMPANY,
        nasCompliance: {
          governmentGrants: true,
          foreignCurrency: true,
        },
      },
    });

    assert.equal((notes.note319_otherIncome as any)?.governmentGrantIncome?.cy, 50_000);
    assert.equal((notes.note319_otherIncome as any)?.miscellaneousIncome?.cy, 0);
    assert.equal((notes.note319_otherIncome as any)?.hasForeignCurrencyTransactions, true);
    assert.ok(
      (notes.note322_adminExpenses?.lineItems ?? []).some(
        (item) => String(item.label).includes('Foreign Exchange'),
      ),
    );
  });
});
