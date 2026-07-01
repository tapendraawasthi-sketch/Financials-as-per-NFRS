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
  // ── Note 3.1: Property, Plant and Equipment ────────────────────────────────
  /** Full PPE schedule per category, imported from YearEndAdjustments */
  note31_ppe: DepreciationSummary[];

  // ── Note 3.2: Investments ──────────────────────────────────────────────────
  note32_investments: {
    /** NEPSE-listed shares — marked to market or lower of cost/market */
    listedShares: InvestmentAdjustment[];
    /** Unlisted equity investments at cost less impairment */
    otherInvestments: InvestmentAdjustment[];
  };

  // ── Note 3.3: Trade Receivables ────────────────────────────────────────────
  note33_tradeReceivables: {
    grossReceivables_cy: number;
    grossReceivables_py: number;
    provisionForImpairment_cy: number;
    provisionForImpairment_py: number;
    /** Net trade receivables = gross − provision */
    netReceivables_cy: number;
    netReceivables_py: number;
    /**
     * Aging analysis (optional) — each bucket has a label like
     * "0–30 days", "31–90 days", "91–180 days", "Over 180 days"
     * and the outstanding amount in NPR.
     */
    agingBuckets?: { label: string; amount: number }[];
  };

  // ── Note 3.4: Other Receivables ────────────────────────────────────────────
  /**
   * Keyed by item name, e.g.:
   *   "Receivables from related parties" → { cy: 100000, py: 0 }
   *   "Loans and Advances" → { cy: 50000, py: 20000 }
   *   "Prepayments" → { cy: 0, py: 0 }
   *   "Deposits" → { cy: 275000, py: 225000 }
   *   "Staff Advances" → { cy: 25000, py: 75000 }
   */
  note34_otherReceivables: Record<string, { cy: number; py: number }>;

  // ── Note 3.5: Other Non-Current Assets ────────────────────────────────────
  /**
   * Keyed by item name, e.g.:
   *   "Biological Assets" → { cy: 1010000, py: 0 }
   */
  note35_otherNonCurrentAssets: Record<string, { cy: number; py: number }>;

  // ── Note 3.6: Other Current Assets ────────────────────────────────────────
  /**
   * Keyed by item name, e.g.:
   *   "Non-Current Assets Held for Sale" → { cy: 10000, py: 0 }
   *   "Advance to Suppliers" → { cy: 100000, py: 0 }
   */
  note36_otherCurrentAssets: Record<string, { cy: number; py: number }>;

  // ── Note 3.7: Inventories ──────────────────────────────────────────────────
  note37_inventories: {
    rawMaterials_cy: number;
    rawMaterials_py: number;
    wip_cy: number;
    wip_py: number;
    finishedGoods_cy: number;
    finishedGoods_py: number;
    totalInventory_cy: number;
    totalInventory_py: number;
    /** Any inventory impairment recognised in the current year (Note 3.21) */
    impairmentRecognized_cy: number;
  };

  // ── Note 3.8: Cash and Cash Equivalents ────────────────────────────────────
  note38_cashAndEquivalents: {
    cashInHand_cy: number;
    cashInHand_py: number;
    /**
     * One entry per bank account:
     *   bankName: e.g. "NABIL Bank – Current A/c 123456"
     *   accountType: "current" | "savings" | "call"
     *   cy: balance at 31 Ashadh
     *   py: balance at previous year-end
     */
    bankBalances: { bankName: string; accountType: string; cy: number; py: number }[];
    totalCash_cy: number;
    totalCash_py: number;
  };

  // ── Note 3.9: Share Capital ────────────────────────────────────────────────
  note39_shareCapital: {
    /** Total authorised shares (number of shares) */
    authorizedShares: number;
    /** Face value per share in NPR, typically NPR 100 */
    faceValuePerShare: number;
    /** Shares issued and fully paid (number) */
    issuedShares: number;
    /** Paid-up shares (number — equal to issuedShares for fully-paid) */
    paidUpShares: number;
    /** Paid-up capital in NPR at current year-end */
    paidUpAmount_cy: number;
    /** Paid-up capital in NPR at previous year-end */
    paidUpAmount_py: number;
  };

  // ── Note 3.10: Reserves ────────────────────────────────────────────────────
  /**
   * Keyed by reserve name, e.g. "General Reserve", "Capital Reserve".
   * Each entry shows opening balance, additions, and closing balance for CY;
   * and prior-year closing balance as the PY comparative.
   */
  note310_reserves: Record<
    string,
    { openingCY: number; additionCY: number; closingCY: number; py: number }
  >;

  // ── Note 3.11: Loans and Borrowings ───────────────────────────────────────
  note311_borrowings: {
    /** Term loans from banks and financial institutions — non-current portion */
    nonCurrentBank: {
      lenderName: string;
      amount_cy: number;
      amount_py: number;
      /** Annual interest rate as a percentage, e.g. 12.5 */
      interestRate: number;
      /** Collateral description, e.g. "Land & Building at Boudha" */
      security: string;
    }[];
    /** Overdraft, cash credit, working capital loans — current portion */
    currentLoans: {
      lenderName: string;
      amount_cy: number;
      amount_py: number;
      /** "overdraft" | "cash_credit" | "working_capital" | "short_term" */
      loanType: string;
    }[];
  };

  // ── Note 3.12: Liability for Employee Benefits ────────────────────────────
  /**
   * Keyed by benefit type, e.g. "Salary Payable", "Bonus Payable",
   * "Provident Fund Payable", "Gratuity Payable".
   * Each entry shows the movement (opening → expense → paid → closing).
   */
  note312_employeeBenefits: Record<
    string,
    { opening: number; expense: number; paid: number; closing: number }
  >;

  // ── Note 3.13: Trade and Other Payables ───────────────────────────────────
  /**
   * Keyed by payable type, e.g. "Trade Payables", "Audit Fee Payable",
   * "TDS Payable", "VAT Payable", "Other Payables".
   */
  note313_tradePayables: Record<string, { cy: number; py: number }>;

  // ── Note 3.14: Provisions ─────────────────────────────────────────────────
  /** Full provision movement schedules, imported from YearEndAdjustments */
  note314_provisions: ProvisionEntry[];

  // ── Note 3.17: Revenue ────────────────────────────────────────────────────
  /**
   * Keyed by revenue stream, e.g. "Sale of Goods", "Rendering of Services",
   * "Interest Income", "Commission Income", "Rental Income",
   * "Dividend Income", "Gain on Disposal of Assets".
   */
  note317_revenue: Record<string, { cy: number; py: number }>;

  // ── Note 3.18: Material Consumed Expenses ─────────────────────────────────
  note318_materialConsumed: {
    /** Opening inventory at 1 Shrawan */
    openingInventory: number;
    /** Purchases during the year */
    purchases: number;
    /** Closing inventory at 31 Ashadh */
    closingInventory: number;
    /** consumed = openingInventory + purchases − closingInventory */
    consumed: number;
  };

  // ── Note 3.19: Direct Expenses ────────────────────────────────────────────
  /**
   * Keyed by expense head, e.g. "Direct Wages", "Carriage Inward",
   * "Packing Charges", "Other Direct Expenses".
   */
  note319_directExpenses: Record<string, { cy: number; py: number }>;

  // ── Note 3.20: Employee Benefit Expenses ──────────────────────────────────
  /**
   * Keyed by expense component, e.g. "Wages and Salaries",
   * "Short-term Non-monetary Benefits", "Defined Contribution Pension",
   * "Defined Benefit Pension Cost", "Other Long-term Employee Benefits",
   * "Other Expenses".
   */
  note320_employeeBenefitExpenses: Record<string, { cy: number; py: number }>;

  // ── Note 3.21: Impairment Expenses ────────────────────────────────────────
  /** Each entry names an impairment category and its CY and PY amounts */
  note321_impairment: { description: string; cy: number; py: number }[];

  // ── Note 3.22: Administrative and Other Expenses ─────────────────────────
  /**
   * Keyed by expense line, e.g. "Bank Charges", "Audit Fees",
   * "Advertisement & Business Promotion", "Fuel Expenses",
   * "House Rent / Lease Rentals", "Electricity & Water", etc.
   */
  note322_adminExpenses: Record<string, { cy: number; py: number }>;

  // ── Note 3.23: Income Tax ─────────────────────────────────────────────────
  note323_incomeTax: {
    /** Tax charge recognised in the Statement of Income */
    currentTax: number;
    /** Book profit before tax from the Statement of Income */
    profitBeforeTax: number;
    /** Applicable rate, e.g. 0.25 for 25 % */
    taxRate: number;
    /**
     * Expenses disallowed under Nepal Income Tax Act 2058
     * (e.g. penalties, personal expenses, excess depreciation).
     * Keyed by item description → disallowable amount.
     */
    addDisallowableExpenses: Record<string, number>;
    /**
     * Additional allowable deductions beyond book expenses
     * (e.g. tax depreciation excess over book depreciation).
     * Keyed by item description → deductible amount.
     */
    lessAllowableExpenses: Record<string, number>;
    /** Taxable income after all adjustments */
    taxableIncome: number;
    /** Advance income tax (TDS + self-assessment instalments) paid during the year */
    advanceTaxPaid: number;
    /** TDS credits available (e.g. TDS on interest income) */
    tdsCreditAvailable: number;
    /** Net tax payable = currentTax − advanceTaxPaid − tdsCreditAvailable */
    netTaxPayable: number;
  };
}
