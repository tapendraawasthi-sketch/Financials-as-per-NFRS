// Deterministic trial balance account-name classification engine.
// Uses: exact label match → synonym match → Nepali romanized match →
//       keyword bucket → parent-group context → fuzzy similarity.
// No AI is involved in this file.

import { CHART_OF_ACCOUNTS } from '../../src/data/chartOfAccounts';
import type { NFRSCategory } from '../../src/types';
import type { RawTBRow } from './tbParser';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type MatchMethod =
  | 'exact'
  | 'synonym'
  | 'nepali_romanized'
  | 'keyword'
  | 'context'
  | 'fuzzy'
  | 'ai'
  | 'manual'
  | 'unmatched';

export interface MatchResult {
  rowIndex: number;
  rawLabel: string;
  matchedLabel: string | null;
  nfrsCategory: NFRSCategory | 'unclassified';
  confidence: number;
  method: MatchMethod;
  candidates: Array<{ label: string; nfrsCategory: NFRSCategory | 'unclassified'; confidence: number }>;
  needsReview: boolean;
  userOverride?: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const CONFIDENCE_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// 1. normalize
// ---------------------------------------------------------------------------
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,()&\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 2. levenshtein
// ---------------------------------------------------------------------------
const levenshteinCache = new Map<string, number>();
const CACHE_LIMIT = 50_000;

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const key = a < b ? `${a}\x00${b}` : `${b}\x00${a}`;
  const cached = levenshteinCache.get(key);
  if (cached !== undefined) return cached;

  if (levenshteinCache.size >= CACHE_LIMIT) {
    levenshteinCache.clear();
  }

  const m = a.length;
  const n = b.length;
  const dp = new Array<number[]>(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Array<number>(n + 1).fill(0);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const result = dp[m][n];
  levenshteinCache.set(key, result);
  return result;
}

export function clearLevenshteinCache(): void {
  levenshteinCache.clear();
}

// ---------------------------------------------------------------------------
// 3. similarityScore
// ---------------------------------------------------------------------------
export function similarityScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.length === 0 || nb.length === 0) return 0;

  const tokensA = na.split(' ').filter(Boolean);
  const tokensB = nb.split(' ').filter(Boolean);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longerSet = new Set(tokensA.length <= tokensB.length ? tokensB : tokensA);
  const overlapCount = shorter.filter((t) => longerSet.has(t)).length;
  const tokenScore = shorter.length > 0 ? (overlapCount / shorter.length) * 100 : 0;

  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const editScore = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;

  return Math.min(100, Math.round(0.70 * tokenScore + 0.30 * editScore));
}

// ---------------------------------------------------------------------------
// 4. Keyword-bucket detection for common Nepal accounting patterns
// ---------------------------------------------------------------------------
const KEYWORD_BUCKETS: Array<{
  pattern: RegExp;
  nfrsCategory: NFRSCategory;
  confidence: number;
}> = [
  // Trade receivables / debtors
  { pattern: /\b(debtor|accounts? receivable|trade receivable|customer receivable)\b/i, nfrsCategory: 'trade_receivables', confidence: 85 },
  // Trade payables / creditors
  { pattern: /\b(creditor|accounts? payable|trade payable|supplier payable)\b/i, nfrsCategory: 'trade_payables_creditors', confidence: 85 },
  // Cash
  { pattern: /\bpetty cash\b/i, nfrsCategory: 'cash_in_hand', confidence: 92 },
  { pattern: /\bcash\b/i, nfrsCategory: 'cash_in_hand', confidence: 80 },
  // Bank borrowings
  { pattern: /\b(term loan|long term loan|bank loan)\b/i, nfrsCategory: 'borrowings_noncurrent_bank', confidence: 88 },
  // Fixed deposits
  { pattern: /\b(fd|fixed deposit)\b/i, nfrsCategory: 'bank_fixed_deposit_current', confidence: 85 },
  // Bank accounts
  { pattern: /\bbank\b/i, nfrsCategory: 'bank_current_account', confidence: 80 },
  // PPE categories
  { pattern: /\b(land|plot|property)\b/i, nfrsCategory: 'ppe_land', confidence: 82 },
  { pattern: /\bbuilding/i, nfrsCategory: 'ppe_buildings', confidence: 82 },
  { pattern: /\b(vehicle|motor vehicle|car)\b/i, nfrsCategory: 'ppe_vehicles', confidence: 82 },
  { pattern: /\b(computer|laptop|desktop|server)\b/i, nfrsCategory: 'ppe_computers', confidence: 82 },
  { pattern: /\b(furniture|fixture|fitting)\b/i, nfrsCategory: 'ppe_furniture', confidence: 82 },
  { pattern: /\b(plant|machinery|machine)\b/i, nfrsCategory: 'ppe_plant_machinery', confidence: 82 },
  { pattern: /\b(software|intangible|patent|trademark)\b/i, nfrsCategory: 'ppe_intangibles', confidence: 82 },
  { pattern: /\b(cwip|capital wip|construction in progress|work in progress)\b/i, nfrsCategory: 'ppe_cwip', confidence: 82 },
  // Accumulated depreciation
  { pattern: /\baccumulated depreciation\b/i, nfrsCategory: 'accum_depreciation', confidence: 92 },
  { pattern: /\bless.?:?\s*(accumulated|accum)?\s*depreciation\b/i, nfrsCategory: 'accum_depreciation', confidence: 90 },
  // Employee salaries
  { pattern: /\b(salary|salaries|wages and salary)\b/i, nfrsCategory: 'emp_expense_salaries', confidence: 82 },
  // PF/SSF
  { pattern: /\b(provident fund|pf|ssf|cit)\b.*expense/i, nfrsCategory: 'emp_expense_pf', confidence: 85 },
  { pattern: /\b(provident fund|pf|ssf|cit)\b/i, nfrsCategory: 'emp_expense_pf', confidence: 78 },
  // Finance costs
  { pattern: /\b(interest expense|loan interest|interest paid)\b/i, nfrsCategory: 'finance_cost_interest', confidence: 87 },
  { pattern: /\b(bank charge|bank commission|bank fee)\b/i, nfrsCategory: 'finance_cost_bank_charges', confidence: 87 },
  // TDS — disambiguation handled separately
  { pattern: /\btds\b/i, nfrsCategory: 'tds_payable', confidence: 80 },    // default; overridden by context
  // VAT
  { pattern: /\bvat payable\b/i, nfrsCategory: 'other_payables', confidence: 90 },
  { pattern: /\binput vat\b/i, nfrsCategory: 'other_receivables_other', confidence: 88 },
  // Revenue
  { pattern: /\b(sales?|revenue|turnover)\b/i, nfrsCategory: 'revenue_sales', confidence: 82 },
  { pattern: /\bservice income\b/i, nfrsCategory: 'revenue_services', confidence: 90 },
  // Purchases / COGS
  { pattern: /\b(purchase|goods purchased|raw material purchased)\b/i, nfrsCategory: 'cogs_purchases', confidence: 82 },
  // Admin expenses
  { pattern: /\b(rent|office rent|house rent)\b.*expense/i, nfrsCategory: 'admin_rent', confidence: 82 },
  // Depreciation expense
  { pattern: /\b(depreciation)\b/i, nfrsCategory: 'depreciation_expense', confidence: 85 },
  // Income tax
  { pattern: /\b(income tax|corporate tax)\b.*expense/i, nfrsCategory: 'income_tax_expense', confidence: 87 },
  // Share capital
  { pattern: /\b(share capital|paid.?up capital)\b/i, nfrsCategory: 'share_capital', confidence: 92 },
  // Retained earnings
  { pattern: /\b(reserves?\s*[&and]+\s*surplus|retained earnings|profit and loss)\b/i, nfrsCategory: 'retained_earnings', confidence: 95 },
  // CWIP / capital work in progress
  { pattern: /\b(work in progress|capital work in progress|cwip|construction in progress)\b/i, nfrsCategory: 'ppe_cwip', confidence: 93 },
  // Biological assets
  { pattern: /\b(biological assets?|livestock|aquaculture|crops)\b/i, nfrsCategory: 'biological_assets', confidence: 92 },
  // Security deposit
  { pattern: /\b(security deposit|guarantee margin|refundable deposit)\b/i, nfrsCategory: 'nca_deposits', confidence: 85 },
  // CSR provision
  { pattern: /\b(csr provision|provision for csr|corporate social responsibility provision)\b/i, nfrsCategory: 'provisions_current', confidence: 87 },
  // Dividend payable
  { pattern: /\bdividend payable\b/i, nfrsCategory: 'dividend_payable', confidence: 90 },
  // Related party
  { pattern: /\b(director loan|loan from director|loan from partner)\b/i, nfrsCategory: 'related_party_payable', confidence: 88 },
  { pattern: /\b(loan to director|receivable from related party|loan to partner)\b/i, nfrsCategory: 'related_party_receivable', confidence: 88 },
  // Staff advance
  { pattern: /\bstaff advance\b/i, nfrsCategory: 'other_receivables_staff_advance', confidence: 85 },
  // Provision for bad debts / impairment on debtors
  { pattern: /\b(provision for bad debts?|provision for doubtful debts?|provision for impairment on debtors?)\b/i, nfrsCategory: 'provision_impairment_debtors', confidence: 90 },
  // Provision for impairment on investment
  { pattern: /\bprovision for impairment on investment\b/i, nfrsCategory: 'provision_impairment_investment', confidence: 90 },
  // NCA held for sale
  { pattern: /\b(assets? held for sale|non.?current assets? held for sale)\b/i, nfrsCategory: 'nca_held_for_sale', confidence: 88 },
  // Advance tax / TDS asset
  { pattern: /\b(advance tax|advance income tax|tds receivable|tax deducted at source.*asset)\b/i, nfrsCategory: 'other_receivables_tds', confidence: 88 },
];

// ---------------------------------------------------------------------------
// 5. Nepali Romanized synonyms
// Maps romanized Nepali words to NFRSCategory.
// Checked before keyword buckets for speed.
// ---------------------------------------------------------------------------
interface NepaliRomanizedEntry {
  patterns: RegExp[];
  nfrsCategory: NFRSCategory;
  confidence: number;
}

const NEPALI_ROMANIZED_ENTRIES: NepaliRomanizedEntry[] = [
  // Land
  {
    patterns: [/\bjameen\b/i, /\bjalin\b/i, /\bjamiyn\b/i],
    nfrsCategory: 'ppe_land',
    confidence: 82,
  },
  // Buildings
  {
    patterns: [/\bbhawan\b/i, /\bghar\b/i, /\bimarat\b/i, /\bbhavan\b/i],
    nfrsCategory: 'ppe_buildings',
    confidence: 82,
  },
  // Inventory / goods
  {
    patterns: [/\bsaman\b/i, /\bmaal\b/i, /\bmal\b/i, /\bsaaman\b/i, /\baamal\b/i, /\bkharcha saman\b/i],
    nfrsCategory: 'inventory_finished_goods',
    confidence: 80,
  },
  // Cash
  {
    patterns: [/\bnakad\b/i, /\bnakaad\b/i, /\bnaqad\b/i],
    nfrsCategory: 'cash_in_hand',
    confidence: 85,
  },
  // Trade receivables / debtors
  {
    patterns: [/\bdhani\b/i, /\bbujandar\b/i, /\bpaune\b/i, /\bpaunekha\b/i],
    nfrsCategory: 'trade_receivables',
    confidence: 80,
  },
  // Trade payables / creditors
  {
    patterns: [/\blenidar\b/i, /\bkharidan\b/i, /\btirnu parne\b/i],
    nfrsCategory: 'trade_payables_creditors',
    confidence: 80,
  },
  // TDS — default to payable; overridden by context check
  {
    patterns: [/\btdas\b/i, /\btda\b/i],
    nfrsCategory: 'tds_payable',
    confidence: 80,
  },
  // Share capital
  {
    patterns: [/\bpanjikaran\b/i, /\bdarta\b/i, /\bsheyer kapital\b/i],
    nfrsCategory: 'share_capital',
    confidence: 80,
  },
  // VAT / other payables
  {
    patterns: [/\bhulak\b/i, /\bhulak khata\b/i, /\bvat\b/i],
    nfrsCategory: 'other_payables',
    confidence: 78,
  },
  // Vehicles
  {
    patterns: [/\bgadi\b/i, /\bsawari\b/i, /\bmotor\b/i],
    nfrsCategory: 'ppe_vehicles',
    confidence: 80,
  },
  // Furniture
  {
    patterns: [/\bfurnichar\b/i, /\bsajawat\b/i],
    nfrsCategory: 'ppe_furniture',
    confidence: 80,
  },
  // Salary
  {
    patterns: [/\btankhwah\b/i, /\btlb\b/i, /\btankhah\b/i],
    nfrsCategory: 'emp_expense_salaries',
    confidence: 82,
  },
  // Gratuity
  {
    patterns: [/\bupadhan\b/i, /\bkaryamuktibhatta\b/i],
    nfrsCategory: 'emp_expense_gratuity',
    confidence: 82,
  },
  // Rent
  {
    patterns: [/\bbhada\b/i, /\bkiraya\b/i],
    nfrsCategory: 'admin_rent',
    confidence: 82,
  },
  // Electricity
  {
    patterns: [/\bbidhyut\b/i, /\bwidyut\b/i, /\bbidyut\b/i],
    nfrsCategory: 'admin_electricity',
    confidence: 82,
  },
  // Retained earnings / P&L
  {
    patterns: [/\bafi ko nakafaa\b/i, /\bnaafaa\b/i, /\bnafaa\b/i],
    nfrsCategory: 'retained_earnings',
    confidence: 78,
  },
];

// ---------------------------------------------------------------------------
// 6. Parent Group Context Map
// Maps normalized parent group labels to a restricted set of candidate categories.
// When a row's parentGroup matches one of these, only those categories are considered.
// ---------------------------------------------------------------------------
const ASSET_CURRENT_CATEGORIES: NFRSCategory[] = [
  'trade_receivables',
  'cash_in_hand',
  'bank_current_account',
  'bank_savings_account',
  'bank_fixed_deposit_current',
  'inventory_raw_materials',
  'inventory_wip',
  'inventory_finished_goods',
  'other_receivables_tds',
  'other_receivables_prepayments',
  'other_receivables_staff_advance',
  'other_receivables_loans',
  'other_receivables_advance_supplier',
  'other_receivables_other',
  'provision_impairment_debtors',
];

const ASSET_NONCURRENT_CATEGORIES: NFRSCategory[] = [
  'ppe_land',
  'ppe_buildings',
  'ppe_vehicles',
  'ppe_office_equipment',
  'ppe_computers',
  'ppe_furniture',
  'ppe_plant_machinery',
  'ppe_intangibles',
  'ppe_cwip',
  'accum_depreciation',
  'investment_listed_trading',
  'investment_unlisted',
  'investment_fixed_deposit_noncurrent',
  'nca_deposits',
  'nca_loans_advances',
  'nca_other',
  'biological_assets',
  'nca_held_for_sale',
  'related_party_receivable',
  'provision_impairment_investment',
];

const LIABILITY_CURRENT_CATEGORIES: NFRSCategory[] = [
  'trade_payables_creditors',
  'trade_payables_advance_customers',
  'borrowings_current_od',
  'borrowings_current_cc',
  'borrowings_current_wc',
  'borrowings_current_portion_lt',
  'income_tax_payable',
  'tds_payable',
  'other_payables',
  'audit_fee_payable',
  'employee_payables_salary',
  'employee_payables_bonus',
  'employee_payables_pf',
  'provisions_current',
  'dividend_payable',
  'related_party_payable',
];

const LIABILITY_NONCURRENT_CATEGORIES: NFRSCategory[] = [
  'borrowings_noncurrent_bank',
  'borrowings_noncurrent_other',
  'deferred_tax_liability',
  'employee_benefit_gratuity',
  'provisions_noncurrent',
  'related_party_payable',
];

const EQUITY_CATEGORIES: NFRSCategory[] = [
  'share_capital',
  'share_premium',
  'general_reserve',
  'retained_earnings',
  'other_reserves',
];

const INCOME_CATEGORIES: NFRSCategory[] = [
  'revenue_sales',
  'revenue_services',
  'other_income_interest',
  'other_income_dividend',
  'other_income_rental',
  'other_income_disposal_gain',
  'other_income_misc',
];

const EXPENSE_CATEGORIES: NFRSCategory[] = [
  'cogs_purchases',
  'cogs_opening_stock',
  'direct_wages',
  'direct_expenses_other',
  'emp_expense_salaries',
  'emp_expense_pf',
  'emp_expense_gratuity',
  'emp_expense_welfare',
  'emp_expense_bonus',
  'emp_expense_other',
  'finance_cost_interest',
  'finance_cost_bank_charges',
  'admin_rent',
  'admin_rates_taxes',
  'admin_insurance',
  'admin_repairs',
  'admin_electricity',
  'admin_communication',
  'admin_printing',
  'admin_legal_professional',
  'admin_audit_fee',
  'admin_traveling',
  'admin_advertisement',
  'admin_other',
  'depreciation_expense',
  'impairment_expense',
  'income_tax_expense',
];

const EMPLOYEE_EXPENSE_CATEGORIES: NFRSCategory[] = [
  'emp_expense_salaries',
  'emp_expense_pf',
  'emp_expense_gratuity',
  'emp_expense_welfare',
  'emp_expense_bonus',
  'emp_expense_other',
];

/**
 * Maps normalized parent group keywords to a list of allowed categories.
 * If a row's parentGroup matches a key here, only these categories will be
 * considered during fuzzy matching (context stage).
 */
const PARENT_GROUP_CONTEXT_MAP: Array<{
  patterns: RegExp[];
  allowedCategories: NFRSCategory[];
  confidence: number;
}> = [
  // ── Current Assets ──────────────────────────────────────────────────────────
  {
    patterns: [
      /\bcurrent assets?\b/i,
      /\b(ca)\b/i,
      /\bcurrent asset group\b/i,
      /\bchalu sampatti\b/i,
    ],
    allowedCategories: ASSET_CURRENT_CATEGORIES,
    confidence: 75,  // boost confidence when parent group context matches
  },
  // ── Non-Current / Fixed Assets ───────────────────────────────────────────────
  {
    patterns: [
      /\bnon.?current assets?\b/i,
      /\bfixed assets?\b/i,
      /\b(nca)\b/i,
      /\bproperty plant.*(equipment|ppne)\b/i,
      /\bppe\b/i,
      /\bsthir sampatti\b/i,
      /\bsthayee sampatti\b/i,
    ],
    allowedCategories: ASSET_NONCURRENT_CATEGORIES,
    confidence: 75,
  },
  // ── Current Liabilities ──────────────────────────────────────────────────────
  {
    patterns: [
      /\bcurrent liabilit/i,
      /\b(cl)\b/i,
      /\bchalu dayitwa\b/i,
      /\bcurrent creditors?\b/i,
    ],
    allowedCategories: LIABILITY_CURRENT_CATEGORIES,
    confidence: 75,
  },
  // ── Non-Current Liabilities ──────────────────────────────────────────────────
  {
    patterns: [
      /\bnon.?current liabilit/i,
      /\b(ncl)\b/i,
      /\bdirghkalin dayitwa\b/i,
      /\blong.?term liabilit/i,
    ],
    allowedCategories: LIABILITY_NONCURRENT_CATEGORIES,
    confidence: 75,
  },
  // ── Equity / Capital ─────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(equity|capital account|shareholders? equity|owner.*equity)\b/i,
      /\bpunjee\b/i,
      /\bkapital\b/i,
    ],
    allowedCategories: EQUITY_CATEGORIES,
    confidence: 78,
  },
  // ── Revenue / Income ─────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(income|revenue|sales|direct income|indirect income|other income)\b/i,
      /\baamdani\b/i,
      /\bbikri\b/i,
    ],
    allowedCategories: INCOME_CATEGORIES,
    confidence: 75,
  },
  // ── Expenses ─────────────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(expenses?|overheads?|direct expenses?|indirect expenses?|operating expenses?)\b/i,
      /\bkharcha\b/i,
    ],
    allowedCategories: EXPENSE_CATEGORIES,
    confidence: 72,
  },
  // ── Employee / HR Expenses ───────────────────────────────────────────────────
  {
    patterns: [
      /\b(employee benefit expenses?|staff expenses?|hr expenses?|personnel expenses?)\b/i,
      /\bkarmachari kharcha\b/i,
    ],
    allowedCategories: EMPLOYEE_EXPENSE_CATEGORIES,
    confidence: 78,
  },
];

// ---------------------------------------------------------------------------
// Helper: get allowed categories for a given parentGroup string
// Returns null if no context match is found.
// ---------------------------------------------------------------------------
function getContextCategories(parentGroup: string): {
  categories: NFRSCategory[];
  confidence: number;
} | null {
  if (!parentGroup || parentGroup.trim() === '') return null;

  for (const entry of PARENT_GROUP_CONTEXT_MAP) {
    for (const pattern of entry.patterns) {
      if (pattern.test(parentGroup)) {
        return { categories: entry.allowedCategories, confidence: entry.confidence };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// TDS Disambiguation: Asset (Dr) vs Liability (Cr)
// Uses the parentGroup context to decide.
// ---------------------------------------------------------------------------
function disambiguateTDS(
  parentGroup: string,
  closingBalance: number,   // positive = Dr, negative = Cr
): NFRSCategory {
  const pg = (parentGroup ?? '').toLowerCase();

  // Explicit parent group context check
  const isLiabilityContext =
    /liabilit/i.test(pg) ||
    /current liabilit/i.test(pg) ||
    /payable/i.test(pg) ||
    /cl\b/i.test(pg);

  const isAssetContext =
    /current assets?/i.test(pg) ||
    /\bca\b/i.test(pg) ||
    /non.?current assets?/i.test(pg) ||
    /advance tax/i.test(pg) ||
    /receivable/i.test(pg);

  if (isLiabilityContext) return 'tds_payable';
  if (isAssetContext) return 'other_receivables_tds';

  // Fall back to balance sign
  if (closingBalance > 0) return 'other_receivables_tds';   // Dr balance = asset
  if (closingBalance < 0) return 'tds_payable';              // Cr balance = liability
  return 'tds_payable';                                       // Default
}

// ---------------------------------------------------------------------------
// 7. matchSingleAccount
// ---------------------------------------------------------------------------
export function matchSingleAccount(
  rawLabel: string,
  rowIndex: number,
  parentGroup: string = '',
  closingBalance: number = 0,
): MatchResult {
  const trimmed = rawLabel.trim();

  // ── Step 1: exact label match ─────────────────────────────────────────────
  for (const entry of CHART_OF_ACCOUNTS) {
    if (normalize(trimmed) === normalize(entry.label)) {
      return {
        rowIndex, rawLabel: trimmed,
        matchedLabel: entry.label,
        nfrsCategory: entry.nfrsCategory,
        confidence: 100,
        method: 'exact',
        candidates: [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: 100 }],
        needsReview: false,
      };
    }
  }

  // ── Step 2: synonym match ─────────────────────────────────────────────────
  for (const entry of CHART_OF_ACCOUNTS) {
    for (const syn of (entry.synonyms ?? [])) {
      if (normalize(trimmed) === normalize(syn)) {
        return {
          rowIndex, rawLabel: trimmed,
          matchedLabel: entry.label,
          nfrsCategory: entry.nfrsCategory,
          confidence: 95,
          method: 'synonym',
          candidates: [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: 95 }],
          needsReview: false,
        };
      }
    }
  }

  // ── Step 3: Nepali romanized match ────────────────────────────────────────
  for (const entry of NEPALI_ROMANIZED_ENTRIES) {
    for (const pattern of entry.patterns) {
      if (pattern.test(trimmed)) {
        // Special case: TDS in romanized Nepali — check context
        let nfrsCategory = entry.nfrsCategory;
        if (
          (nfrsCategory === 'tds_payable' || nfrsCategory === 'other_receivables_tds') &&
          /\btds|tdas|tda\b/i.test(trimmed)
        ) {
          nfrsCategory = disambiguateTDS(parentGroup, closingBalance);
        }

        const catEntries = CHART_OF_ACCOUNTS.filter((e) => e.nfrsCategory === nfrsCategory);
        const bestEntry = catEntries[0] ?? null;
        return {
          rowIndex, rawLabel: trimmed,
          matchedLabel: bestEntry?.label ?? null,
          nfrsCategory,
          confidence: entry.confidence,
          method: 'nepali_romanized',
          candidates: catEntries.slice(0, 5).map((e) => ({
            label: e.label, nfrsCategory: e.nfrsCategory, confidence: entry.confidence,
          })),
          needsReview: entry.confidence < CONFIDENCE_THRESHOLD,
        };
      }
    }
  }

  // ── Step 4: keyword bucket detection ─────────────────────────────────────
  for (const { pattern, nfrsCategory: rawCategory, confidence } of KEYWORD_BUCKETS) {
    if (pattern.test(trimmed)) {
      // Special TDS disambiguation
      let nfrsCategory: NFRSCategory = rawCategory;
      if (rawCategory === 'tds_payable' && /\btds\b/i.test(trimmed)) {
        nfrsCategory = disambiguateTDS(parentGroup, closingBalance);
      }

      const catEntries = CHART_OF_ACCOUNTS.filter((e) => e.nfrsCategory === nfrsCategory);
      const bestEntry = catEntries[0] ?? null;
      return {
        rowIndex, rawLabel: trimmed,
        matchedLabel: bestEntry?.label ?? null,
        nfrsCategory,
        confidence,
        method: 'keyword',
        candidates: catEntries.slice(0, 5).map((e) => ({
          label: e.label, nfrsCategory: e.nfrsCategory, confidence,
        })),
        needsReview: confidence < CONFIDENCE_THRESHOLD,
      };
    }
  }

  // ── Step 5: parent group context matching ─────────────────────────────────
  const contextResult = getContextCategories(parentGroup);
  if (contextResult) {
    // Only consider chart entries whose category is in the allowed set
    const allowedSet = new Set(contextResult.categories);

    const scored = CHART_OF_ACCOUNTS
      .filter((entry) => allowedSet.has(entry.nfrsCategory as NFRSCategory))
      .flatMap((entry) => {
        const labelScore = similarityScore(trimmed, entry.label);
        const synScores = (entry.synonyms ?? []).map((s) => similarityScore(trimmed, s));
        const best = Math.max(labelScore, ...synScores, 0);
        return [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: best }];
      })
      .sort((a, b) => b.confidence - a.confidence);

    const top = scored[0];
    if (top && top.confidence >= 65) {
      // Boost confidence slightly because parent group confirmed the category family
      const boostedConf = Math.min(100, Math.round(top.confidence * 1.08));
      return {
        rowIndex, rawLabel: trimmed,
        matchedLabel: top.label,
        nfrsCategory: top.nfrsCategory as NFRSCategory,
        confidence: boostedConf,
        method: 'context',
        candidates: scored.slice(0, 5).map((s) => ({
          ...s,
          nfrsCategory: s.nfrsCategory as NFRSCategory,
        })),
        needsReview: boostedConf < CONFIDENCE_THRESHOLD,
      };
    }
  }

  // ── Step 6: fuzzy similarity across all chart entries ─────────────────────
  const scored = CHART_OF_ACCOUNTS.flatMap((entry) => {
    const labelScore = similarityScore(trimmed, entry.label);
    const synScores = (entry.synonyms ?? []).map((s) => similarityScore(trimmed, s));
    const best = Math.max(labelScore, ...synScores, 0);
    return [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence: best }];
  }).sort((a, b) => b.confidence - a.confidence);

  const top = scored[0];
  const candidates = scored.slice(0, 5);

  if (top && top.confidence >= 75) {
    return {
      rowIndex, rawLabel: trimmed,
      matchedLabel: top.label,
      nfrsCategory: top.nfrsCategory as NFRSCategory,
      confidence: top.confidence,
      method: 'fuzzy',
      candidates: candidates.map((c) => ({ ...c, nfrsCategory: c.nfrsCategory as NFRSCategory })),
      needsReview: top.confidence < CONFIDENCE_THRESHOLD,
    };
  }

  // ── No match ──────────────────────────────────────────────────────────────
  return {
    rowIndex, rawLabel: trimmed,
    matchedLabel: null,
    nfrsCategory: 'unclassified',
    confidence: top?.confidence ?? 0,
    method: 'unmatched',
    candidates: candidates.map((c) => ({ ...c, nfrsCategory: c.nfrsCategory as NFRSCategory })),
    needsReview: true,
  };
}

// ---------------------------------------------------------------------------
// 8. matchAllAccounts
// ---------------------------------------------------------------------------
export function matchAllAccounts(
  rows: RawTBRow[],
): MatchResult[] {
  return rows.map((row) => {
    // Skip group rows — assign them 'unclassified' without trying to match
    if (row.isGroupRow) {
      return {
        rowIndex: row.rowIndex,
        rawLabel: row.rawLabel,
        matchedLabel: null,
        nfrsCategory: 'unclassified' as const,
        confidence: 0,
        method: 'unmatched' as MatchMethod,
        candidates: [],
        needsReview: false,   // group rows don't need user review
        userOverride: false,
      };
    }

    // Compute net closing balance for TDS disambiguation
    const closingBalance = (row.closingDr ?? 0) - (row.closingCr ?? 0);

    return matchSingleAccount(
      row.rawLabel,
      row.rowIndex,
      row.parentGroup ?? '',
      closingBalance,
    );
  });
}
