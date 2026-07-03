import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePPEClassId, ppeTbCategories } from '../../server/services/ppeCategoryMap.js';

describe('ppeCategoryMap', () => {
  it('maps TB category ids to canonical PPE classes', () => {
    assert.equal(normalizePPEClassId('ppe_buildings'), 'Building');
    assert.equal(normalizePPEClassId('building'), 'Building');
    assert.equal(normalizePPEClassId('ppe_cwip'), 'UnderConstruction');
  });

  it('returns all TB categories for a PPE class', () => {
    const categories = ppeTbCategories('OfficeEquipment');
    assert.ok(categories.includes('ppe_office_equipment'));
    assert.ok(categories.includes('ppe_computers'));
  });
});
