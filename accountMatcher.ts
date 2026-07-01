// ===== accountMatcher.ts =====
// Deterministic account-name matching engine. NO AI HERE.
// Tries, in order: (1) exact label match, (2) synonym dictionary match,
// (3) normalized fuzzy text similarity (Levenshtein-based), (4) bucket-slot detection
// for repeatable sub-ledgers (Debtor A/B/C, Creditor A/B/C, Bank A-D, Director A-D, Pool A-E).
// Anything that doesn't clear a confidence floor is left "unmatched" for either the
// AI fallback (aiMatcher.ts) or manual user selection in the review UI.

import { CHART_OF_ACCOUNTS, ChartAccount, getBucketLabels } from "./chartOfAccounts";

export interface MatchResult {
  rawLabel: string;
  matchedLabel: string | null;
  category: string | null;
  confidence: number; // 0-100
  method: "exact" | "synonym" | "fuzzy" | "bucket_slot" | "ai" | "unmatched";
  candidates: { label: string; confidence: number }[]; // top alternatives for the dropdown
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,()&\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Classic Levenshtein distance, small strings only (account labels are short) -> O(n*m) is fine.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
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
  return dp[m][n];
}

function similarityScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.length === 0 || nb.length === 0) return 0;
  // token overlap boost: if all words of the shorter string appear in the longer one
  const tokensA = na.split(" ").filter(Boolean);
  const tokensB = nb.split(" ").filter(Boolean);
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longerSet = new Set(tokensA.length <= tokensB.length ? tokensB : tokensA);
  const overlap = shorter.filter((t) => longerSet.has(t)).length;
  const tokenScore = shorter.length > 0 ? (overlap / shorter.length) * 100 : 0;

  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const editScore = maxLen > 0 ? (1 - dist / maxLen) * 100 : 0;

  // Weighted blend: token containment matters more than raw edit distance for account names
  return Math.round(0.65 * tokenScore + 0.35 * editScore);
}

// Bucket-slot detection: patterns like "Debtor A", "Creditor B", "Bank C", "Director D",
// "Pool A", or plain free-text names that should be OFFERED as a new slot in that bucket
// rather than force-matched to a fixed label (e.g. "ABC Traders" as a new debtor).
const BUCKET_PATTERNS: { bucket: "sundry_debtors" | "sundry_creditors" | "bank_accounts" | "related_party_director" | "related_party_director_recv" | "repair_pool"; regex: RegExp; category: string; noteHint: string }[] = [
  { bucket: "sundry_debtors", regex: /\bdebtor\b/i, category: "trade_receivables", noteHint: "3.3" },
  { bucket: "sundry_creditors", regex: /\bcreditor\b/i, category: "trade_payables", noteHint: "3.13" },
  { bucket: "bank_accounts", regex: /\bbank\b/i, category: "cash_bank", noteHint: "3.8" },
  { bucket: "related_party_director", regex: /\bdirector\b.*(payable|loan)/i, category: "related_party_liability", noteHint: "3.11" },
  { bucket: "related_party_director_recv", regex: /\bdirector\b.*(receivable|advance)/i, category: "related_party_asset", noteHint: "3.4" },
];

export function matchAccount(rawLabel: string): MatchResult {
  const trimmed = rawLabel.trim();
  if (!trimmed) {
    return { rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched", candidates: [] };
  }

  // 1. Exact match (case-insensitive on normalized text, but return canonical template label)
  const exact = CHART_OF_ACCOUNTS.find((a) => normalize(a.label) === normalize(trimmed));
  if (exact) {
    return {
      rawLabel, matchedLabel: exact.label, category: exact.category, confidence: 100,
      method: "exact", candidates: [{ label: exact.label, confidence: 100 }],
    };
  }

  // 2. Synonym dictionary match
  const synonymHit = CHART_OF_ACCOUNTS.find((a) =>
    (a.synonyms || []).some((syn) => normalize(syn) === normalize(trimmed))
  );
  if (synonymHit) {
    return {
      rawLabel, matchedLabel: synonymHit.label, category: synonymHit.category, confidence: 95,
      method: "synonym", candidates: [{ label: synonymHit.label, confidence: 95 }],
    };
  }

  // 3. Bucket-slot pattern detection (repeatable sub-ledgers) — offer existing slots first
  for (const pattern of BUCKET_PATTERNS) {
    if (pattern.regex.test(trimmed)) {
      const existingSlots = getBucketLabels(pattern.bucket as any);
      const scored = existingSlots
        .map((label) => ({ label, confidence: similarityScore(trimmed, label) }))
        .sort((a, b) => b.confidence - a.confidence);
      const best = scored[0];
      return {
        rawLabel,
        matchedLabel: best && best.confidence >= 55 ? best.label : null,
        category: pattern.category,
        confidence: best ? best.confidence : 40,
        method: "bucket_slot",
        candidates: scored.slice(0, 5),
      };
    }
  }

  // 4. Fuzzy similarity across the entire fixed taxonomy (labels + synonyms)
  const scored = CHART_OF_ACCOUNTS.map((a) => {
    const labelScore = similarityScore(trimmed, a.label);
    const synScores = (a.synonyms || []).map((s) => similarityScore(trimmed, s));
    const best = Math.max(labelScore, ...synScores, 0);
    return { label: a.label, category: a.category, confidence: best };
  }).sort((a, b) => b.confidence - a.confidence);

  const top = scored[0];
  const candidates = scored.slice(0, 5).map((s) => ({ label: s.label, confidence: s.confidence }));

  if (top && top.confidence >= 80) {
    return { rawLabel, matchedLabel: top.label, category: top.category, confidence: top.confidence, method: "fuzzy", candidates };
  }

  // Below threshold: leave for AI fallback / manual review, but surface best guesses
  return {
    rawLabel,
    matchedLabel: null,
    category: top ? top.category : null,
    confidence: top ? top.confidence : 0,
    method: "unmatched",
    candidates,
  };
}

export function matchAllAccounts(rawLabels: string[]): MatchResult[] {
  return rawLabels.map((label) => matchAccount(label));
}
