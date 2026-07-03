// src/types/financials.ts

export interface BalanceSheet {
  // Non-Current Assets
  nca_ppe: number;
  nca_investments: number;
  nca_receivables: number;
  nca_other: number;
  totalNonCurrentAssets: number;
  // Current Assets
  ca_investments: number;
  ca_inventories: number;
  ca_tradeReceivables: number;
  ca_cashAndEquivalents: number;
  ca_other: number;
  totalCurrentAssets: number;
  totalAssets: number;
  // Equity
  eq_shareCapital: number;
  eq_reserves: number;
  eq_retainedEarnings: number;
  totalEquity: number;
  // Non-Current Liabilities
  ncl_borrowings: number;
  ncl_employeeBenefits: number;
  ncl_provisions: number;
  ncl_deferredTax: number;
  totalNonCurrentLiabilities: number;
  // Current Liabilities
  cl_borrowings: number;
  cl_tradePayables: number;
  cl_incomeTaxPayable: number;
  cl_provisions: number;
  cl_other: number;
  totalCurrentLiabilities: number;
  totalEquityAndLiabilities: number;
  checkDifference: number;
  // Previous Year (all fields suffixed _py)
  nca_ppe_py?: number;
  nca_investments_py?: number;
  nca_receivables_py?: number;
  nca_other_py?: number;
  totalNonCurrentAssets_py?: number;
  ca_investments_py?: number;
  ca_inventories_py?: number;
  ca_tradeReceivables_py?: number;
  ca_cashAndEquivalents_py?: number;
  ca_other_py?: number;
  totalCurrentAssets_py?: number;
  totalAssets_py?: number;
  eq_shareCapital_py?: number;
  eq_reserves_py?: number;
  eq_retainedEarnings_py?: number;
  totalEquity_py?: number;
  ncl_borrowings_py?: number;
  ncl_employeeBenefits_py?: number;
  ncl_provisions_py?: number;
  ncl_deferredTax_py?: number;
  totalNonCurrentLiabilities_py?: number;
  cl_borrowings_py?: number;
  cl_tradePayables_py?: number;
  cl_incomeTaxPayable_py?: number;
  cl_provisions_py?: number;
  cl_other_py?: number;
  totalCurrentLiabilities_py?: number;
  totalEquityAndLiabilities_py?: number;
  checkDifference_py?: number;
}

export interface IncomeStatement {
  revenue: number;
  interestIncome: number;
  otherIncome: number;
  totalIncome: number;
  materialConsumed: number;
  directExpenses: number;
  employeeBenefitExpense: number;
  financeCharges: number;
  depreciation: number;
  impairment: number;
  adminAndOtherExpenses: number;
  totalExpenses: number;
  profitBeforeStaffBonus: number;
  staffBonus: number;
  profitBeforeTax: number;
  incomeTaxExpense: number;
  netProfit: number;
  // Previous Year
  revenue_py?: number;
  interestIncome_py?: number;
  otherIncome_py?: number;
  totalIncome_py?: number;
  materialConsumed_py?: number;
  directExpenses_py?: number;
  employeeBenefitExpense_py?: number;
  financeCharges_py?: number;
  depreciation_py?: number;
  impairment_py?: number;
  adminAndOtherExpenses_py?: number;
  totalExpenses_py?: number;
  profitBeforeStaffBonus_py?: number;
  staffBonus_py?: number;
  profitBeforeTax_py?: number;
  incomeTaxExpense_py?: number;
  netProfit_py?: number;
}

export interface ChangesInEquity {
  cyOpeningShareCapital?: number;
  cyOpeningSharePremium?: number;
  cyOpeningGeneralReserve?: number;
  cyOpeningRetainedEarnings?: number;
  cyOpeningTotal?: number;
  cyNetProfit?: number;
  cyShareCapitalIssued?: number;
  cySharePremiumReceived?: number;
  cyTransferToReserve?: number;
  cyDividends?: number;
  cyClosingShareCapital?: number;
  cyClosingSharePremium?: number;
  cyClosingGeneralReserve?: number;
  cyClosingRetainedEarnings?: number;
  cyClosingTotal?: number;
}

export interface CashFlowStatement {
  profitBeforeTax: number;
  addDepreciation: number;
  addImpairment: number;
  lessInterestIncome: number;
  lessDividendIncome: number;
  addInterestExpense: number;
  addLossOnDisposal: number;
  lessGainOnDisposal: number;
  addFVLossOnInvestment: number;
  lessFVGainOnInvestment: number;
  decreaseIncreaseReceivables: number;
  decreaseIncreaseInventory: number;
  decreaseIncreaseOtherCurrentAssets: number;
  increaseDecreasePayables: number;
  increaseDecreaseIncomeTaxPayable: number;
  increaseDecreaseEmployeeLiability: number;
  increaseDecreaseProvisions: number;
  cashGeneratedFromOperations: number;
  interestPaid: number;
  incomeTaxPaid: number;
  netCashFromOperating: number;
  proceedsFromPPEDisposal: number;
  proceedsFromInvestmentDisposal?: number;
  interestReceived: number;
  dividendReceived: number;
  purchaseOfPPE: number;
  purchaseOfInvestments: number;
  netCashFromInvesting: number;
  proceedsFromShareIssue: number;
  proceedsFromBorrowingsNonCurrent: number;
  proceedsFromBorrowingsCurrent: number;
  repaymentOfBorrowingsNonCurrent: number;
  repaymentOfBorrowingsCurrent: number;
  dividendPaid: number;
  netCashFromFinancing: number;
  netIncreaseDecrease: number;
  openingCash: number;
  closingCash: number;
  reconciliationDifference: number;
}

// NotesData is a large aggregate type — define sub-types for each note
export interface NotesData {
  note31_ppe: DepreciationSummaryForNote[];
  note32_investments: any;
  note33_tradeReceivables: any;
  note34_otherReceivables?: any;
  note34_otherCurrentAssets?: any;
  note35_otherNonCurrentAssets?: any;
  note35_biologicalAssets?: any;
  note36_otherCurrentAssets?: any;
  note36_heldForSale?: any;
  note37_inventories: any;
  note38_cashAndEquivalents?: any;
  note38_cashEquivalents?: any;
  note39_shareCapital: any;
  note310_reserves: any;
  note311_borrowings: any;
  note312_employeeBenefits: any;
  note313_tradePayables: any;
  note314_provisions?: any;
  note314_taxComputation?: any;
  note315_revenue?: any;
  note316_dividendPayable?: any;
  note317_revenue?: any;
  note317_revenueDetailed?: any;
  note318_materialConsumed: any;
  note319_directExpenses?: any;
  note319_otherIncome?: any;
  note320_employeeBenefitExpenses?: any;
  note320_employeeExpenses?: any;
  note321_impairment?: any;
  note321_depreciation?: any;
  note322_adminExpenses: any;
  note323_incomeTax?: any;
  note323_taxExpense?: any;
  note324_relatedParty?: any;
  note325_contingencies?: any;
  note326_subsequentEvents?: any;
  [key: string]: any;
}

import type { DepreciationSummary } from './adjustments';
type DepreciationSummaryForNote = DepreciationSummary;
