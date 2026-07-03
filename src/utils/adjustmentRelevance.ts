import type { MappedTBRow } from '../types';

export interface AdjustmentRelevance {
  hasPPE: boolean;
  hasInventory: boolean;
  hasInvestments: boolean;
  hasTradeReceivables: boolean;
}

const PPE_PREFIXES = ['ppe_', 'property_plant_equipment'];
const INVENTORY_CATEGORIES = new Set([
  'inventory_raw_materials',
  'inventory_wip',
  'inventory_finished_goods',
]);
const INVESTMENT_CATEGORIES = new Set([
  'investment_listed_trading',
  'investment_unlisted',
  'investment_fixed_deposit_noncurrent',
  'bank_fixed_deposit_current',
]);

function rowHasBalance(row: MappedTBRow): boolean {
  if (row.isGroupRow) return false;
  return (row.closingDr ?? 0) > 0 || (row.closingCr ?? 0) > 0;
}

export function detectAdjustmentRelevance(rows: MappedTBRow[] = []): AdjustmentRelevance {
  let hasPPE = false;
  let hasInventory = false;
  let hasInvestments = false;
  let hasTradeReceivables = false;

  for (const row of rows) {
    if (!rowHasBalance(row)) continue;
    const cat = String(row.nfrsCategory ?? '');
    if (PPE_PREFIXES.some((prefix) => cat === prefix || cat.startsWith(prefix))) {
      hasPPE = true;
    }
    if (INVENTORY_CATEGORIES.has(cat)) hasInventory = true;
    if (INVESTMENT_CATEGORIES.has(cat)) hasInvestments = true;
    if (cat === 'trade_receivables') hasTradeReceivables = true;
  }

  return { hasPPE, hasInventory, hasInvestments, hasTradeReceivables };
}
