/**
 * Optional Claude enrichment for adjustment wizard section visibility.
 * Rule-based detectAdjustmentRelevance remains the source of truth;
 * AI may only ADD sections the rules missed, never remove rule-detected sections.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MappedTBRow } from '../../src/types/trialBalance.js';
import type { AdjustmentRelevance, AdjustmentSectionVisibility } from '../../src/utils/adjustmentRelevance.js';
import { detectAdjustmentRelevance } from '../../src/utils/adjustmentRelevance.js';

export interface AIRelevanceEnrichment {
  aiEnhanced: boolean;
  aiNotes: string[];
  suggestedSections: Partial<AdjustmentSectionVisibility>;
}

const SECTION_KEYS: Array<keyof AdjustmentSectionVisibility> = [
  'ppe', 'inventory', 'investments', 'provisions', 'disallowedTax', 'advanceTax', 'relatedPartyLoan', 'journal',
];

const SYSTEM_PROMPT =
  'You are a Nepal CA preparing year-end adjustments for NAS for MEs financial statements. ' +
  'Given trial balance account labels, identify which adjustment wizard sections apply beyond obvious zeros. ' +
  'Respond with JSON only: { "sections": { "ppe": bool, "inventory": bool, ... }, "notes": string[] }';

function buildAccountSummary(rows: MappedTBRow[]): string {
  return rows
    .filter((r) => !r.isGroupRow)
    .filter((r) => (r.closingDr ?? 0) > 0 || (r.closingCr ?? 0) > 0)
    .slice(0, 120)
    .map((r) => ({
      label: r.rawLabel ?? r.displayLabel,
      category: r.nfrsCategory,
      dr: r.closingDr ?? 0,
      cr: r.closingCr ?? 0,
    }))
    .map((r) => `${r.label} [${r.category}] Dr:${r.dr} Cr:${r.cr}`)
    .join('\n');
}

function parseAIRelevance(text: string): { sections: Partial<AdjustmentSectionVisibility>; notes: string[] } {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return { sections: {}, notes: [] };
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    sections?: Partial<AdjustmentSectionVisibility>;
    notes?: string[];
  };
  return {
    sections: parsed.sections ?? {},
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
}

export async function enrichAdjustmentRelevanceWithAI(
  rows: MappedTBRow[],
  base: AdjustmentRelevance,
  apiKey: string,
): Promise<AdjustmentRelevance & AIRelevanceEnrichment> {
  if (!apiKey || rows.length === 0) {
    return { ...base, aiEnhanced: false, aiNotes: [], suggestedSections: {} };
  }

  const client = new Anthropic({ apiKey });
  const accountSummary = buildAccountSummary(rows);

  const userPrompt = `Trial balance accounts (Nepal MEs engagement):
${accountSummary}

Rule-based detection already found:
${JSON.stringify(base.sectionVisibility)}

Which adjustment sections should ALSO be shown? Only suggest true for sections with evidence in the accounts.
Sections: ${SECTION_KEYS.join(', ')}
Return JSON: { "sections": { ... }, "notes": ["brief reason", ...] }`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    const { sections, notes } = parseAIRelevance(text);

    const mergedVisibility: AdjustmentSectionVisibility = { ...base.sectionVisibility };
    for (const key of SECTION_KEYS) {
      if (sections[key] === true) mergedVisibility[key] = true;
    }

    const activeSectionLabels = [...base.activeSectionLabels];
    if (sections.ppe && !base.sectionVisibility.ppe) activeSectionLabels.unshift('PPE / Depreciation (AI)');
    if (sections.investments && !base.sectionVisibility.investments) activeSectionLabels.push('Investment FV (AI)');

    return {
      ...base,
      hasPPE: base.hasPPE || sections.ppe === true,
      hasInventory: base.hasInventory || sections.inventory === true,
      hasInvestments: base.hasInvestments || sections.investments === true,
      hasRelatedParty: base.hasRelatedParty || sections.relatedPartyLoan === true,
      sectionVisibility: mergedVisibility,
      activeSectionLabels,
      aiEnhanced: true,
      aiNotes: notes,
      suggestedSections: sections,
    };
  } catch (err) {
    console.warn('[adjustmentRelevanceAI] API error:', err);
    return { ...base, aiEnhanced: false, aiNotes: ['AI enrichment unavailable — using rule-based detection only.'], suggestedSections: {} };
  }
}

export function detectRelevanceWithOptionalAI(
  rows: MappedTBRow[],
  company: Parameters<typeof detectAdjustmentRelevance>[1],
  useAI: boolean,
  apiKey?: string,
): Promise<AdjustmentRelevance & Partial<AIRelevanceEnrichment>> {
  const base = detectAdjustmentRelevance(rows, company);
  if (!useAI || !apiKey) return Promise.resolve(base);
  return enrichAdjustmentRelevanceWithAI(rows, base, apiKey);
}
