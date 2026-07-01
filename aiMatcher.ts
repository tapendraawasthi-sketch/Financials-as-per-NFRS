// ===== aiMatcher.ts =====
// Gemini-assisted fallback classifier for account names the deterministic matcher
// (accountMatcher.ts) could not resolve with confidence >= 80.
//
// SAFETY RULE: the model is given the FULL fixed taxonomy and instructed to choose ONLY
// from that list, or return null. The response is validated in code against
// CHART_OF_ACCOUNTS before ever being trusted -- if Gemini returns a label that is not an
// exact match to a real chart-of-accounts entry, it is discarded and the account is
// forced to "unmatched" for manual human selection. The AI can suggest; it can never
// invent a destination that doesn't already exist in the template.

import { GoogleGenAI } from "@google/genai";
import { CHART_OF_ACCOUNTS, findChartAccountByLabel } from "./chartOfAccounts";
import { MatchResult } from "./accountMatcher";

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required.");
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

interface AiSuggestion {
  raw_label: string;
  best_match_label: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Sends a batch of unresolved raw labels to Gemini along with the closed taxonomy list,
 * and returns validated MatchResults. Every suggestion is cross-checked against the real
 * chart of accounts before being accepted -- hallucinated labels are dropped.
 */
export async function aiMatchUnresolved(rawLabels: string[]): Promise<MatchResult[]> {
  if (rawLabels.length === 0) return [];

  const ai = getGeminiClient();
  const taxonomyList = CHART_OF_ACCOUNTS.map((a) => `- "${a.label}" (category: ${a.category})`).join("\n");

  const prompt = `You are classifying raw trial balance account names from a client's bookkeeping export into a FIXED chart of accounts used by an audit firm's Nepal NAS-for-MEs financial statement template.

You may ONLY select from this exact closed list of valid destination labels (copy the label text EXACTLY, character for character, including capitalization and punctuation):
${taxonomyList}

If NONE of these labels are a reasonable match for a raw account name, return best_match_label as null. Do not invent new labels. Do not paraphrase a label. Do not select a label that is not letter-for-letter present in the list above.

Raw account names to classify:
${JSON.stringify(rawLabels, null, 2)}

Respond with ONLY a JSON array (no markdown fences, no commentary), one object per raw account name, in the same order, in this exact shape:
[{"raw_label": "...", "best_match_label": "..." | null, "confidence": 0-100, "reasoning": "one short sentence"}]`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });

  const text = (response.text || "").trim();
  let parsed: AiSuggestion[] = [];
  try {
    // Defensive: strip accidental markdown code fences if the model adds them anyway
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("aiMatchUnresolved: failed to parse Gemini JSON response", err, text);
    // Total failure -> everything falls back to unmatched, safe default
    return rawLabels.map((rawLabel) => ({
      rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched", candidates: [],
    }));
  }

  return rawLabels.map((rawLabel) => {
    const suggestion = parsed.find((p) => p.raw_label === rawLabel);
    if (!suggestion || !suggestion.best_match_label) {
      return { rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched" as const, candidates: [] };
    }

    // HARD VALIDATION: the suggested label must exist verbatim in the real chart of accounts.
    const validated = findChartAccountByLabel(suggestion.best_match_label);
    if (!validated) {
      console.warn(
        `aiMatchUnresolved: Gemini suggested non-existent label "${suggestion.best_match_label}" ` +
        `for raw account "${rawLabel}" -- rejecting and forcing manual review.`
      );
      return { rawLabel, matchedLabel: null, category: null, confidence: 0, method: "unmatched" as const, candidates: [] };
    }

    const confidence = Math.min(Math.max(Math.round(suggestion.confidence), 0), 99); // AI never gets 100%
    return {
      rawLabel,
      matchedLabel: validated.label,
      category: validated.category,
      confidence,
      method: "ai" as const,
      candidates: [{ label: validated.label, confidence }],
    };
  });
}
