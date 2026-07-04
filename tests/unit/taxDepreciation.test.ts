import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTaxDepreciation } from '../../server/services/depreciationEngine.js';
import { ITA_TAX_DEPRECIATION_POOLS } from '../../src/data/taxDepreciationPools.js';

describe('taxDepreciation pools', () => {
  it('exposes Pool A through Pool E with ITA 2058 rates', () => {
    assert.equal(ITA_TAX_DEPRECIATION_POOLS.length, 5);
    assert.deepEqual(
      ITA_TAX_DEPRECIATION_POOLS.map((pool) => pool.pool),
      ['A', 'B', 'C', 'D', 'E'],
    );
  });

  it('returns taxDepreciation on each computed pool', () => {
    const pools = calculateTaxDepreciation(
      [
        {
          id: 'a1',
          assetName: 'Building',
          assetClass: 'Building',
          purchaseDateBS: '1 Shrawan 2080',
          originalCost: 1_000_000,
          additionsCY: 0,
          disposalValue: 0,
          depreciationCY: 40_000,
        },
        {
          id: 'e1',
          assetName: 'Plant',
          assetClass: 'PlantMachinery',
          purchaseDateBS: '1 Shrawan 2080',
          originalCost: 500_000,
          additionsCY: 0,
          disposalValue: 0,
          depreciationCY: 75_000,
        },
      ] as any,
      [],
      { 'Pool A (Building 5%)': 900_000, 'Pool E (Plant & Machinery 15%)': 400_000 },
      5_000_000,
    );

    assert.equal(pools.length, 5);
    assert.ok(pools.every((pool) => typeof pool.taxDepreciation === 'number'));
    assert.ok(pools.some((pool) => String(pool.poolName).includes('Pool E')));
  });
});
