// ===== src/types/financials.ts =====
// TypeScript types for all four primary financial statements mandated by
// NAS for MEs 2018 (Sections 3–7) and for all accompanying notes (Sections
// 8, and model financial statement Notes 3.1–3.23).
//
// Design principles:
//   • Every statement type carries both current-year (cy) and previous-year
//     (py) figures so the writer service can populate both columns in a single
//     pass.
//   • The NotesData type is the single source of truth fed into the Excel
//     writer; each note sub-type maps 1:1 to the disclosure rows in the
//     MEs Financials Format template.
//   • All monetary amounts are in NPR (Nepalese Rupees) as whole numbers or
//     two-decimal floats — the Excel formatter handles thousands separators.

import type { DepreciationSummary, InvestmentAdjustment, ProvisionEntry } from './adjustments';

// ---------------------------------------------------------------------------
// 1. FinancialLineItem — a single row in a printed financial statement
// ---------------------------------------------------------------------------
export interface FinancialLineItem {
  /** Stable row identifier used for formula cross-referencing */
  id: string;
  /** Display text, e.g. "Property, Plant and Equipment" */
  label: string;
  /** Note reference shown in the second column, e.g. "3.1" */
  noteRef?: string;
  /** Current-year figure (NPR) */
  currentYear: number;
  /** Prior-year comparative figure (NPR) */
  previousYear: number;
  /** True if this row is a subtotal (e.g. "Total Non-Current Assets") */
  isSubTotal: boolean;
  /** True if this row is a grand total (e.g. "Total Assets") */
  isTotal: boolean;
  /** True if this is a blank spacer row — both amounts are 0 */
  isBlankRow: boolean;
  /**
   * Visual indentation level for the printed statement:
   *   0 = major section heading (ASSETS, EQUITY AND LIABILITIES)
   *   1 = section label (Non-Current Assets)
   *   2 = individual line item (Property, Plant and Equipment)
   *   3 = sub-line item (e.g. within a note schedule)
   */
  indentLevel: number;
  /**
   * If true the figure is displayed in brackets in the printed statement
   * (e.g. provisions, contra-assets, expenses in a statement of income).
   */
  isNegative: boolean;
}

// ---------------------------------------------------------------------------
// 2. BalanceSheet — Statement of Financial Position
//    Per NAS for MEs §4 and the ICAN Model Financial Statements format.
//    Field naming convention:
//      nca_  = Non-Current Asset
//      ca_   = Current Asset
//      eq_   = Equity
//      ncl_  = Non-Current Liability
//      cl_   = Current Liability
//      _py   = previous-year comparative
// ---------------------------------------------------------------------------
export interface BalanceSheet {
  // ── Non-Current Assets (current year) ─────────────────────────────────────
  /** Note 3.1 — carrying amount of PPE net of accumulated depreciation */
  nca_ppe: number;
  /** Note 3.2 — non-current portion of investment portfolio */
  nca_investments: number;
  /** Note 3.4 — non-current portion of other receivables (e.g. deposits) */
  nca_receivables: number;
  /** Note 3.5 — biological assets and other non-current assets */
  nca_other: number;
  totalNonCurrentAssets: number;

  // ── Current Assets (current year) ─────────────────────────────────────────
  /** Note 3.2 — current portion of investments (trading securities) */
  ca_investments: number;
  /** Note 3.7 — inventories at the lower of cost or NRV */
  ca_inventories: number;
  /** Note 3.3 + Note 3.4 current — trade receivables + current other receivables */
  ca_tradeReceivables: number;
  /** Note 3.8 — cash in hand and bank balances */
  ca_cashAndEquivalents: number;
  /** Note 3.6 — advance tax, other current assets */
  ca_other: number;
  totalCurrentAssets: number;
  totalAssets: number;

  // ── Equity (current year) ──────────────────────────────────────────────────
  /** Note 3.9 — paid-up share capital */
  eq_shareCapital: number;
  /** Note 3.10 — general reserve and other reserves */
  eq_reserves: number;
  /** Retained earnings / accumulated profit at year-end */
  eq_retainedEarnings: number;
  totalEquity: number;

  // ── Non-Current Liabilities (current year) ────────────────────────────────
  /** Note 3.11 — non-current portion of bank loans and borrowings */
  ncl_borrowings: number;
  /** Note 3.12 — non-current portion of employee benefit obligations */
  ncl_employeeBenefits: number;
  /** Note 3.14 — non-current provisions (e.g. long-term warranty) */
  ncl_provisions: number;
  /** Deferred tax liability (nil for most MEs — include for completeness) */
  ncl_deferredTax: number;
  totalNonCurrentLiabilities: number;

  // ── Current Liabilities (current year) ────────────────────────────────────
  /** Note 3.11 — current portion of loans, overdraft, cash credit */
  cl_borrowings: number;
  /** Note 3.13 — trade payables, TDS, VAT, and other statutory payables */
  cl_tradePayables: number;
  /** Income tax payable net of advance tax */
  cl_incomeTaxPayable: number;
  /** Current employee benefit liability (salary, bonus, PF payable) */
  cl_provisions: number;
  /** Advance from customers, dividends payable, other current liabilities */
  cl_other: number;
  totalCurrentLiabilities: number;
  totalEquityAndLiabilities: number;

  /**
   * Balance check: totalAssets − totalEquityAndLiabilities.
   * The Excel writer asserts this equals 0; non-zero triggers a validation error.
   */
  checkDifference: number;

  // ── Non-Current Assets (previous year) ────────────────────────────────────
  nca_ppe_py: number;
  nca_investments_py: number;
  nca_receivables_py: number;
  nca_other_py: number;
  totalNonCurrentAssets_py: number;

  // ── Current Assets (previous year) ────────────────────────────────────────
  ca_investments_py: number;
  ca_inventories_py: number;
  ca_tradeReceivables_py: number;
  ca_cashAndEquivalents_py: number;
  ca_other_py: number;
  totalCurrentAssets_py: number;
  totalAssets_py: number;

  // ── Equity (previous year) ─────────────────────────────────────────────────
  eq_shareCapital_py: number;
  eq_reserves_py: number;
  eq_retainedEarnings_py: number;
  totalEquity_py: number;

  // ── Non-Current Liabilities (previous year) ───────────────────────────────
  ncl_borrowings_py: number;
  ncl_employeeBenefits_py: number;
  ncl_provisions_py: number;
  ncl_deferredTax_py: number;
  totalNonCurrentLiabilities_py: number;

  // ── Current Liabilities (previous year) ───────────────────────────────────
  cl_borrowings_py: number;
  cl_tradePayables_py: number;
  cl_incomeTaxPayable_py: number;
  cl_provisions_py: number;
  cl_other_py: number;
  totalCurrentLiabilities_py: number;
  totalEquityAndLiabilities_py: number;
  checkDifference_py: number;
}

// ---------------------------------------------------------------------------
// 3. IncomeStatement — Statement of Income
//    Per NAS for MEs §5 and ICAN Model Financial Statements format.
//    Follows the NATURE OF EXPENSE classification method required by §5.3.
// ---------------------------------------------------------------------------
export interface IncomeStatement {
  // ── Income (current year) ─────────────────────────────────────────────────
  /** Note 3.17 — sales of goods + rendering of services */
  revenue: number;
  /** Interest income from bank deposits and loans given */
  interestIncome: number;
  /** Other income: rental, commission, dividend, gain on disposal, FV gains */
  otherIncome: number;
  totalIncome: number;

  // ── Expenses (current year) ───────────────────────────────────────────────
  /** Note 3.18 — opening stock + purchases − closing stock */
  materialConsumed: number;
  /** Note 3.19 — direct wages, carriage inward, direct manufacturing costs */
  directExpenses: number;
  /** Note 3.20 — salaries, PF/SSF, gratuity, bonus, staff welfare */
  employeeBenefitExpense: number;
  /** Interest expense and bank charges (NAS for MEs §18) */
  financeCharges: number;
  /** Depreciation on PPE (Note 3.1 total for the year) */
  depreciation: number;
  /** Note 3.21 — impairment on debtors, investments, inventory write-down */
  impairment: number;
  /** Note 3.22 — all remaining overhead expenses classified by nature */
  adminAndOtherExpenses: number;
  totalExpenses: number;

  // ── Profit Waterfall (current year) ───────────────────────────────────────
  /**
   * Profit/(Loss) before staff bonus.
   * Nepal law requires staff bonus to be computed on pre-bonus profit.
   */
  profitBeforeStaffBonus: number;
  /** Staff bonus at 10 % of profitBeforeStaffBonus (Nepal Bonus Act 2030) */
  staffBonus: number;
  profitBeforeTax: number;
  /** Note 3.23 — current tax expense per Nepal Income Tax Act 2058 */
  incomeTaxExpense: number;
  netProfit: number;

  // ── Income (previous year) ────────────────────────────────────────────────
  revenue_py: number;
  interestIncome_py: number;
  otherIncome_py: number;
  totalIncome_py: number;

  // ── Expenses (previous year) ──────────────────────────────────────────────
  materialConsumed_py: number;
  directExpenses_py: number;
  employeeBenefitExpense_py: number;
  financeCharges_py: number;
  depreciation_py: number;
  impairment_py: number;
  adminAndOtherExpenses_py: number;
  totalExpenses_py: number;

  // ── Profit Waterfall (previous year) ──────────────────────────────────────
  profitBeforeStaffBonus_py: number;
  staffBonus_py: number;
  profitBeforeTax_py: number;
  incomeTaxExpense_py: number;
  netProfit_py: number;
}

// ---------------------------------------------------------------------------
// 4. ChangesInEquity — Statement of Changes in Equity
//    Per NAS for MEs §6 and ICAN Model format.
//    Shows movements in Share Capital, Share Premium, General Reserve,
//    and Retained Earnings for the current year (previous year is a
//    separate instance of this interface for the comparative column).
// ---------------------------------------------------------------------------
export interface ChangesInEquity {
  // ── Prior Year ──
  pyOpeningShareCapital?: number;
  pyOpeningSharePremium?: number;
  pyOpeningGeneralReserve?: number;
  pyOpeningRetainedEarnings?: number;
  pyOpeningTotal?: number;
  
  pyNetProfit?: number;
  pyDividends?: number;
  pyTransferToReserve?: number;
  pyOtherComprehensiveIncome?: number;

  // ── Current Year Opening (usually equals py closing) ──
  cyOpeningShareCapital?: number;
  cyOpeningSharePremium?: number;
  cyOpeningGeneralReserve?: number;
  cyOpeningRetainedEarnings?: number;
  cyOpeningTotal?: number;

  // ── Current Year Movements ──
  cyNetProfit?: number;
  cyDividends?: number;
  cyShareCapitalIssued?: number;
  cySharePremiumReceived?: number;
  cyTransferToReserve?: number;
  cyOtherComprehensiveIncome?: number;

  // ── Current Year Closing ──
  cyClosingShareCapital?: number;
  cyClosingSharePremium?: number;
  cyClosingGeneralReserve?: number;
  cyClosingRetainedEarnings?: number;
  cyClosingTotal?: number;
}

// ---------------------------------------------------------------------------
// 5. CashFlowStatement — Statement of Cash Flows (Indirect Method)
//    Per NAS for MEs §7.4 — indirect method is mandatory for MEs.
//    All amounts are NPR; inflows are positive, outflows are negative.
// ---------------------------------------------------------------------------
export interface CashFlowStatement {
  // ── Operating Activities ───────────────────────────────────────────────────
  /** Starting point — profit before tax from the Statement of Income */
  profitBeforeTax: number;
  // Non-cash add-backs:
  addDepreciation: number;
  addImpairment: number;
  // Finance items reclassified to investing/financing:
  lessInterestIncome: number;
  lessDividendIncome: number;
  addInterestExpense: number;
  // Disposal adjustments:
  addLossOnDisposal: number;
  lessGainOnDisposal: number;
  // Investment fair value movements (non-cash):
  addFVLossOnInvestment: number;
  lessFVGainOnInvestment: number;
  // Working capital movements (increase in asset = negative; increase in liability = positive):
  decreaseIncreaseReceivables: number;
  decreaseIncreaseInventory: number;
  decreaseIncreaseOtherCurrentAssets: number;
  increaseDecreasePayables: number;
  increaseDecreaseIncomeTaxPayable: number;
  increaseDecreaseEmployeeLiability: number;
  increaseDecreaseProvisions: number;
  cashGeneratedFromOperations: number;
  // Cash payments:
  interestPaid: number;
  incomeTaxPaid: number;
  netCashFromOperating: number;

  // ── Investing Activities ───────────────────────────────────────────────────
  proceedsFromPPEDisposal: number;
  proceedsFromInvestmentDisposal: number;
  interestReceived: number;
  dividendReceived: number;
  purchaseOfPPE: number;
  purchaseOfInvestments: number;
  netCashFromInvesting: number;

  // ── Financing Activities ───────────────────────────────────────────────────
  proceedsFromShareIssue: number;
  proceedsFromBorrowingsNonCurrent: number;
  proceedsFromBorrowingsCurrent: number;
  repaymentOfBorrowingsNonCurrent: number;
  repaymentOfBorrowingsCurrent: number;
  dividendPaid: number;
  netCashFromFinancing: number;

  // ── Reconciliation ─────────────────────────────────────────────────────────
  netIncreaseDecrease: number;
  /** Cash and cash equivalents at 1 Shrawan (opening) */
  openingCash: number;
  /** Cash and cash equivalents at 31 Ashadh (closing) */
  closingCash: number;
  /**
   * Reconciliation check: closingCash − (openingCash + netIncreaseDecrease).
   * The writer asserts this equals 0.
   */
  reconciliationDifference: number;
}

// ---------------------------------------------------------------------------
// 6. NotesData — comprehensive type holding all note disclosures
//    Each sub-property maps directly to one note section in the
//    MEs Financials Format template (Notes 3.1 to 3.23).
// ---------------------------------------------------------------------------
export interface NotesData {

  // ── Note 3.1 — PPE ─────────────────────────────────────────────────────────
  note31_ppe: Array<{
    categoryId:          string;
    categoryName:        string;
    // Cost movement
    openingCost:         number;
    additions:           number;
    disposals:           number;
    closingCost:         number;
    // Accumulated depreciation movement
    openingAccumDepn:    number;
    depnForYear:         number;
    impairmentLosses:    number;
    depnOnDisposal:      number;
    closingAccumDepn:    number;
    // Net book value
    nbvClosing:          number;
    nbvOpening:          number;
    // Security
    securedAmount:       number;
    hasSecuredAssets:    boolean;
    assets:              any[];
  }>;

  // ── Note 3.2 — Investments ─────────────────────────────────────────────────
  note32_investments: {
    listedShares: Array<{
      companyName:         string;
      openingUnits:        number;
      purchasesDuringYear: number;
      salesDuringYear:     number;
      closingUnits:        number;
      costPerUnit:         number;
      totalCost:           number;
      ltp:                 number;
      marketValue:         number;
      fairValueGainLoss:   number;
      impairmentAmount:    number;
      carryingAmount:      number;
    }>;
    unlistedShares: Array<{
      companyName:      string;
      openingCost:      number;
      additions:        number;
      disposals:        number;
      impairmentAmount: number;
      closingCarrying:  number;
    }>;
    fdrNonCurrent:   number;
    fdrCurrent:      number;
    totalNonCurrent: number;
    totalCurrent:    number;
  };

  // ── Note 3.3 — Trade and Other Receivables ─────────────────────────────────
  note33_tradeReceivables: {
    grossReceivables_cy:       number;
    grossReceivables_py:       number;
    provisionMovement: {
      opening:   number;
      additions: number;
      writeOffs: number;
      reversals: number;
      closing:   number;
    };
    provisionForImpairment_cy: number;
    provisionForImpairment_py: number;
    netReceivables_cy:         number;
    netReceivables_py:         number;
    relatedPartyReceivables:   number;
    prepayments:               number;
    tdsReceivable:             number;
    staffAdvances:             number;
    advanceToSuppliers:        number;
    otherLoansAdvances:        number;
    nonCurrentPortion:         number;
    currentPortion:            number;
    agingAnalysis: Array<{
      agingBucket:   string;
      amount:        number;
    }>;
  };

  // ── Note 3.4 — Other Current Assets ───────────────────────────────────────
  note34_otherCurrentAssets: {
    securityDeposits:     number;
    guaranteeMargins:     number;
    advanceIncomeTax:     number;
    otherPrepaidExpenses: number;
    total:                number;
  };

  // ── Note 3.5 — Biological Assets ──────────────────────────────────────────
  note35_biologicalAssets: {
    hasBalance:          boolean;
    openingCarrying:     number;
    additionsPurchases:  number;
    disposalsSales:      number;
    fairValueAdjustment: number;
    closingCarrying:     number;
  };

  // ── Note 3.6 — Non-Current Assets Held for Sale ───────────────────────────
  note36_heldForSale: {
    hasBalance: boolean;
    assets: Array<{
      description:      string;
      carryingAmount:   number;
      expectedSaleDate: string | null;
    }>;
    total: number;
  };

  // ── Note 3.7 — Inventories ─────────────────────────────────────────────────
  note37_inventories: {
    rawMaterials:          { opening: number; closing: number };
    wip:                   { opening: number; closing: number };
    finishedGoods:         { opening: number; closing: number };
    totalOpening:          number;
    totalClosing:          number;
    impairmentRecognised:  number;
    inventoryAtNRV:        number;
    pledgedAsSecurityAmt:  number;
    costFormula:           string;
  };

  // ── Note 3.8 — Cash and Cash Equivalents ──────────────────────────────────
  note38_cashEquivalents: {
    cashInHand_cy: number;
    cashInHand_py: number;
    bankAccounts: Array<{
      accountName:    string;
      bankName:       string;
      accountType:    'Current' | 'Savings' | 'Fixed Deposit (≤3 months)';
      closingBalance: number;
      openingBalance: number;
    }>;
    totalCash_cy: number;
    totalCash_py: number;
  };

  // ── Note 3.9 — Share Capital ───────────────────────────────────────────────
  note39_shareCapital: {
    ordinaryShares: {
      authorizedAmount:    number;
      authorizedShares:    number;
      parValuePerShare:    number;
      openingIssuedShares: number;
      openingPaidUp:       number;
      issuedDuringYear:    number;
      issuedForCash:       number;
      closingIssuedShares: number;
      closingPaidUp:       number;
    };
    preferenceShares: null | {
      authorizedAmount:    number;
      closingPaidUp:       number;
    };
    restrictionsOnDistribution: string | null;
    sharesReservedForOptions:   number;
  };

  // ── Note 3.10 — Reserves ──────────────────────────────────────────────────
  note310_reserves: {
    sharePremium: {
      opening:   number;
      additions: number;
      closing:   number;
    };
    generalReserve: {
      opening:              number;
      transferFromProfit:   number;
      closing:              number;
    };
    retainedEarnings: {
      opening:           number;
      netProfitForYear:  number;
      dividendsDeclared: number;
      transferToReserve: number;
      closing:           number;
    };
    otherReserves: number;
  };

  // ── Note 3.11 — Loans and Borrowings ──────────────────────────────────────
  note311_borrowings: {
    nonCurrent: Array<{
      lenderName:   string;
      type:         'Bank Term Loan' | 'Debentures' | 'Other Loan';
      secured:      boolean;
      interestRate: number;
      maturityDate: string | null;
      balance_cy:   number;
      balance_py:   number;
    }>;
    current: Array<{
      lenderName: string;
      type:       'Bank Overdraft' | 'Cash Credit' | 'Working Capital Loan' | 'Current Portion of Long-Term Loan' | 'Related Party Loan';
      secured:    boolean;
      balance_cy: number;
      balance_py: number;
    }>;
    totalNonCurrent_cy: number;
    totalCurrent_cy:    number;
  };

  // ── Note 3.12 — Employee Benefit Liabilities ──────────────────────────────
  note312_employeeBenefits: {
    definedBenefit: {
      description:   string;
      openingBalance: number;
      expenseForYear: number;
      paidDuringYear: number;
      closingBalance: number;
      nonCurrentPortion: number;
      currentPortion: number;
    };
    definedContribution: {
      pfContribution:  number;
      ssfContribution: number;
    };
    leaveEncashment: {
      openingBalance: number;
      expenseForYear: number;
      paidDuringYear: number;
      closingBalance: number;
    };
    salaryPayable: number;
    bonusPayable:  number;
    totalCurrentEmployeeLiabilities:    number;
    totalNonCurrentEmployeeLiabilities: number;
  };

  // ── Note 3.13 — Trade and Other Payables ──────────────────────────────────
  note313_tradePayables: {
    tradeCreditors:        number;
    advanceFromCustomers:  number;
    auditFeePayable:       number;
    vatPayable:            number;
    tdsPayableBreakdown: Array<{
      ledgerName: string;
      amount:     number;
    }>;
    tdsPayableTotal: number;
    otherAccruals:   number;
    total:           number;
    // Previous year
    tradeCreditors_py:   number;
    auditFeePayable_py:  number;
    vatPayable_py:       number;
    tdsPayableTotal_py:  number;
  };

  // ── Note 3.14 — Tax Computation Summary ───────────────────────────────────
  note314_taxComputation: {
    advanceTaxPaid:     number;
    tdsCreditAvailable: number;
    incomeTaxForYear:   number;
    netTaxLiability:    number;
    taxRecoverable:     number;
  };

  // ── Note 3.15 — Revenue (Summary) ─────────────────────────────────────────
  note315_revenue: {
    saleOfGoods_cy:    number;
    saleOfServices_cy: number;
    totalRevenue_cy:   number;
    saleOfGoods_py:    number;
    saleOfServices_py: number;
    totalRevenue_py:   number;
  };

  // ── Note 3.16 — Dividend Payable ──────────────────────────────────────────
  note316_dividendPayable: {
    hasDividend:           boolean;
    paidUpCapital:         number;
    declaredRatePercent:   number;
    amountPerShare:        number;
    totalDividendDeclared: number;
    tdsOnDividend:         number;
    netDividendPayable:    number;
  };

  // ── Note 3.17 — Revenue from Operations (Detailed) ────────────────────────
  note317_revenueDetailed: {
    saleOfGoods:         { cy: number; py: number };
    renderingOfServices: { cy: number; py: number };
    interestIncome:      { cy: number; py: number };
    dividendIncome:      { cy: number; py: number };
    otherIncome:         { cy: number; py: number };
    totalIncome:         { cy: number; py: number };
  };

  // ── Note 3.18 — Material Consumed ─────────────────────────────────────────
  note318_materialConsumed: {
    openingRawMaterial:        number;
    purchasesDuringYear:       number;
    closingRawMaterial:        number;
    rawMaterialConsumed:       number;
    changeInInventoriesFGWIP:  number;
    openingFGWIP:              number;
    closingFGWIP:              number;
    directWages:               number;
    otherDirectExpenses:       number;
    totalCostOfProduction:     number;
  };

  // ── Note 3.19 — Other Income ──────────────────────────────────────────────
  note319_otherIncome: {
    interestIncome:              { cy: number; py: number };
    commissionIncome:            { cy: number; py: number };
    rentalIncome:                { cy: number; py: number };
    dividendReceived:            { cy: number; py: number };
    gainOnDisposalAssets:        { cy: number; py: number };
    insuranceClaims:             { cy: number; py: number };
    fairValueGainOnInvestments:  { cy: number; py: number };
    miscellaneousIncome:         { cy: number; py: number };
    total:                       { cy: number; py: number };
  };

  // ── Note 3.20 — Employee Benefit Expenses ─────────────────────────────────
  note320_employeeExpenses: {
    salariesWages:         { cy: number; py: number };
    allowances:            { cy: number; py: number };
    pfSsfContribution:     { cy: number; py: number };
    gratuityExpense:       { cy: number; py: number };
    leaveEncashment:       { cy: number; py: number };
    staffBonusExpense:     { cy: number; py: number };
    staffWelfare:          { cy: number; py: number };
    otherEmployeeCosts:    { cy: number; py: number };
    totalEmployeeExpenses: { cy: number; py: number };
    kmpCompensation: {
      description:   string;
      salary:        number;
      bonus:         number;
      otherBenefits: number;
      total:         number;
    };
  };

  // ── Note 3.21 — Depreciation ──────────────────────────────────────────────
  note321_depreciation: {
    byClass: Array<{
      categoryName:        string;
      depreciationForYear: number;
    }>;
    totalDepreciation:    number;
    totalDepreciation_py: number;
  };

  // ── Note 3.22 — Administrative Expenses ───────────────────────────────────
  note322_adminExpenses: {
    lineItems: Array<{
      label: string;
      cy:    number;
      py:    number;
    }>;
    total_cy: number;
    total_py: number;
  };

  // ── Note 3.23 — Tax Expense and Reconciliation ────────────────────────────
  note323_taxExpense: {
    currentTaxExpense:   number;
    deferredTaxExpense:  number;
    priorYearAdjustment: number;
    totalTaxExpense:     number;
    effectiveTaxRate:    number;
    reconciliation: {
      profitBeforeTax:      number;
      disallowableExpenses: Record<string, number>;
      allowableDeductions:  Record<string, number>;
      taxableProfit:        number;
      taxAtStatutoryRate:   number;
      taxAdjustments:       number;
      totalCurrentTax:      number;
    };
    taxDepreciationByPool: Array<{
      poolName:          string;
      rate:              number;
      openingBasis:      number;
      additions:         number;
      disposals:         number;
      depreciationBasis: number;
      taxDepreciation:   number;
      closingBasis:      number;
    }>;
    advanceTaxPaid:     number;
    tdsCreditAvailable: number;
    netTaxPayable:      number;
  };

  // ── Note 3.24 — Related Party Transactions ────────────────────────────────
  note324_relatedParty: {
    relatedParties: Array<{
      partyName:           string;
      relationship:        'Director / Related Party' | 'Group Company' | 'Associate' | 'KMP' | 'Other';
      natureOfTransaction: 'Loan Given' | 'Loan Received' | 'Sales' | 'Purchases' | 'Rent Paid' | 'Salary Paid' | 'Other';
      transactionAmount:   number;
      outstandingBalance:  number;
      balanceType:         'Receivable' | 'Payable';
      atArmSLength:        boolean;
    }>;
    kmpCompensationTotal:          number;
    noRelatedPartyTransactions:    boolean;
  };

  // ── Note 3.25 — Contingent Liabilities ────────────────────────────────────
  note325_contingencies: {
    hasContingencies:              boolean;
    bankGuaranteesIssued:          number;
    lcOpened:                      number;
    legalCasesPending: Array<{
      caseDescription: string;
      amount:          number;
      status:          string;
    }>;
    capitalCommitments:            number;
    operatingLeaseCommitments:     number;
    defaultText:                   string;
  };

  // ── Note 3.26 — Subsequent Events ────────────────────────────────────────
  note326_subsequentEvents: {
    hasSubsequentEvents: boolean;
    events: Array<{
      description: string;
      date:        string;
      amount:      number | null;
    }>;
    defaultText: string;
  };
}
