import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import {
  validateMesWorkbookStructure,
  compareSheetOrderToReference,
  mesReferenceXlsxPath,
  MES_WORKBOOK_SHEET_ORDER,
  MES_CONSOLIDATED_NOTES_SHEET,
} from '../../server/services/mesWorkbookContract.js';
import { generateNFRSWorkbook } from '../../server/services/excelWriter.js';
import { SAMPLE_COMPANY } from '../../src/data/sampleData.js';
import type { BalanceSheet, CashFlowStatement, ChangesInEquity, IncomeStatement } from '../../src/types/index.js';

const minimalBS: BalanceSheet = {
  nca_ppe: 1_000_000, nca_ppe_py: 0,
  nca_investments: 0, nca_investments_py: 0,
  nca_receivables: 0, nca_receivables_py: 0,
  nca_other: 0, nca_other_py: 0,
  totalNonCurrentAssets: 1_000_000, totalNonCurrentAssets_py: 0,
  ca_investments: 0, ca_investments_py: 0,
  ca_inventories: 0, ca_inventories_py: 0,
  ca_tradeReceivables: 0, ca_tradeReceivables_py: 0,
  ca_cashAndEquivalents: 0, ca_cashAndEquivalents_py: 0,
  ca_other: 0, ca_other_py: 0,
  totalCurrentAssets: 0, totalCurrentAssets_py: 0,
  totalAssets: 1_000_000, totalAssets_py: 0,
  eq_shareCapital: 500_000, eq_shareCapital_py: 0,
  eq_reserves: 0, eq_reserves_py: 0,
  eq_retainedEarnings: 500_000, eq_retainedEarnings_py: 0,
  totalEquity: 1_000_000, totalEquity_py: 0,
  ncl_borrowings: 0, ncl_borrowings_py: 0,
  ncl_employeeBenefits: 0, ncl_employeeBenefits_py: 0,
  ncl_provisions: 0, ncl_provisions_py: 0,
  totalNonCurrentLiabilities: 0, totalNonCurrentLiabilities_py: 0,
  cl_borrowings: 0, cl_borrowings_py: 0,
  cl_tradePayables: 0, cl_tradePayables_py: 0,
  cl_incomeTaxPayable: 0, cl_incomeTaxPayable_py: 0,
  cl_provisions: 0, cl_provisions_py: 0,
  cl_other: 0, cl_other_py: 0,
  totalCurrentLiabilities: 0, totalCurrentLiabilities_py: 0,
  totalEquityAndLiabilities: 1_000_000, totalEquityAndLiabilities_py: 0,
};

const minimalIS: IncomeStatement = {
  revenue: 1_000_000, revenue_py: 0,
  interestIncome: 0, interestIncome_py: 0,
  otherIncome: 0, otherIncome_py: 0,
  totalIncome: 1_000_000, totalIncome_py: 0,
  materialConsumed: 0, materialConsumed_py: 0,
  directExpenses: 0, directExpenses_py: 0,
  employeeBenefitExpense: 0, employeeBenefitExpense_py: 0,
  financeCharges: 0, financeCharges_py: 0,
  depreciation: 0, depreciation_py: 0,
  impairment: 0, impairment_py: 0,
  adminAndOtherExpenses: 0, adminAndOtherExpenses_py: 0,
  totalExpenses: 0, totalExpenses_py: 0,
  profitBeforeStaffBonus: 200_000, profitBeforeStaffBonus_py: 0,
  staffBonus: 0, staffBonus_py: 0,
  profitBeforeTax: 200_000, profitBeforeTax_py: 0,
  incomeTaxExpense: 50_000, incomeTaxExpense_py: 0,
  netProfit: 150_000, netProfit_py: 0,
};

const minimalCF: CashFlowStatement = {
  profitBeforeTax: 200_000,
  addDepreciation: 0, addImpairment: 0,
  lessInterestIncome: 0, lessDividendIncome: 0, addInterestExpense: 0,
  addLossOnDisposal: 0, lessGainOnDisposal: 0,
  addFVLossOnInvestment: 0, lessFVGainOnInvestment: 0,
  decreaseIncreaseReceivables: 0, decreaseIncreaseInventory: 0,
  decreaseIncreaseOtherCurrentAssets: 0, increaseDecreasePayables: 0,
  increaseDecreaseIncomeTaxPayable: 0, increaseDecreaseEmployeeLiability: 0,
  cashGeneratedFromOperations: 200_000,
  interestPaid: 0, incomeTaxPaid: 0,
  netCashFromOperating: 200_000,
  proceedsFromPPEDisposal: 0, interestReceived: 0, dividendReceived: 0,
  purchaseOfPPE: 0, purchaseOfInvestments: 0,
  netCashFromInvesting: 0,
  proceedsFromShareIssue: 0, proceedsFromBorrowingsNonCurrent: 0,
  repaymentOfBorrowingsNonCurrent: 0, proceedsFromBorrowingsCurrent: 0,
  repaymentOfBorrowingsCurrent: 0, dividendPaid: 0,
  netCashFromFinancing: 0,
  netIncreaseDecrease: 200_000,
  openingCash: 0, closingCash: 0,
  reconciliationDifference: 0,
};

const minimalCE: ChangesInEquity = {
  cyOpeningShareCapital: 500_000, cyOpeningSharePremium: 0,
  cyOpeningGeneralReserve: 0, cyOpeningRetainedEarnings: 350_000, cyOpeningTotal: 850_000,
  cyNetProfit: 150_000,
  cyShareCapitalIssued: 0, cySharePremiumReceived: 0,
  cyTransferToReserve: 0, cyDividends: 0,
  cyClosingShareCapital: 500_000, cyClosingSharePremium: 0,
  cyClosingGeneralReserve: 0, cyClosingRetainedEarnings: 500_000, cyClosingTotal: 1_000_000,
};

const minimalNotes = {
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
  note323_incomeTax: {
    profitBeforeTax: 200_000, addDisallowableExpenses: {}, lessAllowableExpenses: {},
    taxableIncome: 200_000, taxRate: 0.25, currentTax: 50_000, advanceTaxPaid: 0, netTaxPayable: 50_000,
  },
  note324_relatedParty: { relatedParties: [] },
  note325_contingencies: { defaultText: 'No contingencies.' },
  note326_subsequentEvents: { defaultText: 'No subsequent events.' },
};

async function loadGeneratedWorkbook() {
  const buffer = await generateNFRSWorkbook({
    company: SAMPLE_COMPANY,
    trialBalance: {
      rows: [],
      companyName: 'Test',
      fiscalYear: '2081/82',
      isBalanced: true,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      warnings: [],
    },
    balanceSheet: minimalBS,
    incomeStatement: minimalIS,
    changesInEquity: minimalCE,
    cashFlow: minimalCF,
    notes: minimalNotes as any,
    adjustments: {
      assetRegister: [],
      investmentAdjustments: [],
      disallowedForTax: [{ description: 'Entertainment', amount: 5000, section: 'Sec 21', side: 'expense' as const }],
      advanceTax1: 10_000,
      advanceTax2: 20_000,
      advanceTax3: 30_000,
      advanceTaxDaysLate1: 150,
      manualJournals: [],
      journalEntries: [],
      taxDepPool: [],
      inventoryDetails: {
        rawMaterialsCY: 0, rawMaterialsPY: 0, wipCY: 0, wipPY: 0, finishedGoodsCY: 0, finishedGoodsPY: 0,
      },
    } as any,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe('mesWorkbookContract', () => {
  it('defines the MEs reference sheet order (26 tabs)', () => {
    assert.equal(MES_WORKBOOK_SHEET_ORDER.length, 26);
    assert.ok(MES_WORKBOOK_SHEET_ORDER.includes(MES_CONSOLIDATED_NOTES_SHEET));
    assert.equal(MES_WORKBOOK_SHEET_ORDER.indexOf('Tax Notes'), MES_WORKBOOK_SHEET_ORDER.indexOf('Disallow for Tax') + 1);
  });

  it('validates generated NFRS workbook against structural contract', async () => {
    const wb = await loadGeneratedWorkbook();
    const result = validateMesWorkbookStructure(wb);
    if (!result.ok) {
      assert.fail(`Workbook structure errors:\n${result.errors.join('\n')}`);
    }
    assert.equal(result.sheetNames.length, 26);
  });

  it('optionally compares to reference xlsx when MES_REFERENCE_XLSX_PATH is set', async () => {
    const refPath = mesReferenceXlsxPath();
    if (!refPath || !fs.existsSync(refPath)) {
      return;
    }
    const refWb = new ExcelJS.Workbook();
    await refWb.xlsx.readFile(refPath);
    const genWb = await loadGeneratedWorkbook();
    const refNames = refWb.worksheets.map((ws) => ws.name);
    const genNames = genWb.worksheets.map((ws) => ws.name);
    const orderErrors = compareSheetOrderToReference(genNames, refNames);
    assert.equal(orderErrors.length, 0, orderErrors.join('\n'));
  });
});
