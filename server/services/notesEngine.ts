// Builds typed data objects for all 26 NAS for MEs notes (Note 3.1 – Note 3.26).
// Each note produces both a structured data object and enough information for
// the Excel writer to render a fully formatted note sheet.

import type {
  ParsedTrialBalance,
  MappedTBRow,
  YearEndAdjustments,
  BalanceSheet,
  IncomeStatement,
  CompanyProfile,
  NotesData,
  NFRSCategory,
  DepreciationSummary,
  InvestmentAdjustment,
  ProvisionEntry,
} from '../../src/types/index.js';
import { computeIncomeTax } from './taxEngine.js';
import { subledgerStore } from '../store/subledgerStore.js';

// ─── Internal helpers ──────────────────────────────────────────────────────────

function sumTB(
  rows: MappedTBRow[],
  categories: NFRSCategory | NFRSCategory[],
  field: 'closingDr' | 'closingCr' | 'openingDr' | 'openingCr' | 'duringDr' | 'duringCr' = 'closingDr',
): number {
  const cats = Array.isArray(categories) ? categories : [categories];
  return rows
    .filter((r) => cats.includes(r.nfrsCategory as NFRSCategory) && !(r as any).isGroupRow)
    .reduce((s, r) => s + (r[field] ?? 0), 0);
}

function netClosing(rows: MappedTBRow[], categories: NFRSCategory | NFRSCategory[]): number {
  const cats = Array.isArray(categories) ? categories : [categories];
  return rows
    .filter((r) => cats.includes(r.nfrsCategory as NFRSCategory) && !(r as any).isGroupRow)
    .reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0);
}

function rowsByCategory(rows: MappedTBRow[], category: NFRSCategory): MappedTBRow[] {
  return rows.filter((r) => r.nfrsCategory === category && !(r as any).isGroupRow);
}

function safeSum(...vals: (number | undefined)[]): number {
  return vals.reduce<number>((a, v) => a + (v ?? 0), 0);
}

const round = (n: number) => Math.round(n * 100) / 100;

function debtorDaysOutstanding(d: Record<string, unknown>): number {
  if (typeof d.daysOutstanding === 'number') return d.daysOutstanding;
  if (typeof d.agingDays === 'number') return d.agingDays;
  const cat = String(d.ageCategory ?? '');
  if (cat === '<30days') return 15;
  if (cat === '31-60days') return 45;
  if (cat === '61-90days') return 75;
  if (cat === '>90days') return 120;
  return 0;
}

function debtorAmount(d: Record<string, unknown>): number {
  return Number(d.debitBalance ?? d.balanceCY ?? d.amount ?? 0);
}

function buildAgingAnalysis(
  debtors: Record<string, unknown>[],
  grossReceivables: number,
): Array<{ bucket: string; amount: number }> {
  const buckets = [
    { bucket: '0-30 days', min: 0, max: 30, amount: 0 },
    { bucket: '31-60 days', min: 31, max: 60, amount: 0 },
    { bucket: '61-90 days', min: 61, max: 90, amount: 0 },
    { bucket: '>90 days', min: 91, max: Number.POSITIVE_INFINITY, amount: 0 },
  ];
  for (const d of debtors) {
    const amt = debtorAmount(d);
    if (amt <= 0) continue;
    const days = debtorDaysOutstanding(d);
    const bucket = buckets.find((b) => days >= b.min && days <= b.max) ?? buckets[3];
    bucket.amount += amt;
  }
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  if (total > 0 && grossReceivables > 0 && Math.abs(total - grossReceivables) > 1) {
    const factor = grossReceivables / total;
    buckets.forEach((b) => { b.amount = round(b.amount * factor); });
  }
  return buckets.map(({ bucket, amount }) => ({ bucket, amount: round(amount) }));
}

function mapSubledgerBankType(
  accountType: string,
): 'Current' | 'Savings' | 'Fixed Deposit (≤3 months)' {
  const t = accountType.toLowerCase();
  if (t === 'savings') return 'Savings';
  if (t === 'fixed_deposit') return 'Fixed Deposit (≤3 months)';
  return 'Current';
}

function isLoanBankType(accountType: string): boolean {
  const t = accountType.toLowerCase();
  return t === 'loan' || t === 'overdraft' || t === 'cash_credit' || t === 'working_capital';
}

// TAX DEPRECIATION RATES — Nepal Income Tax Act 2058, Schedule 2
const TAX_DEPN_RATES: Record<string, number> = {
  ppe_buildings:        0.05,
  ppe_furniture:        0.25,
  ppe_vehicles:         0.20,
  ppe_plant_machinery:  0.15,
  ppe_intangibles:      0.15,
  ppe_computers:        0.25,
  ppe_office_equipment: 0.15,
};

// ─── Main export ───────────────────────────────────────────────────────────────

export function buildNotesData(params: {
  tb: ParsedTrialBalance;
  adj: YearEndAdjustments;
  bs: BalanceSheet;
  is: IncomeStatement;
  company: CompanyProfile;
}): NotesData {
  const { tb, adj, bs, is: IS, company } = params;
  const rows = tb.rows ?? [];
  const provisions = adj.provisions ?? [];
  const subledger = (company as { id?: string }).id
    ? subledgerStore.get((company as { id?: string }).id!)
    : null;
  const taxRate = (company.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;
  const roundingLevel = company.accountingPolicies?.roundingLevel ?? 1;

  // ─── Note 3.1 — PPE ────────────────────────────────────────────────────────

  const PPE_CLASSES: Array<{ categoryId: string; label: string }> = [
    { categoryId: 'Land',              label: 'Land' },
    { categoryId: 'Building',          label: 'Buildings' },
    { categoryId: 'OfficeEquipment',   label: 'Furniture, Computers & Office Equipment' },
    { categoryId: 'Vehicle',           label: 'Vehicles' },
    { categoryId: 'PlantMachinery',    label: 'Plant & Machinery' },
    { categoryId: 'Intangible',        label: 'Intangibles / Software' },
    { categoryId: 'UnderConstruction', label: 'Capital Work in Progress' },
  ];

  const depnSummaryMap = new Map<string, DepreciationSummary>(
    (adj.depreciationSummary ?? []).map((d) => [d.categoryId, d])
  );

  const note31_ppe: NotesData['note31_ppe'] = PPE_CLASSES.map((cls) => {
    const d = depnSummaryMap.get(cls.categoryId);
    const tbGross    = sumTB(rows, cls.categoryId as NFRSCategory, 'closingDr');
    const tbOpenGross= sumTB(rows, cls.categoryId as NFRSCategory, 'openingDr');

    const openingCost       = d?.openingCost       ?? tbOpenGross;
    const additions         = d?.additions          ?? 0;
    const disposals         = d?.disposals          ?? 0;
    const closingCost       = d?.closingCost        ?? (openingCost + additions - disposals);
    const openingAccumDepn  = d?.openingAccumDepn   ?? 0;
    const depnForYear       = d?.depnForYear        ?? 0;
    const depnOnDisposal    = d?.depnOnDisposal     ?? 0;
    const closingAccumDepn  = d?.closingAccumDepn   ?? (openingAccumDepn + depnForYear - depnOnDisposal);
    const nbvClosing        = d?.netBookValueClosing ?? Math.max(0, closingCost - closingAccumDepn);
    const nbvOpening        = Math.max(0, openingCost - openingAccumDepn);

    // Assets pledged as security
    const assetsSecured = (adj.assets ?? [])
      .filter((a) => a.categoryId === cls.categoryId && a.isMortgaged)
      .reduce((s, a) => s + a.originalCost, 0);

    return {
      categoryId:      cls.categoryId,
      categoryName:    cls.label,
      // Cost movement
      openingCost,
      additions,
      disposals,
      closingCost,
      // Accumulated depreciation movement
      openingAccumDepn,
      depnForYear,
      impairmentLosses:   0,
      depnOnDisposal,
      closingAccumDepn,
      // NBV
      netBookValueClosing: nbvClosing,
      nbvClosing,
      nbvOpening,
      // Assets pledged
      securedAmount: assetsSecured,
      hasSecuredAssets: assetsSecured > 0,
      // Individual assets
      assets: (adj.depreciationSummary?.find((ds) => ds.categoryId === cls.categoryId)?.assets) ?? [],
    };
  }).filter((item) =>
    // Only include categories that have any balance or movement
    item.openingCost > 0 || item.additions > 0 || item.closingCost > 0
  );

  // ─── Note 3.2 — Investments ────────────────────────────────────────────────

  const investmentAdjs = adj.investmentAdjustments ?? [];

  const listedShares = investmentAdjs.filter(
    (i) => i.investmentType === 'listed_trading' || i.investmentType === 'listed_ats',
  ).map((inv) => ({
    companyName:       inv.investmentName,
    openingUnits:      inv.units ?? 0,
    purchasesDuringYear: 0,
    salesDuringYear:   0,
    closingUnits:      inv.units ?? 0,
    costPerUnit:       inv.totalCost && inv.units ? inv.totalCost / inv.units : 0,
    totalCost:         inv.totalCost ?? 0,
    ltp:               inv.ltp ?? 0,
    marketValue:       inv.marketValue ?? ((inv.units ?? 0) * (inv.ltp ?? 0)),
    fairValueGainLoss: inv.fairValueGainLoss ?? 0,
    impairmentAmount:  inv.impairmentAmount ?? 0,
    carryingAmount:    inv.carryingAmount ?? 0,
  }));

  const unlistedShares = investmentAdjs.filter(
    (i) => i.investmentType === 'unlisted',
  ).map((inv) => ({
    companyName:      inv.investmentName,
    openingCost:      inv.totalCost ?? 0,
    additions:        0,
    disposals:        0,
    impairmentAmount: inv.impairmentAmount ?? 0,
    closingCarrying:  inv.carryingAmount ?? 0,
  }));

  const fdrNonCurrent = sumTB(rows, 'investment_fixed_deposit_noncurrent', 'closingDr');
  const fdrCurrent    = sumTB(rows, 'bank_fixed_deposit_current', 'closingDr');

  const note32_investments: NotesData['note32_investments'] = {
    listedShares,
    unlistedShares,
    fdrNonCurrent,
    fdrCurrent,
    totalNonCurrent: listedShares.reduce((s, i) => s + i.carryingAmount, 0)
      + unlistedShares.reduce((s, i) => s + i.closingCarrying, 0)
      + fdrNonCurrent,
    totalCurrent:    listedShares.reduce((s, i) => s + i.marketValue, 0) + fdrCurrent,
  };

  // ─── Note 3.3 — Trade and Other Receivables ────────────────────────────────

  const grossReceivables     = sumTB(rows, 'trade_receivables', 'closingDr');
  const grossReceivablesOpen = sumTB(rows, 'trade_receivables', 'openingDr');

  const provisionBadDebt    = provisions.find((p) => p.provisionType === 'doubtful_debts');
  const provisionImpairment = Math.abs(safeSum(
    sumTB(rows, 'provision_impairment_debtors', 'closingCr'),
    provisionBadDebt?.closingBalance ?? 0,
  ));
  const provisionImpairmentOpen = Math.abs(safeSum(
    sumTB(rows, 'provision_impairment_debtors', 'openingCr'),
    provisionBadDebt?.openingBalance ?? 0,
  ));
  const provisionAdditions = provisionBadDebt?.additionForYear ?? 0;
  const provisionWriteOffs = provisionBadDebt?.utilisedDuringYear ?? 0;
  const provisionReversals = 0;

  const debtorRows = (
    subledger?.debtors?.length
      ? subledger.debtors
      : (adj.debtors as unknown as Record<string, unknown>[] | undefined) ?? []
  ) as Record<string, unknown>[];
  const agingAnalysis = debtorRows.length > 0
    ? buildAgingAnalysis(debtorRows, grossReceivables)
    : [];

  const note33_tradeReceivables: NotesData['note33_tradeReceivables'] = {
    grossReceivables_cy:       grossReceivables,
    grossReceivables_py:       grossReceivablesOpen,
    provisionMovement: {
      opening:   provisionImpairmentOpen,
      additions: provisionAdditions,
      writeOffs: provisionWriteOffs,
      reversals: provisionReversals,
      closing:   provisionImpairment,
    },
    provisionForImpairment_cy: provisionImpairment,
    provisionForImpairment_py: provisionImpairmentOpen,
    netReceivables_cy:         round(grossReceivables - provisionImpairment),
    netReceivables_py:         round(grossReceivablesOpen - provisionImpairmentOpen),
    relatedPartyReceivables:   sumTB(rows, 'related_party_receivable', 'closingDr'),
    prepayments:               sumTB(rows, 'other_receivables_prepayments', 'closingDr'),
    tdsReceivable:             sumTB(rows, 'other_receivables_tds', 'closingDr'),
    staffAdvances:             sumTB(rows, 'other_receivables_staff_advance', 'closingDr'),
    advanceToSuppliers:        sumTB(rows, 'other_receivables_advance_supplier', 'closingDr'),
    otherLoansAdvances:        sumTB(rows, 'other_receivables_loans', 'closingDr'),
    nonCurrentPortion:         safeSum(
      sumTB(rows, 'nca_loans_advances', 'closingDr'),
      sumTB(rows, 'nca_deposits', 'closingDr'),
    ),
    currentPortion:            round(
      grossReceivables - provisionImpairment
      + sumTB(rows, 'other_receivables_prepayments', 'closingDr')
      + sumTB(rows, 'other_receivables_tds', 'closingDr')
      + sumTB(rows, 'other_receivables_staff_advance', 'closingDr')
      + sumTB(rows, 'other_receivables_advance_supplier', 'closingDr')
      + sumTB(rows, 'other_receivables_loans', 'closingDr')
    ),
    agingAnalysis,
  };

  // ─── Note 3.4 — Other Current Assets ──────────────────────────────────────

  const note34_otherCurrentAssets: NotesData['note34_otherCurrentAssets'] = {
    securityDeposits:    sumTB(rows, 'nca_deposits', 'closingDr'),    // current portion
    guaranteeMargins:    0,
    advanceIncomeTax:    sumTB(rows, 'advance_tax_paid', 'closingDr'),
    otherPrepaidExpenses:sumTB(rows, 'other_receivables_other', 'closingDr'),
    total: round(
      sumTB(rows, 'nca_deposits', 'closingDr')
      + sumTB(rows, 'advance_tax_paid', 'closingDr')
      + sumTB(rows, 'other_receivables_other', 'closingDr')
    ),
  };

  // ─── Note 3.5 — Biological Assets ─────────────────────────────────────────

  const bioOpeningBalance = sumTB(rows, 'biological_assets' as NFRSCategory, 'openingDr');
  const bioClosingBalance = sumTB(rows, 'biological_assets' as NFRSCategory, 'closingDr');

  const note35_biologicalAssets: NotesData['note35_biologicalAssets'] = {
    hasBalance: bioClosingBalance > 0 || bioOpeningBalance > 0,
    openingCarrying:    bioOpeningBalance,
    additionsPurchases: Math.max(0, sumTB(rows, 'biological_assets' as NFRSCategory, 'duringDr')),
    disposalsSales:     Math.max(0, sumTB(rows, 'biological_assets' as NFRSCategory, 'duringCr')),
    fairValueAdjustment:0,
    closingCarrying:    bioClosingBalance,
  };

  // ─── Note 3.6 — Non-Current Assets Held for Sale ──────────────────────────

  const hfsBalance = sumTB(rows, 'nca_held_for_sale' as NFRSCategory, 'closingDr');

  const note36_heldForSale: NotesData['note36_heldForSale'] = {
    hasBalance: hfsBalance > 0,
    assets: hfsBalance > 0 ? [{
      description:    'Non-Current Assets Held for Sale',
      carryingAmount: hfsBalance,
      expectedSaleDate: null,
    }] : [],
    total: hfsBalance,
  };

  // ─── Note 3.7 — Inventories ────────────────────────────────────────────────

  const invAdjs = adj.inventoryAdjustments ?? [];

  const rmClosing  = round(sumTB(rows, 'inventory_raw_materials', 'closingDr')
    - (invAdjs.find((i) => i.category === 'raw_materials')?.impairmentAmount ?? 0));
  const wipClosing = round(sumTB(rows, 'inventory_wip', 'closingDr')
    - (invAdjs.find((i) => i.category === 'wip')?.impairmentAmount ?? 0));
  const fgClosing  = round(sumTB(rows, 'inventory_finished_goods', 'closingDr')
    - (invAdjs.find((i) => i.category === 'finished_goods')?.impairmentAmount ?? 0));

  const rmOpening  = sumTB(rows, 'inventory_raw_materials', 'openingDr');
  const wipOpening = sumTB(rows, 'inventory_wip', 'openingDr');
  const fgOpening  = sumTB(rows, 'inventory_finished_goods', 'openingDr');

  const note37_inventories: NotesData['note37_inventories'] = {
    rawMaterials:   { opening: rmOpening,  closing: rmClosing  },
    wip:            { opening: wipOpening, closing: wipClosing },
    finishedGoods:  { opening: fgOpening,  closing: fgClosing  },
    totalOpening:   round(rmOpening + wipOpening + fgOpening),
    totalClosing:   round(rmClosing + wipClosing + fgClosing),
    impairmentRecognised: invAdjs.reduce((s, i) => s + (i.impairmentAmount ?? 0), 0),
    inventoryAtNRV:       invAdjs.filter((i) => i.writtenDownTo !== undefined)
      .reduce((s, i) => s + (i.writtenDownTo ?? 0), 0),
    pledgedAsSecurityAmt: 0,
    costFormula: company.accountingPolicies?.inventoryCostMethod ?? 'WeightedAverage',
  };

  // ─── Note 3.8 — Cash and Cash Equivalents ──────────────────────────────────

  const cashRows       = rowsByCategory(rows, 'cash_in_hand');
  const bankCurrentRows= rowsByCategory(rows, 'bank_current_account');
  const bankSavingsRows= rowsByCategory(rows, 'bank_savings_account');
  const fdCurrentRows  = rowsByCategory(rows, 'bank_fixed_deposit_current');

  const subledgerCashAssetBanks = (subledger?.bankAccounts ?? [])
    .filter((b) => b.balance >= 0 && !isLoanBankType(b.accountType));
  const subledgerBankRows = subledgerCashAssetBanks.map((b) => ({
    accountName:    b.bankName,
    bankName:       b.bankName,
    accountType:    mapSubledgerBankType(b.accountType),
    closingBalance: round(b.balance),
    openingBalance: 0,
  }));

  const note38_cashEquivalents: NotesData['note38_cashEquivalents'] = {
    cashInHand_cy:  cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0),
    cashInHand_py:  cashRows.reduce((s, r) => s + (r.openingDr ?? 0), 0),
    bankAccounts: subledgerBankRows.length > 0 ? subledgerBankRows : [
      ...bankCurrentRows.map((r) => ({
        accountName:    r.rawLabel,
        bankName:       r.rawLabel,
        accountType:    'Current' as const,
        closingBalance: round((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        openingBalance: round((r.openingDr ?? 0) - (r.openingCr ?? 0)),
      })),
      ...bankSavingsRows.map((r) => ({
        accountName:    r.rawLabel,
        bankName:       r.rawLabel,
        accountType:    'Savings' as const,
        closingBalance: round((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        openingBalance: round((r.openingDr ?? 0) - (r.openingCr ?? 0)),
      })),
      ...fdCurrentRows.map((r) => ({
        accountName:    r.rawLabel,
        bankName:       r.rawLabel,
        accountType:    'Fixed Deposit (≤3 months)' as const,
        closingBalance: round(r.closingDr ?? 0),
        openingBalance: round(r.openingDr ?? 0),
      })),
    ],
    totalCash_cy: round(
      cashRows.reduce((s, r) => s + (r.closingDr ?? 0), 0)
      + (subledgerBankRows.length > 0
        ? subledgerBankRows.reduce((s, b) => s + b.closingBalance, 0)
        : bankCurrentRows.reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0)
          + bankSavingsRows.reduce((s, r) => s + (r.closingDr ?? 0) - (r.closingCr ?? 0), 0)
          + fdCurrentRows.reduce((s, r) => s + (r.closingDr ?? 0), 0))
    ),
    totalCash_py: round(
      cashRows.reduce((s, r) => s + (r.openingDr ?? 0), 0)
      + (subledgerBankRows.length > 0
        ? subledgerBankRows.reduce((s, b) => s + b.openingBalance, 0)
        : bankCurrentRows.reduce((s, r) => s + (r.openingDr ?? 0) - (r.openingCr ?? 0), 0)
          + bankSavingsRows.reduce((s, r) => s + (r.openingDr ?? 0) - (r.openingCr ?? 0), 0)
          + fdCurrentRows.reduce((s, r) => s + (r.openingDr ?? 0), 0))
    ),
  };

  // ─── Note 3.9 — Share Capital ──────────────────────────────────────────────

  const paidUpCapital    = Math.abs(netClosing(rows, 'share_capital'));
  const paidUpCapitalOpen= Math.abs(
    rows.filter((r) => r.nfrsCategory === 'share_capital' && !(r as any).isGroupRow)
      .reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const sharesIssued = Math.round(paidUpCapital / 100);   // NPR 100 par value standard

  const note39_shareCapital: NotesData['note39_shareCapital'] = {
    ordinaryShares: {
      authorizedAmount:    paidUpCapital,
      authorizedShares:    sharesIssued,
      parValuePerShare:    100,
      openingIssuedShares: Math.round(paidUpCapitalOpen / 100),
      openingPaidUp:       paidUpCapitalOpen,
      issuedDuringYear:    0,
      issuedForCash:       0,
      closingIssuedShares: sharesIssued,
      closingPaidUp:       paidUpCapital,
    },
    preferenceShares: null,
    restrictionsOnDistribution: null,
    sharesReservedForOptions:   0,
  };

  // ─── Note 3.10 — Reserves ──────────────────────────────────────────────────

  const sharePremiumClose = Math.abs(netClosing(rows, 'share_premium'));
  const sharePremiumOpen  = Math.abs(
    rows.filter((r) => r.nfrsCategory === 'share_premium' && !(r as any).isGroupRow)
      .reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const genReserveClose = Math.abs(netClosing(rows, 'general_reserve'));
  const genReserveOpen  = Math.abs(
    rows.filter((r) => r.nfrsCategory === 'general_reserve' && !(r as any).isGroupRow)
      .reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );
  const retainedClose = Math.abs(netClosing(rows, 'retained_earnings'));
  const retainedOpen  = Math.abs(
    rows.filter((r) => r.nfrsCategory === 'retained_earnings' && !(r as any).isGroupRow)
      .reduce((s, r) => s + (r.openingCr ?? 0) - (r.openingDr ?? 0), 0)
  );

  const note310_reserves: NotesData['note310_reserves'] = {
    sharePremium: {
      opening:   sharePremiumOpen,
      additions: round(sharePremiumClose - sharePremiumOpen),
      closing:   sharePremiumClose,
    },
    generalReserve: {
      opening:          genReserveOpen,
      transferFromProfit: round(genReserveClose - genReserveOpen),
      closing:          genReserveClose,
    },
    retainedEarnings: {
      opening:         retainedOpen,
      netProfitForYear:IS.netProfit ?? 0,
      dividendsDeclared: 0,
      transferToReserve: round(genReserveClose - genReserveOpen),
      closing:         retainedClose,
    },
    otherReserves: Math.abs(netClosing(rows, 'other_reserves')),
  };

  // ─── Note 3.11 — Loans and Borrowings ──────────────────────────────────────

  const ltBankRows    = rowsByCategory(rows, 'borrowings_noncurrent_bank');
  const ltOtherRows   = rowsByCategory(rows, 'borrowings_noncurrent_other');
  const stOdRows      = rowsByCategory(rows, 'borrowings_current_od');
  const stCcRows      = rowsByCategory(rows, 'borrowings_current_cc');
  const stWcRows      = rowsByCategory(rows, 'borrowings_current_wc');
  const stPortionRows = rowsByCategory(rows, 'borrowings_current_portion_lt');
  const rpPayableRows = rowsByCategory(rows, 'related_party_payable');

  const subledgerLoanBanks = (subledger?.bankAccounts ?? []).filter(
    (b) => isLoanBankType(b.accountType) || b.balance < 0,
  );
  const subledgerLoanCurrent = subledgerLoanBanks
    .filter((b) => ['overdraft', 'cash_credit', 'working_capital'].includes(b.accountType))
    .map((b) => ({
      lenderName: b.bankName,
      type: b.accountType === 'overdraft'
        ? 'Bank Overdraft' as const
        : b.accountType === 'cash_credit'
          ? 'Cash Credit' as const
          : 'Working Capital Loan' as const,
      secured: !!b.securedBy,
      balance_cy: Math.abs(b.balance),
      balance_py: 0,
    }));
  const subledgerLoanNonCurrent = subledgerLoanBanks
    .filter((b) => b.accountType === 'loan')
    .map((b) => ({
      lenderName:   b.bankName,
      type:         'Bank Term Loan' as const,
      secured:      !!b.securedBy,
      interestRate: b.interestRate ?? 0,
      maturityDate: b.maturityDate ?? null,
      balance_cy:   Math.abs(b.balance),
      balance_py:   0,
    }));
  const subledgerRpPayableLoans = (subledger?.relatedParties ?? [])
    .filter((rp) => rp.balanceType === 'payable')
    .map((rp) => ({
      lenderName: rp.partyName,
      type:       'Related Party Loan' as const,
      secured:    false,
      balance_cy: Math.abs(rp.outstandingBalance),
      balance_py: 0,
    }));

  const note311_borrowings: NotesData['note311_borrowings'] = {
    nonCurrent: [
      ...ltBankRows.map((r) => ({
        lenderName:   r.rawLabel,
        type:         'Bank Term Loan' as const,
        secured:      true,
        interestRate: 0,
        maturityDate: null,
        balance_cy:   Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py:   Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...ltOtherRows.map((r) => ({
        lenderName:   r.rawLabel,
        type:         'Other Loan' as const,
        secured:      false,
        interestRate: 0,
        maturityDate: null,
        balance_cy:   Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py:   Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...subledgerLoanNonCurrent,
    ],
    current: [
      ...stOdRows.map((r) => ({
        lenderName: r.rawLabel,
        type:       'Bank Overdraft' as const,
        secured:    true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...stCcRows.map((r) => ({
        lenderName: r.rawLabel,
        type:       'Cash Credit' as const,
        secured:    true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...stWcRows.map((r) => ({
        lenderName: r.rawLabel,
        type:       'Working Capital Loan' as const,
        secured:    true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...stPortionRows.map((r) => ({
        lenderName: r.rawLabel,
        type:       'Current Portion of Long-Term Loan' as const,
        secured:    true,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...rpPayableRows.map((r) => ({
        lenderName: r.rawLabel,
        type:       'Related Party Loan' as const,
        secured:    false,
        balance_cy: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balance_py: Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)),
      })),
      ...subledgerLoanCurrent,
      ...subledgerRpPayableLoans,
    ],
    totalNonCurrent_cy: ltBankRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + ltOtherRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + subledgerLoanNonCurrent.reduce((s, r) => s + r.balance_cy, 0),
    totalCurrent_cy: [stOdRows, stCcRows, stWcRows, stPortionRows, rpPayableRows]
      .flat().reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + subledgerLoanCurrent.reduce((s, r) => s + r.balance_cy, 0)
      + subledgerRpPayableLoans.reduce((s, r) => s + r.balance_cy, 0),
  };

  // ─── Note 3.12 — Employee Benefit Liabilities ──────────────────────────────

  const gratuityProv    = provisions.find((p) => p.provisionType === 'gratuity');
  const leaveProv       = provisions.find((p) => p.provisionType === 'leave_encashment');
  const bonusProv       = provisions.find((p) => p.provisionType === 'bonus');

  const note312_employeeBenefits: NotesData['note312_employeeBenefits'] = {
    definedBenefit: {
      description:   'Gratuity (as per Labour Act 2074)',
      openingBalance: gratuityProv?.openingBalance ?? 0,
      expenseForYear: gratuityProv?.additionForYear ?? 0,
      paidDuringYear: gratuityProv?.utilisedDuringYear ?? 0,
      closingBalance: gratuityProv?.closingBalance
        ?? sumTB(rows, 'employee_benefit_gratuity', 'closingCr'),
      nonCurrentPortion: gratuityProv?.closingBalance ?? 0,
      currentPortion: 0,
    },
    definedContribution: {
      pfContribution:  sumTB(rows, 'employee_payables_pf', 'closingCr'),
      ssfContribution: 0,
    },
    leaveEncashment: {
      openingBalance:  leaveProv?.openingBalance ?? 0,
      expenseForYear:  leaveProv?.additionForYear ?? 0,
      paidDuringYear:  leaveProv?.utilisedDuringYear ?? 0,
      closingBalance:  leaveProv?.closingBalance ?? 0,
    },
    salaryPayable:   sumTB(rows, 'employee_payables_salary', 'closingCr'),
    bonusPayable:    bonusProv?.closingBalance ?? sumTB(rows, 'employee_payables_bonus', 'closingCr'),
    totalCurrentEmployeeLiabilities: round(
      sumTB(rows, 'employee_payables_salary', 'closingCr')
      + (bonusProv?.closingBalance ?? sumTB(rows, 'employee_payables_bonus', 'closingCr'))
      + sumTB(rows, 'employee_payables_pf', 'closingCr')
    ),
    totalNonCurrentEmployeeLiabilities: gratuityProv?.closingBalance ?? 0,
  };

  // ─── Note 3.13 — Trade and Other Payables ──────────────────────────────────

  const creditorRows    = rowsByCategory(rows, 'trade_payables_creditors');
  const advFromCustRows = rowsByCategory(rows, 'trade_payables_advance_customers');
  const auditFeeRows    = rowsByCategory(rows, 'audit_fee_payable');
  const vatRows         = rowsByCategory(rows, 'other_payables');
  const tdsPayRows      = rowsByCategory(rows, 'tds_payable');

  const note313_tradePayables: NotesData['note313_tradePayables'] = {
    tradeCreditors: creditorRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    advanceFromCustomers: advFromCustRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    auditFeePayable: auditFeeRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    vatPayable: vatRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    tdsPayableBreakdown: tdsPayRows.map((r) => ({
      ledgerName: r.rawLabel,
      amount:     Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
    })),
    tdsPayableTotal: tdsPayRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0),
    otherAccruals: 0,
    total: round(
      creditorRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + advFromCustRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + auditFeeRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + vatRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
      + tdsPayRows.reduce((s, r) => s + Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)), 0)
    ),
    // Previous year
    tradeCreditors_py:      creditorRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
    auditFeePayable_py:     auditFeeRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
    vatPayable_py:          vatRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
    tdsPayableTotal_py:     tdsPayRows.reduce((s, r) => s + Math.abs((r.openingCr ?? 0) - (r.openingDr ?? 0)), 0),
  };

  // ─── Note 3.14 — Tax Computation (Summary) ─────────────────────────────────

  const advanceTaxPaid   = sumTB(rows, 'advance_tax_paid', 'closingDr');
  const tdsCredit        = sumTB(rows, 'other_receivables_tds', 'closingDr');
  const taxPayable       = Math.abs(sumTB(rows, 'income_tax_payable', 'closingCr'));
  const currentTaxExpense= IS.incomeTaxExpense ?? 0;

  const note314_taxComputation: NotesData['note314_taxComputation'] = {
    advanceTaxPaid,
    tdsCreditAvailable: tdsCredit,
    incomeTaxForYear:   currentTaxExpense,
    netTaxLiability:    Math.max(0, currentTaxExpense - advanceTaxPaid - tdsCredit),
    taxRecoverable:     Math.max(0, advanceTaxPaid + tdsCredit - currentTaxExpense),
  };

  // ─── Note 3.15 — Revenue from Operations (Summary) ─────────────────────────

  const saleOfGoods    = sumTB(rows, 'revenue_sales', 'closingCr');
  const saleOfServices = sumTB(rows, 'revenue_services', 'closingCr');

  const note315_revenue: NotesData['note315_revenue'] = {
    saleOfGoods_cy:     saleOfGoods,
    saleOfServices_cy:  saleOfServices,
    totalRevenue_cy:    round(saleOfGoods + saleOfServices),
    saleOfGoods_py:     sumTB(rows, 'revenue_sales', 'openingCr'),
    saleOfServices_py:  sumTB(rows, 'revenue_services', 'openingCr'),
    totalRevenue_py:    round(
      sumTB(rows, 'revenue_sales', 'openingCr') + sumTB(rows, 'revenue_services', 'openingCr')
    ),
  };

  // ─── Note 3.16 — Dividend Payable ──────────────────────────────────────────

  const dividendPayableBalance = Math.abs(
    sumTB(rows, 'dividend_payable' as NFRSCategory, 'closingCr')
  );
  const paidUpForDividend = note39_shareCapital.ordinaryShares.closingPaidUp;

  // Compute declared dividend rate from balance if available
  const declaredRate = paidUpForDividend > 0 && dividendPayableBalance > 0
    ? round((dividendPayableBalance / paidUpForDividend) * 100)
    : 0;

  const note316_dividendPayable: NotesData['note316_dividendPayable'] = {
    hasDividend:         dividendPayableBalance > 0,
    paidUpCapital:       paidUpForDividend,
    declaredRatePercent: declaredRate,
    amountPerShare:      note39_shareCapital.ordinaryShares.closingIssuedShares > 0
      ? round(dividendPayableBalance / note39_shareCapital.ordinaryShares.closingIssuedShares)
      : 0,
    totalDividendDeclared: dividendPayableBalance,
    tdsOnDividend:         round(dividendPayableBalance * 0.05),
    netDividendPayable:    round(dividendPayableBalance * 0.95),
  };

  // ─── Note 3.17 — Revenue from Operations (Detailed) ───────────────────────

  const otherIncomeRows = [
    'other_income_interest',
    'other_income_dividend',
    'other_income_rental',
    'other_income_disposal_gain',
    'other_income_misc',
  ] as NFRSCategory[];

  const note317_revenueDetailed: NotesData['note317_revenueDetailed'] = {
    saleOfGoods: {
      cy: sumTB(rows, 'revenue_sales', 'closingCr'),
      py: sumTB(rows, 'revenue_sales', 'openingCr'),
    },
    renderingOfServices: {
      cy: sumTB(rows, 'revenue_services', 'closingCr'),
      py: sumTB(rows, 'revenue_services', 'openingCr'),
    },
    interestIncome: {
      cy: sumTB(rows, 'other_income_interest', 'closingCr'),
      py: sumTB(rows, 'other_income_interest', 'openingCr'),
    },
    dividendIncome: {
      cy: sumTB(rows, 'other_income_dividend', 'closingCr'),
      py: sumTB(rows, 'other_income_dividend', 'openingCr'),
    },
    otherIncome: {
      cy: otherIncomeRows.reduce((s, c) => s + sumTB(rows, c, 'closingCr'), 0),
      py: otherIncomeRows.reduce((s, c) => s + sumTB(rows, c, 'openingCr'), 0),
    },
    totalIncome: {
      cy: IS.totalIncome ?? 0,
      py: (IS as any).totalIncome_py ?? 0,
    },
  };

  // ─── Note 3.18 — Material Consumed and Direct Expenses ────────────────────

  const rmOpenForConsumed = sumTB(rows, 'inventory_raw_materials', 'openingDr');
  const purchases         = sumTB(rows, 'cogs_purchases', 'closingDr');
  const rmCloseForConsumed= sumTB(rows, 'inventory_raw_materials', 'closingDr');
  const materialConsumed  = round(rmOpenForConsumed + purchases - rmCloseForConsumed);

  // Change in inventories of FG + WIP
  const fgWipOpenForChange = round(fgOpening + wipOpening);
  const fgWipCloseForChange= round(fgClosing + wipClosing);
  const changeInInventories= round(fgWipOpenForChange - fgWipCloseForChange);

  const directWages = sumTB(rows, 'direct_wages', 'closingDr');
  const directOther = sumTB(rows, 'direct_expenses_other', 'closingDr');

  const note318_materialConsumed: NotesData['note318_materialConsumed'] = {
    openingRawMaterial:   rmOpenForConsumed,
    purchasesDuringYear:  purchases,
    closingRawMaterial:   rmCloseForConsumed,
    rawMaterialConsumed:  materialConsumed,
    changeInInventoriesFGWIP: changeInInventories,
    openingFGWIP:         fgWipOpenForChange,
    closingFGWIP:         fgWipCloseForChange,
    directWages,
    otherDirectExpenses:  directOther,
    totalCostOfProduction: round(materialConsumed + changeInInventories + directWages + directOther),
  };

  // ─── Note 3.19 — Other Income ──────────────────────────────────────────────

  const note319_otherIncome: NotesData['note319_otherIncome'] = {
    interestIncome:       { cy: sumTB(rows, 'other_income_interest', 'closingCr'),      py: 0 },
    commissionIncome:     { cy: 0, py: 0 },
    rentalIncome:         { cy: sumTB(rows, 'other_income_rental', 'closingCr'),         py: 0 },
    dividendReceived:     { cy: sumTB(rows, 'other_income_dividend', 'closingCr'),       py: 0 },
    gainOnDisposalAssets: { cy: sumTB(rows, 'other_income_disposal_gain', 'closingCr'),  py: 0 },
    insuranceClaims:      { cy: 0, py: 0 },
    fairValueGainOnInvestments: {
      cy: investmentAdjs
        .filter((i) => (i.fairValueGainLoss ?? 0) > 0)
        .reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0),
      py: 0,
    },
    miscellaneousIncome:  { cy: sumTB(rows, 'other_income_misc', 'closingCr'), py: 0 },
    total: {
      cy: round(
        sumTB(rows, 'other_income_interest', 'closingCr')
        + sumTB(rows, 'other_income_rental', 'closingCr')
        + sumTB(rows, 'other_income_dividend', 'closingCr')
        + sumTB(rows, 'other_income_disposal_gain', 'closingCr')
        + sumTB(rows, 'other_income_misc', 'closingCr')
        + investmentAdjs
            .filter((i) => (i.fairValueGainLoss ?? 0) > 0)
            .reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0)
      ),
      py: 0,
    },
  };

  // ─── Note 3.20 — Employee Benefit Expenses ─────────────────────────────────

  const salariesExp      = sumTB(rows, 'emp_expense_salaries', 'closingDr');
  const pfExp            = sumTB(rows, 'emp_expense_pf', 'closingDr');
  const gratuityExp      = gratuityProv?.additionForYear ?? sumTB(rows, 'emp_expense_gratuity', 'closingDr');
  const welfareExp       = sumTB(rows, 'emp_expense_welfare', 'closingDr');
  const bonusExp         = IS.staffBonus ?? bonusProv?.additionForYear ?? 0;
  const leaveExp         = leaveProv?.additionForYear ?? sumTB(rows, 'emp_expense_leave' as NFRSCategory, 'closingDr');
  const otherEmpExp      = sumTB(rows, 'emp_expense_other', 'closingDr');

  const note320_employeeExpenses: NotesData['note320_employeeExpenses'] = {
    salariesWages:        { cy: salariesExp,  py: 0 },
    allowances:           { cy: 0,            py: 0 },
    pfSsfContribution:    { cy: pfExp,        py: 0 },
    gratuityExpense:      { cy: gratuityExp,  py: 0 },
    leaveEncashment:      { cy: leaveExp,     py: 0 },
    staffBonusExpense:    { cy: bonusExp,     py: 0 },
    staffWelfare:         { cy: welfareExp,   py: 0 },
    otherEmployeeCosts:   { cy: otherEmpExp,  py: 0 },
    totalEmployeeExpenses:{ cy: round(salariesExp + pfExp + gratuityExp + welfareExp + bonusExp + leaveExp + otherEmpExp), py: 0 },
    kmpCompensation: {
      description: 'Key Management Personnel Compensation',
      salary:      0,
      bonus:       0,
      otherBenefits: 0,
      total:       0,
    },
  };

  // ─── Note 3.21 — Depreciation ──────────────────────────────────────────────

  const note321_depreciation: NotesData['note321_depreciation'] = {
    byClass: note31_ppe.map((item) => ({
      categoryName:      item.categoryName,
      depreciationForYear: item.depnForYear,
    })),
    totalDepreciation:   round(note31_ppe.reduce((s, item) => s + item.depnForYear, 0)),
    totalDepreciation_py:0,
  };

  // ─── Note 3.22 — Other/Administrative Expenses ─────────────────────────────

  const ADMIN_CATEGORIES: Array<{ cat: NFRSCategory; label: string }> = [
    { cat: 'admin_rent',              label: 'Rent / Lease Rentals' },
    { cat: 'admin_communication',     label: 'Communication Expenses' },
    { cat: 'admin_printing',          label: 'Printing & Stationery' },
    { cat: 'admin_traveling',         label: 'Travel & Conveyance' },
    { cat: 'admin_advertisement',     label: 'Advertisement & Promotion' },
    { cat: 'admin_audit_fee',         label: 'Audit Fees' },
    { cat: 'admin_legal_professional',label: 'Professional & Legal Fees' },
    { cat: 'admin_rates_taxes',       label: 'Board & AGM / Rates & Taxes' },
    { cat: 'admin_repairs',           label: 'Repairs & Maintenance' },
    { cat: 'admin_insurance',         label: 'Insurance Premium' },
    { cat: 'finance_cost_bank_charges',label:'Bank Charges' },
    { cat: 'admin_other',             label: 'CSR & Other Miscellaneous' },
  ];

  const note322_adminExpenses: NotesData['note322_adminExpenses'] = {
    lineItems: ADMIN_CATEGORIES.map((ac) => ({
      label:  ac.label,
      cy:     sumTB(rows, ac.cat, 'closingDr'),
      py:     0,
    })).filter((li) => li.cy > 0),
    total_cy: round(ADMIN_CATEGORIES.reduce((s, ac) => s + sumTB(rows, ac.cat, 'closingDr'), 0)),
    total_py: 0,
  };

  // ─── Note 3.23 — Tax Expense and Reconciliation ────────────────────────────

  const bookProfit     = IS.profitBeforeTax ?? 0;
  const bookDepreciation = adj.depreciationSummary?.reduce((s, d) => s + d.depnForYear, 0) ?? 0;

  // Tax depreciation (WDV method per ITA 2058)
  const taxDepreciation = (adj.depreciationSummary ?? []).reduce((total, d) => {
    const rate = TAX_DEPN_RATES[d.categoryId] ?? 0.10;
    const basis = d.openingCost + d.additions - d.disposals - d.openingAccumDepn;
    return total + Math.max(0, basis) * rate;
  }, 0);

  const disallowableExpenses: Record<string, number> = {
    'Accounting Depreciation':    bookDepreciation,
    'Provisions (non-deductible)':provisions.reduce((s, p) => s + (p.closingBalance ?? 0), 0),
  };

  const allowableDeductions: Record<string, number> = {
    'Tax Depreciation (ITA 2058)': taxDepreciation,
  };

  const taxResult = computeIncomeTax({
    bookProfit,
    taxRate: taxRate,
    disallowableExpenses,
    allowableExpenses: allowableDeductions,
    advanceTaxPaid:    advanceTaxPaid + tdsCredit,
    tdsCredit:         0,
    previousYearLoss:  0,
  });

  const note323_taxExpense: NotesData['note323_taxExpense'] = {
    currentTaxExpense:   round(taxResult.currentTaxExpense),
    deferredTaxExpense:  0,
    priorYearAdjustment: 0,
    totalTaxExpense:     round(taxResult.currentTaxExpense),
    effectiveTaxRate:    taxResult.effectiveTaxRate,
    reconciliation: {
      profitBeforeTax:      bookProfit,
      disallowableExpenses,
      allowableDeductions,
      taxableProfit:        round(taxResult.taxableIncome),
      taxAtStatutoryRate:   round(taxResult.taxableIncome * taxRate),
      taxAdjustments:       0,
      totalCurrentTax:      round(taxResult.currentTaxExpense),
    },
    taxDepreciationByPool: (adj.taxDepreciationPools ?? []).map((pool) => ({
      poolName:           pool.poolName,
      rate:               pool.rate,
      openingBasis:       pool.openingBasis,
      additions:          pool.additionsFullYear + pool.additionsTwoThirds + pool.additionsOneThird,
      disposals:          pool.disposals,
      depreciationBasis:  pool.depreciationBasis,
      taxDepreciation:    pool.taxDepreciation,
      closingBasis:       pool.closingBasis,
    })),
    advanceTaxPaid,
    tdsCreditAvailable: tdsCredit,
    netTaxPayable:      round(taxResult.taxPayable),
  };

  // ─── Note 3.24 — Related Party Transactions ────────────────────────────────

  const rpReceivableRows = rowsByCategory(rows, 'related_party_receivable');
  const rpPayRows        = rowsByCategory(rows, 'related_party_payable');

  const subledgerRelatedParties = (
    subledger?.relatedParties?.length
      ? subledger.relatedParties
      : (adj.relatedParties as unknown as Array<Record<string, unknown>> | undefined) ?? []
  );

  const note324_relatedParty: NotesData['note324_relatedParty'] = {
    relatedParties: subledgerRelatedParties.length > 0
      ? subledgerRelatedParties.map((rp) => {
          const row = rp as Record<string, unknown>;
          const balanceType = String(row.balanceType ?? 'receivable');
          const txns = (row.transactionsCurrentYear as Array<{ amount?: number }> | undefined) ?? [];
          return {
            partyName:          String(row.partyName ?? row.name ?? ''),
            relationship:       String(row.relationshipType ?? row.relationship ?? 'Related Party'),
            natureOfTransaction: balanceType === 'payable' ? 'Loan Received' as const : 'Loan Given' as const,
            transactionAmount:  txns.reduce((s, t) => s + (t.amount ?? 0), 0),
            outstandingBalance: Math.abs(Number(row.outstandingBalance ?? row.balanceCY ?? 0)),
            balanceType:        balanceType === 'payable' ? 'Payable' as const : 'Receivable' as const,
            atArmSLength:       Boolean(row.isArmLength ?? false),
          };
        })
      : [
      ...rpPayRows.map((r) => ({
        partyName:          r.rawLabel,
        relationship:       'Director / Related Party' as const,
        natureOfTransaction:'Loan Received' as const,
        transactionAmount:  0,
        outstandingBalance: Math.abs((r.closingCr ?? 0) - (r.closingDr ?? 0)),
        balanceType:        'Payable' as const,
        atArmSLength:       false,
      })),
      ...rpReceivableRows.map((r) => ({
        partyName:          r.rawLabel,
        relationship:       'Director / Related Party' as const,
        natureOfTransaction:'Loan Given' as const,
        transactionAmount:  0,
        outstandingBalance: Math.abs((r.closingDr ?? 0) - (r.closingCr ?? 0)),
        balanceType:        'Receivable' as const,
        atArmSLength:       false,
      })),
    ],
    kmpCompensationTotal: 0,
    noRelatedPartyTransactions:
      subledgerRelatedParties.length === 0
      && rpPayRows.length === 0 && rpReceivableRows.length === 0,
  };

  // ─── Note 3.25 — Contingent Liabilities and Commitments ───────────────────

  const note325_contingencies: NotesData['note325_contingencies'] = {
    hasContingencies:      false,
    bankGuaranteesIssued:  0,
    lcOpened:              0,
    legalCasesPending:     [],
    capitalCommitments:    0,
    operatingLeaseCommitments: 0,
    defaultText:           'The Company has no contingent liabilities or commitments as at the reporting date.',
  };

  // ─── Note 3.26 — Subsequent Events ────────────────────────────────────────

  const note326_subsequentEvents: NotesData['note326_subsequentEvents'] = {
    hasSubsequentEvents: false,
    events:              [],
    defaultText:         'There are no significant events after the reporting date that require adjustment to or disclosure in these financial statements.',
  };

  // ─── Assemble and return ───────────────────────────────────────────────────

  return {
    note31_ppe,
    note32_investments,
    note33_tradeReceivables,
    note34_otherCurrentAssets,
    note35_biologicalAssets,
    note36_heldForSale,
    note37_inventories,
    note38_cashEquivalents,
    note39_shareCapital,
    note310_reserves,
    note311_borrowings,
    note312_employeeBenefits,
    note313_tradePayables,
    note314_taxComputation,
    note315_revenue,
    note316_dividendPayable,
    note317_revenueDetailed,
    note318_materialConsumed,
    note319_otherIncome,
    note320_employeeExpenses,
    note321_depreciation,
    note322_adminExpenses,
    note323_taxExpense,
    note324_relatedParty,
    note325_contingencies,
    note326_subsequentEvents,
  };
}
