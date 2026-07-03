import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCategoryAlias } from '../../server/services/accountMatcher.ts';
import { buildCategoryGroups } from '../../src/data/categoryGroups.ts';

describe('taxonomy', () => {
  it('normalizes canonical COA ids to legacy engine ids', () => {
    assert.equal(normalizeCategoryAlias('trade_payables'), 'trade_payables_creditors');
    assert.equal(normalizeCategoryAlias('admin_water_electricity'), 'admin_electricity');
    assert.equal(normalizeCategoryAlias('provision_impairment_investments'), 'provision_impairment_investment');
  });

  it('exposes all leaf COA categories in mapper dropdown groups', () => {
    const groups = buildCategoryGroups();
    const all = new Set(groups.flatMap((g) => g.categories));
    assert.ok(all.has('vat_payable'));
    assert.ok(all.has('materials_consumed'));
    assert.ok(all.has('admin_water_electricity'));
    assert.ok(all.size >= 100);
  });
});
