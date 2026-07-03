import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  writeBalanceSheet,
  writeIncomeStatement,
  writeCashFlowStatement,
  writeChangesInEquity,
  generateNFRSWorkbook,
} from '../../server/services/excelWriter.js';
import { SAMPLE_COMPANY } from '../../src/data/sampleData.js';
import type { BalanceSheet, CashFlowStatement, ChangesInEquity, IncomeStatement } from '../../src/types/index.js';

const minimalBS: BalanceSheet = {
  nca_ppe: 1_000_000, nca_ppe_py: 900_000,
  nca_investments: 0, nca_investments_py: 0,
  nca_receivables: 50_000, nca_receivables_py: 40_000,
  nca_other: 0, nca_other_py: 0,
  totalNonCurrentAssets: 1_050_000, totalNonCurrentAssets_py: 940_000,
  ca_investments: 0, ca_investments_py: 0,
  ca_inventories: 200_000, ca_inventories_py: 180_000,
  ca_tradeReceivables: 300_000, ca_tradeReceivables_py: 250_000,
  ca_cashAndEquivalents: 150_000, ca_cashAndEquivalents_py: 120_000,
  ca_other: 0, ca_other_py: 0,
  totalCurrentAssets: 650_000, totalCurrentAssets_py: 550_000,
  totalAssets: 1_700_000, totalAssets_py: 1_490_000,
  eq_shareCapital: 500_000, eq_shareCapital_py: 500_000,
  eq_reserves: 50_000, eq_reserves_py: 50_000,
  eq_retainedEarnings: 800_000, eq_retainedEarnings_py: 600_000,
  totalEquity: 1_350_000, totalEquity_py: 1_150_000,
  ncl_borrowings: 200_000, ncl_borrowings_py: 200_000,
  ncl_employeeBenefits: 0, ncl_employeeBenefits_py: 0,
  ncl_provisions: 0, ncl_provisions_py: 0,
  totalNonCurrentLiabilities: 200_000, totalNonCurrentLiabilities_py: 200_000,
  cl_borrowings: 0, cl_borrowings_py: 0,
  cl_tradePayables: 100_000, cl_tradePayables_py: 100_000,
  cl_incomeTaxPayable: 50_000, cl_incomeTaxPayable_py: 40_000,
  cl_provisions: 0, cl_provisions_py: 0,
  cl_other: 0, cl_other_py: 0,
  totalCurrentLiabilities: 150_000, totalCurrentLiabilities_py: 140_000,
  totalEquityAndLiabilities: 1_700_000, totalEquityAndLiabilities_py: 1_490_000,
};

const minimalIS: IncomeStatement = {
  revenue: 2_000_000, revenue_py: 1_800_000,
  interestIncome: 10_000, interestIncome_py: 8_000,
  otherIncome: 5_000, otherIncome_py: 4_000,
  totalIncome: 2_015_000, totalIncome_py: 1_812_000,
  materialConsumed: 800_000, materialConsumed_py: 700_000,
  directExpenses: 200_000, directExpenses_py: 180_000,
  employeeBenefitExpense: 300_000, employeeBenefitExpense_py: 280_000,
  financeCharges: 20_000, financeCharges_py: 18_000,
  depreciation: 100_000, depreciation_py: 90_000,
  impairment: 0, impairment_py: 0,
  adminAndOtherExpenses: 150_000, adminAndOtherExpenses_py: 140_000,
  totalExpenses: 1_570_000, totalExpenses_py: 1_408_000,
  profitBeforeStaffBonus: 445_000, profitBeforeStaffBonus_py: 404_000,
  staffBonus: 44_500, staffBonus_py: 40_400,
  profitBeforeTax: 400_500, profitBeforeTax_py: 363_600,
  incomeTaxExpense: 100_125, incomeTaxExpense_py: 90_900,
  netProfit: 300_375, netProfit_py: 272_700,
};

const minimalCF: CashFlowStatement = {
  profitBeforeTax: 400_500,
  addDepreciation: 100_000, addImpairment: 0,
  lessInterestIncome: 10_000, lessDividendIncome: 0, addInterestExpense: 20_000,
  addLossOnDisposal: 0, lessGainOnDisposal: 0,
  addFVLossOnInvestment: 0, lessFVGainOnInvestment: 0,
  decreaseIncreaseReceivables: -50_000, decreaseIncreaseInventory: -20_000,
  decreaseIncreaseOtherCurrentAssets: 0, increaseDecreasePayables: 10_000,
  increaseDecreaseIncomeTaxPayable: 10_000, increaseDecreaseEmployeeLiability: 0,
  cashGeneratedFromOperations: 460_500,
  interestPaid: 20_000, incomeTaxPaid: 90_000,
  netCashFromOperating: 350_500,
  proceedsFromPPEDisposal: 0, interestReceived: 10_000, dividendReceived: 0,
  purchaseOfPPE: 0, purchaseOfInvestments: 0,
  netCashFromInvesting: 10_000,
  proceedsFromShareIssue: 0, proceedsFromBorrowingsNonCurrent: 0,
  repaymentOfBorrowingsNonCurrent: 0, proceedsFromBorrowingsCurrent: 0,
  repaymentOfBorrowingsCurrent: 0, dividendPaid: 0,
  netCashFromFinancing: 0,
  netIncreaseDecrease: 360_500,
  openingCash: 120_000, closingCash: 150_000,
  reconciliationDifference: 0,
};

const minimalCE: ChangesInEquity = {
  cyOpeningShareCapital: 500_000, cyOpeningSharePremium: 0,
  cyOpeningGeneralReserve: 50_000, cyOpeningRetainedEarnings: 600_000, cyOpeningTotal: 1_150_000,
  cyNetProfit: 300_375,
  cyShareCapitalIssued: 0, cySharePremiumReceived: 0,
  cyTransferToReserve: 0, cyDividends: 0,
  cyClosingShareCapital: 500_000, cyClosingSharePremium: 0,
  cyClosingGeneralReserve: 50_000, cyClosingRetainedEarnings: 900_375, cyClosingTotal: 1_450_375,
};

function formulaOf(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v && typeof v === 'object' && 'formula' in v) return String((v as { formula: string }).formula);
  return '';
}

describe('excelWriter', () => {
  it('writes IS subtotal and PBT/net-profit formulas', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Income Statement');
    const map = writeIncomeStatement(ws, minimalIS, SAMPLE_COMPANY);

    assert.match(formulaOf(ws.getRow(map.totalIncomeRow).getCell('C')), /^SUM\(/);
    assert.match(formulaOf(ws.getRow(map.totalExpensesRow).getCell('C')), /^SUM\(/);
    assert.equal(
      formulaOf(ws.getRow(map.profitBeforeTaxRow).getCell('C')),
      `C${map.totalIncomeRow}-C${map.totalExpensesRow}`,
    );
    assert.equal(
      formulaOf(ws.getRow(map.netProfitRow).getCell('C')),
      `C${map.profitBeforeTaxRow}-C${map.taxRow}`,
    );
  });

  it('writes BS section subtotal SUM formulas', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Balance Sheet');
    const map = writeBalanceSheet(ws, minimalBS, SAMPLE_COMPANY);

    assert.match(
      formulaOf(ws.getRow(map.totalNcaRow).getCell('C')),
      new RegExp(`SUM\\(C${map.ppeRow}:C${map.ncaOtherRow}\\)`),
    );
    assert.match(
      formulaOf(ws.getRow(map.totalCaRow).getCell('C')),
      new RegExp(`SUM\\(C${map.caInvestmentsRow}:C${map.caOtherRow}\\)`),
    );
    assert.match(
      formulaOf(ws.getRow(map.totalEquityRow).getCell('C')),
      new RegExp(`SUM\\(C${map.shareCapitalRow}:C${map.retainedEarningsRow}\\)`),
    );
  });

  it('tracks Change in Equity profit row for validation', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Change in Equity');
    const map = writeChangesInEquity(ws, minimalCE, SAMPLE_COMPANY);
    assert.equal(map.profitForYearRow, 7);
    assert.equal(ws.getRow(map.profitForYearRow).getCell(1).value, 'Profit for the Year');
  });

  it('generates a non-empty workbook buffer', async () => {
    const buffer = await generateNFRSWorkbook({
      company: SAMPLE_COMPANY,
      trialBalance: { rows: [], isBalanced: true, totalClosingDr: 0, totalClosingCr: 0, difference: 0 },
      balanceSheet: minimalBS,
      incomeStatement: minimalIS,
      cashFlow: minimalCF,
      changesInEquity: minimalCE,
      adjustments: { journalEntries: [], provisions: [] },
      notes: {
        note31_ppe: [],
        note33_tradeReceivables: { grossReceivables_cy: 0, grossReceivables_py: 0, provisionForDoubtful_cy: 0, provisionForDoubtful_py: 0, netReceivables_cy: 0, netReceivables_py: 0 },
        note34_otherReceivables: {},
        note35_otherNonCurrentAssets: {},
        note36_otherCurrentAssets: {},
        note37_inventories: { items: [], total_cy: 0, total_py: 0 },
        note38_cashAndEquivalents: { cashInHand_cy: 0, cashInHand_py: 0, bankBalances: [], total_cy: 0, total_py: 0 },
        note39_shareCapital: { authorized: 0, issued: 0, paidUp: 0 },
        note310_reserves: {},
        note311_borrowings: { nonCurrentBank: [], currentLoans: [], totalNonCurrent_cy: 0, totalNonCurrent_py: 0, totalCurrent_cy: 0, totalCurrent_py: 0 },
        note312_employeeBenefits: {},
        note313_tradePayables: {},
        note317_revenue: {},
        note318_materialConsumed: { openingInventory: 0, purchases: 0, closingInventory: 0, consumed: 0 },
        note319_directExpenses: {},
        note320_employeeBenefitExpenses: {},
        note321_impairment: [],
        note322_adminExpenses: {},
        note323_incomeTax: { profitBeforeTax: 0, addDisallowableExpenses: {}, lessAllowableExpenses: {}, taxableIncome: 0, taxRate: 0.25, currentTax: 0, advanceTaxPaid: 0, netTaxPayable: 0 },
        note324_relatedParty: { relatedParties: [] },
        note325_contingencies: { defaultText: 'No contingencies.' },
        note326_subsequentEvents: { defaultText: 'No subsequent events.' },
      },
      depreciationSummary: [],
    });
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10_000);
  });
});
