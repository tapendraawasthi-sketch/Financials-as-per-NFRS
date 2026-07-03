// Financial statement computation engine — NAS for MEs / ICAN format.

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
  NFRSCategory,
} from '../../src/types';
import { buildNotesData } from './notesEngine.js';
import { computeTax, computeStaffBonus } from './taxEngine.js';
import { normalizeCategoryAlias } from './accountMatcher.js';
import { CHART_OF_ACCOUNTS } from '../../src/data/chartOfAccounts.js';

// ---------------------------------------------------------------------------
// TB aggregation helpers
// ---------------------------------------------------------------------------

function rowMatchesCategory(rowCategory: string | undefined, categories: string[]): boolean {
  if (!rowCategory) return false;
  const rowNorm = normalizeCategoryAlias(rowCategory);
  for (const cat of categories) {
    const catNorm = normalizeCategoryAlias(cat);
    if (rowCategory === cat || rowNorm === catNorm || rowCategory === catNorm || rowNorm === cat) {
      return true;
    }
  }
  return false;
}

function sumDr(rows: MappedTBRow[], ...categories: (NFRSCategory | string)[]): number {
  return rows
    .filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory as string, categories))
    .reduce((acc, r) => acc + (r.closingDr ?? 0), 0);
}

function sumCr(rows: MappedTBRow[], ...categories: (NFRSCategory | string)[]): number {
  return rows
    .filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory as string, categories))
    .reduce((acc, r) => acc + (r.closingCr ?? 0), 0);
}

function sumOpeningDr(rows: MappedTBRow[], ...categories: (NFRSCategory | string)[]): number {
  return rows
    .filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory as string, categories))
    .reduce((acc, r) => acc + (r.openingDr ?? 0), 0);
}

function sumOpeningCr(rows: MappedTBRow[], ...categories: (NFRSCategory | string)[]): number {
  return rows
    .filter((r) => !r.isGroupRow && rowMatchesCategory(r.nfrsCategory as string, categories))
    .reduce((acc, r) => acc + (r.openingCr ?? 0), 0);
}

function netBalance(rows: MappedTBRow[], ...categories: (NFRSCategory | string)[]): number {
  return sumDr(rows, ...categories) - sumCr(rows, ...categories);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

function splitCashAndOverdrafts(rows: MappedTBRow[]): { cash: number; overdrafts: number } {
  const cashCats = new Set(['cash_in_hand', 'bank_current_account', 'bank_fixed_deposit_current']);
  let cash = 0;
  let overdrafts = 0;
  for (const row of rows) {
    if (!cashCats.has(row.nfrsCategory as string) || (row as { isGroupRow?: boolean }).isGroupRow) continue;
    const net = (row.closingDr ?? 0) - (row.closingCr ?? 0);
    if (net >= 0) cash += net;
    else overdrafts += -net;
  }
  return { cash: round2(cash), overdrafts: round2(overdrafts) };
}

const ADMIN_CATEGORIES = CHART_OF_ACCOUNTS
  .filter((e) => e.statementLine === 'IS Admin' && !e.isGroup)
  .map((e) => e.category)
  .concat([
    'admin_electricity', 'admin_printing', 'admin_legal_professional', 'admin_other',
    'admin_traveling', 'admin_repairs', 'admin_rates_taxes',
  ]);

function inventoryFromAdj(adj: YearEndAdjustments, rows: MappedTBRow[]) {
  const inv = adj.inventoryDetails;
  const openingPY = inv
    ? inv.rawMaterialsPY + inv.wipPY + inv.finishedGoodsPY
    : sumOpeningDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods');
  const closingCY = inv
    ? inv.rawMaterialsCY + inv.wipCY + inv.finishedGoodsCY
    : sumDr(rows, 'inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods');
  return { openingPY, closingCY };
}

// ---------------------------------------------------------------------------
// Income Statement
// ---------------------------------------------------------------------------
export function computeIncomeStatement(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  company: CompanyProfile,
  previousYearIS: Partial<IncomeStatement> = {},
): IncomeStatement {
  const rows = tb.rows;

  const revenue = round2(sumCr(rows, 'revenue_sales', 'revenue_services'));
  const interestIncome = round2(
    sumCr(rows, 'other_income_interest', 'interest_income'),
  );
  const otherIncome = round2(
    sumCr(rows, 'other_income_dividend', 'other_income_rental', 'other_income_misc', 'other_income_disposal_gain', 'commission_income' as NFRSCategory, 'insurance_claim_income' as NFRSCategory)
    + (adj.gainOnDisposals ?? 0)
    + (adj.investmentAdjustments ?? [])
      .filter((i) => (i.fairValueGainLoss ?? 0) > 0)
      .reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0),
  );
  const totalIncome = round2(revenue + interestIncome + otherIncome);

  const { openingPY, closingCY } = inventoryFromAdj(adj, rows);
  const materialConsumed = round2(
    openingPY
    + sumDr(rows, 'cogs_purchases', 'cogs_opening_stock', 'materials_consumed', 'purchase')
    - closingCY,
  );

  const directExpenses = round2(sumDr(rows, 'direct_wages', 'direct_expenses_other'));
  const staffBonusProvision = adj.staffBonusProvision
    ?? round2(sumDr(rows, 'emp_expense_bonus'));
  const employeeBenefitExpense = round2(
    sumDr(rows, 'emp_expense_salaries', 'emp_expense_welfare', 'allowances_expense' as NFRSCategory)
    + sumDr(rows, 'emp_expense_pf', 'emp_expense_gratuity', 'emp_expense_other')
    + staffBonusProvision
    + sumDr(rows, 'emp_expense_leave' as NFRSCategory),
  );

  const financeCharges = round2(sumDr(rows, 'finance_cost_interest', 'finance_cost_bank_charges'));
  const depreciation = round2(adj.totalDepreciationExpense ?? 0);
  const impairment = round2(
    sumDr(rows, 'impairment_expense')
    + (adj.investmentAdjustments ?? []).reduce((s, i) => s + (i.impairmentAmount ?? 0), 0)
    + (adj.investmentAdjustments ?? [])
      .filter((i) => (i.fairValueGainLoss ?? 0) < 0)
      .reduce((s, i) => s + Math.abs(i.fairValueGainLoss ?? 0), 0),
  );

  const adminAndOtherExpenses = round2(
    ADMIN_CATEGORIES.reduce((s, cat) => s + sumDr(rows, cat), 0),
  );

  const totalExpenses = round2(
    materialConsumed + directExpenses + employeeBenefitExpense
    + financeCharges + depreciation + impairment + adminAndOtherExpenses,
  );

  const profitBeforeStaffBonus = round2(totalIncome - (totalExpenses - staffBonusProvision));
  const staffBonus = round2(staffBonusProvision);
  const profitBeforeTax = round2(profitBeforeStaffBonus - staffBonus);

  const incomeTaxExpense = round2(
    adj.incomeTaxProvision ?? adj.currentTaxExpense ?? sumDr(rows, 'income_tax_expense'),
  );
  const netProfit = round2(profitBeforeTax - incomeTaxExpense);

  return {
    revenue, interestIncome, otherIncome, totalIncome,
    materialConsumed, directExpenses, employeeBenefitExpense: employeeBenefitExpense,
    financeCharges, depreciation, impairment, adminAndOtherExpenses, totalExpenses,
    profitBeforeStaffBonus, staffBonus, profitBeforeTax, incomeTaxExpense, netProfit,
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
// Balance Sheet
// ---------------------------------------------------------------------------
export function computeBalanceSheet(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  is: IncomeStatement,
  company: CompanyProfile,
  previousYearBS: Partial<BalanceSheet> = {},
): BalanceSheet {
  const rows = tb.rows;

  const grossPPE = sumDr(
    rows,
    'ppe_land', 'ppe_buildings', 'ppe_vehicles', 'ppe_office_equipment',
    'ppe_computers', 'ppe_furniture', 'ppe_plant_machinery', 'ppe_intangibles', 'ppe_cwip',
  );
  const accumDepn = sumCr(rows, 'accum_depreciation');
  const depnInTB = round2(sumCr(rows, 'accum_depreciation') - sumOpeningCr(rows, 'accum_depreciation'));
  const totalAccumDepn = depnInTB >= adj.totalDepreciationExpense * 0.99
    ? accumDepn
    : accumDepn + adj.totalDepreciationExpense;
  const nca_ppe = round2(Math.max(0, grossPPE - totalAccumDepn));

  const listedFVAdj = (adj.investmentAdjustments ?? [])
    .filter((i) => i.investmentType === 'listed_trading' || i.investmentType === 'listed_ats')
    .reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const unlistedImpair = (adj.investmentAdjustments ?? [])
    .filter((i) => i.investmentType === 'unlisted')
    .reduce((s, i) => s + (i.impairmentAmount ?? 0), 0);

  const invImpairmentProvision = sumCr(
    rows,
    'provision_impairment_investment',
    'provision_impairment_investments',
  );
  const investmentListedTrading = round2(Math.max(0, sumDr(rows, 'investment_listed_trading') + listedFVAdj));
  const investmentUnlisted = sumDr(rows, 'investment_unlisted') - unlistedImpair;
  const investmentFD_NC = sumDr(rows, 'investment_fixed_deposit_noncurrent');
  const nca_investments = round2(Math.max(0,
    investmentUnlisted + investmentFD_NC - invImpairmentProvision,
  ));

  const nca_receivables = round2(
    sumDr(rows, 'nca_deposits', 'nca_loans_advances'),
  );

  const nca_other = round2(
    sumDr(rows, 'biological_assets', 'other_noncurrent_assets', 'nca_other'),
  );
  const totalNonCurrentAssets = round2(nca_ppe + nca_investments + nca_receivables + nca_other);

  const ca_investments = investmentListedTrading;
  const { closingCY } = inventoryFromAdj(adj, rows);
  const ca_inventories = round2(Math.max(0, closingCY - (adj.totalInventoryImpairment ?? 0)));

  const tradeRec = sumDr(rows, 'trade_receivables');
  const impairmentOnRec = sumCr(rows, 'provision_impairment_debtors');
  const ca_tradeReceivables = round2(Math.max(0,
    tradeRec - impairmentOnRec
    + sumDr(rows, 'related_party_receivable')
    + sumDr(rows, 'other_receivables_advance_supplier', 'other_receivables_prepayments',
      'other_receivables_staff_advance', 'other_receivables_tds', 'other_receivables_loans'),
  ));

  const { cash: cashNet, overdrafts: bankOverdrafts } = splitCashAndOverdrafts(rows);
  const ca_cashAndEquivalents = cashNet;

  const ca_other = round2(sumDr(rows, 'lc_bg_margin', 'other_current_assets', 'nca_held_for_sale'));

  const totalCurrentAssets = round2(
    ca_investments + ca_inventories + ca_tradeReceivables + ca_cashAndEquivalents + ca_other,
  );
  const totalAssets = round2(totalNonCurrentAssets + totalCurrentAssets);

  const shareCapital = round2(sumCr(rows, 'share_capital'));
  const sharePremium = round2(sumCr(rows, 'share_premium'));
  const reserves = round2(sumCr(rows, 'capital_reserve', 'revaluation_reserve'));

  const dividendDeclared = adj.dividendPayable
    ?? sumCr(rows, 'dividend_payable')
    ?? round2((company.dividendDeclaredPercent ?? 0) / 100 * shareCapital);

  const openingRE = round2(
    sumOpeningCr(rows, 'retained_earnings', 'general_reserve')
    - sumOpeningDr(rows, 'retained_earnings', 'general_reserve'),
  );
  const eq_retainedEarnings = round2(openingRE + is.netProfit - dividendDeclared);
  const eq_shareCapital = round2(shareCapital + sharePremium);
  const eq_reserves = round2(reserves);
  const totalEquity = round2(eq_shareCapital + eq_reserves + eq_retainedEarnings);

  const ncl_borrowings = round2(
    sumCr(rows, 'borrowings_noncurrent_bank', 'borrowings_noncurrent_other', 'borrowings_noncurrent_related'),
  );
  const ncl_employeeBenefits = round2(sumCr(rows, 'employee_benefit_noncurrent', 'employee_benefit_gratuity'));
  const ncl_provisions = 0;
  const ncl_deferredTax = 0;
  const totalNonCurrentLiabilities = round2(
    ncl_borrowings + ncl_employeeBenefits + ncl_provisions + ncl_deferredTax,
  );

  const cl_borrowings = round2(
    sumCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc',
      'borrowings_current_portion_lt', 'borrowings_related_current', 'related_party_payable')
    + bankOverdrafts,
  );
  const cl_tradePayables = round2(
    sumCr(rows, 'trade_payables_creditors', 'trade_payables', 'audit_fee_payable', 'tds_payable',
      'other_payables', 'trade_payables_advance_customers', 'vat_payable'),
  );

  const incomeTaxPayable = round2(sumCr(rows, 'income_tax_payable'));
  const advanceTax = round2(sumDr(rows, 'advance_tax_paid', 'other_receivables_tds'));
  const cl_incomeTaxPayable = round2(Math.max(0,
    incomeTaxPayable - advanceTax - (adj.incomeTaxPaidPY ?? 0)
    + Math.max(0, (adj.incomeTaxProvision ?? 0) - sumDr(rows, 'income_tax_expense')),
  ));

  const cl_provisions = round2(
    sumCr(rows, 'provisions_csr', 'provisions_current', 'employee_payables_pf',
      'employee_payables_salary', 'employee_payables_bonus'),
  );

  const cl_other = round2(sumCr(rows, 'advance_from_customers', 'dividend_payable'));

  const totalCurrentLiabilities = round2(
    cl_borrowings + cl_tradePayables + cl_incomeTaxPayable + cl_provisions + cl_other,
  );
  const totalEquityAndLiabilities = round2(totalEquity + totalNonCurrentLiabilities + totalCurrentLiabilities);
  const checkDifference = round2(totalAssets - totalEquityAndLiabilities);

  return {
    nca_ppe, nca_investments, nca_receivables, nca_other, totalNonCurrentAssets,
    ca_investments, ca_inventories, ca_tradeReceivables, ca_cashAndEquivalents, ca_other, totalCurrentAssets,
    totalAssets,
    eq_shareCapital, eq_reserves, eq_retainedEarnings, totalEquity,
    ncl_borrowings, ncl_employeeBenefits, ncl_provisions, ncl_deferredTax, totalNonCurrentLiabilities,
    cl_borrowings, cl_tradePayables, cl_incomeTaxPayable, cl_provisions, cl_other, totalCurrentLiabilities,
    totalEquityAndLiabilities, checkDifference,
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
// Changes in Equity
// ---------------------------------------------------------------------------
export function computeChangesInEquity(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  is: IncomeStatement,
  company: CompanyProfile,
  previousCIE?: Partial<ChangesInEquity>,
): ChangesInEquity {
  const rows = tb.rows;
  const shareCapital = sumCr(rows, 'share_capital');
  const sharePremium = sumCr(rows, 'share_premium');
  const otherReserves = sumCr(rows, 'general_reserve', 'capital_reserve', 'revaluation_reserve');
  const openingShareCapital = sumOpeningCr(rows, 'share_capital');
  const openingSharePremium = sumOpeningCr(rows, 'share_premium');
  const openingOtherReserves = sumOpeningCr(rows, 'general_reserve', 'capital_reserve', 'revaluation_reserve');
  const openingRetained = round2(
    sumOpeningCr(rows, 'retained_earnings', 'general_reserve')
    - sumOpeningDr(rows, 'retained_earnings', 'general_reserve'),
  );

  const shareIssued = company.shareIssuedDuringYear
    ? round2(company.shareIssuedDuringYear * 100)
    : round2(shareCapital - openingShareCapital);

  const dividendDeclared = adj.dividendPayable
    ?? sumCr(rows, 'dividend_payable')
    ?? round2((company.dividendDeclaredPercent ?? 0) / 100 * openingShareCapital);

  const closingRetained = round2(openingRetained + is.netProfit - dividendDeclared);

  return {
    cyOpeningShareCapital: round2(openingShareCapital),
    cyOpeningSharePremium: round2(openingSharePremium),
    cyOpeningGeneralReserve: round2(openingOtherReserves),
    cyOpeningRetainedEarnings: round2(openingRetained),
    cyOpeningTotal: round2(openingShareCapital + openingSharePremium + openingOtherReserves + openingRetained),
    cyNetProfit: round2(is.netProfit),
    cyShareCapitalIssued: shareIssued,
    cySharePremiumReceived: round2(sharePremium - openingSharePremium),
    cyTransferToReserve: 0,
    cyDividends: round2(dividendDeclared),
    cyClosingShareCapital: round2(shareCapital),
    cyClosingSharePremium: round2(sharePremium),
    cyClosingGeneralReserve: round2(otherReserves),
    cyClosingRetainedEarnings: closingRetained,
    cyClosingTotal: round2(shareCapital + sharePremium + otherReserves + closingRetained),
    ...previousCIE,
  };
}

// ---------------------------------------------------------------------------
// Cash Flow (indirect method)
// ---------------------------------------------------------------------------
export function computeCashFlow(
  tb: ParsedTrialBalance,
  adj: YearEndAdjustments,
  is: IncomeStatement,
  bs: BalanceSheet,
  previousCF?: Partial<CashFlowStatement>,
): CashFlowStatement {
  const rows = tb.rows;
  const profitBeforeTax = is.profitBeforeTax;

  const addDepreciation = adj.totalDepreciationExpense ?? 0;
  const addImpairment = is.impairment;
  const lessInterestIncome = -is.interestIncome;
  const lessDividendIncome = -sumCr(rows, 'other_income_dividend');
  const addInterestExpense = is.financeCharges;
  const addLossOnDisposal = adj.lossOnDisposals ?? 0;
  const lessGainOnDisposal = -(adj.gainOnDisposals ?? 0);

  const fvLoss = (adj.investmentAdjustments ?? [])
    .filter((i) => (i.fairValueGainLoss ?? 0) < 0)
    .reduce((s, i) => s - (i.fairValueGainLoss ?? 0), 0);
  const fvGain = (adj.investmentAdjustments ?? [])
    .filter((i) => (i.fairValueGainLoss ?? 0) > 0)
    .reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  const addFVLossOnInvestment = fvLoss;
  const lessFVGainOnInvestment = -fvGain;

  const prevTradeRec = previousCF?.decreaseIncreaseReceivables !== undefined
    ? bs.ca_tradeReceivables + (previousCF.decreaseIncreaseReceivables as number)
    : round2(
      sumOpeningDr(rows, 'trade_receivables', 'other_receivables_advance_supplier',
        'other_receivables_prepayments', 'other_receivables_staff_advance',
        'other_receivables_loans', 'related_party_receivable')
      - sumOpeningCr(rows, 'provision_impairment_debtors'),
    );
  const decreaseIncreaseReceivables = round2(prevTradeRec - bs.ca_tradeReceivables);

  const { openingPY, closingCY } = inventoryFromAdj(adj, rows);
  const prevInv = previousCF?.decreaseIncreaseInventory !== undefined
    ? bs.ca_inventories + (previousCF.decreaseIncreaseInventory as number)
    : openingPY;
  const decreaseIncreaseInventory = round2(prevInv - bs.ca_inventories);

  const prevOtherCA = sumOpeningDr(rows, 'other_current_assets', 'nca_held_for_sale');
  const decreaseIncreaseOtherCurrentAssets = round2(prevOtherCA - bs.ca_other);

  const prevPayables = sumOpeningCr(rows, 'trade_payables_creditors', 'tds_payable',
    'other_payables', 'audit_fee_payable', 'trade_payables_advance_customers');
  const increaseDecreasePayables = round2(bs.cl_tradePayables - prevPayables);

  const prevTaxPayable = sumOpeningCr(rows, 'income_tax_payable');
  const increaseDecreaseIncomeTaxPayable = round2(bs.cl_incomeTaxPayable - prevTaxPayable);

  const prevEmpLiab = sumOpeningCr(rows, 'employee_payables_pf', 'employee_payables_bonus',
    'employee_payables_salary', 'employee_benefit_noncurrent');
  const currentEmpLiab = round2(
    sumCr(rows, 'employee_payables_pf', 'employee_payables_bonus', 'employee_payables_salary')
    + (adj.staffBonusProvision ?? is.staffBonus),
  );
  const increaseDecreaseEmployeeLiability = round2(currentEmpLiab - prevEmpLiab);

  const prevProvisions = sumOpeningCr(rows, 'provisions_csr', 'provisions_current');
  const increaseDecreaseProvisions = round2(bs.cl_provisions - prevProvisions - (adj.staffBonusProvision ?? 0));

  const cashGeneratedFromOperations = round2(
    profitBeforeTax + addDepreciation + addImpairment
    + lessInterestIncome + lessDividendIncome + addInterestExpense
    + addLossOnDisposal + lessGainOnDisposal
    + addFVLossOnInvestment + lessFVGainOnInvestment
    + decreaseIncreaseReceivables + decreaseIncreaseInventory
    + decreaseIncreaseOtherCurrentAssets + increaseDecreasePayables
    + increaseDecreaseIncomeTaxPayable + increaseDecreaseEmployeeLiability
    + increaseDecreaseProvisions,
  );

  const interestPaid = -Math.abs(is.financeCharges);
  const incomeTaxPaid = -Math.abs(
    sumDr(rows, 'advance_tax_paid') + (adj.incomeTaxPaidPY ?? 0),
  );
  const netCashFromOperating = round2(cashGeneratedFromOperations + interestPaid + incomeTaxPaid);

  const proceedsFromPPEDisposal = (adj.depreciationResults ?? [])
    .reduce((s, r) => s + (r.disposalProceeds ?? 0), 0);
  const proceedsFromInvestmentDisposal = 0;
  const interestReceived = is.interestIncome;
  const dividendReceived = sumCr(rows, 'other_income_dividend');
  const purchaseOfPPE = -(adj.assets ?? []).reduce((s, a) => s + (a.additionalCost ?? 0), 0);
  const purchaseOfInvestments = -Math.max(0,
    netBalance(rows, 'investment_listed_trading', 'investment_unlisted', 'investment_fixed_deposit_noncurrent')
    - (sumOpeningDr(rows, 'investment_listed_trading', 'investment_unlisted', 'investment_fixed_deposit_noncurrent')
      - sumOpeningCr(rows, 'investment_listed_trading', 'investment_unlisted', 'investment_fixed_deposit_noncurrent')),
  );

  const netCashFromInvesting = round2(
    proceedsFromPPEDisposal + proceedsFromInvestmentDisposal
    + interestReceived + dividendReceived + purchaseOfPPE + purchaseOfInvestments,
  );

  const proceedsFromShareIssue = round2(
    (sumCr(rows, 'share_capital') - sumOpeningCr(rows, 'share_capital'))
    + (sumCr(rows, 'share_premium') - sumOpeningCr(rows, 'share_premium')),
  );

  const ncBorrowChange = sumCr(rows, 'borrowings_noncurrent_bank', 'borrowings_noncurrent_other')
    - sumOpeningCr(rows, 'borrowings_noncurrent_bank', 'borrowings_noncurrent_other');
  const proceedsFromBorrowingsNonCurrent = round2(Math.max(0, ncBorrowChange));
  const repaymentOfBorrowingsNonCurrent = round2(Math.min(0, ncBorrowChange));

  const cBorrowChange = sumCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc')
    - sumOpeningCr(rows, 'borrowings_current_od', 'borrowings_current_cc', 'borrowings_current_wc');
  const proceedsFromBorrowingsCurrent = round2(Math.max(0, cBorrowChange));
  const repaymentOfBorrowingsCurrent = round2(Math.min(0, cBorrowChange));

  const dividendPaid = -round2(adj.incomeTaxPaidPY ? 0 : (adj.dividendPayable ?? sumCr(rows, 'dividend_payable')));

  const netCashFromFinancing = round2(
    proceedsFromShareIssue + proceedsFromBorrowingsNonCurrent + repaymentOfBorrowingsNonCurrent
    + proceedsFromBorrowingsCurrent + repaymentOfBorrowingsCurrent + dividendPaid,
  );

  const netIncreaseDecrease = round2(netCashFromOperating + netCashFromInvesting + netCashFromFinancing);
  const openingCash = round2(
    sumOpeningDr(rows, 'cash_in_hand', 'bank_current_account', 'bank_fixed_deposit_current')
    - sumOpeningCr(rows, 'bank_current_account'),
  );
  const closingCash = bs.ca_cashAndEquivalents;
  const reconciliationDifference = round2(closingCash - (openingCash + netIncreaseDecrease));

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
    ...previousCF,
  };
}

// ---------------------------------------------------------------------------
// Master orchestrator
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
  const enrichedAdj: YearEndAdjustments = { ...adj };

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

  const incomeStatement = computeIncomeStatement(tb, enrichedAdj, company, pyIS);

  if (enrichedAdj.staffBonusProvision == null && incomeStatement.profitBeforeStaffBonus > 0) {
    enrichedAdj.staffBonusProvision = computeStaffBonus(incomeStatement.profitBeforeStaffBonus);
    incomeStatement.staffBonus = enrichedAdj.staffBonusProvision;
    incomeStatement.profitBeforeTax = round2(incomeStatement.profitBeforeStaffBonus - incomeStatement.staffBonus);
  }

  if (enrichedAdj.incomeTaxProvision == null && incomeStatement.profitBeforeTax > 0) {
    const taxRate = (company.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;
    const taxResult = computeTax({
      accountingProfit: incomeStatement.profitBeforeTax,
      accountingDepreciation: enrichedAdj.totalDepreciationExpense ?? incomeStatement.depreciation ?? 0,
      taxDepreciation: enrichedAdj.taxDepreciationPools?.reduce((s, p) => s + (p.taxDepreciation ?? 0), 0) ?? 0,
      disallowedForTax: enrichedAdj.disallowedForTax ?? [],
      staffBonus: enrichedAdj.staffBonusProvision ?? 0,
      profitBeforeBonus: incomeStatement.profitBeforeStaffBonus,
      advanceTaxPaid: sumDr(tb.rows, 'advance_tax_paid'),
      incomeTaxRate: taxRate,
      entityType: (company.entityType as 'Company' | 'Partnership' | 'Sole Proprietorship' | 'Cooperative' | 'Other') ?? 'Company',
    });
    enrichedAdj.incomeTaxProvision = taxResult.currentTaxExpense;
    enrichedAdj.currentTaxExpense = taxResult.currentTaxExpense;
    incomeStatement.incomeTaxExpense = taxResult.currentTaxExpense;
    incomeStatement.netProfit = round2(incomeStatement.profitBeforeTax - incomeStatement.incomeTaxExpense);
  }

  const balanceSheet = computeBalanceSheet(tb, enrichedAdj, incomeStatement, company, pyBS);
  const changesInEquity = computeChangesInEquity(tb, enrichedAdj, incomeStatement, company);
  const cashFlow = computeCashFlow(tb, enrichedAdj, incomeStatement, balanceSheet);
  const notes = buildNotesData({ tb, adj: enrichedAdj, bs: balanceSheet, is: incomeStatement, company });

  return { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes };
}
