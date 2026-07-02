import {
  ParsedTrialBalance,
  MappedTBRow,
  YearEndAdjustments,
  BalanceSheet,
  IncomeStatement,
  CompanyProfile,
  NotesData,
  NFRSCategory,
} from '../../src/types/index.js';
import { computeIncomeTax } from './taxEngine.js';

// ── Helper: sum closing balance of TB rows matching one or more NFRS categories
function sumTBCategory(
  rows: MappedTBRow[],
  categories: NFRSCategory | NFRSCategory[],
  field: 'closingDr' | 'closingCr' | 'openingDr' | 'openingCr' | 'duringDr' | 'duringCr' = 'closingDr',
): number {
  const cats = Array.isArray(categories) ? categories : [categories];
  return rows
    .filter((r) => cats.includes(r.nfrsCategory as NFRSCategory))
    .reduce((sum, r) => sum + (r[field] ?? 0), 0);
}

// Helper: net closing balance (Dr - Cr) for a set of categories
function netClosing(rows: MappedTBRow[], categories: NFRSCategory | NFRSCategory[]): number {
  const cats = Array.isArray(categories) ? categories : [categories];
  return rows
    .filter((r) => cats.includes(r.nfrsCategory as NFRSCategory))
    .reduce((sum, r) => sum + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0);
}

// Helper: get individual rows matching a category
function rowsByCategory(rows: MappedTBRow[], category: NFRSCategory): MappedTBRow[] {
  return rows.filter((r) => r.nfrsCategory === category);
}

// Helper: safely sum an array of numbers
function safeSum(...values: (number | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

// ── Main function ─────────────────────────────────────────────────────────────

export function buildNotesData(params: {
  tb: ParsedTrialBalance;
  adj: YearEndAdjustments;
  bs: BalanceSheet;
  is: IncomeStatement;
  company: CompanyProfile;
}): NotesData {
  const { tb, adj, bs, is: incomeStatement, company } = params;
  const rows = tb.rows ?? [];
  const provisions = adj.provisions ?? [];
  const taxRate = company.accountingPolicies?.incomeTaxRatePercent ?? 25;

  // ── Note 3.1 — PPE ─────────────────────────────────────────────────────────
  const note31_PPE = adj.depreciationSummary ?? [];

  // ── Note 3.2 — Investments ─────────────────────────────────────────────────
  const investmentAdjs = adj.investmentAdjustments ?? [];
  const note32_investments = {
    listedSharesCY: investmentAdjs
      .filter((i) => i.investmentType === 'listed_trading' || i.investmentType === 'listed_ats')
      .reduce((s, i) => s + (i.carryingAmount ?? 0), 0),
    unlistedSharesCY: investmentAdjs
      .filter((i) => i.investmentType === 'unlisted')
      .reduce((s, i) => s + (i.carryingAmount ?? 0), 0),
    mutualFundsCY: 0,
    fdrCY: safeSum(
      sumTBCategory(rows, 'investment_fixed_deposit_noncurrent', 'closingDr'),
      ...investmentAdjs.filter((i) => (i.investmentType as any) === 'fdr').map((i) => i.carryingAmount ?? 0)
    ),
    totalNonCurrentCY: safeSum(
      sumTBCategory(rows, ['investment_listed_trading', 'investment_listed_ats', 'investment_unlisted', 'investment_fixed_deposit_noncurrent'], 'closingDr')
    ),
    breakdown: investmentAdjs.map((inv) => ({
      name: inv.investmentName,
      type: inv.investmentType,
      openingCost: inv.totalCost ?? 0,
      additions: 0,
      disposals: 0,
      fvAdjustment: inv.fairValueGainLoss ?? 0,
      closingCost: inv.totalCost ?? 0,
      impairment: inv.impairmentAmount ?? 0,
      carryingAmount: inv.carryingAmount ?? 0,
    })),
  };

  // ── Note 3.3 — Trade Receivables ────────────────────────────────────────────
  const grossReceivables_cy = sumTBCategory(rows, 'trade_receivables', 'closingDr');
  const provisionForBadDebts = provisions.find((p) => p.provisionType === 'doubtful_debts');
  const provisionForImpairment_cy = Math.abs(
    safeSum(
      sumTBCategory(rows, 'provision_impairment_debtors', 'closingCr'),
      provisionForBadDebts?.closingBalance ?? 0
    )
  );
  const netReceivables_cy = grossReceivables_cy - provisionForImpairment_cy;

  const note33_tradeReceivables = {
    grossReceivablesCY: grossReceivables_cy,
    provisionForImpairmentCY: provisionForImpairment_cy,
    netReceivablesCY: netReceivables_cy,
    // Aging analysis — populated from subledger data if available
    aging: [],
  };

  // ── Note 3.4 — Other Receivables ────────────────────────────────────────────
  const note34_otherReceivables: Record<string, number> = {
    'TDS Receivable': sumTBCategory(rows, 'other_receivables_tds', 'closingDr'),
    'VAT Receivable': 0,
    'Prepayments': sumTBCategory(rows, 'other_receivables_prepayments', 'closingDr'),
    'Accrued Income': 0,
    'Staff Advances': sumTBCategory(rows, 'other_receivables_staff_advance', 'closingDr'),
    'Loans & Advances to Others': sumTBCategory(rows, 'other_receivables_loans', 'closingDr'),
    'Other Current Assets': sumTBCategory(rows, 'other_receivables_other', 'closingDr'),
  };

  // ── Note 3.5 — Other Non-Current Assets ────────────────────────────────────
  const note35_otherNCA: Record<string, number> = {
    'Long-term Loans & Advances': sumTBCategory(rows, 'nca_loans_advances', 'closingDr'),
    'Security Deposits': sumTBCategory(rows, 'nca_deposits', 'closingDr'),
    'Deferred Tax Asset': 0,
  };

  // ── Note 3.7 — Inventories ──────────────────────────────────────────────────
  const invAdjs = adj.inventoryAdjustments ?? [];
  const note37_inventories = {
    rawMaterials: {
      cy: sumTBCategory(rows, 'inventory_raw_materials', 'closingDr') -
          (invAdjs.find((i) => i.category === 'raw_materials')?.impairmentAmount ?? 0),
      py: 0,
    },
    wip: {
      cy: sumTBCategory(rows, 'inventory_wip', 'closingDr') -
          (invAdjs.find((i) => i.category === 'wip')?.impairmentAmount ?? 0),
      py: 0,
    },
    finishedGoods: {
      cy: sumTBCategory(rows, 'inventory_finished_goods', 'closingDr') -
          (invAdjs.find((i) => i.category === 'finished_goods')?.impairmentAmount ?? 0),
      py: 0,
    },
    tradingStock: {
      cy: 0,
      py: 0,
    },
    consumables: {
      cy: 0,
      py: 0,
    },
    totalCY: sumTBCategory(
      rows,
      ['inventory_raw_materials', 'inventory_wip', 'inventory_finished_goods'],
      'closingDr'
    ),
    impairmentRecognisedCY: invAdjs.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0),
  };

  // ── Note 3.8 — Cash & Cash Equivalents ─────────────────────────────────────
  const cashRows = rowsByCategory(rows, 'cash_in_hand');
  const bankCurrentRows = rowsByCategory(rows, 'bank_current_account');
  const bankSavingsRows = rowsByCategory(rows, 'bank_savings_account');
  const shortTermFDRRows = rowsByCategory(rows, 'bank_fixed_deposit_current');

  const note38_cash = {
    cashInHand_cy: cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0),
    cashInHand_py: 0,
    bankBalances: [
      ...bankCurrentRows.map((r) => ({
        bankName: r.rawLabel,
        accountType: 'Current' as const,
        cy: r.closingDr ?? 0,
        py: 0,
      })),
      ...bankSavingsRows.map((r) => ({
        bankName: r.rawLabel,
        accountType: 'Savings' as const,
        cy: r.closingDr ?? 0,
        py: 0,
      })),
      ...shortTermFDRRows.map((r) => ({
        bankName: r.rawLabel,
        accountType: 'FD (≤3 months)' as const,
        cy: r.closingDr ?? 0,
        py: 0,
      })),
    ],
    totalCash_cy: safeSum(
      sumTBCategory(rows, 'cash_in_hand', 'closingDr'),
      sumTBCategory(rows, 'bank_current_account', 'closingDr'),
      sumTBCategory(rows, 'bank_savings_account', 'closingDr'),
      sumTBCategory(rows, 'bank_fixed_deposit_current', 'closingDr'),
    ),
    totalCash_py: 0,
  };

  // ── Note 3.9 — Share Capital ─────────────────────────────────────────────────
  const paidUpCapital = Math.abs(netClosing(rows, 'share_capital'));
  const note39_shareCapital = {
    authorizedAmount: paidUpCapital,   // Default — user can adjust in Excel
    issuedAmount: paidUpCapital,
    paidUpAmount: { cy: paidUpCapital, py: 0 },
    faceValuePerShare: 100,           // Standard NPR 100 per share in Nepal
    numberOfSharesIssued: Math.round(paidUpCapital / 100),
  };

  // ── Note 3.10 — Reserves & Surplus ──────────────────────────────────────────
  const note310_reserves: Record<string, { cy: number; py: number }> = {
    'General Reserve': {
      cy: Math.abs(netClosing(rows, 'general_reserve')),
      py: 0,
    },
    'Share Premium': {
      cy: Math.abs(netClosing(rows, 'share_premium')),
      py: 0,
    },
    'Retained Earnings': {
      cy: Math.abs(netClosing(rows, 'retained_earnings')),
      py: 0,
    },
    'Other Reserves': {
      cy: Math.abs(netClosing(rows, 'other_reserves')),
      py: 0,
    },
  };

  // ── Note 3.11 — Borrowings ───────────────────────────────────────────────────
  const ltBankRows = rowsByCategory(rows, 'borrowings_noncurrent_bank');
  const ltOtherRows = rowsByCategory(rows, 'borrowings_noncurrent_other');
  const stLoanRows = rowsByCategory(rows, 'borrowings_current_wc');
  const odRows = rowsByCategory(rows, 'borrowings_current_od');
  const currentPortionRows = rowsByCategory(rows, 'borrowings_current_portion_lt');

  const note311_borrowings = {
    nonCurrentBank: [
      ...ltBankRows.map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: Math.abs(r.closingCr ?? 0),
        amount_py: 0,
        interestRate: 0,
        security: '',
      })),
      ...ltOtherRows.map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: Math.abs(r.closingCr ?? 0),
        amount_py: 0,
        interestRate: 0,
        security: '',
      })),
    ],
    currentLoans: [
      ...stLoanRows.map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: Math.abs(r.closingCr ?? 0),
        amount_py: 0,
        loanType: 'Short Term',
      })),
      ...odRows.map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: Math.abs(r.closingCr ?? 0),
        amount_py: 0,
        loanType: 'Overdraft',
      })),
      ...currentPortionRows.map((r) => ({
        lenderName: r.rawLabel,
        amount_cy: Math.abs(r.closingCr ?? 0),
        amount_py: 0,
        loanType: 'Current Portion',
      })),
    ],
  };

  // ── Note 3.12 — Employee Benefits ────────────────────────────────────────────
  const gratuityProv = provisions.find((p) => p.provisionType === 'gratuity');
  const leaveProv = provisions.find((p) => p.provisionType === 'leave_encashment');
  const bonusProv = provisions.find((p) => p.provisionType === 'bonus');

  const note312_employeeBenefits = {
    salaryPayable: { cy: sumTBCategory(rows, 'employee_payables_salary', 'closingCr'), py: 0 },
    bonusPayable: { cy: bonusProv?.closingBalance ?? sumTBCategory(rows, 'employee_payables_bonus', 'closingCr'), py: 0 },
    pfPayable: { cy: sumTBCategory(rows, 'employee_payables_pf', 'closingCr'), py: 0 },
    gratuity: {
      opening: 0,
      expense: gratuityProv?.additionForYear ?? 0,
      paid: 0,
      closing: gratuityProv?.closingBalance ?? sumTBCategory(rows, 'employee_benefit_gratuity', 'closingCr'),
    },
    leaveEncashment: {
      opening: 0,
      expense: leaveProv?.additionForYear ?? 0,
      paid: 0,
      closing: leaveProv?.closingBalance ?? 0,
    },
  };

  // ── Note 3.13 — Trade Payables ────────────────────────────────────────────────
  const note313_tradePayables: Record<string, number> = {
    'Trade Creditors (Sundry Creditors)': sumTBCategory(rows, 'trade_payables_creditors', 'closingCr'),
    'Advance from Customers': sumTBCategory(rows, 'trade_payables_advance_customers', 'closingCr'),
    'Audit Fee Payable': sumTBCategory(rows, 'audit_fee_payable', 'closingCr'),
    'TDS / Withholding Tax Payable': sumTBCategory(rows, 'tds_payable', 'closingCr'),
    'Other Payables': sumTBCategory(rows, 'other_payables', 'closingCr'),
  };

  // ── Note 3.14 — Provisions ────────────────────────────────────────────────────
  const note314_provisions = provisions.map((p) => ({
    description: p.description,
    type: p.provisionType,
    opening: p.openingBalance ?? 0,
    additions: p.additionForYear ?? 0,
    utilized: p.utilisedDuringYear ?? 0,
    closing: p.closingBalance ?? 0,
  }));

  // ── Note 3.17 — Revenue ──────────────────────────────────────────────────────
  const note317_revenue: Record<string, number> = {
    'Sale of Goods': sumTBCategory(rows, 'revenue_sales', 'closingCr'),
    'Rendering of Services': sumTBCategory(rows, 'revenue_services', 'closingCr'),
    'Interest Income': sumTBCategory(rows, 'other_income_interest', 'closingCr'),
    'Dividend Income': sumTBCategory(rows, 'other_income_dividend', 'closingCr'),
    'Rental Income': sumTBCategory(rows, 'other_income_rental', 'closingCr'),
    'Other Income': sumTBCategory(rows, 'other_income_misc', 'closingCr'),
  };

  // ── Note 3.18 — Material Consumed & Purchases ────────────────────────────────
  const openingInventoryAll = safeSum(
    sumTBCategory(rows, 'inventory_raw_materials', 'openingDr'),
    sumTBCategory(rows, 'inventory_wip', 'openingDr'),
    sumTBCategory(rows, 'inventory_finished_goods', 'openingDr'),
  );
  const closingInventoryAll = safeSum(
    sumTBCategory(rows, 'inventory_raw_materials', 'closingDr'),
    sumTBCategory(rows, 'inventory_wip', 'closingDr'),
    sumTBCategory(rows, 'inventory_finished_goods', 'closingDr'),
  );
  const totalPurchases = sumTBCategory(rows, 'cogs_purchases', 'closingDr');
  const materialConsumed = openingInventoryAll + totalPurchases - closingInventoryAll;

  const note318_materialConsumed = {
    openingInventory: openingInventoryAll,
    addPurchases: totalPurchases,
    lessClosingInventory: closingInventoryAll,
    materialConsumed,
    inventoryChange: openingInventoryAll - closingInventoryAll,
  };

  // ── Note 3.19 — Direct Expenses ──────────────────────────────────────────────
  const note319_directExpenses: Record<string, number> = {
    'Direct Wages & Labour': sumTBCategory(rows, 'direct_expenses_other', 'closingDr'),
    'Other Direct Expenses': 0,
  };

  // ── Note 3.20 — Employee Benefit Expenses ────────────────────────────────────
  const note320_employeeExpenses: Record<string, number> = {
    'Salaries, Wages & Allowances': sumTBCategory(rows, 'emp_expense_salaries', 'closingDr'),
    "PF / SSF Contribution (Employer's)": sumTBCategory(rows, 'emp_expense_pf', 'closingDr'),
    'Gratuity Expense': gratuityProv?.additionForYear ?? sumTBCategory(rows, 'emp_expense_gratuity', 'closingDr'),
    'Leave Encashment Expense': leaveProv?.additionForYear ?? sumTBCategory(rows, 'employee_benefit_leave', 'closingDr'),
    'Staff Bonus (10% of Net Profit before Tax)': incomeStatement.staffBonus ?? bonusProv?.additionForYear ?? 0,
    'Staff Welfare & Training': sumTBCategory(rows, 'emp_expense_welfare', 'closingDr'),
    'Other Employee Benefits': sumTBCategory(rows, 'emp_expense_other', 'closingDr'),
  };

  // ── Note 3.21 — Finance Costs / Impairment ───────────────────────────────────
  const note321_financeCosts: Record<string, number> = {
    'Bank Interest Expense': sumTBCategory(rows, 'finance_cost_interest', 'closingDr'),
    'Bank Charges & Commission': sumTBCategory(rows, 'finance_cost_bank_charges', 'closingDr'),
    'Other Finance Costs': 0,
  };

  const note321_impairment = [
    {
      description: 'Impairment of Trade Receivables (Provision for Doubtful Debts)',
      cy: provisionForBadDebts?.closingBalance ?? 0,
    },
    {
      description: 'Impairment of Inventories',
      cy: invAdjs.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0),
    },
    {
      description: 'Impairment of Investments',
      cy: investmentAdjs.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0),
    },
  ].filter((i) => i.cy > 0);

  // ── Note 3.22 — Administrative & Other Expenses ──────────────────────────────
  const adminCategoryMap: Array<[NFRSCategory, string]> = [
    ['admin_rent', 'Rent Expense'],
    ['admin_electricity', 'Electricity, Water & Utilities'],
    ['admin_communication', 'Telephone, Internet & Communication'],
    ['admin_printing', 'Printing & Stationery'],
    ['admin_repairs', 'Repairs & Maintenance'],
    ['admin_audit_fee', 'Audit Fee (Statutory & Tax)'],
    ['admin_legal_professional', 'Legal & Professional Fees'],
    ['admin_other', 'Selling & Distribution Expenses'],
    ['admin_traveling', 'Travel & Conveyance'],
    ['admin_insurance', 'Insurance Premium'],
    ['admin_other', 'Miscellaneous Expenses'],
    ['admin_other', 'Other Administrative Expenses'],
  ];

  const note322_adminExpenses: Record<string, number> = {};
  for (const [category, label] of adminCategoryMap) {
    const amount = sumTBCategory(rows, category, 'closingDr');
    if (amount > 0) note322_adminExpenses[label] = amount;
  }

  // ── Note 3.23 — Income Tax ────────────────────────────────────────────────────
  const bookProfit = incomeStatement.profitBeforeTax ?? 0;
  const disallowableTotal = provisions
    .filter((p) => p.provisionType === 'gratuity' || p.provisionType === 'leave_encashment')
    .reduce((s, p) => s + (p.closingBalance ?? 0), 0);

  const bookDepreciation = adj.depreciationSummary?.reduce(
    (s, d) => s + (d.depnForYear ?? 0), 0
  ) ?? 0;

  const taxComputation = computeIncomeTax({
    bookProfit,
    taxRate: taxRate / 100,
    disallowableExpenses: {
      provisions: disallowableTotal,
      bookDepreciation,
    },
    allowableExpenses: {
      taxDepreciation: adj.taxDepreciationPools?.reduce((s, p) => s + p.taxDepreciation, 0) ?? 0,
    },
    advanceTaxPaid: sumTBCategory(rows, 'other_receivables_tds', 'closingDr'),
    tdsCredit: 0,
    previousYearLoss: 0,
  });

  const note323_incomeTax = {
    currentTax: taxComputation.currentTaxExpense,
    profitBeforeTax: bookProfit,
    taxRate: taxRate / 100,
    addDisallowableExpenses: {
      'Provisions (Gratuity/Leave)': disallowableTotal,
      'Accounting Depreciation': bookDepreciation,
    },
    lessAllowableExpenses: {
      'Tax Depreciation (s.19)': adj.taxDepreciationPools?.reduce((s, p) => s + p.taxDepreciation, 0) ?? 0,
    },
    taxableIncome: taxComputation.taxableIncome,
  };

  // ── Assemble NotesData ────────────────────────────────────────────────────────
  const notes: any = {
    // PPE
    note31_ppe: note31_PPE,

    // Investments
    note32_investments,

    // Receivables
    note33_tradeReceivables,
    note34_otherReceivables,
    note35_otherNonCurrentAssets: note35_otherNCA,
    note36_otherCurrentAssets: {}, // placeholder if needed

    // Current Assets
    note37_inventories,
    note38_cashAndEquivalents: note38_cash,

    // Equity
    note39_shareCapital,
    note310_reserves,

    // Liabilities
    note311_borrowings,
    note312_employeeBenefits,
    note313_tradePayables,
    note314_provisions,

    // Income
    note317_revenue,

    // Expenses
    note318_materialConsumed,
    note319_directExpenses,
    note320_employeeBenefitExpenses: note320_employeeExpenses,
    note321_financeCosts,
    note321_impairment,
    note322_adminExpenses,

    // Tax
    note323_incomeTax,
  };

  return notes;
}
