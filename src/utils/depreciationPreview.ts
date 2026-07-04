import {
  calculateSLMDepreciation,
  calculateWDVDepreciation,
} from '../../server/services/depreciationEngine';
import type { AssetRow } from './assetMapping';

/** Client-side annual depreciation estimate — uses the same helpers as depreciationEngine. */
export function previewAnnualDepreciation(asset: AssetRow): number {
  if (!asset.cost || asset.cost <= 0) return 0;
  if (asset.category === 'Land') return 0;
  if (asset.disposed) return 0;

  if (asset.method === 'WDV') {
    const wdv = Math.max(0, asset.cost - (asset.accumDepn || 0));
    return Math.round(calculateWDVDepreciation(wdv, asset.wdvRate || 0, 1));
  }

  const life = asset.usefulLife || 1;
  return Math.round(calculateSLMDepreciation(asset.cost, 0, life, 1));
}
