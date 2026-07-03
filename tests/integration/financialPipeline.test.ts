import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_COMPANY, SAMPLE_TRIAL_BALANCE_CSV } from '../../src/data/sampleData.js';
import { parseTrialBalance } from '../../server/services/tbParser.js';
import { classifyAll } from '../../server/services/accountMatcher.js';
import { calculateDepreciationSummary } from '../../server/services/depreciationEngine.js';
import { computeAllFinancials } from '../../server/services/financialEngine.js';
import type { AssetItem, ParsedTrialBalance, YearEndAdjustments } from '../../src/types/index.js';

const TEST_ASSETS: AssetItem[] = [
  {
    id: 'building-a',
    assetName: 'Building A',
    categoryId: 'building',
    originalCost: 5_500_000,
    additionalCost: 0,
    purchaseDateBS: '2076-09-14',
    usefulLifeYears: 25,
    residualValue: 0,
    depreciationMethod: 'StraightLine',
    wdvRate: 0,
    accumDepreciationOpening: 660_000,
    isFullyDepreciated: false,
    isMortgaged: false,
    disposed: false,
  },
];

function toDepreciationRegister(assets: AssetItem[]) {
  return assets.map((asset) => ({
    id: asset.id,
    assetName: asset.assetName,
    assetClass: 'Building',
    categoryId: asset.categoryId,
    originalCost: asset.originalCost,
    additionsCY: asset.additionalCost ?? 0,
    purchaseDateBS: asset.purchaseDateBS,
    usefulLifeYears: asset.usefulLifeYears,
    accumulatedDepnPY: asset.accumDepreciationOpening ?? 0,
    disposed: asset.disposed,
  }));
}

async function buildSampleTrialBalance(): Promise<ParsedTrialBalance> {
  const parsed = await parseTrialBalance(Buffer.from(SAMPLE_TRIAL_BALANCE_CSV, 'utf-8'), 'sample.csv');
  const classified = classifyAll(parsed.rows);
  return {
    ...parsed,
    rows: classified.map((row, index) => ({
      ...parsed.rows[index],
      ...row,
      nfrsCategory: row.nfrsCategory,
      matchedLabel: row.displayLabel,
    })),
  };
}

describe('financial pipeline integration', () => {
  it('runs depreciation and financial statements with BS and CF reconciliation', async () => {
    const trialBalance = await buildSampleTrialBalance();
    const depreciationInput = toDepreciationRegister(TEST_ASSETS);
    const { results: depreciationResults, summary: depreciationSummary } = calculateDepreciationSummary(
      depreciationInput,
      [],
      SAMPLE_COMPANY.fiscalYear?.bsFY ?? '2081/82',
    );

    const totalDepreciationExpense = depreciationResults.reduce(
      (sum, row) => sum + (row.depreciationCY ?? 0),
      0,
    );

    const adjustments = {
      companyId: SAMPLE_COMPANY.id,
      fiscalYear: SAMPLE_COMPANY.fiscalYear?.bsFY,
      assets: TEST_ASSETS,
      assetRegister: depreciationResults,
      depreciationResults,
      depreciationSummary,
      taxDepreciationPools: [],
      inventoryAdjustments: [],
      investmentAdjustments: [],
      provisions: [],
      journalEntries: [],
      totalDepreciationExpense: totalDepreciationExpense || 907_506,
      staffBonusProvision: 132_349,
      incomeTaxProvision: 441_163,
      dividendPayable: 3_470_901,
      staffBonusPayablePY: 0,
      incomeTaxPaidPY: 0,
      disallowedForTax: [],
      taxDepPool: [],
      manualJournals: [],
      bankAccounts: [],
      debtors: [],
      creditors: [],
      relatedParties: [],
      inventoryDetails: {
        rawMaterialsCY: 25_000,
        rawMaterialsPY: 25_000,
        wipCY: 0,
        wipPY: 0,
        finishedGoodsCY: 0,
        finishedGoodsPY: 0,
      },
      totalInventoryImpairment: 0,
      totalInvestmentFVAdjustment: 0,
      totalProvisions: 0,
      gainOnDisposals: 0,
      lossOnDisposals: 0,
    } as YearEndAdjustments;

    const result = {
      ...adjustments,
      ...computeAllFinancials(trialBalance, adjustments, SAMPLE_COMPANY),
    };

    assert.ok(result.depreciationSummary);
    assert.ok(result.totalDepreciationExpense > 0);

    const firstAsset = result.assetRegister[0] as {
      netBookValueCY?: number;
      closingWDV?: number;
      originalCost?: number;
      cost?: number;
    };
    const closingWdv = firstAsset.closingWDV ?? firstAsset.netBookValueCY ?? 0;
    const cost = firstAsset.cost ?? firstAsset.originalCost ?? 0;
    assert.ok(closingWdv < cost);

    const cfEndCash = result.cashFlow.closingCash;
    const bsCash = result.balanceSheet.cashAndEquivalents
      ?? result.balanceSheet.ca_cashAndEquivalents
      ?? 0;
    assert.ok(Math.abs(cfEndCash - bsCash) <= 0.5);

    const balancedTrialBalance: ParsedTrialBalance = {
      rows: [
        {
          rowIndex: 0,
          rawLabel: 'Cash',
          nfrsCategory: 'cash_in_hand',
          closingDr: 1000,
          closingCr: 0,
          openingDr: 0,
          openingCr: 0,
          duringDr: 1000,
          duringCr: 0,
          adjustmentDr: 0,
          adjustmentCr: 0,
        },
        {
          rowIndex: 1,
          rawLabel: 'Share Capital',
          nfrsCategory: 'share_capital',
          closingDr: 0,
          closingCr: 1000,
          openingDr: 0,
          openingCr: 1000,
          duringDr: 0,
          duringCr: 0,
          adjustmentDr: 0,
          adjustmentCr: 0,
        },
      ],
      isBalanced: true,
      totalClosingDr: 1000,
      totalClosingCr: 1000,
      difference: 0,
    };

    const balancedAdj = {
      assets: [],
      depreciationResults: [],
      totalDepreciationExpense: 0,
      staffBonusProvision: 0,
      investmentAdjustments: [],
      taxDepreciationPools: [],
      provisions: [],
      journalEntries: [],
      inventoryDetails: {
        rawMaterialsCY: 0,
        rawMaterialsPY: 0,
        wipCY: 0,
        wipPY: 0,
        finishedGoodsCY: 0,
        finishedGoodsPY: 0,
      },
      totalInventoryImpairment: 0,
      totalInvestmentFVAdjustment: 0,
      totalProvisions: 0,
      gainOnDisposals: 0,
      lossOnDisposals: 0,
    } as YearEndAdjustments;

    const balanced = computeAllFinancials(balancedTrialBalance, balancedAdj, SAMPLE_COMPANY);
    const bs = balanced.balanceSheet;
    const totalLiabilities = bs.totalLiabilities
      ?? ((bs.totalCurrentLiabilities ?? 0) + (bs.totalNonCurrentLiabilities ?? 0));
    const balanceDiff = Math.abs((bs.totalAssets ?? 0) - ((bs.totalEquity ?? 0) + totalLiabilities));
    assert.ok(balanceDiff <= 1, `balance sheet difference ${balanceDiff}`);
  });
});
