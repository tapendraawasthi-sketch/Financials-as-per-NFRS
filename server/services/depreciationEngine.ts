// Depreciation engine — NAS for MEs (Section 12) accounting depreciation
// and Nepal Income Tax Act 2058 pool-based tax depreciation.

import type { AssetRegisterEntry } from '../../src/types/adjustments.js';
import type { PPENote } from '../../src/types/financials.js';
import type { AccountingPolicies } from '../../src/types/company.js';
import type { DepreciationSummary } from '../../src/types/index.js';
import { normalizePPEClassId, ppeClassLabel } from './ppeCategoryMap.js';

const DEFAULT_RATES: Record<string, { rate: number; method: 'SLM' | 'WDV' }> = {
  Land: { rate: 0, method: 'SLM' },
  Building: { rate: 0.04, method: 'SLM' },
  OfficeEquipment: { rate: 0.25, method: 'WDV' },
  Vehicle: { rate: 0.20, method: 'WDV' },
  PlantMachinery: { rate: 0.15, method: 'WDV' },
  Intangible: { rate: 0.20, method: 'SLM' },
  UnderConstruction: { rate: 0, method: 'SLM' },
};

const TAX_POOLS: Array<{ poolName: string; rate: number; classes: string[] }> = [
  { poolName: 'Pool A (Building 5%)', rate: 0.05, classes: ['Building'] },
  { poolName: 'Pool B (Computers & Software 25%)', rate: 0.25, classes: ['Intangible', 'OfficeEquipment'] },
  { poolName: 'Pool C (Office Equipment & Furniture 25%)', rate: 0.25, classes: ['OfficeEquipment'] },
  { poolName: 'Pool D (Vehicles 20%)', rate: 0.20, classes: ['Vehicle'] },
  { poolName: 'Pool E (Plant & Machinery 15%)', rate: 0.15, classes: ['PlantMachinery'] },
];

function parseBSMonth(dateStr: string): number {
  const months: Record<string, number> = {
    shrawan: 1, bhadra: 2, aswin: 3, kartik: 4, mangsir: 5, poush: 6,
    magh: 7, falgun: 8, chaitra: 9, baisakh: 10, jestha: 11, ashadh: 12,
  };
  const parts = dateStr.trim().split(/\s+/);
  return months[(parts[1] ?? '').toLowerCase()] ?? 1;
}

function monthsHeldInFY(purchaseDate: string | number): number {
  if (typeof purchaseDate === 'number') {
    return 12;
  }
  const month = parseBSMonth(purchaseDate);
  if (month <= 6) return 12;
  if (month <= 9) return 12 - (month - 6) * 2;
  return Math.max(1, 12 - month + 1);
}

function getRateAndMethod(
  asset: AssetRegisterEntry,
  policies?: AccountingPolicies,
): { rate: number; method: 'SLM' | 'WDV' } {
  if (asset.depreciationMethodOverride) {
    return {
      rate: asset.rateOverride ?? DEFAULT_RATES[asset.assetClass]?.rate ?? 0.1,
      method: asset.depreciationMethodOverride,
    };
  }
  const policyRate = policies?.depreciationRates?.[asset.assetClass];
  const defaults = DEFAULT_RATES[asset.assetClass] ?? { rate: 0.1, method: 'SLM' as const };
  return {
    rate: policyRate ?? defaults.rate,
    method: policies?.depreciationMethod ?? defaults.method,
  };
}

function computeAccountingDepreciation(
  asset: AssetRegisterEntry,
  policies?: AccountingPolicies,
): AssetRegisterEntry {
  const raw = asset as AssetRegisterEntry & {
    purchaseDateBS?: string;
    accumDepn?: number;
    accumulatedDepreciation?: number;
    name?: string;
    purchaseDate?: string | number;
  };
  const assetLabel = asset.assetName ?? raw.name ?? asset.id;

  let purchaseDateForCalc: string | number;
  if (raw.purchaseDateBS) {
    purchaseDateForCalc = raw.purchaseDateBS;
  } else if (typeof raw.purchaseDate === 'number') {
    purchaseDateForCalc = raw.purchaseDate;
  } else if (raw.purchaseDate) {
    purchaseDateForCalc = raw.purchaseDate;
  } else {
    throw new Error(`Asset '${assetLabel}': purchaseDate or purchaseDateBS required.`);
  }

  const { rate, method } = getRateAndMethod(asset, policies);
  const costBase = asset.originalCost + asset.additionsCY;
  const months = monthsHeldInFY(purchaseDateForCalc);
  const fraction = asset.disposalDate ? months / 12 : months / 12;
  const accumulatedDepnPY = raw.accumDepn ?? asset.accumulatedDepnPY ?? raw.accumulatedDepreciation ?? 0;

  let depreciationCY = 0;
  if (asset.assetClass === 'Land' || rate === 0) {
    depreciationCY = 0;
  } else if (method === 'SLM') {
    depreciationCY = costBase * rate * fraction;
  } else {
    const wdv = costBase - accumulatedDepnPY;
    depreciationCY = wdv * rate * fraction;
  }

  if (asset.disposalDate && asset.disposalValue !== undefined) {
    const nbv = costBase - accumulatedDepnPY - depreciationCY;
    const gainLoss = asset.disposalValue - nbv;
    void gainLoss;
  }

  const accumulatedDepnCY = accumulatedDepnPY + depreciationCY;
  const netBookValueCY = costBase - accumulatedDepnCY;
  const netBookValuePY = asset.originalCost - accumulatedDepnPY;

  return {
    ...asset,
    depreciationCY: Math.round(depreciationCY * 100) / 100,
    accumulatedDepnCY: Math.round(accumulatedDepnCY * 100) / 100,
    netBookValueCY: Math.round(netBookValueCY * 100) / 100,
    netBookValuePY: Math.round(netBookValuePY * 100) / 100,
  };
}

function buildPPENote(assets: AssetRegisterEntry[], policies?: AccountingPolicies): PPENote {
  const classMap = new Map<string, PPENote['classes'][0]>();

  for (const asset of assets) {
    const name = asset.assetClass;
    if (!classMap.has(name)) {
      classMap.set(name, {
        name,
        costOpeningDr: 0, costOpeningCr: 0,
        additions: 0, disposals: 0, costClosing: 0,
        accumDepnOpening: 0, depreciationCharged: 0,
        impairmentLosses: 0, disposalDepn: 0, accumDepnClosing: 0,
        carryingAmountOpening: 0, carryingAmountClosing: 0,
      });
    }
    const cls = classMap.get(name)!;
    cls.costOpeningDr += asset.originalCost;
    cls.additions += asset.additionsCY;
    cls.disposals += asset.disposalValue ?? 0;
    cls.accumDepnOpening += asset.accumulatedDepnPY;
    cls.depreciationCharged += asset.depreciationCY ?? 0;
    cls.accumDepnClosing += asset.accumulatedDepnCY ?? 0;
    cls.carryingAmountOpening += asset.netBookValuePY ?? 0;
    cls.carryingAmountClosing += asset.netBookValueCY ?? 0;
    cls.costClosing = cls.costOpeningDr + cls.additions - cls.disposals;
  }

  const classes = Array.from(classMap.values());
  const totals = classes.reduce(
    (acc, c) => ({
      name: 'Total',
      costOpeningDr: acc.costOpeningDr + c.costOpeningDr,
      costOpeningCr: 0,
      additions: acc.additions + c.additions,
      disposals: acc.disposals + c.disposals,
      costClosing: acc.costClosing + c.costClosing,
      accumDepnOpening: acc.accumDepnOpening + c.accumDepnOpening,
      depreciationCharged: acc.depreciationCharged + c.depreciationCharged,
      impairmentLosses: acc.impairmentLosses + c.impairmentLosses,
      disposalDepn: acc.disposalDepn + c.disposalDepn,
      accumDepnClosing: acc.accumDepnClosing + c.accumDepnClosing,
      carryingAmountOpening: acc.carryingAmountOpening + c.carryingAmountOpening,
      carryingAmountClosing: acc.carryingAmountClosing + c.carryingAmountClosing,
    }),
    {
      name: 'Total',
      costOpeningDr: 0, costOpeningCr: 0, additions: 0, disposals: 0, costClosing: 0,
      accumDepnOpening: 0, depreciationCharged: 0, impairmentLosses: 0,
      disposalDepn: 0, accumDepnClosing: 0, carryingAmountOpening: 0, carryingAmountClosing: 0,
    },
  );

  const depreciationRates: Record<string, number> = {};
  for (const [cls, def] of Object.entries(DEFAULT_RATES)) {
    depreciationRates[cls] = policies?.depreciationRates?.[cls] ?? def.rate;
  }

  return {
    classes,
    totals,
    depreciationRates,
    depreciationMethod: policies?.depreciationMethod ?? 'SLM',
    securityNote: '',
    WIPNote: '',
  };
}

function computeTaxDepPool(
  assets: AssetRegisterEntry[],
  openingBases: Record<string, number>,
  taxableIncome: number,
  repairExpenses: Record<string, number> = {},
) {
  const poolResults = TAX_POOLS.map((pool) => {
    const poolAssets = assets.filter((a) => pool.classes.includes(a.assetClass));
    let additions = 0;
    let disposals = 0;
    for (const a of poolAssets) {
      additions += a.additionsCY ?? 0;
      disposals += a.disposalValue ?? 0;
    }

    const openingBasis = openingBases[pool.poolName] ?? 0;
    let repairExpense = repairExpenses[pool.poolName] ?? 0;
    const repairThreshold = openingBasis * 0.07;
    const capitalizedRepairs = Math.max(0, repairExpense - repairThreshold);
    additions += capitalizedRepairs;

    const depreciationBasis = openingBasis + additions - disposals;
    const depreciation = depreciationBasis * pool.rate;
    const netDepreciation = depreciation;

    return {
      poolName: pool.poolName,
      pool: pool.poolName,
      rate: pool.rate,
      openingBasis,
      additions,
      disposals,
      depreciationBasis: Math.round(depreciationBasis * 100) / 100,
      netDepreciation: Math.round(netDepreciation * 100) / 100,
      repairExpense,
    };
  });

  const totalNetDep = poolResults.reduce((s, p) => s + p.netDepreciation, 0);
  const maxAllowable = taxableIncome * (2 / 3);
  const totalUnabsorbed = Math.max(0, totalNetDep - maxAllowable);

  return poolResults.map((pool) => {
    const share = totalNetDep > 0 ? pool.netDepreciation / totalNetDep : 0;
    const unabsorbed = Math.round(totalUnabsorbed * share * 100) / 100;
    const taxableDepreciation = Math.round((pool.netDepreciation - unabsorbed) * 100) / 100;
    const nextYearBasis = Math.max(0, pool.depreciationBasis - taxableDepreciation);

    return {
      poolName: pool.poolName,
      pool: pool.poolName,
      rate: pool.rate,
      openingBasis: pool.openingBasis,
      additions: pool.additions,
      disposals: pool.disposals,
      absorbed: taxableDepreciation,
      unabsorbed,
      taxDepreciation: taxableDepreciation,
      depreciationBasis: pool.depreciationBasis,
      closingBasis: Math.round(nextYearBasis * 100) / 100,
      nextYearBasis: Math.round(nextYearBasis * 100) / 100,
      repairExpense: pool.repairExpense,
    };
  });
}

export interface DepreciationEngineResult {
  assetRegisterComputed: AssetRegisterEntry[];
  ppeTotals: PPENote;
  taxDepSchedule: ReturnType<typeof computeTaxDepPool>;
  totalDepreciationExpense: number;
}

export function computeDepreciation(
  assetRegister: AssetRegisterEntry[],
  policies?: AccountingPolicies,
  options?: {
    taxOpeningBases?: Record<string, number>;
    taxableIncome?: number;
    repairExpenses?: Record<string, number>;
  },
): DepreciationEngineResult {
  const assetRegisterComputed = assetRegister.map((a) =>
    computeAccountingDepreciation(a, policies),
  );

  const totalDepreciationExpense = assetRegisterComputed.reduce(
    (s, a) => s + (a.depreciationCY ?? 0),
    0,
  );

  const ppeTotals = buildPPENote(assetRegisterComputed, policies);
  const taxDepSchedule = computeTaxDepPool(
    assetRegisterComputed,
    options?.taxOpeningBases ?? {},
    options?.taxableIncome ?? 0,
    options?.repairExpenses,
  );

  return {
    assetRegisterComputed,
    ppeTotals,
    taxDepSchedule,
    totalDepreciationExpense: Math.round(totalDepreciationExpense * 100) / 100,
  };
}

// Legacy exports
export function calculateSLMDepreciation(cost: number, residual: number, life: number, fraction: number): number {
  if (cost <= 0 || life <= 0) return 0;
  return Math.max(0, ((cost - residual) / life) * fraction);
}

export function calculateWDVDepreciation(wdv: number, ratePct: number, fraction: number): number {
  if (wdv <= 0) return 0;
  return Math.max(0, wdv * (ratePct / 100) * fraction);
}

export function calculateDepreciationSummary(
  assets: AssetRegisterEntry[],
  _categories: unknown[],
  _fiscalYear: string,
) {
  const result = computeDepreciation(assets);
  const summary: DepreciationSummary[] = result.ppeTotals.classes.map((cls) => {
    const categoryId = normalizePPEClassId(cls.name);
    const classAssets = result.assetRegisterComputed.filter(
      (asset) => normalizePPEClassId(asset.assetClass) === categoryId,
    );
    return {
      categoryId,
      categoryName: ppeClassLabel(categoryId),
      openingCost: cls.costOpeningDr,
      additions: cls.additions,
      disposals: cls.disposals,
      closingCost: cls.costClosing,
      openingAccumDepn: cls.accumDepnOpening,
      depnForYear: cls.depreciationCharged,
      depnOnDisposal: cls.disposalDepn,
      closingAccumDepn: cls.accumDepnClosing,
      netBookValueClosing: cls.carryingAmountClosing,
      assets: classAssets,
    };
  });
  return {
    results: result.assetRegisterComputed,
    summary,
  };
}

export function calculateTaxDepreciation(
  assets: AssetRegisterEntry[],
  _categories: unknown[],
  openingPoolBases: Record<string, number>,
  taxableIncome = 0,
  repairExpenses?: Record<string, number>,
) {
  return computeDepreciation(assets, undefined, {
    taxOpeningBases: openingPoolBases,
    taxableIncome,
    repairExpenses,
  }).taxDepSchedule;
}
