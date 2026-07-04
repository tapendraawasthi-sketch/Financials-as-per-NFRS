import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { SAMPLE_COMPANY, SAMPLE_TRIAL_BALANCE_CSV } from '../../src/data/sampleData.js';
import { parseTrialBalance } from '../../server/services/tbParser.js';
import { classifyAll } from '../../server/services/accountMatcher.js';
import { computeAllFinancials } from '../../server/services/financialEngine.js';
import { buildAdjustedTrialBalance } from '../../server/services/adjustmentSync.js';
import { generateNFRSWorkbook } from '../../server/services/excelWriter.js';
import { validateMesWorkbookStructure } from '../../server/services/mesWorkbookContract.js';
import { validateCellAnchors, validateEnterDetailsLabels } from '../../server/services/mesWorkbookCellParity.js';
import type { YearEndAdjustments } from '../../src/types/index.js';

async function buildClassifiedTB() {
  const parsed = await parseTrialBalance(Buffer.from(SAMPLE_TRIAL_BALANCE_CSV, 'utf-8'), 'sample.csv');
  const classified = classifyAll(parsed.rows);
  return {
    ...parsed,
    rows: classified.map((row, index) => ({
      ...parsed.rows[index],
      nfrsCategory: row.category,
      confidence: row.confidence,
      matchMethod: row.matchMethod,
    })),
  };
}

describe('mesWorkbook end-to-end flow', () => {
  it('generates MEs-format workbook from sample TB through financial pipeline', async () => {
    const tb = await buildClassifiedTB();
    const adjustments: YearEndAdjustments = {
      assetRegister: [],
      investmentAdjustments: [],
      disallowedForTax: [],
      manualJournals: [],
      journalEntries: [],
      taxDepPool: [],
      inventoryDetails: {
        rawMaterialsCY: 0, rawMaterialsPY: 0, wipCY: 0, wipPY: 0, finishedGoodsCY: 0, finishedGoodsPY: 0,
      },
    } as YearEndAdjustments;

    const { adjustedTB } = buildAdjustedTrialBalance({
      tb: tb as any,
      manualGroups: [],
      systemAdjustments: { depreciation: 0, staffBonus: 0, incomeTax: 0, dividendDeclared: 0, tdsOnDividend: 0, investmentFVGainLoss: 0 },
    });

    const financials = computeAllFinancials(adjustedTB as any, adjustments as any, SAMPLE_COMPANY);
    const buffer = await generateNFRSWorkbook({
      company: SAMPLE_COMPANY,
      trialBalance: adjustedTB as any,
      balanceSheet: financials.balanceSheet,
      incomeStatement: financials.incomeStatement,
      changesInEquity: financials.changesInEquity,
      cashFlow: financials.cashFlow,
      notes: financials.notes,
      adjustments,
    });

    assert.ok(buffer.length > 20_000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const structure = validateMesWorkbookStructure(wb);
    assert.equal(structure.ok, true, structure.errors.join('\n'));

    const anchors = validateCellAnchors(wb);
    assert.equal(anchors.ok, true, anchors.errors.join('\n'));

    const labels = validateEnterDetailsLabels(wb);
    assert.equal(labels.ok, true, labels.errors.join('\n'));
  });
});
