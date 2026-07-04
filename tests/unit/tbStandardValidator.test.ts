import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { generateTrialBalanceTemplate } from '../../server/services/tbTemplateWriter.js';
import { validateStandardTemplate } from '../../server/services/tbStandardValidator.js';
import { HEADER_ROW_INDEX } from '../../server/services/tbStandardSchema.js';

describe('tbStandardValidator', () => {
  it('accepts an untouched generated standard template', async () => {
    const buffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const result = validateStandardTemplate(workbook);
    assert.equal(result.isStandardFormat, true);
    assert.equal(result.issues.filter((i) => i.severity === 'error').length, 0);
    assert.ok(result.totalExpectedAccounts > 0);
    assert.equal(result.matchedAccountCount, result.totalExpectedAccounts);
  });

  it('detects renamed headers', async () => {
    const buffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet('Trial Balance')!;
    ws.getRow(HEADER_ROW_INDEX).getCell(4).value = 'Debit';
    const result = validateStandardTemplate(workbook);
    assert.equal(result.isStandardFormat, false);
    const headerIssue = result.issues.find((i) => i.category === 'headers' && i.severity === 'error');
    assert.ok(headerIssue);
    assert.match(headerIssue!.message, /During Dr\./);
  });

  it('detects missing section headers', async () => {
    const buffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet('Trial Balance')!;
    ws.spliceRows(6, 1);
    const result = validateStandardTemplate(workbook);
    assert.equal(result.isStandardFormat, false);
    const sectionIssue = result.issues.find((i) => i.category === 'sections' && i.severity === 'error');
    assert.ok(sectionIssue);
    assert.ok(result.missingSections.length > 0);
  });

  it('detects Dr/Cr closing imbalance', async () => {
    const buffer = await generateTrialBalanceTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.getWorksheet('Trial Balance')!;
    for (let rowNum = HEADER_ROW_INDEX + 2; rowNum <= ws.rowCount; rowNum++) {
      const label = String(ws.getRow(rowNum).getCell(1).value ?? '');
      if (label && label !== label.toUpperCase()) {
        ws.getRow(rowNum).getCell(9).value = 500000;
        ws.getRow(rowNum).getCell(10).value = 0;
        break;
      }
    }
    const result = validateStandardTemplate(workbook);
    assert.equal(result.isStandardFormat, false);
    const balanceIssue = result.issues.find((i) => i.category === 'balances' && i.severity === 'error');
    assert.ok(balanceIssue);
  });
});
