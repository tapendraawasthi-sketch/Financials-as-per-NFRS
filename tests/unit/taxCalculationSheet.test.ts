import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { writeTaxCalculationSheet } from '../../server/services/excelWriter.js';
import type { IncomeStatement } from '../../src/types/index.js';

const minimalIS: IncomeStatement = {
  revenue: 2_000_000, revenue_py: 0,
  interestIncome: 0, interestIncome_py: 0,
  otherIncome: 0, otherIncome_py: 0,
  totalIncome: 2_000_000, totalIncome_py: 0,
  materialConsumed: 800_000, materialConsumed_py: 0,
  directExpenses: 0, directExpenses_py: 0,
  employeeBenefitExpense: 300_000, employeeBenefitExpense_py: 0,
  financeCharges: 0, financeCharges_py: 0,
  depreciation: 100_000, depreciation_py: 0,
  impairment: 0, impairment_py: 0,
  adminAndOtherExpenses: 150_000, adminAndOtherExpenses_py: 0,
  totalExpenses: 1_350_000, totalExpenses_py: 0,
  profitBeforeStaffBonus: 650_000, profitBeforeStaffBonus_py: 0,
  staffBonus: 0, staffBonus_py: 0,
  profitBeforeTax: 650_000, profitBeforeTax_py: 0,
  incomeTaxExpense: 0, incomeTaxExpense_py: 0,
  netProfit: 650_000, netProfit_py: 0,
};

function formulaOf(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v && typeof v === 'object' && 'formula' in v) return String((v as { formula: string }).formula);
  return '';
}

describe('writeTaxCalculationSheet Section 118 days late', () => {
  it('uses days-late pro-rata interest formula in installment schedule', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tax Calculation');
    writeTaxCalculationSheet(
      ws,
      {
        companyName: 'Test Co',
        address: 'Kathmandu',
        incomeStatement: minimalIS,
        taxRate: 0.25,
        advanceTaxPayments: [100_000, 200_000, 300_000],
        advanceTaxDaysLate: [150, 90, 0],
      },
      '2081/82',
    );

    let interestFormula = '';
    for (let r = 1; r <= ws.rowCount; r++) {
      const f = formulaOf(ws.getRow(r).getCell(7));
      if (f.includes('/365')) {
        interestFormula = f;
        break;
      }
    }
    assert.match(interestFormula, /0\.15\*F\d+\/365/);

    const buffer = await wb.xlsx.writeBuffer();
    assert.ok(Buffer.from(buffer).length > 2000);
  });
});
