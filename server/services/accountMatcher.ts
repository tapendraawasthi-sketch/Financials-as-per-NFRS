// ===== server/services/accountMatcher.ts =====
// Deterministic trial balance account-name classification engine.
// Uses: exact label match → synonym match → keyword bucket → fuzzy similarity.
// No AI is involved in this file.

import { CHART_OF_ACCOUNTS } from '../../src/data/chartOfAccounts';
import type { NFRSCategory } from '../../src/types';
import type { RawTBParseResult } from './tbParser';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type MatchMethod = 'exact' | 'synonym' | 'keyword' | 'fuzzy' | 'ai' | 'manual' | 'unmatched';

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
const MAX_EDIT_LEN = 100;

export function levenshtein(a: string, b: string): number {
  const m = Math.min(a.length, MAX_EDIT_LEN);
  const n = Math.min(b.length, MAX_EDIT_LEN);
  const as = a.slice(0, m);
  const bs = b.slice(0, n);
  if (m === 0) return n;
  if (n === 0) return m;

  // Use two-row rolling array for O(m) space
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (as[i - 1] === bs[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    prev = [...curr];
  }
  return prev[n];
}

// ---------------------------------------------------------------------------
// 3. similarityScore
// ---------------------------------------------------------------------------
export function similarityScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.length === 0 || nb.length === 0) return 0;

  // Token overlap
  const tokensA = na.split(' ').filter(Boolean);
  const tokensB = nb.split(' ').filter(Boolean);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longerSet = new Set(tokensA.length <= tokensB.length ? tokensB : tokensA);
  const overlapCount = shorter.filter((t) => longerSet.has(t)).length;
  const tokenScore = shorter.length > 0 ? (overlapCount / shorter.length) * 100 : 0;

  // Edit distance
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
  { pattern: /\b(debtor|accounts? receivable|trade receivable|customer receivable)\b/i, nfrsCategory: 'trade_receivables', confidence: 85 },
  { pattern: /\b(creditor|accounts? payable|trade payable|supplier payable)\b/i,       nfrsCategory: 'trade_payables_creditors', confidence: 85 },
  { pattern: /\bcash\b/i,            nfrsCategory: 'cash_in_hand',              confidence: 80 },
  { pattern: /\bpetty cash\b/i,      nfrsCategory: 'cash_in_hand',              confidence: 90 },
  { pattern: /\bbank\b/i,            nfrsCategory: 'bank_current_account',       confidence: 80 },
  { pattern: /\b(land|plot|property)\b/i, nfrsCategory: 'ppe_land',             confidence: 82 },
  { pattern: /\bbuilding/i,          nfrsCategory: 'ppe_buildings',              confidence: 82 },
  { pattern: /\bvehicle|motor vehicle|car\b/i, nfrsCategory: 'ppe_vehicles',     confidence: 82 },
  { pattern: /\bcomputer|laptop|desktop|server\b/i, nfrsCategory: 'ppe_computers', confidence: 82 },
  { pattern: /\bfurniture|fixture|fitting\b/i, nfrsCategory: 'ppe_furniture',   confidence: 82 },
  { pattern: /\b(plant|machinery|machine)\b/i, nfrsCategory: 'ppe_plant_machinery', confidence: 82 },
  { pattern: /\b(software|intangible|patent|trademark)\b/i, nfrsCategory: 'ppe_intangibles', confidence: 82 },
  { pattern: /\b(cwip|capital wip|construction in progress|work in progress)\b/i, nfrsCategory: 'ppe_cwip', confidence: 82 },
  { pattern: /\baccumulated depreciation\b/i, nfrsCategory: 'accum_depreciation', confidence: 92 },
  { pattern: /\b(salary|salaries|wages and salary)\b/i, nfrsCategory: 'emp_expense_salaries', confidence: 82 },
  { pattern: /\b(provident fund|pf|ssf|cit)\b.*expense/i, nfrsCategory: 'emp_expense_pf', confidence: 82 },
  { pattern: /\b(interest expense|loan interest|interest paid)\b/i, nfrsCategory: 'finance_cost_interest', confidence: 85 },
  { pattern: /\b(bank charge|bank commission|bank fee)\b/i, nfrsCategory: 'finance_cost_bank_charges', confidence: 85 },
  { pattern: /\btds\b/i,             nfrsCategory: 'tds_payable',               confidence: 82 },
  { pattern: /\bvat payable\b/i,     nfrsCategory: 'other_payables',            confidence: 88 },
  { pattern: /\b(sales?|revenue|turnover)\b/i, nfrsCategory: 'revenue_sales',   confidence: 82 },
  { pattern: /\bservice income\b/i,  nfrsCategory: 'revenue_services',           confidence: 88 },
  { pattern: /\b(purchase|goods purchased|raw material purchased)\b/i, nfrsCategory: 'cogs_purchases', confidence: 82 },
  { pattern: /\b(rent|office rent|house rent)\b.*expense/i, nfrsCategory: 'admin_rent', confidence: 82 },
  { pattern: /\b(depreciation)\b/i,  nfrsCategory: 'depreciation_expense',       confidence: 85 },
  { pattern: /\b(income tax|corporate tax)\b.*expense/i, nfrsCategory: 'income_tax_expense', confidence: 85 },
  { pattern: /\b(share capital|paid.?up capital)\b/i, nfrsCategory: 'share_capital', confidence: 90 },
  { pattern: /\b(retained earnings|profit and loss)\b/i, nfrsCategory: 'retained_earnings', confidence: 88 },
  { pattern: /\b(inventory|closing stock|stock in trade|finished goods)\b/i, nfrsCategory: 'inventory_finished_goods', confidence: 80 },
];

// ---------------------------------------------------------------------------
// 5. matchSingleAccount
// ---------------------------------------------------------------------------
export function matchSingleAccount(rawLabel: string, rowIndex: number): MatchResult {
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

  // ── Step 3: keyword bucket detection ─────────────────────────────────────
  for (const { pattern, nfrsCategory, confidence } of KEYWORD_BUCKETS) {
    if (pattern.test(trimmed)) {
      // Find best chart label for this category
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

  // ── Step 4: fuzzy similarity across all chart entries (labels + synonyms) ─
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
      nfrsCategory: top.nfrsCategory,
      confidence: top.confidence,
      method: 'fuzzy',
      candidates,
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
    candidates: candidates,
    needsReview: true,
  };
}

// ---------------------------------------------------------------------------
// 6. matchAllAccounts
// ---------------------------------------------------------------------------
export function matchAllAccounts(
  rows: RawTBParseResult['rows'],
): MatchResult[] {
  return rows.map((row) => matchSingleAccount(row.rawLabel, row.rowIndex));
}
