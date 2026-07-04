import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildMesEnterDetailsFields } from '../../server/services/mesEnterDetailsFields.js';
import { writeMesFormatTrialBalance } from '../../server/services/mesTrialBalanceWriter.js';
import { SAMPLE_COMPANY } from '../../src/data/sampleData.js';
import type { ParsedTrialBalance } from '../../src/types/index.js';

describe('mesEnterDetailsFields', () => {
  it('uses MEs reference labels in column B/C layout contract', () => {
    const fields = buildMesEnterDetailsFields(SAMPLE_COMPANY, {
      inventoryDetails: {
        rawMaterialsCY: 100,
        rawMaterialsPY: 80,
        wipCY: 0,
        wipPY: 0,
        finishedGoodsCY: 200,
        finishedGoodsPY: 150,
      },
      dividendPayable: 50_000,
    });
    const labels = fields.map((f) => f.label);
    assert.ok(labels.includes('name of entity'));
    assert.ok(labels.includes('address'));
    assert.ok(labels.includes('this year'));
    assert.ok(labels.includes('number of employees'));
    assert.ok(labels.includes('income tax rate (%)'));
    assert.ok(labels.includes('dividend declared (%)'));
    assert.ok(labels.includes('type of audit firm'));
    assert.ok(labels.includes('inventory — raw materials (cy)'));
    assert.ok(labels.includes('inventory check (cy = bs?)'));
  });

  it('computes dividend capacity from retained earnings and profit', async () => {
    const { computeDividendCapacityPercent } = await import('../../server/services/mesEnterDetailsFields.js');
    const capacity = computeDividendCapacityPercent(10_000_000, 2_000_000, 51_000_000);
    assert.ok(Math.abs(capacity - 23.5294) < 0.01);
  });
});

describe('mesTrialBalanceWriter', () => {
  it('writes 21-column dual-year trial balance with adjusted balance and grand total', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Trial Balance');
    const tb: ParsedTrialBalance = {
      rows: [{
        rowIndex: 0,
        rawLabel: 'Share Capital',
        displayLabel: 'Share Capital',
        nfrsCategory: 'share_capital',
        openingDr: 0, openingCr: 0,
        duringDr: 0, duringCr: 0,
        adjustmentDr: 0, adjustmentCr: 0,
        closingDr: 0, closingCr: 500_000,
        isGroupRow: false, parentGroup: '', rawIndentSpaces: 0,
        matchMethod: 'exact', confidence: 100, needsReview: false, userOverride: false,
      }],
      companyName: 'Test Co',
      fiscalYear: '2081/82',
      isBalanced: true,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      warnings: [],
    };
    writeMesFormatTrialBalance(ws, tb, SAMPLE_COMPANY);
    assert.equal(ws.columnCount, 21);
    assert.equal(String(ws.getRow(5).getCell(8).value), 'Adjusted Balance');
    assert.ok(String(ws.getRow(1).getCell(1).value).includes('Test') || String(ws.getRow(1).getCell(1).value).length > 0);
    let grandTotalRow = 0;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (ws.getRow(r).getCell(1).value === 'GRAND TOTAL') {
        grandTotalRow = r;
        break;
      }
    }
    assert.ok(grandTotalRow > 0);
    const buffer = await wb.xlsx.writeBuffer();
    assert.ok(Buffer.from(buffer).length > 1000);
  });
});
