export interface BalanceSheet {
  // Non-Current Assets
  ppe: number; ppeNote: string;
  investments: number;
  receivablesNCA: number;
  otherNCA: number;
  totalNCA: number;
  // Current Assets
  investmentsCA: number;
  inventories: number;
  tradeReceivables: number;
  cashAndEquivalents: number;
  otherCA: number;
  totalCA: number;
  totalAssets: number;
  // Equity
  shareCapital: number;
  reserves: number;
  retainedEarnings: number;
  totalEquity: number;
  // Non-Current Liabilities
  borrowingsNCL: number;
  employeeBenefitsNCL: number;
  provisionsNCL: number;
  totalNCL: number;
  // Current Liabilities
  borrowingsCL: number;
  tradePayables: number;
  incomeTaxLiability: number;
  employeeBenefitsCL: number;
  provisionsCL: number;
  otherCL: number;
  totalCL: number;
  totalLiabilities: number;
  totalEquityAndLiabilities: number;
  // Previous Year
  previous: Partial<BalanceSheet>;
  isBalanced: boolean;
}

export interface IncomeStatement {
  revenueFromOperations: number;
  interestIncome: number;
  otherIncome: number;
  totalIncome: number;
  materialConsumed: number;
  directExpenses: number;
  employeeBenefitExpenses: number;
  interestExpenses: number;
  depreciation: number;
  impairment: number;
  adminAndOtherExpenses: number;
  totalExpenses: number;
  profitBeforeStaffBonus: number;
  staffBonus: number;
  profitBeforeTax: number;
  incomeTaxExpense: number;
  netProfit: number;
  previous: Partial<IncomeStatement>;
}

export interface ChangesInEquity {
  rows: Array<{
    label: string;
    shareCapital: number;
    sharePremium: number;
    retainedEarnings: number;
    otherReserves: number;
    total: number;
  }>;
  previousRows: ChangesInEquity['rows'];
}

export interface CashFlowStatement {
  // Operating
  profitBeforeTax: number;
  addDepreciation: number;
  addImpairment: number;
  lessInterestIncome: number;
  lessDividendIncome: number;
  addInterestExpense: number;
  gainLossOnDisposal: number;
  workingCapitalChanges: Record<string, number>;
  cashFromOperationsBeforeTax: number;
  interestPaid: number;
  taxPaid: number;
  netOperatingCF: number;
  // Investing
  proceedsFromSalePPE: number;
  proceedsFromSaleInvestments: number;
  acquisitionOfPPE: number;
  acquisitionOfInvestments: number;
  interestReceived: number;
  dividendReceived: number;
  netInvestingCF: number;
  // Financing
  proceedsFromShareIssue: number;
  proceedsFromBorrowingsNCL: number;
  repaymentOfBorrowingsNCL: number;
  proceedsFromBorrowingsCL: number;
  dividendPaid: number;
  netFinancingCF: number;
  // Summary
  netChangeInCash: number;
  openingCash: number;
  closingCash: number;
  previous: Partial<CashFlowStatement>;
}

export interface PPENote {
  classes: Array<{
    name: string;
    costOpeningDr: number; costOpeningCr: number;
    additions: number;
    disposals: number;
    costClosing: number;
    accumDepnOpening: number;
    depreciationCharged: number;
    impairmentLosses: number;
    disposalDepn: number;
    accumDepnClosing: number;
    carryingAmountOpening: number;
    carryingAmountClosing: number;
  }>;
  totals: PPENote['classes'][0];
  depreciationRates: Record<string, number>;
  depreciationMethod: string;
  securityNote: string;
  WIPNote: string;
}

export interface InvestmentsNote {
  listedShares: {
    openingBalance: number; additions: number; disposals: number;
    closingBalance: number; fairValueGainLoss: number;
    netCarryingAmount: number; nonCurrentPortion: number; currentPortion: number;
  };
  otherInvestments: {
    costOpening: number; additions: number; disposals: number; costClosing: number;
    provisionOpening: number; provisionMovement: number; provisionClosing: number;
    netCarryingAmount: number; nonCurrentPortion: number; currentPortion: number;
  };
}

export interface TradeReceivablesNote {
  tradeDebtors: { balanceCY: number; balancePY: number };
  relatedPartyReceivables: { balanceCY: number; balancePY: number };
  provisionForImpairment: { opening: number; charge: number; utilisation: number; closing: number };
  netReceivables: { balanceCY: number; balancePY: number };
  ageing: Array<{ category: string; amountCY: number; amountPY: number }>;
}

export interface OtherReceivablesNote {
  items: Array<{ description: string; balanceCY: number; balancePY: number }>;
  total: { balanceCY: number; balancePY: number };
}

export interface OtherNCANote {
  items: Array<{ description: string; balanceCY: number; balancePY: number }>;
  total: { balanceCY: number; balancePY: number };
}

export interface OtherCANote {
  items: Array<{ description: string; balanceCY: number; balancePY: number }>;
  total: { balanceCY: number; balancePY: number };
}

export interface InventoriesNote {
  rawMaterials: { balanceCY: number; balancePY: number };
  workInProgress: { balanceCY: number; balancePY: number };
  finishedGoods: { balanceCY: number; balancePY: number };
  total: { balanceCY: number; balancePY: number };
  impairment: { amountCY: number; amountPY: number };
}

export interface CashNote {
  cashInHand: { balanceCY: number; balancePY: number };
  bankAccounts: Array<{ bankName: string; accountNumber: string; balanceCY: number; balancePY: number }>;
  fixedDeposits: { balanceCY: number; balancePY: number };
  total: { balanceCY: number; balancePY: number };
}

export interface ShareCapitalNote {
  authorizedShares: number;
  authorizedAmount: number;
  issuedSharesPY: number;
  issuedSharesCY: number;
  issuedAmountPY: number;
  issuedAmountCY: number;
  parValue: number;
  sharesIssuedDuringYear: number;
}

export interface ReservesNote {
  generalReserve: { balanceCY: number; balancePY: number };
  capitalReserve: { balanceCY: number; balancePY: number };
  revaluationReserve: { balanceCY: number; balancePY: number };
  otherReserves: { balanceCY: number; balancePY: number };
  total: { balanceCY: number; balancePY: number };
}

export interface BorrowingsNote {
  nonCurrent: Array<{ lender: string; balanceCY: number; balancePY: number; maturityDate: string; rate: number }>;
  current: Array<{ lender: string; balanceCY: number; balancePY: number; type: string }>;
  totalNonCurrent: { balanceCY: number; balancePY: number };
  totalCurrent: { balanceCY: number; balancePY: number };
}

export interface EmpBenefitLiabilityNote {
  gratuity: { balanceCY: number; balancePY: number };
  leaveEncashment: { balanceCY: number; balancePY: number };
  pfPayable: { balanceCY: number; balancePY: number };
  bonusPayable: { balanceCY: number; balancePY: number };
  total: { balanceCY: number; balancePY: number };
}

export interface TradePayablesNote {
  tradeCreditors: { balanceCY: number; balancePY: number };
  advanceFromCustomers: { balanceCY: number; balancePY: number };
  relatedPartyPayables: { balanceCY: number; balancePY: number };
  total: { balanceCY: number; balancePY: number };
}

export interface TaxLiabilityNote {
  incomeTaxPayable: { balanceCY: number; balancePY: number };
  tdsPayable: { balanceCY: number; balancePY: number };
  vatPayable: { balanceCY: number; balancePY: number };
  advanceTax: { balanceCY: number; balancePY: number };
  total: { balanceCY: number; balancePY: number };
}

export interface ProvisionsNote {
  items: Array<{ description: string; opening: number; addition: number; utilisation: number; closing: number }>;
  total: { opening: number; addition: number; utilisation: number; closing: number };
}

export interface OtherCLNote {
  items: Array<{ description: string; balanceCY: number; balancePY: number }>;
  total: { balanceCY: number; balancePY: number };
}

export interface RevenueNote {
  salesRevenue: { amountCY: number; amountPY: number };
  serviceRevenue: { amountCY: number; amountPY: number };
  total: { amountCY: number; amountPY: number };
}

export interface MaterialConsumedNote {
  openingStock: number;
  purchases: number;
  closingStock: number;
  materialConsumed: number;
  previous: { openingStock: number; purchases: number; closingStock: number; materialConsumed: number };
}

export interface DirectExpensesNote {
  items: Array<{ description: string; amountCY: number; amountPY: number }>;
  total: { amountCY: number; amountPY: number };
}

export interface EmpBenefitExpensesNote {
  salaries: { amountCY: number; amountPY: number };
  allowances: { amountCY: number; amountPY: number };
  pfSsf: { amountCY: number; amountPY: number };
  bonus: { amountCY: number; amountPY: number };
  leaveEncashment: { amountCY: number; amountPY: number };
  other: { amountCY: number; amountPY: number };
  total: { amountCY: number; amountPY: number };
}

export interface ImpairmentNote {
  onDebtors: { amountCY: number; amountPY: number };
  onInvestments: { amountCY: number; amountPY: number };
  onPPE: { amountCY: number; amountPY: number };
  total: { amountCY: number; amountPY: number };
}

export interface AdminExpensesNote {
  items: Array<{ description: string; amountCY: number; amountPY: number }>;
  total: { amountCY: number; amountPY: number };
}

export interface TaxExpenseNote {
  currentTax: { amountCY: number; amountPY: number };
  deferredTax: { amountCY: number; amountPY: number };
  total: { amountCY: number; amountPY: number };
  reconciliation: Array<{ description: string; amount: number }>;
}

export interface RelatedPartyNote {
  parties: Array<{
    name: string;
    relationship: string;
    receivableCY: number; receivablePY: number;
    payableCY: number; payablePY: number;
    purchases: number; sales: number;
    terms: string;
  }>;
}

export interface ContingenciesNote {
  items: Array<{ description: string; nature: string; amount: number }>;
}

export interface SubsequentEventsNote {
  items: Array<{ description: string; date: string; impact: string }>;
}

export interface NotesData {
  note31_ppe: PPENote;
  note32_investments: InvestmentsNote;
  note33_tradeReceivables: TradeReceivablesNote;
  note34_otherReceivables: OtherReceivablesNote;
  note35_otherNCA: OtherNCANote;
  note36_otherCA: OtherCANote;
  note37_inventories: InventoriesNote;
  note38_cashEquivalents: CashNote;
  note39_shareCapital: ShareCapitalNote;
  note310_reserves: ReservesNote;
  note311_borrowings: BorrowingsNote;
  note312_employeeBenefitLiability: EmpBenefitLiabilityNote;
  note313_tradePayables: TradePayablesNote;
  note314_incomeTaxLiability: TaxLiabilityNote;
  note315_provisions: ProvisionsNote;
  note316_otherCL: OtherCLNote;
  note317_revenue: RevenueNote;
  note318_materialConsumed: MaterialConsumedNote;
  note319_directExpenses: DirectExpensesNote;
  note320_employeeBenefitExpenses: EmpBenefitExpensesNote;
  note321_impairment: ImpairmentNote;
  note322_adminExpenses: AdminExpensesNote;
  note323_taxExpense: TaxExpenseNote;
  note324_relatedParty: RelatedPartyNote;
  note325_contingencies: ContingenciesNote;
  note326_subsequentEvents: SubsequentEventsNote;
  accountingPoliciesText: string;
}
