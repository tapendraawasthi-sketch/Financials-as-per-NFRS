import type { AssetItem, MappedTBRow } from '../types';
import { mapAssetClassToCategory, mapCategoryToAssetClass } from './assetMapping';

const PPE_PREFIXES = ['ppe_', 'property_plant_equipment'];

function isPpeRow(row: MappedTBRow): boolean {
  if (row.isGroupRow) return false;
  const cat = String(row.nfrsCategory ?? '');
  if ((row.closingDr ?? 0) === 0 && (row.closingCr ?? 0) === 0) return false;
  return PPE_PREFIXES.some((prefix) => cat === prefix || cat.startsWith(prefix));
}

/** Build asset register rows from mapped PPE trial balance accounts. */
export function prefillAssetsFromTrialBalance(rows: MappedTBRow[] = []): AssetItem[] {
  return rows.filter(isPpeRow).map((account, i) => {
    const nfrs = String(account.nfrsCategory ?? '');
    const rawClass = nfrs.startsWith('ppe_') ? nfrs.replace('ppe_', '') : 'building';
    const displayCategory = mapAssetClassToCategory(rawClass);
    return {
      id: `ppe-prefill-${account.rowIndex ?? i}`,
      assetName: String(account.displayLabel ?? account.rawLabel ?? `PPE Account ${i + 1}`),
      categoryId: mapCategoryToAssetClass(displayCategory),
      originalCost: Number(account.closingDr ?? 0),
      additionalCost: Number(account.duringDr ?? 0),
      purchaseDateBS: '',
      usefulLifeYears: 10,
      residualValue: 0,
      depreciationMethod: 'StraightLine',
      wdvRate: 20,
      accumDepreciationOpening: 0,
      isFullyDepreciated: false,
      isMortgaged: false,
      disposed: false,
    };
  });
}

export function isAssetRegisterEmpty(assets: AssetItem[] = []): boolean {
  return assets.length === 0 || assets.every((a) => {
    const name = (a.assetName ?? '').trim();
    return !name && (a.originalCost ?? 0) === 0;
  });
}
