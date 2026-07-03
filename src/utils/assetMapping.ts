import type { AssetItem } from '../types';

export interface AssetRow {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  cost: number;
  accumDepn: number;
  usefulLife: number;
  method: 'SLM' | 'WDV';
  wdvRate: number;
  mortgaged: boolean;
}

const CATEGORY_TO_CLASS: Record<string, string> = {
  Land: 'Land',
  Buildings: 'Building',
  Vehicles: 'Vehicle',
  Computers: 'OfficeEquipment',
  'Office Equipment': 'OfficeEquipment',
  'Furniture & Fixtures': 'OfficeEquipment',
  'Plant & Machinery': 'PlantMachinery',
  'Intangible Assets': 'Intangible',
};

const CLASS_TO_CATEGORY: Record<string, string> = {
  Land: 'Land',
  Building: 'Buildings',
  Vehicle: 'Vehicles',
  OfficeEquipment: 'Office Equipment',
  PlantMachinery: 'Plant & Machinery',
  Intangible: 'Intangible Assets',
  UnderConstruction: 'Plant & Machinery',
};

export function mapCategoryToAssetClass(category: string): string {
  return CATEGORY_TO_CLASS[category] ?? 'Building';
}

export function mapAssetClassToCategory(assetClass: string): string {
  const normalized = assetClass.replace(/^ppe_/, '');
  if (CLASS_TO_CATEGORY[assetClass]) return CLASS_TO_CATEGORY[assetClass];
  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return CLASS_TO_CATEGORY[title] ?? 'Buildings';
}

export function assetRowToAssetItem(row: AssetRow): AssetItem {
  return {
    id: row.id,
    assetName: row.name,
    categoryId: mapCategoryToAssetClass(row.category),
    purchaseDateBS: row.purchaseDate,
    originalCost: row.cost,
    additionalCost: 0,
    usefulLifeYears: row.usefulLife,
    residualValue: 0,
    depreciationMethod: row.method === 'WDV' ? 'WrittenDownValue' : 'StraightLine',
    wdvRate: row.wdvRate,
    accumDepreciationOpening: row.accumDepn,
    isFullyDepreciated: false,
    isMortgaged: row.mortgaged,
    disposed: false,
  };
}

export function assetItemToRow(asset: AssetItem & { name?: string; cost?: number; accumDepn?: number }): AssetRow {
  return {
    id: asset.id,
    name: asset.assetName ?? asset.name ?? '',
    category: mapAssetClassToCategory(asset.categoryId),
    purchaseDate: asset.purchaseDateBS ?? '',
    cost: asset.originalCost ?? asset.cost ?? 0,
    accumDepn: asset.accumDepreciationOpening ?? asset.accumDepn ?? 0,
    usefulLife: asset.usefulLifeYears ?? 10,
    method: asset.depreciationMethod === 'WrittenDownValue' || asset.depreciationMethod === 'WDV' ? 'WDV' : 'SLM',
    wdvRate: asset.wdvRate ?? 20,
    mortgaged: asset.isMortgaged ?? false,
  };
}
