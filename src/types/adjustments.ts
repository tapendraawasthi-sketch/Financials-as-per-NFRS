// ===== src/types/adjustments.ts =====
// TypeScript types for all year-end adjustments used in the NFRS/NAS for MEs
// financial reporting automation system for Nepal.
//
// Covers: PPE/depreciation register, tax depreciation pools, inventory
// valuation adjustments, investment fair value adjustments, provisions, and
// the master YearEndAdjustments container.

import type { DepreciationMethod } from './company';

// ---------------------------------------------------------------------------
// 1. AssetItem — one physical fixed asset in the PPE register
// ---------------------------------------------------------------------------
export interface AssetItem {
  /** Unique identifier for this asset (UUID or sequential string) */
  id: string;
  /** Human-readable name, e.g. "Toyota Hiace Van" */
  assetName: string;
  /** References AssetCategory.id (e.g. "vehicles", "buildings") */
  categoryId: string;
  /** Purchase date in Bikram Sambat format, e.g. "15 Poush 2079" */
  purchaseDateBS: string;
  /** Purchase date in AD format, e.g. "December 30, 2022" */
  purchaseDateAD: string;
  /** Original acquisition cost in NPR */
  originalCost: number;
  /** Capital improvements capitalised in the current fiscal year */
  additionalCost: number;
  /** Disposal date in BS format (optional — only if disposed this year) */
  disposalDateBS?: string;
  /** Actual proceeds received on disposal, NOT book value */
  disposalValue?: number;
  /** Estimated total useful life in years (for SLM) */
  usefulLifeYears: number;
  /** Expected residual / scrap value at end of life */
  residualValue: number;
  /** SLM or WDV — imported from company profile */
  depreciationMethod: DepreciationMethod;
  /**
   * WDV rate as a percentage integer, e.g. 25 means 25 % p.a.
   * Only relevant when depreciationMethod === 'wdv'.
   */
  wdvRate?: number;
  /** Accumulated depreciation brought forward (opening balance) */
  accumDepreciationOpening: number;
  /** True if the asset has reached zero net book value */
  isFullyDepreciated: boolean;
  /** True if mortgaged / pledged as collateral to a bank */
  isMortgaged: boolean;
  /** Details of the mortgage (lender name, loan account, etc.) */
  mortgageDetails?: string;
}

// ---------------------------------------------------------------------------
// 2. DepreciationResult — computed depreciation for ONE asset for the year
// ---------------------------------------------------------------------------
export interface DepreciationResult {
  /** References AssetItem.id */
  assetId: string;
  assetName: string;
  /** References AssetCategory.id */
  categoryId: string;
  /** Cost at start of year (before additions this year) */
  openingCost: number;
  /** Additions capitalised during the year */
  additions: number;
  /** Cost of assets disposed of during the year */
  disposals: number;
  /** Closing cost = openingCost + additions − disposals */
  closingCost: number;
  /** Accumulated depreciation brought forward */
  openingAccumDepn: number;
  /** Depreciation charge for the current fiscal year */
  depnForYear: number;
  /** Accumulated depreciation attributable to disposed assets */
  depnOnDisposal: number;
  /** Closing accumulated depreciation = openingAccumDepn + depnForYear − depnOnDisposal */
  closingAccumDepn: number;
  /** Net book value at start of year */
  netBookValueOpening: number;
  /** Net book value at end of year = closingCost − closingAccumDepn */
  netBookValueClosing: number;
  /**
   * Gain (positive) or loss (negative) on disposal.
   * = disposalProceeds − (cost of disposed asset − depnOnDisposal)
   */
  gainLossOnDisposal?: number;
  /** Actual sale / insurance proceeds received */
  disposalProceeds?: number;
}

// ---------------------------------------------------------------------------
// 3. DepreciationSummary — aggregated depreciation per asset category
// ---------------------------------------------------------------------------
export interface DepreciationSummary {
  /** References AssetCategory.id */
  categoryId: string;
  /** Human-readable category label, e.g. "Vehicles" */
  categoryName: string;
  openingCost: number;
  additions: number;
  disposals: number;
  closingCost: number;
  openingAccumDepn: number;
  depnForYear: number;
  depnOnDisposal: number;
  closingAccumDepn: number;
  /** Net book value at year-end across all assets in this category */
  netBookValueClosing: number;
  /** Individual asset details making up this category total */
  assets: DepreciationResult[];
}

// ---------------------------------------------------------------------------
// 4. TaxDepreciationPool — Nepal Income Tax Act 2058 Section 19 pool
// ---------------------------------------------------------------------------
export interface TaxDepreciationPool {
  /** Pool identifier per Schedule 2 of Nepal Income Tax Act */
  pool: 'A' | 'B' | 'C' | 'D';
  /**
   * Pool description:
   *   A = Buildings, structures (5 %)
   *   B = Computers, IT equipment, software (25 %)
   *   C = Other machinery & equipment (20 %)
   *   D = Vehicles, furniture & fixtures (15 %)
   */
  poolName: string;
  /** Depreciation rate as a decimal, e.g. 0.05 for Pool A */
  rate: number;
  /** Opening written-down value (depreciation basis) at 1 Shrawan */
  openingBasis: number;
  /**
   * Additions purchased 1 Shrawan – 31 Poush (first 4 months);
   * allowed at 100 % in the depreciation basis.
   */
  additionsFullYear: number;
  /**
   * Additions purchased 1 Magh – 31 Chaitra (middle 4 months);
   * allowed at 2/3 in the depreciation basis.
   */
  additionsTwoThirds: number;
  /**
   * Additions purchased 1 Baisakh – 32/31 Ashadh (last 4 months);
   * allowed at 1/3 in the depreciation basis.
   */
  additionsOneThird: number;
  /** Cost of assets disposed of during the year (deducted from basis) */
  disposals: number;
  /**
   * Effective depreciation basis =
   *   openingBasis + additionsFullYear + (2/3 × additionsTwoThirds)
   *   + (1/3 × additionsOneThird) − disposals
   */
  depreciationBasis: number;
  /** Tax depreciation = depreciationBasis × rate */
  taxDepreciation: number;
  /** Closing basis = depreciationBasis − taxDepreciation */
  closingBasis: number;
}

// ---------------------------------------------------------------------------
// 5. InventoryAdjustment — lower-of-cost-or-NRV test per NAS for MEs §11
// ---------------------------------------------------------------------------
export interface InventoryAdjustment {
  /** Description of the inventory item or batch */
  itemDescription: string;
  quantity: number;
  costPerUnit: number;
  /** totalCost = quantity × costPerUnit */
  totalCost: number;
  /** Net realisable value per unit = estimated selling price − costs to sell */
  nrvPerUnit: number;
  /** totalNRV = quantity × nrvPerUnit */
  totalNRV: number;
  /**
   * Impairment required = max(0, totalCost − totalNRV).
   * Positive means inventory is written down; zero means no impairment.
   */
  impairmentAmount: number;
  /** Inventory classification for disclosure in Note 3.7 */
  category: 'raw_materials' | 'wip' | 'finished_goods';
}

// ---------------------------------------------------------------------------
// 6. InvestmentAdjustment — subsequent measurement per NAS for MEs §10.6
// ---------------------------------------------------------------------------
export interface InvestmentAdjustment {
  /** Name / description of the investee company or instrument */
  investmentName: string;
  /**
   * Classification:
   *   listed_trading  — NEPSE-listed shares held for trading → mark to market
   *   listed_ats      — NEPSE-listed available-for-sale → lower of cost or market
   *   unlisted        — unlisted equity → cost less impairment
   */
  investmentType: 'listed_trading' | 'listed_ats' | 'unlisted';
  /** Number of units / shares held */
  quantity: number;
  costPerUnit: number;
  /** totalCost = quantity × costPerUnit */
  totalCost: number;
  /** NEPSE closing price (LTP) at the reporting date (undefined for unlisted) */
  marketValuePerUnit?: number;
  /** totalMarketValue = quantity × marketValuePerUnit (undefined for unlisted) */
  totalMarketValue?: number;
  /**
   * For listed_trading: change in fair value since last measurement.
   * Positive = gain recognised in profit or loss; negative = loss.
   */
  fairValueGainLoss?: number;
  /**
   * For listed_ats and unlisted: impairment recognised in profit or loss
   * when carrying amount exceeds recoverable amount.
   */
  impairmentAmount?: number;
  /**
   * Net carrying amount after all adjustments:
   *   listed_trading → totalMarketValue
   *   listed_ats     → min(totalCost, totalMarketValue) − impairmentAmount
   *   unlisted       → totalCost − impairmentAmount
   */
  carryingAmount: number;
}

// ---------------------------------------------------------------------------
// 7. ProvisionEntry — a single provision or accrual per NAS for MEs §14
// ---------------------------------------------------------------------------
export interface ProvisionEntry {
  /** Unique identifier */
  id: string;
  /**
   * Type of provision, used for grouping in the notes and
   * routing to the correct note (Note 3.12, 3.14, etc.).
   */
  provisionType:
    | 'gratuity'
    | 'leave_encashment'
    | 'bonus'
    | 'audit_fee'
    | 'doubtful_debts'
    | 'warranty'
    | 'other';
  /** Narrative description for note disclosure */
  description: string;
  /** Balance at 1 Shrawan (opening of current fiscal year) */
  openingBalance: number;
  /** Amount added / charged to profit or loss during the year */
  additionForYear: number;
  /** Amount utilised / settled during the year */
  utilisedDuringYear: number;
  /** Amount reversed (unused) during the year */
  reversedDuringYear: number;
  /**
   * Closing balance = openingBalance + additionForYear
   *                   − utilisedDuringYear − reversedDuringYear
   */
  closingBalance: number;
  /**
   * True if the provision is expected to be settled within 12 months —
   * shown under Current Liabilities on the Balance Sheet.
   */
  isCurrentLiability: boolean;
  /**
   * Optional reference to the corresponding trial balance account label,
   * used to cross-check the provision balance against the raw TB.
   */
  linkedTBAccount?: string;
}

// ---------------------------------------------------------------------------
// 8. AdjustmentJournalEntry — double-entry record of each adjustment
// ---------------------------------------------------------------------------
export interface AdjustmentJournalEntry {
  /** Unique identifier */
  id: string;
  /** Narrative description of the journal entry */
  description: string;
  /** Account debited (use canonical NFRS label from chartOfAccounts.ts) */
  debitAccount: string;
  /** Account credited */
  creditAccount: string;
  /** Amount in NPR */
  amount: number;
  /** Functional category of the adjustment */
  adjustmentType:
    | 'depreciation'
    | 'inventory_impairment'
    | 'investment_fv'
    | 'provision'
    | 'tax'
    | 'other';
  /** Cross-reference to the financial statement note, e.g. "Note 3.1" */
  linkedNoteRef?: string;
  /**
   * False when the entry was manually keyed by the user;
   * true when auto-generated by the calculation engine.
   */
  isSystemGenerated: boolean;
}

// ---------------------------------------------------------------------------
// 9. YearEndAdjustments — master container for the entire adjustment package
// ---------------------------------------------------------------------------
export interface YearEndAdjustments {
  /** References CompanyProfile.id */
  companyId: string;
  /** Fiscal year in BS format, e.g. "2081/82" */
  fiscalYear: string;

  // ── PPE Register ─────────────────────────────────────────────────────────
  /** Complete list of individual fixed assets */
  assets: AssetItem[];
  /** Per-asset depreciation computation results */
  depreciationResults: DepreciationResult[];
  /** Aggregated depreciation totals per category (for Note 3.1 disclosure) */
  depreciationSummary: DepreciationSummary[];

  // ── Tax Depreciation (Nepal Income Tax Act §19) ───────────────────────────
  taxDepreciationPools: TaxDepreciationPool[];

  // ── Inventory & Investment ────────────────────────────────────────────────
  /** Lower-of-cost-or-NRV items requiring write-down */
  inventoryAdjustments: InventoryAdjustment[];
  /** Fair value / impairment adjustments on investment portfolio */
  investmentAdjustments: InvestmentAdjustment[];

  // ── Provisions & Accruals ─────────────────────────────────────────────────
  provisions: ProvisionEntry[];

  // ── Adjustment Journals ───────────────────────────────────────────────────
  /** All journal entries (system-generated and user-entered) */
  journalEntries: AdjustmentJournalEntry[];

  // ── Computed Totals ───────────────────────────────────────────────────────
  /** Sum of depnForYear across all assets */
  totalDepreciationExpense: number;
  /** Sum of impairmentAmount across all inventory items */
  totalInventoryImpairment: number;
  /**
   * Net fair value movement on investments.
   * Positive = net gain recognised; negative = net loss.
   */
  totalInvestmentFVAdjustment: number;
  /** Sum of additionForYear across all provisions */
  totalProvisions: number;
  /** Aggregate gains on disposal of PPE (positive number) */
  gainOnDisposals: number;
  /** Aggregate losses on disposal of PPE (positive number = a loss) */
  lossOnDisposals: number;

  // ── Tax ───────────────────────────────────────────────────────────────────
  /**
   * Taxable profit as computed under Nepal Income Tax Act 2058.
   * Undefined until the tax calculation step is complete.
   */
  taxableProfit?: number;
  /**
   * Current year income tax expense recognised in profit or loss.
   * Undefined until the tax calculation step is complete.
   */
  currentTaxExpense?: number;
}
