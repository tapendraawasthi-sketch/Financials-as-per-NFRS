// Claude AI fallback classifier for unmatched trial balance rows.
// Called only when confidence < 75 or category is unclassified.

import Anthropic from '@anthropic-ai/sdk';
import { CHART_OF_ACCOUNTS, NFRS_CATEGORIES } from '../../src/data/chartOfAccounts.js';
import type { MappedTBRow } from '../../src/types/trialBalance.js';

interface AIClassification {
  index: number;
  category: string;
  confidence: number;
  reasoning?: string;
}

const aiCache = new Map<string, AIClassification[]>();

const SYSTEM_PROMPT =
  'You are a Nepal chartered accountant expert in NAS for MEs and NFRS financial ' +
  'reporting. Given a list of trial balance account labels from Nepali accounting ' +
  'software, classify each into exactly one NFRS category from the provided list. ' +
  'Respond with a JSON array only. No explanation.';

function cacheKey(label: string, parentGroup: string): string {
  return `${label.toLowerCase()}|${parentGroup.toLowerCase()}`;
}

function buildUserPrompt(batch: Array<{ index: number; label: string; parentGroup: string }>): string {
  return `Classify these account labels into NFRS categories.
Available categories: ${NFRS_CATEGORIES.join(', ')}
Parent group context is provided for each account.
Return ONLY a JSON array of objects: [{index, category, confidence, reasoning}]
Accounts to classify:
${JSON.stringify(batch)}`;
}

function parseAIResponse(text: string): AIClassification[] {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as AIClassification[];
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Classify low-confidence rows using Claude. Batches up to 50 rows per API call.
 */
export async function classifyWithAI(
  rows: MappedTBRow[],
  apiKey: string,
): Promise<MappedTBRow[]> {
  const needsAI = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.needsReview || row.nfrsCategory === 'unclassified');

  if (needsAI.length === 0 || !apiKey) return rows;

  const result = [...rows];
  const BATCH_SIZE = 50;
  const client = new Anthropic({ apiKey });

  for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
    const batch = needsAI.slice(i, i + BATCH_SIZE);
    const uncached: typeof batch = [];
    const cachedResults = new Map<number, AIClassification>();

    for (const item of batch) {
      const key = cacheKey(item.row.rawLabel, item.row.parentGroup);
      const hit = aiCache.get(key);
      if (hit?.[0]) {
        cachedResults.set(item.index, { ...hit[0], index: item.index });
      } else {
        uncached.push(item);
      }
    }

    let apiResults: AIClassification[] = [];
    if (uncached.length > 0) {
      const prompt = buildUserPrompt(
        uncached.map((u) => ({
          index: u.index,
          label: u.row.rawLabel,
          parentGroup: u.row.parentGroup,
        })),
      );

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content
          .filter((c) => c.type === 'text')
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('');
        apiResults = parseAIResponse(text);
      } catch (err) {
        console.error('[AI Matcher] API error:', err);
      }
    }

    const allResults = [...apiResults, ...cachedResults.values()];
    const validCategories = new Set(NFRS_CATEGORIES);

    for (const ai of allResults) {
      const idx = ai.index;
      if (idx < 0 || idx >= result.length) continue;

      const category = validCategories.has(ai.category) ? ai.category : 'unclassified';
      const entry = CHART_OF_ACCOUNTS.find((e) => e.category === category);
      const confidence = Math.min(100, Math.max(0, ai.confidence ?? 70));

      result[idx] = {
        ...result[idx],
        nfrsCategory: category,
        matchMethod: 'ai',
        confidence,
        needsReview: confidence < 75 || category === 'unclassified',
        displayLabel: entry?.displayLabel ?? result[idx].rawLabel,
      };

      const key = cacheKey(result[idx].rawLabel, result[idx].parentGroup);
      aiCache.set(key, [{ index: idx, category, confidence, reasoning: ai.reasoning }]);
    }
  }

  return result;
}

/** Legacy export */
export async function aiMatchUnresolved(
  accounts: Pick<MappedTBRow, 'rawLabel' | 'parentGroup' | 'closingDr' | 'closingCr'>[],
  _company: unknown,
  apiKey: string,
): Promise<Array<{ rowIndex: number; nfrsCategory: string; confidence: number; reasoning: string }>> {
  const rows: MappedTBRow[] = accounts.map((a, i) => ({
    rowIndex: i,
    rawLabel: a.rawLabel,
    parentGroup: a.parentGroup ?? '',
    openingDr: 0, openingCr: 0, duringDr: 0, duringCr: 0,
    adjustmentDr: 0, adjustmentCr: 0,
    closingDr: a.closingDr ?? 0, closingCr: a.closingCr ?? 0,
    rowLevel: 2, isGroupRow: false, rawIndentSpaces: 0,
    nfrsCategory: 'unclassified',
    matchMethod: 'unmatched',
    confidence: 0,
    needsReview: true,
    userOverride: false,
    displayLabel: a.rawLabel,
  }));

  const classified = await classifyWithAI(rows, apiKey);
  return classified.map((r, i) => ({
    rowIndex: i,
    nfrsCategory: r.nfrsCategory,
    confidence: r.confidence,
    reasoning: '',
  }));
}

export function clearAIMatcherCache(): void {
  aiCache.clear();
}
