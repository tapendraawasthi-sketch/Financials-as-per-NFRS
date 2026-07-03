import { writeFile } from 'fs/promises';
import { generateNFRSWorkbook } from './server/services/excelWriter.js';
import { SAMPLE_COMPANY, SAMPLE_EXPECTED } from './src/data/sampleData.js';

async function main() {
  console.log('🔧 Starting Excel generation test...');
  console.log('   Company:', SAMPLE_COMPANY.companyName);
  console.log('   Fiscal Year:', SAMPLE_COMPANY.fiscalYear.bsFY);

  // Minimal mock financial data for testing
  const mockParams = {
    company: SAMPLE_COMPANY,
    balanceSheet: {
      totalAssets: { cy: SAMPLE_EXPECTED.totalAssets, py: 0 },
      totalCurrentAssets: { cy: SAMPLE_EXPECTED.totalCurrentAssets, py: 0 },
      totalNCA: { cy: SAMPLE_EXPECTED.totalNCA, py: 0 },
      totalLiabilitiesAndEquity: { cy: SAMPLE_EXPECTED.totalLiabilitiesAndEquity, py: 0 },
      totalCurrentLiabilities: { cy: SAMPLE_EXPECTED.totalCurrentLiabilities, py: 0 },
      totalNCL: { cy: SAMPLE_EXPECTED.totalNCL, py: 0 },
      totalEquity: { cy: SAMPLE_EXPECTED.totalEquity, py: 0 },
      checkDifference: 0,
    },
    incomeStatement: {
      totalIncome: { cy: SAMPLE_EXPECTED.totalRevenue, py: 0 },
      totalExpenses: { cy: SAMPLE_EXPECTED.totalPurchases, py: 0 },
      profitBeforeTax: { cy: SAMPLE_EXPECTED.profitBeforeTax, py: 0 },
      netProfit: { cy: SAMPLE_EXPECTED.profitBeforeTax - SAMPLE_EXPECTED.incomeTax, py: 0 },
    },
    trialBalance: { rows: [], stats: { totalDebit: 0, totalCredit: 0, rowCount: 0 } },
    adjustments: { journalEntries: [] },
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
    },
    changesInEquity: { shareCapital: 0, sharePremium: 0, generalReserve: 0, retainedEarnings: 0, openingRetainedEarnings: 0, profitForTheYear: 0, closingRetainedEarnings: 0 },
    cashFlow: { profitBeforeTax: 0, addDepreciation: 0, addImpairment: 0, lessInterestIncome: 0, lessDividendIncome: 0, addInterestExpense: 0, addLossOnDisposal: 0, lessGainOnDisposal: 0, addFVLossOnInvestment: 0, lessFVGainOnInvestment: 0, decreaseIncreaseReceivables: 0, decreaseIncreaseInventory: 0, decreaseIncreaseOtherCurrentAssets: 0, increaseDecreasePayables: 0, increaseDecreaseIncomeTaxPayable: 0, increaseDecreaseEmployeeLiability: 0, cashGeneratedFromOperations: 0, interestPaid: 0, incomeTaxPaid: 0, netCashFromOperating: 0, proceedsFromPPEDisposal: 0, interestReceived: 0, dividendReceived: 0, purchaseOfPPE: 0, purchaseOfInvestments: 0, netCashFromInvesting: 0, proceedsFromShareIssue: 0, proceedsFromBorrowingsNonCurrent: 0, repaymentOfBorrowingsNonCurrent: 0, proceedsFromBorrowingsCurrent: 0, repaymentOfBorrowingsCurrent: 0, dividendPaid: 0, netCashFromFinancing: 0, netIncreaseDecrease: 0, openingCash: 0, closingCash: 0, reconciliationDifference: 0 },
  };

  const buffer = await generateNFRSWorkbook(mockParams as Parameters<typeof generateNFRSWorkbook>[0]);

  const outputPath = 'test-output.xlsx';
  await writeFile(outputPath, buffer);

  const sizeKB = Math.round(buffer.length / 1024);
  console.log(`\n✅ Excel generated successfully!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`\n💡 Open ${outputPath} in Microsoft Excel or LibreOffice to verify.`);
}

main().catch((err) => {
  console.error('\n❌ Excel generation test FAILED:');
  console.error(err);
  process.exit(1);
});
