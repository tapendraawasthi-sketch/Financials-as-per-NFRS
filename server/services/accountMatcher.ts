// Rule-based trial balance account classifier — 6-tier matching pipeline.
// Uses CHART_OF_ACCOUNTS as the master taxonomy.

import { CHART_OF_ACCOUNTS, type COAEntry } from '../../src/data/chartOfAccounts.js';
import type { MappedTBRow, NFRSCategory } from '../../src/types/trialBalance.js';
import type { RawTBRow } from './tbParser.js';

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  bank_charges: 'finance_cost_bank_charges',
  admin_travelling: 'admin_traveling',
  admin_repair_maintenance: 'admin_repairs',
  admin_printing_stationery: 'admin_printing',
  admin_legal: 'admin_legal_professional',
  admin_others: 'admin_other',
  admin_miscellaneous: 'admin_other',
  borrowings_current_overdraft: 'borrowings_current_od',
  borrowings_current_working: 'borrowings_current_wc',
  salary_payable: 'employee_payables_salary',
  bonus_payable: 'employee_payables_bonus',
  pf_ssf_payable: 'employee_payables_pf',
  impairment_on_debtors: 'impairment_expense',
  trade_payables: 'trade_payables_creditors',
  advance_from_customers: 'trade_payables_advance_customers',
  other_current_liabilities: 'other_payables',
  employee_benefit_noncurrent: 'employee_benefit_gratuity',
  borrowings_noncurrent_related: 'borrowings_noncurrent_other',
  salary_wages_expense: 'emp_expense_salaries',
  pf_ssf_expense: 'emp_expense_pf',
  staff_bonus_expense: 'emp_expense_bonus',
  leave_encashment_expense: 'emp_expense_leave',
  other_employee_expense: 'emp_expense_welfare',
  purchase: 'cogs_purchases',
  wages_direct: 'direct_wages',
  other_direct_expenses: 'direct_expenses_other',
  interest_income: 'other_income_interest',
  dividend_income: 'other_income_dividend',
  rental_income: 'other_income_rental',
  gain_on_disposal: 'other_income_disposal_gain',
  other_income: 'other_income_misc',
  interest_expense: 'finance_cost_interest',
  advance_tax: 'advance_tax_paid',
};

function normalizeCategoryAlias(category: string): string {
  return CATEGORY_ALIAS_MAP[category] ?? category;
}

export interface MatchResult {
  nfrsCategory: NFRSCategory | 'unclassified';
  matchMethod: MappedTBRow['matchMethod'];
  confidence: number;
  needsReview: boolean;
  displayLabel: string;
}

const REVIEW_THRESHOLD = 75;
const KEYWORD_THRESHOLD = 40;

// ---------------------------------------------------------------------------
// Normalization & Levenshtein
// ---------------------------------------------------------------------------
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,()&\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const levenshteinCache = new Map<string, number>();
const CACHE_LIMIT = 50_000;

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const key = a < b ? `${a}\x00${b}` : `${b}\x00${a}`;
  const cached = levenshteinCache.get(key);
  if (cached !== undefined) return cached;

  if (levenshteinCache.size >= CACHE_LIMIT) levenshteinCache.clear();

  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }

  const result = dp[n];
  levenshteinCache.set(key, result);
  return result;
}

export function clearLevenshteinCache(): void {
  levenshteinCache.clear();
}

// ---------------------------------------------------------------------------
// Build exact-match map from all synonyms
// ---------------------------------------------------------------------------
const EXACT_MATCH_MAP = new Map<string, NFRSCategory>();

function buildExactMatchMap(): void {
  if (EXACT_MATCH_MAP.size > 0) return;
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    EXACT_MATCH_MAP.set(normalize(entry.displayLabel), entry.category);
    for (const syn of entry.synonyms) {
      EXACT_MATCH_MAP.set(normalize(syn), entry.category);
    }
    for (const nr of entry.nepaliRomanized) {
      EXACT_MATCH_MAP.set(normalize(nr), entry.category);
    }
  }
}

// ---------------------------------------------------------------------------
// Parent group → category hints (Tier 5)
// ---------------------------------------------------------------------------
const PARENT_GROUP_MAP: Array<{ pattern: RegExp; category: NFRSCategory; subPatterns?: Array<{ pattern: RegExp; category: NFRSCategory }> }> = [
  { pattern: /sundry debtors?/i, category: 'trade_receivables' },
  { pattern: /sundry creditors?/i, category: 'trade_payables' },
  { pattern: /salary payable/i, category: 'salary_payable' },
  { pattern: /tds payable/i, category: 'tds_payable' },
  { pattern: /loan from bank/i, category: 'borrowings_noncurrent_bank' },
  { pattern: /bank accounts?/i, category: 'bank_current_account' },
  {
    pattern: /property.*plant|ppe|fixed assets?/i,
    category: 'ppe_buildings',
    subPatterns: [
      { pattern: /land|bhoomi|jagga/i, category: 'ppe_land' },
      { pattern: /building|bhawan/i, category: 'ppe_buildings' },
      { pattern: /vehicle|gadi/i, category: 'ppe_vehicles' },
      { pattern: /computer|laptop/i, category: 'ppe_computers' },
      { pattern: /furniture/i, category: 'ppe_furniture' },
      { pattern: /plant|machinery/i, category: 'ppe_plant_machinery' },
      { pattern: /intangible|software|tally/i, category: 'ppe_intangibles' },
      { pattern: /cwip|under construction/i, category: 'ppe_cwip' },
      { pattern: /depreciation/i, category: 'accum_depreciation' },
    ],
  },
  {
    pattern: /direct income/i,
    category: 'revenue_sales',
    subPatterns: [{ pattern: /service/i, category: 'revenue_services' }],
  },
  { pattern: /indirect income/i, category: 'other_income' },
  {
    pattern: /employee benefit expenses?/i,
    category: 'salary_wages_expense',
    subPatterns: [
      { pattern: /pf|ssf|cit|provident/i, category: 'pf_ssf_expense' },
      { pattern: /bonus/i, category: 'staff_bonus_expense' },
      { pattern: /allowance/i, category: 'allowances_expense' },
    ],
  },
  {
    pattern: /administrative expenses?/i,
    category: 'admin_others',
    subPatterns: [
      { pattern: /rent|bhada/i, category: 'admin_rent' },
      { pattern: /audit/i, category: 'admin_audit_fee' },
      { pattern: /travel/i, category: 'admin_travelling' },
      { pattern: /electric|water|utility/i, category: 'admin_water_electricity' },
      { pattern: /advertis|market/i, category: 'admin_advertisement' },
      { pattern: /legal/i, category: 'admin_legal' },
      { pattern: /insurance/i, category: 'admin_insurance' },
      { pattern: /print|station/i, category: 'admin_printing_stationery' },
    ],
  },
  { pattern: /repair.*maintenance/i, category: 'admin_repair_maintenance' },
  {
    pattern: /impairment expense/i,
    category: 'impairment_on_debtors',
    subPatterns: [{ pattern: /investment/i, category: 'impairment_on_investments' }],
  },
];

function matchParentContext(parentGroup: string, label: string): { category: NFRSCategory; confidence: number } | null {
  if (!parentGroup.trim()) return null;
  for (const entry of PARENT_GROUP_MAP) {
    if (!entry.pattern.test(parentGroup)) continue;
    if (entry.subPatterns) {
      for (const sub of entry.subPatterns) {
        if (sub.pattern.test(label)) {
          return { category: sub.category, confidence: 65 };
        }
      }
    }
    return { category: entry.category, confidence: 60 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Keyword scoring (Tier 4)
// ---------------------------------------------------------------------------
function scoreKeywords(entry: COAEntry, normalizedLabel: string, parentGroup: string): number {
  let score = 0;
  const words = normalizedLabel.split(' ').filter(Boolean);

  for (const kw of entry.keywords) {
    const nkw = normalize(kw);
    if (!nkw) continue;
    if (words.includes(nkw) || normalizedLabel === nkw) {
      score += 10;
    } else if (normalizedLabel.includes(nkw)) {
      score += 5;
    }
  }

  for (const ex of entry.exclusionKeywords) {
    if (normalizedLabel.includes(normalize(ex))) score -= 20;
  }

  // Parent group bonus
  const pg = normalize(parentGroup);
  if (pg && entry.statementLine.toLowerCase().includes('equity') && /capital|equity|punji/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes('NCA') && /fixed asset|ppe|non.?current asset/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes('CA') && /current asset/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes('CL') && /current liabilit/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes('NCL') && /non.?current liabilit/i.test(pg)) {
    score += 15;
  }
  if (pg && entry.statementLine.includes('IS') && /income|expense|direct|indirect/i.test(pg)) {
    score += 15;
  }

  return score;
}

function keywordMatch(normalizedLabel: string, parentGroup: string): MatchResult | null {
  let best: { entry: COAEntry; score: number } | null = null;

  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    const score = scoreKeywords(entry, normalizedLabel, parentGroup);
    if (!best || score > best.score) best = { entry, score };
  }

  if (!best || best.score < KEYWORD_THRESHOLD) return null;

  const confidence = Math.min(85, Math.max(60, 50 + best.score));
  return {
    nfrsCategory: normalizeCategoryAlias(best.entry.category),
    matchMethod: 'keyword',
    confidence,
    needsReview: confidence < REVIEW_THRESHOLD,
    displayLabel: best.entry.displayLabel,
  };
}

// ---------------------------------------------------------------------------
// Fuzzy match (Tier 6)
// ---------------------------------------------------------------------------
function fuzzyMatch(normalizedLabel: string): MatchResult | null {
  let best: { entry: COAEntry; distance: number; synonym: string } | null = null;

  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    const candidates = [entry.displayLabel, ...entry.synonyms, ...entry.nepaliRomanized];
    for (const cand of candidates) {
      const nc = normalize(cand);
      const dist = levenshtein(normalizedLabel, nc);
      const maxLen = Math.max(normalizedLabel.length, nc.length);
      if (maxLen === 0) continue;
      if (dist / maxLen < 0.3) {
        if (!best || dist < best.distance) {
          best = { entry, distance: dist, synonym: cand };
        }
      }
    }
  }

  if (!best) return null;
  const maxLen = Math.max(normalizedLabel.length, normalize(best.synonym).length);
  const confidence = Math.round(100 * (1 - best.distance / maxLen));
  const clamped = Math.min(60, Math.max(40, confidence));

  return {
    nfrsCategory: normalizeCategoryAlias(best.entry.category),
    matchMethod: 'fuzzy',
    confidence: clamped,
    needsReview: true,
    displayLabel: best.entry.displayLabel,
  };
}

// ---------------------------------------------------------------------------
// Single-row classifier
// ---------------------------------------------------------------------------
export function classifyRow(row: RawTBRow): MatchResult {
  buildExactMatchMap();

  const label = row.rawLabel.trim();
  const normalized = normalize(label);

  if (row.isGroupRow) {
    return {
      nfrsCategory: 'unclassified',
      matchMethod: 'unmatched',
      confidence: 0,
      needsReview: false,
      displayLabel: label,
    };
  }

  // Tier 1 — exact match
  const exact = EXACT_MATCH_MAP.get(normalized);
  if (exact) {
    const entry = CHART_OF_ACCOUNTS.find((e) => e.category === exact);
    return {
      nfrsCategory: normalizeCategoryAlias(exact),
      matchMethod: 'exact',
      confidence: 100,
      needsReview: false,
      displayLabel: entry?.displayLabel ?? label,
    };
  }

  // Tier 2 — synonym exact
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    for (const syn of entry.synonyms) {
      if (normalize(syn) === normalized) {
        return {
          nfrsCategory: normalizeCategoryAlias(entry.category),
          matchMethod: 'synonym',
          confidence: 95,
          needsReview: false,
          displayLabel: entry.displayLabel,
        };
      }
    }
  }

  // Tier 3 — Nepali romanized exact
  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup) continue;
    for (const nr of entry.nepaliRomanized) {
      if (normalize(nr) === normalized) {
        return {
          nfrsCategory: normalizeCategoryAlias(entry.category),
          matchMethod: 'synonym',
          confidence: 90,
          needsReview: false,
          displayLabel: entry.displayLabel,
        };
      }
    }
  }

  // Tier 4 — keyword scoring
  const kw = keywordMatch(normalized, row.parentGroup);
  if (kw) return kw;

  // Tier 5 — parent context
  const ctx = matchParentContext(row.parentGroup, label);
  if (ctx) {
    const entry = CHART_OF_ACCOUNTS.find((e) => e.category === ctx.category);
    return {
      nfrsCategory: normalizeCategoryAlias(ctx.category),
      matchMethod: 'context',
      confidence: ctx.confidence,
      needsReview: ctx.confidence < REVIEW_THRESHOLD,
      displayLabel: entry?.displayLabel ?? label,
    };
  }

  // Tier 6 — fuzzy
  const fuzzy = fuzzyMatch(normalized);
  if (fuzzy) return fuzzy;

  return {
    nfrsCategory: 'unclassified',
    matchMethod: 'unmatched',
    confidence: 0,
    needsReview: true,
    displayLabel: label,
  };
}

// ---------------------------------------------------------------------------
// Classify all rows
// ---------------------------------------------------------------------------
export function classifyAll(rows: RawTBRow[]): MappedTBRow[] {
  return rows.map((row) => {
    const result = classifyRow(row);
    return {
      ...row,
      nfrsCategory: result.nfrsCategory,
      matchMethod: result.matchMethod,
      confidence: result.confidence,
      needsReview: result.needsReview || result.nfrsCategory === 'unclassified',
      userOverride: false,
      displayLabel: result.displayLabel,
    };
  });
}

// Legacy exports
export const CONFIDENCE_THRESHOLD = REVIEW_THRESHOLD;
export function matchSingleAccount(rawLabel: string, rowIndex: number, parentGroup = ''): {
  rowIndex: number;
  rawLabel: string;
  nfrsCategory: NFRSCategory | 'unclassified';
  confidence: number;
  method: MappedTBRow['matchMethod'];
  needsReview: boolean;
} {
  const row: RawTBRow = {
    rowIndex,
    rawLabel,
    openingDr: 0, openingCr: 0, duringDr: 0, duringCr: 0,
    adjustmentDr: 0, adjustmentCr: 0, closingDr: 0, closingCr: 0,
    rowLevel: 2, isGroupRow: false, parentGroup, rawIndentSpaces: 0,
  };
  const r = classifyRow(row);
  return {
    rowIndex,
    rawLabel,
    nfrsCategory: r.nfrsCategory,
    confidence: r.confidence,
    method: r.matchMethod,
    needsReview: r.needsReview,
  };
}

export function matchAllAccounts(rows: RawTBRow[]) {
  return classifyAll(rows).map((r) => ({
    rowIndex: r.rowIndex,
    rawLabel: r.rawLabel,
    matchedLabel: r.displayLabel,
    nfrsCategory: r.nfrsCategory,
    confidence: r.confidence,
    method: r.matchMethod,
    candidates: [],
    needsReview: r.needsReview,
    userOverride: r.userOverride,
  }));
}
