import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectRelevanceWithOptionalAI } from '../../server/services/adjustmentRelevanceAI.js';

describe('adjustmentRelevanceAI', () => {
  it('returns rule-based relevance when AI is disabled', async () => {
    const result = await detectRelevanceWithOptionalAI(
      [{
        rowIndex: 0,
        rawLabel: 'Building',
        nfrsCategory: 'ppe_buildings',
        closingDr: 1_000_000,
        closingCr: 0,
        isGroupRow: false,
        openingDr: 0, openingCr: 0, duringDr: 0, duringCr: 0,
        adjustmentDr: 0, adjustmentCr: 0,
      }],
      null,
      false,
      undefined,
    );
    assert.equal(result.hasPPE, true);
    assert.notEqual(result.aiEnhanced, true);
  });

  it('returns rule-based relevance when API key is missing even if useAI=true', async () => {
    const result = await detectRelevanceWithOptionalAI([], null, true, undefined);
    assert.equal(result.sectionVisibility.provisions, true);
    assert.notEqual(result.aiEnhanced, true);
  });
});
