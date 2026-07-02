// ===== server/services/financialEngine.ts =====
// Financial statement computation engine.
// Converts a mapped trial balance + year-end adjustments into all four
// NFRS/NAS for MEs financial statements and supporting notes.

import type {
  ParsedTrialBalance,
  MappedTBRow,
  YearEndAdjustments,
  BalanceSheet,
  IncomeStatement,
  ChangesInEquity,
  CashFlowStatement,
  NotesData,
  CompanyProfile,
  AccountingPolicies,
  NFRSCategory,
} from '../../src/types';

// ---------------------------------------------------------------------------
// Helper: sum closing balances for given NFRS categories
// ---------------------------------------------------------------------------
function sumRows(
  rows: MappedTBRow[],
  ...categories: (NFRSCategory | string)[]
): number {
  const catSet = new Set(categories);
  return rows
    .filter((r) => catSet.has(r.nfrsCategory as string))
    .reduce((acc, r) => acc + ((r.closingDr ?? 0) - (r.closingCr ?? 0)), 0);
}

/** Sum only credit-side closing (for liability / income accounts). */
function sumCr(
  rows: MappedTBRow[],
  ...categories: (NFRSCategory | string)[]
): number {
  const catSet = new Set(categories);
  return rows
    .filter((r) => catSet.has(r.nfrsCategory as string))
    .reduce((acc, r) => acc + (r.closingCr ?? 0), 0);
}

/** Sum only debit-side closing (for asset / expense accounts). */
function sumDr(
  rows: MappedTBRow[],
  ...categories: (NFRSCategory | string)[]
): number {
  const catSet = new Set(categories);
  return rows
    .filter((r) => catSet.has(r.nfrsCategory as string))
    .reduce((acc, r) => acc + (r.closingDr ?? 0), 0);
}

/** Sum opening debit balances (for working capital movement). */
function sumOpeningDr(
  rows: MappedTBRow[],
  ...categories: (NFRSCategory | string)[]
): number {
  const catSet = new Set(categories);
  return rows
    .filter((r) => catSet.has(r.nfrsCategory as string))
    .reduce((acc, r) => acc + (r.openingDr ?? 0), 0);
}

/** Sum opening credit balances. */
function sumOpeningCr(
  rows: MappedTBRow[],
  ...categories: (NFRSCategory | string)[]
): number {
  const catSet = new Set(categories);
  return rows
    .filter((r) => catSet.has(r.nfrsCategory as string))
    .reduce((acc, r) => acc + (r.openingCr ?? 0), 0);
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// 1. computeBalanceSheet
// ---------------------------------------------------------------------------
export function computeBalanceSheet(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  is: IncomeStatement,
  previousYearBS: Partial<BalanceSheet> = {},
): BalanceSheet {
  const rows = tb.rows;

  // ── Non-Current Assets ────────────────────────────────────────────────────
  const grossPPE = sumDr(rows,
    'ppe_land', 'ppe_buildings', 'ppe_vehicles', 'ppe_office_equipment',
    'ppe_computers', 'ppe_furniture', 'ppe_plant_machinery', 'ppe_intangibles', 'ppe_cwip',
  );
  const accumDepnTB = sumCr(rows, 'accum_depreciation');
  const totalAccumDepn = accumDepnTB + adj.totalDepreciationExpense;
  const nca_ppe = Math.max(0, grossPPE - totalAccumDepn);

  const investmentNonCurrent =
    sumDr(rows, 'investment_listed_trading', 'investment_unlisted', 'investment_fixed_deposit_noncurrent') -
    adj.investmentAdjustments.reduce((sum, inv) => sum + (inv.impairmentAmount ?? 0), 0);
  const nca_investments = Math.max(0, investmentNonCurrent);

  const nca_receivables = Math.max(0,
    sumDr(rows, 'nca_deposits', 'nca_loans_advances'),
  );

  const nca_other = Math.max(0, sumDr(rows, 'other_noncurrent_assets'));

  const totalNonCurrentAssets = round(nca_ppe + nca_investments + nca_receivables + nca_other);

  // ── Current Assets ────────────────────────────────────────────────────────
  const ca_investments = 0; // Short-term FD moved to cash equivalent

  const grossInventory = sumDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods');
  const ca_inventories = Math.max(0, grossInventory - adj.totalInventoryImpairment);

  const tradeRec = sumDr(rows, 'trade_receivables');
  const impairmentOnRec = sumCr(rows, 'provision_impairment_debtors');
  const otherRec = sumDr(rows,
    'other_receivables_advance_supplier', 'other_receivables_prepayments',
    'other_receivables_staff_advance', 'other_receivables_tds', 'other_receivables_loans',
  );
  const ca_tradeReceivables = Math.max(0, tradeRec - impairmentOnRec + otherRec);

  const ca_cashAndEquivalents = Math.max(0,
    sumDr(rows, 'cash_in_hand', 'bank_current_account', 'bank_fixed_deposit_current') -
    sumCr(rows, 'bank_current_account'), // overdraft offsets bank balance
  );

  const ca_other = Math.max(0, sumDr(rows, 'other_current_assets'));

  const totalCurrentAssets = round(ca_investments + ca_inventories + ca_tradeReceivables + ca_cashAndEquivalents + ca_other);
  const totalAssets = round(totalNonCurrentAssets + totalCurrentAssets);

  // ── Equity ────────────────────────────────────────────────────────────────
  const eq_shareCapital = round(sumCr(rows, 'share_capital', 'share_premium'));
  const eq_reserves = round(sumCr(rows, 'general_reserve'));

  // Retained earnings = opening retained earnings + net profit - dividends
  const openingRetained = sumOpeningCr(rows, 'retained_earnings');
  // Net profit is computed by the income statement engine
  const eq_retainedEarnings = round(sumCr(rows, 'retained_earnings') + is.netProfit);
  const totalEquity = round(eq_shareCapital + eq_reserves + eq_retainedEarnings);

  // ── Non-Current Liabilities ───────────────────────────────────────────────
  const ncl_borrowings = round(sumCr(rows, 'borrowings_noncurrent_bank'));
  const ncl_employeeBenefits = 0; // Populated from Note 3.12 split — default 0
  const ncl_provisions = 0;
  const ncl_deferredTax = 0;
  const totalNonCurrentLiabilities = round(ncl_borrowings + ncl_employeeBenefits + ncl_provisions + ncl_deferredTax);

  // ── Current Liabilities ───────────────────────────────────────────────────
  const cl_borrowings = round(
    sumCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc'),
  );
  const cl_tradePayables = round(
    sumCr(rows, 'trade_payables_creditors', 'tds_payable', 'other_payables', 'audit_fee_payable', 'trade_payables_advance_customers'),
  );

  const incomeTaxPayable = round(sumCr(rows, 'income_tax_payable') + is.incomeTaxExpense);
  const advanceTax = round(sumDr(rows, 'other_receivables_tds'));
  const cl_incomeTaxPayable = round(Math.max(0, incomeTaxPayable - advanceTax));

  const cl_provisions = round(
    sumCr(rows, 'employee_payables_pf', 'employee_payables_bonus', 'employee_payables_salary') + is.staffBonus,
  );
  const cl_other = 0; // Dividends payable etc. — populated from adjustments if needed
  const totalCurrentLiabilities = round(cl_borrowings + cl_tradePayables + cl_incomeTaxPayable + cl_provisions + cl_other);

  const totalEquityAndLiabilities = round(totalEquity + totalNonCurrentLiabilities + totalCurrentLiabilities);
  const checkDifference = round(totalAssets - totalEquityAndLiabilities);

  return {
    nca_ppe, nca_investments, nca_receivables, nca_other, totalNonCurrentAssets,
    ca_investments, ca_inventories, ca_tradeReceivables, ca_cashAndEquivalents, ca_other, totalCurrentAssets,
    totalAssets,
    eq_shareCapital, eq_reserves, eq_retainedEarnings, totalEquity,
    ncl_borrowings, ncl_employeeBenefits, ncl_provisions, ncl_deferredTax, totalNonCurrentLiabilities,
    cl_borrowings, cl_tradePayables, cl_incomeTaxPayable, cl_provisions, cl_other, totalCurrentLiabilities,
    totalEquityAndLiabilities, checkDifference,
    // Previous year fields
    nca_ppe_py: previousYearBS.nca_ppe ?? 0,
    nca_investments_py: previousYearBS.nca_investments ?? 0,
    nca_receivables_py: previousYearBS.nca_receivables ?? 0,
    nca_other_py: previousYearBS.nca_other ?? 0,
    totalNonCurrentAssets_py: previousYearBS.totalNonCurrentAssets ?? 0,
    ca_investments_py: previousYearBS.ca_investments ?? 0,
    ca_inventories_py: previousYearBS.ca_inventories ?? 0,
    ca_tradeReceivables_py: previousYearBS.ca_tradeReceivables ?? 0,
    ca_cashAndEquivalents_py: previousYearBS.ca_cashAndEquivalents ?? 0,
    ca_other_py: previousYearBS.ca_other ?? 0,
    totalCurrentAssets_py: previousYearBS.totalCurrentAssets ?? 0,
    totalAssets_py: previousYearBS.totalAssets ?? 0,
    eq_shareCapital_py: previousYearBS.eq_shareCapital ?? 0,
    eq_reserves_py: previousYearBS.eq_reserves ?? 0,
    eq_retainedEarnings_py: previousYearBS.eq_retainedEarnings ?? 0,
    totalEquity_py: previousYearBS.totalEquity ?? 0,
    ncl_borrowings_py: previousYearBS.ncl_borrowings ?? 0,
    ncl_employeeBenefits_py: previousYearBS.ncl_employeeBenefits ?? 0,
    ncl_provisions_py: previousYearBS.ncl_provisions ?? 0,
    ncl_deferredTax_py: previousYearBS.ncl_deferredTax ?? 0,
    totalNonCurrentLiabilities_py: previousYearBS.totalNonCurrentLiabilities ?? 0,
    cl_borrowings_py: previousYearBS.cl_borrowings ?? 0,
    cl_tradePayables_py: previousYearBS.cl_tradePayables ?? 0,
    cl_incomeTaxPayable_py: previousYearBS.cl_incomeTaxPayable ?? 0,
    cl_provisions_py: previousYearBS.cl_provisions ?? 0,
    cl_other_py: previousYearBS.cl_other ?? 0,
    totalCurrentLiabilities_py: previousYearBS.totalCurrentLiabilities ?? 0,
    totalEquityAndLiabilities_py: previousYearBS.totalEquityAndLiabilities ?? 0,
    checkDifference_py: previousYearBS.checkDifference ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 2. computeIncomeStatement
// ---------------------------------------------------------------------------
export function computeIncomeStatement(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  accountingPolicies: AccountingPolicies,
  previousYearIS: Partial<IncomeStatement> = {},
): IncomeStatement {
  const rows = tb.rows;

  // ── Income ────────────────────────────────────────────────────────────────
  const revenue = round(sumCr(rows, 'revenue_sales', 'revenue_services'));
  const interestIncome = round(sumCr(rows, 'other_income_interest'));
  const otherIncomeTB = round(
    sumCr(rows, 'other_income_dividend', 'other_income_rental', 'other_income_misc', 'other_income_disposal_gain'),
  );
  const otherIncome = round(otherIncomeTB + adj.gainOnDisposals);
  const totalIncome = round(revenue + interestIncome + otherIncome);

  // ── Expenses ──────────────────────────────────────────────────────────────
  // Material consumed = opening stock + purchases - closing stock
  const openingStock = round(
    sumOpeningDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods'),
  );
  const purchases = round(sumDr(rows, 'cogs_purchases', 'cogs_opening_stock'));
  const closingStock = round(
    sumDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods'),
  );
  const materialConsumed = round(openingStock + purchases - closingStock);

  const directExpenses = round(sumDr(rows, 'direct_wages', 'direct_expenses_other'));

  const employeeSalaries = round(sumDr(rows, 'emp_expense_salaries', 'emp_expense_pf', 'emp_expense_gratuity', 'emp_expense_welfare'));
  const provisionExpenses = adj.provisions
    .filter((p) => p.provisionType === 'gratuity' || p.provisionType === 'leave_encashment')
    .reduce((sum, p) => sum + p.additionForYear, 0);
  const employeeBenefitExpense = round(employeeSalaries + provisionExpenses);

  const financeCharges = round(sumDr(rows, 'finance_cost_interest', 'finance_cost_bank_charges'));
  const depreciation = round(adj.totalDepreciationExpense);

  const impairmentTB = round(sumDr(rows, 'impairment_expense'));
  const impairment = round(impairmentTB + adj.totalInventoryImpairment);

  const adminAndOtherExpenses = round(
    sumDr(rows,
      'admin_rent', 'admin_rates_taxes', 'admin_insurance', 'admin_repairs',
      'admin_electricity', 'admin_communication', 'admin_printing', 'admin_legal_professional',
      'admin_audit_fee', 'admin_traveling', 'admin_advertisement', 'admin_other',
    ),
  );

  const totalExpenses = round(materialConsumed + directExpenses + employeeBenefitExpense + financeCharges + depreciation + impairment + adminAndOtherExpenses);
  const profitBeforeStaffBonus = round(totalIncome - totalExpenses);

  const bonusRate = (accountingPolicies.bonusRatePercent ?? 10) / 100;
  const staffBonus = round(
    profitBeforeStaffBonus > 0 ? profitBeforeStaffBonus * bonusRate : 0,
  );

  const profitBeforeTax = round(profitBeforeStaffBonus - staffBonus);

  const taxFromAdj = adj.currentTaxExpense ?? 0;
  const taxFromTB = round(sumDr(rows, 'income_tax_expense'));
  const incomeTaxExpense = round(taxFromAdj > 0 ? taxFromAdj : taxFromTB);

  const netProfit = round(profitBeforeTax - incomeTaxExpense);

  return {
    revenue, interestIncome, otherIncome, totalIncome,
    materialConsumed, directExpenses, employeeBenefitExpense, financeCharges,
    depreciation, impairment, adminAndOtherExpenses, totalExpenses,
    profitBeforeStaffBonus, staffBonus, profitBeforeTax, incomeTaxExpense, netProfit,
    // Previous year
    revenue_py: previousYearIS.revenue ?? 0,
    interestIncome_py: previousYearIS.interestIncome ?? 0,
    otherIncome_py: previousYearIS.otherIncome ?? 0,
    totalIncome_py: previousYearIS.totalIncome ?? 0,
    materialConsumed_py: previousYearIS.materialConsumed ?? 0,
    directExpenses_py: previousYearIS.directExpenses ?? 0,
    employeeBenefitExpense_py: previousYearIS.employeeBenefitExpense ?? 0,
    financeCharges_py: previousYearIS.financeCharges ?? 0,
    depreciation_py: previousYearIS.depreciation ?? 0,
    impairment_py: previousYearIS.impairment ?? 0,
    adminAndOtherExpenses_py: previousYearIS.adminAndOtherExpenses ?? 0,
    totalExpenses_py: previousYearIS.totalExpenses ?? 0,
    profitBeforeStaffBonus_py: previousYearIS.profitBeforeStaffBonus ?? 0,
    staffBonus_py: previousYearIS.staffBonus ?? 0,
    profitBeforeTax_py: previousYearIS.profitBeforeTax ?? 0,
    incomeTaxExpense_py: previousYearIS.incomeTaxExpense ?? 0,
    netProfit_py: previousYearIS.netProfit ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 3. computeChangesInEquity
// ---------------------------------------------------------------------------
export function computeChangesInEquity(
  tb: ParsedTrialBalance,
  is: IncomeStatement,
  _company: CompanyProfile,
): ChangesInEquity {
  const rows = tb.rows;

  const openingShareCapital = round(sumOpeningCr(rows, 'share_capital'));
  const openingSharePremium  = round(sumOpeningCr(rows, 'share_premium'));
  const openingGeneralReserve = round(sumOpeningCr(rows, 'general_reserve'));
  const openingRetainedEarnings = round(sumOpeningCr(rows, 'retained_earnings'));
  const openingTotal = round(openingShareCapital + openingSharePremium + openingGeneralReserve + openingRetainedEarnings);

  const addProfitForYear    = round(is.netProfit);
  const addNewShareCapital  = round(sumCr(rows, 'share_capital') - sumOpeningCr(rows, 'share_capital'));
  const addSharePremiumOnNewIssue = round(sumCr(rows, 'share_premium') - openingSharePremium);
  const addTransferToReserve      = 0; // Typically a manual entry
  const lessTransferFromReserve   = 0;
  const lessDividendPaid          = 0; // Derive from financing activities if available
  const lessBonusShareIssued      = 0;

  const closingShareCapital    = round(sumCr(rows, 'share_capital'));
  const closingSharePremium    = round(sumCr(rows, 'share_premium'));
  const closingGeneralReserve  = round(sumCr(rows, 'general_reserve'));
  const closingRetainedEarnings = round(openingRetainedEarnings + addProfitForYear - lessDividendPaid);
  const closingTotal = round(closingShareCapital + closingSharePremium + closingGeneralReserve + closingRetainedEarnings);

  return {
    cyOpeningShareCapital: openingShareCapital,
    cyOpeningSharePremium: openingSharePremium,
    cyOpeningGeneralReserve: openingGeneralReserve,
    cyOpeningRetainedEarnings: openingRetainedEarnings,
    cyOpeningTotal: openingTotal,
    cyNetProfit: addProfitForYear,
    cyShareCapitalIssued: addNewShareCapital,
    cySharePremiumReceived: addSharePremiumOnNewIssue,
    cyTransferToReserve: addTransferToReserve,
    cyDividends: lessDividendPaid,
    cyClosingShareCapital: closingShareCapital,
    cyClosingSharePremium: closingSharePremium,
    cyClosingGeneralReserve: closingGeneralReserve,
    cyClosingRetainedEarnings: closingRetainedEarnings,
    cyClosingTotal: closingTotal,
  };
}

// ---------------------------------------------------------------------------
// 4. computeCashFlow (Indirect method)
// ---------------------------------------------------------------------------
export function computeCashFlow(
  tb: ParsedTrialBalance,
  bs: BalanceSheet,
  is: IncomeStatement,
  adj: YearEndAdjustments,
): CashFlowStatement {
  const rows = tb.rows;

  const profitBeforeTax = is.profitBeforeTax;

  // Non-cash adjustments
  const addDepreciation = adj.totalDepreciationExpense;
  const addImpairment   = is.impairment;
  const lessInterestIncome  = -is.interestIncome;
  const lessDividendIncome  = -sumCr(rows, 'other_income_dividend');
  const addInterestExpense  = is.financeCharges;
  const addLossOnDisposal   = adj.lossOnDisposals;
  const lessGainOnDisposal  = -adj.gainOnDisposals;

  const fvLoss = adj.investmentAdjustments
    .filter((i) => (i.fairValueGainLoss ?? 0) < 0)
    .reduce((s, i) => s - (i.fairValueGainLoss ?? 0), 0);
  const fvGain = adj.investmentAdjustments
    .filter((i) => (i.fairValueGainLoss ?? 0) > 0)
    .reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const addFVLossOnInvestment  =  fvLoss;
  const lessFVGainOnInvestment = -fvGain;

  // Working capital movements: closing − opening (increase in asset = negative)
  const closingRec = bs.ca_tradeReceivables;
  const openingRec = round(
    sumOpeningDr(rows, 'trade_receivables', 'other_receivables_advance_supplier',
      'other_receivables_prepayments', 'other_receivables_staff_advance', 'other_receivables_loans'),
  );
  const decreaseIncreaseReceivables = round(openingRec - closingRec);

  const closingInv = bs.ca_inventories;
  const openingInv = round(
    sumOpeningDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods'),
  );
  const decreaseIncreaseInventory = round(openingInv - closingInv);

  const decreaseIncreaseOtherCurrentAssets = round(
    sumOpeningDr(rows, 'other_current_assets') - bs.ca_other,
  );

  const closingPayables = bs.cl_tradePayables;
  const openingPayables = round(
    sumOpeningCr(rows, 'trade_payables_creditors', 'tds_payable', 'other_payables', 'audit_fee_payable'),
  );
  const increaseDecreasePayables = round(closingPayables - openingPayables);

  const increaseDecreaseIncomeTaxPayable = round(bs.cl_incomeTaxPayable - sumOpeningCr(rows, 'income_tax_payable'));
  const increaseDecreaseEmployeeLiability = round(
    sumCr(rows, 'employee_payables_pf', 'employee_payables_bonus', 'employee_payables_salary') -
    sumOpeningCr(rows, 'employee_payables_pf', 'employee_payables_bonus', 'employee_payables_salary'),
  );
  const increaseDecreaseProvisions = 0;

  const cashGeneratedFromOperations = round(
    profitBeforeTax + addDepreciation + addImpairment +
    lessInterestIncome + lessDividendIncome + addInterestExpense +
    addLossOnDisposal + lessGainOnDisposal +
    addFVLossOnInvestment + lessFVGainOnInvestment +
    decreaseIncreaseReceivables + decreaseIncreaseInventory +
    decreaseIncreaseOtherCurrentAssets + increaseDecreasePayables +
    increaseDecreaseIncomeTaxPayable + increaseDecreaseEmployeeLiability +
    increaseDecreaseProvisions,
  );

  const interestPaid = -Math.abs(is.financeCharges);
  const incomeTaxPaid = -Math.abs(is.incomeTaxExpense);
  const netCashFromOperating = round(cashGeneratedFromOperations + interestPaid + incomeTaxPaid);

  // ── Investing ─────────────────────────────────────────────────────────────
  const proceedsFromPPEDisposal = adj.depreciationResults
    .reduce((s, r) => s + (r.disposalProceeds ?? 0), 0);
  const proceedsFromInvestmentDisposal = 0;
  const interestReceived  = is.interestIncome;
  const dividendReceived  = Math.abs(lessDividendIncome);

  // PPE additions from adjustments
  const purchaseOfPPE = -adj.assets.reduce((s, a) => s + (a.additionalCost ?? 0), 0);
  const purchaseOfInvestments = -(
    sumDr(rows, 'investment_listed_trading', 'investment_unlisted', 'investment_fixed_deposit_noncurrent') -
    sumOpeningDr(rows, 'investment_listed_trading', 'investment_unlisted', 'investment_fixed_deposit_noncurrent')
  );
  const netCashFromInvesting = round(
    proceedsFromPPEDisposal + proceedsFromInvestmentDisposal +
    interestReceived + dividendReceived + purchaseOfPPE + purchaseOfInvestments,
  );

  // ── Financing ─────────────────────────────────────────────────────────────
  const proceedsFromShareIssue = round(
    sumCr(rows, 'share_capital') - sumOpeningCr(rows, 'share_capital') +
    sumCr(rows, 'share_premium') - sumOpeningCr(rows, 'share_premium'),
  );
  const proceedsFromBorrowingsNonCurrent = round(
    Math.max(0, sumCr(rows, 'borrowings_noncurrent_bank') - sumOpeningCr(rows, 'borrowings_noncurrent_bank')),
  );
  const repaymentOfBorrowingsNonCurrent = round(
    Math.min(0, sumCr(rows, 'borrowings_noncurrent_bank') - sumOpeningCr(rows, 'borrowings_noncurrent_bank')),
  );
  const proceedsFromBorrowingsCurrent = round(
    Math.max(0, sumCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc') -
      sumOpeningCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc')),
  );
  const repaymentOfBorrowingsCurrent = round(
    Math.min(0, sumCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc') -
      sumOpeningCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc')),
  );
  const dividendPaid = 0; // Adjust if dividend payout tracked in TB

  const netCashFromFinancing = round(
    proceedsFromShareIssue + proceedsFromBorrowingsNonCurrent + repaymentOfBorrowingsNonCurrent +
    proceedsFromBorrowingsCurrent + repaymentOfBorrowingsCurrent + dividendPaid,
  );

  // ── Reconciliation ────────────────────────────────────────────────────────
  const netIncreaseDecrease = round(netCashFromOperating + netCashFromInvesting + netCashFromFinancing);
  const openingCash = round(
    sumOpeningDr(rows, 'cash_in_hand', 'bank_current_account', 'bank_fixed_deposit_current') -
    sumOpeningCr(rows, 'bank_current_account'), // opening overdraft offset
  );
  const closingCash = bs.ca_cashAndEquivalents;
  const reconciliationDifference = round(closingCash - (openingCash + netIncreaseDecrease));

  return {
    profitBeforeTax, addDepreciation, addImpairment,
    lessInterestIncome, lessDividendIncome, addInterestExpense,
    addLossOnDisposal, lessGainOnDisposal,
    addFVLossOnInvestment, lessFVGainOnInvestment,
    decreaseIncreaseReceivables, decreaseIncreaseInventory,
    decreaseIncreaseOtherCurrentAssets, increaseDecreasePayables,
    increaseDecreaseIncomeTaxPayable, increaseDecreaseEmployeeLiability,
    increaseDecreaseProvisions, cashGeneratedFromOperations,
    interestPaid, incomeTaxPaid, netCashFromOperating,
    proceedsFromPPEDisposal, proceedsFromInvestmentDisposal,
    interestReceived, dividendReceived, purchaseOfPPE, purchaseOfInvestments,
    netCashFromInvesting,
    proceedsFromShareIssue, proceedsFromBorrowingsNonCurrent, proceedsFromBorrowingsCurrent,
    repaymentOfBorrowingsNonCurrent, repaymentOfBorrowingsCurrent, dividendPaid,
    netCashFromFinancing, netIncreaseDecrease, openingCash, closingCash, reconciliationDifference,
  };
}

// ---------------------------------------------------------------------------
// 5. computeNotesData
// ---------------------------------------------------------------------------
export function computeNotesData(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  bs: BalanceSheet,
  is: IncomeStatement,
): NotesData {
  const rows = tb.rows;

  const categoryRecord = (cats: string[]): Record<string, { cy: number; py: number }> => {
    const out: Record<string, { cy: number; py: number }> = {};
    for (const row of rows) {
      if (cats.includes(row.nfrsCategory as string)) {
        const net = round((row.closingCr ?? 0) - (row.closingDr ?? 0));
        const existing = out[row.rawLabel] ?? { cy: 0, py: 0 };
        out[row.rawLabel] = { cy: round(existing.cy + net), py: 0 };
      }
    }
    return out;
  };

  const expenseRecord = (cats: string[]): Record<string, { cy: number; py: number }> => {
    const out: Record<string, { cy: number; py: number }> = {};
    for (const row of rows) {
      if (cats.includes(row.nfrsCategory as string)) {
        const net = round((row.closingDr ?? 0) - (row.closingCr ?? 0));
        const existing = out[row.rawLabel] ?? { cy: 0, py: 0 };
        out[row.rawLabel] = { cy: round(existing.cy + net), py: 0 };
      }
    }
    return out;
  };

  return {
    note31_ppe: adj.depreciationSummary,
    note32_investments: {
      listedShares: adj.investmentAdjustments.filter(
        (i) => i.investmentType === 'listed_trading' || i.investmentType === 'listed_ats',
      ),
      otherInvestments: adj.investmentAdjustments.filter((i) => i.investmentType === 'unlisted'),
    },
    note33_tradeReceivables: {
      grossReceivables_cy: round(sumDr(rows, 'trade_receivables')),
      grossReceivables_py: 0,
      provisionForImpairment_cy: round(sumCr(rows, 'provision_impairment_debtors')),
      provisionForImpairment_py: 0,
      netReceivables_cy: bs.ca_tradeReceivables,
      netReceivables_py: 0,
    },
    note34_otherReceivables: {
      'Loans and Advances': { cy: round(sumDr(rows, 'other_receivables_loans', 'nca_loans_advances')), py: 0 },
      'Prepayments': { cy: round(sumDr(rows, 'other_receivables_prepayments')), py: 0 },
      'Deposits': { cy: round(sumDr(rows, 'nca_deposits')), py: 0 },
      'Staff Advances': { cy: round(sumDr(rows, 'other_receivables_staff_advance')), py: 0 },
      'Advance to Suppliers': { cy: round(sumDr(rows, 'other_receivables_advance_supplier')), py: 0 },
    },
    note35_otherNonCurrentAssets: { 'Other Non-Current Assets': { cy: bs.nca_other, py: 0 } },
    note36_otherCurrentAssets: { 'Other Current Assets': { cy: bs.ca_other, py: 0 } },
    note37_inventories: {
      rawMaterials_cy: round(sumDr(rows, 'inventory_raw_materials')), rawMaterials_py: 0,
      wip_cy: round(sumDr(rows, 'inventory_wip')), wip_py: 0,
      finishedGoods_cy: round(sumDr(rows, 'inventory_finished_goods')), finishedGoods_py: 0,
      totalInventory_cy: bs.ca_inventories, totalInventory_py: 0,
      impairmentRecognized_cy: adj.totalInventoryImpairment,
    },
    note38_cashAndEquivalents: {
      cashInHand_cy: round(sumDr(rows, 'cash_in_hand')), cashInHand_py: 0,
      bankBalances: rows
        .filter((r) => ['bank_current_account', 'bank_fixed_deposit_current'].includes(r.nfrsCategory as string))
        .map((r) => ({
          bankName: r.rawLabel,
          accountType: (r.nfrsCategory === 'bank_fixed_deposit_current') ? 'fixed_deposit' : 'current',
          cy: round((r.closingDr ?? 0) - (r.closingCr ?? 0)),
          py: 0,
        })),
      totalCash_cy: bs.ca_cashAndEquivalents, totalCash_py: 0,
    },
    note39_shareCapital: {
      authorizedShares: 0,
      faceValuePerShare: 100,
      issuedShares: 0,
      paidUpShares: 0,
      paidUpAmount_cy: round(sumCr(rows, 'share_capital')),
      paidUpAmount_py: round(sumOpeningCr(rows, 'share_capital')),
    },
    note310_reserves: {
      'General Reserve': {
        openingCY: round(sumOpeningCr(rows, 'general_reserve')),
        additionCY: 0,
        closingCY: round(sumCr(rows, 'general_reserve')),
        py: round(sumOpeningCr(rows, 'general_reserve')),
      },
      'Retained Earnings': {
        openingCY: round(sumOpeningCr(rows, 'retained_earnings')),
        additionCY: is.netProfit,
        closingCY: round(sumCr(rows, 'retained_earnings')),
        py: round(sumOpeningCr(rows, 'retained_earnings')),
      },
    },
    note311_borrowings: {
      nonCurrentBank: rows
        .filter((r) => (r.nfrsCategory as string) === 'borrowings_noncurrent_bank')
        .map((r) => ({
          lenderName: r.rawLabel,
          amount_cy: round(r.closingCr ?? 0),
          amount_py: round(r.openingCr ?? 0),
          interestRate: 0,
          security: '',
        })),
      currentLoans: rows
        .filter((r) =>
          ['borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc'].includes(r.nfrsCategory as string),
        )
        .map((r) => ({
          lenderName: r.rawLabel,
          amount_cy: round(r.closingCr ?? 0),
          amount_py: round(r.openingCr ?? 0),
          loanType: r.nfrsCategory as string,
        })),
    },
    note312_employeeBenefits: {
      'Salary Payable': {
        opening: round(sumOpeningCr(rows, 'employee_payables_salary')),
        expense: is.employeeBenefitExpense,
        paid: 0,
        closing: round(sumCr(rows, 'employee_payables_salary')),
      },
      'Bonus Payable': {
        opening: round(sumOpeningCr(rows, 'employee_payables_bonus')),
        expense: is.staffBonus,
        paid: 0,
        closing: round(sumCr(rows, 'employee_payables_bonus')),
      },
    },
    note313_tradePayables: {
      'Trade Payables': { cy: round(sumCr(rows, 'trade_payables_creditors')), py: round(sumOpeningCr(rows, 'trade_payables_creditors')) },
      'TDS Payable': { cy: round(sumCr(rows, 'tds_payable')), py: round(sumOpeningCr(rows, 'tds_payable')) },
      'VAT Payable': { cy: round(sumCr(rows, 'other_payables')), py: round(sumOpeningCr(rows, 'other_payables')) },
      'Audit Fee Payable': { cy: round(sumCr(rows, 'audit_fee_payable')), py: round(sumOpeningCr(rows, 'audit_fee_payable')) },
    },
    note314_provisions: adj.provisions,
    note317_revenue: {
      'Sale of Goods': { cy: round(sumCr(rows, 'revenue_sales')), py: 0 },
      'Rendering of Services': { cy: round(sumCr(rows, 'revenue_services')), py: 0 },
      'Interest Income': { cy: is.interestIncome, py: 0 },
      'Other Income': { cy: is.otherIncome, py: 0 },
    },
    note318_materialConsumed: {
      openingInventory: round(sumOpeningDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods')),
      purchases: round(sumDr(rows, 'cogs_purchases')),
      closingInventory: round(sumDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods')),
      consumed: is.materialConsumed,
    },
    note319_directExpenses: expenseRecord(['direct_wages', 'direct_expenses_other']),
    note320_employeeBenefitExpenses: expenseRecord([
      'emp_expense_salaries', 'emp_expense_pf', 'emp_expense_gratuity',
      'emp_expense_welfare', 'emp_expense_bonus',
    ]),
    note321_impairment: [
      { description: 'Impairment on Trade Receivables', cy: round(sumDr(rows, 'impairment_expense')), py: 0 },
      { description: 'Inventory Write-down', cy: adj.totalInventoryImpairment, py: 0 },
      { description: 'Investment Impairment', cy: adj.investmentAdjustments.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0), py: 0 },
    ],
    note322_adminExpenses: expenseRecord([
      'admin_rent', 'admin_rates_taxes', 'admin_insurance', 'admin_repairs',
      'admin_electricity', 'admin_communication', 'admin_printing', 'admin_legal_professional',
      'admin_audit_fee', 'admin_traveling', 'admin_advertisement', 'admin_other',
    ]),
    note323_incomeTax: {
      currentTax: is.incomeTaxExpense,
      profitBeforeTax: is.profitBeforeTax,
      taxRate: (adj.currentTaxExpense ?? 0) > 0 && is.profitBeforeTax > 0
        ? adj.currentTaxExpense! / is.profitBeforeTax
        : 0.25,
      addDisallowableExpenses: {},
      lessAllowableExpenses: {
        'Tax Depreciation (excess over book)': Math.max(0,
          adj.taxDepreciationPools.reduce((s, p) => s + p.taxDepreciation, 0) - adj.totalDepreciationExpense,
        ),
      },
      taxableIncome: adj.taxableProfit ?? is.profitBeforeTax,
      advanceTaxPaid: round(sumDr(rows, 'other_receivables_tds')),
      tdsCreditAvailable: 0,
      netTaxPayable: bs.cl_incomeTaxPayable,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. computeAllFinancials — master orchestrator
// ---------------------------------------------------------------------------
export function computeAllFinancials(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  company: CompanyProfile,
  previousYearData?: import('../../src/types').PreviousYearBalances,
): {
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  changesInEquity: ChangesInEquity;
  cashFlow: CashFlowStatement;
  notes: NotesData;
} {
  const policies: AccountingPolicies = company.accountingPolicies ?? {
    bonusRatePercent: 10,
    incomeTaxRatePercent: 25,
    gratuityDaysPerYear: 15,
    roundingLevel: 100,
    assetCategories: [],
    depreciationMethod: 'StraightLine',
  };

  // Transform flat previousYearData to partial statements
  const pyBS: Partial<BalanceSheet> = previousYearData ? {
    nca_ppe: previousYearData.ppe,
    nca_investments: previousYearData.investments,
    ca_cashAndEquivalents: previousYearData.cashAndEquivalents,
    totalCurrentAssets: previousYearData.currentAssets,
    eq_shareCapital: previousYearData.shareCapital,
    eq_reserves: previousYearData.reserves,
    ncl_borrowings: previousYearData.borrowingsNonCurrent,
    cl_borrowings: previousYearData.borrowingsCurrent,
    cl_tradePayables: previousYearData.tradePayables,
    cl_provisions: previousYearData.provisions,
  } : {};

  const pyIS: Partial<IncomeStatement> = previousYearData ? {
    revenue: previousYearData.revenue,
    materialConsumed: previousYearData.costOfSales,
    otherIncome: previousYearData.otherIncome,
    adminAndOtherExpenses: previousYearData.adminExpenses,
    financeCharges: previousYearData.financeCosts,
    depreciation: previousYearData.depreciation,
    incomeTaxExpense: previousYearData.incomeTaxExpense,
  } : {};

  // 1. Income Statement first (net profit feeds into equity and BS retained earnings)
  const incomeStatement = computeIncomeStatement(
    tb, adj, policies, pyIS,
  );

  // 2. Balance Sheet (uses IS net profit and depreciation)
  const balanceSheet = computeBalanceSheet(
    tb, adj, incomeStatement, pyBS,
  );

  // 3. Changes in Equity (uses IS net profit)
  const changesInEquity = computeChangesInEquity(tb, incomeStatement, company);

  // 4. Cash Flow Statement (uses BS and IS)
  const cashFlow = computeCashFlow(tb, balanceSheet, incomeStatement, adj);

  // 5. Notes
  const notes = computeNotesData(tb, adj, balanceSheet, incomeStatement);

  return { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes };
}
