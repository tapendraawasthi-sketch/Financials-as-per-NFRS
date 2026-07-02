// ===== server/services/depreciationEngine.ts =====
// Fixed asset depreciation engine for Nepal NFRS/NAS for MEs.
// Implements SLM, WDV (book), and Nepal Income Tax Act 2058 pool depreciation.
// All calculations are mathematically deterministic — no AI involvement.

import type {
  AssetItem,
  AssetCategory,
  DepreciationResult,
  DepreciationSummary,
  TaxDepreciationPool,
  YearEndAdjustments,
} from '../../src/types';
import { DepreciationMethod } from '../../src/types';

// Re-implement calendar utilities locally to avoid client/server import issues
function normMonthName(name: string): number {
  const map: Record<string, number> = {
    shrawan: 1, bhadra: 2, aswin: 3, kartik: 4, mangsir: 5, poush: 6,
    magh: 7, falgun: 8, chaitra: 9, baisakh: 10, jestha: 11, ashadh: 12,
  };
  return map[name.toLowerCase().trim()] ?? 0;
}

function parseBSLocal(
  dateStr: string,
): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\s\-\/]+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0], 10);
  const month = normMonthName(parts[1]);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(year) || month === 0) return null;
  return { day, month, year };
}

/** Cumulative days before `bsMonth` (1-based) in a normal BS year. */
const BS_MONTH_DAYS = [0, 31, 32, 31, 30, 30, 30, 30, 30, 30, 31, 32, 31];

function cumulativeDaysBefore(month: number, isLeap: boolean): number {
  let total = 0;
  for (let m = 1; m < month; m++) {
    let d = BS_MONTH_DAYS[m] ?? 30;
    if (m === 9 && isLeap) d = 31;
    if (m === 12 && isLeap) d = 32;
    total += d;
  }
  return total;
}

// ---------------------------------------------------------------------------
// 1. calculateSLMDepreciation
// ---------------------------------------------------------------------------
export function calculateSLMDepreciation(
  cost: number,
  residualValue: number,
  usefulLifeYears: number,
  depreciationFraction: number,
): number {
  if (cost <= 0 || usefulLifeYears <= 0) return 0;
  const depreciableAmount = Math.max(0, cost - residualValue);
  const annual = depreciableAmount / usefulLifeYears;
  return Math.max(0, annual * depreciationFraction);
}

// ---------------------------------------------------------------------------
// 2. calculateWDVDepreciation
// ---------------------------------------------------------------------------
export function calculateWDVDepreciation(
  writtenDownValue: number,
  wdvRatePercent: number,
  depreciationFraction: number,
): number {
  if (writtenDownValue <= 0 || wdvRatePercent <= 0) return 0;
  const annual = writtenDownValue * (wdvRatePercent / 100);
  return Math.max(0, annual * depreciationFraction);
}

// ---------------------------------------------------------------------------
// Helper: compute depreciation fraction from a BS purchase date
// ---------------------------------------------------------------------------
function computeFraction(
  purchaseDateBS: string,
  fiscalYearBSStart: number, // BS year of 1 Shrawan
  totalDaysInFY: number,
  isLeap: boolean,
): number {
  const parsed = parseBSLocal(purchaseDateBS);
  if (!parsed) return 1.0; // default to full year if unparseable

  // Determine if the purchase is in the current fiscal year
  const { month, year } = parsed;

  // FY spans BS year X (months 1-9) + BS year X+1 (months 10-12)
  const isInCurrentFY =
    (year === fiscalYearBSStart && month >= 1 && month <= 12) ||
    (year === fiscalYearBSStart + 1 && month >= 10 && month <= 12);

  if (!isInCurrentFY) {
    // Prior year asset — full year depreciation
    return 1.0;
  }

  // Day offset from start of fiscal year (1 Shrawan = day 0)
  const offsetDays = cumulativeDaysBefore(month, isLeap) + (parsed.day - 1);
  const daysRemaining = Math.max(0, totalDaysInFY - offsetDays);
  return Math.min(1, daysRemaining / totalDaysInFY);
}

// ---------------------------------------------------------------------------
// Helper: tax pool letter for an asset category
// ---------------------------------------------------------------------------
function taxPool(category: AssetCategory | undefined): 'A' | 'B' | 'C' | 'D' | null {
  if (!category) return null;
  const name = (category.name ?? category.id ?? '').toLowerCase();
  if (name.includes('building') || name.includes('structure')) return 'A';
  if (name.includes('computer') || name.includes('software') || name.includes('intangible')) return 'B';
  if (name.includes('vehicle') || name.includes('furniture') || name.includes('fixture')) return 'D';
  // Default: plant, machinery, office equipment
  return 'C';
}

// ---------------------------------------------------------------------------
// 3. calculateAssetDepreciation
// ---------------------------------------------------------------------------
export function calculateAssetDepreciation(
  asset: AssetItem,
  accumDepnOpening: number,
  depreciationFraction: number,
  wdvRatePercent?: number,
): DepreciationResult {
  const openingCost = asset.originalCost;
  const closingCost = asset.originalCost + asset.additionalCost - (asset.disposalValue ? asset.originalCost : 0);
  const netBookValueOpening = asset.originalCost + asset.additionalCost - accumDepnOpening;

  // Fully depreciated check
  if (asset.isFullyDepreciated || netBookValueOpening <= asset.residualValue) {
    return {
      assetId: asset.id,
      assetName: asset.assetName,
      categoryId: asset.categoryId,
      openingCost,
      additions: asset.additionalCost,
      disposals: asset.disposalValue ? openingCost : 0,
      closingCost,
      openingAccumDepn: accumDepnOpening,
      depnForYear: 0,
      depnOnDisposal: 0,
      closingAccumDepn: accumDepnOpening,
      netBookValueOpening,
      netBookValueClosing: Math.max(0, netBookValueOpening),
      gainLossOnDisposal: asset.disposalValue
        ? asset.disposalValue - Math.max(0, netBookValueOpening)
        : undefined,
      disposalProceeds: asset.disposalValue,
    };
  }

  // Is there a disposal this year?
  let depnOnDisposal = 0;
  let gainLossOnDisposal: number | undefined;
  let disposalProceeds: number | undefined;
  const hasDisposal = !!asset.disposalDateBS && asset.disposalValue !== undefined;

  // Compute main depreciation
  let depnForYear = 0;

  if (asset.depreciationMethod === DepreciationMethod.StraightLine) {
    depnForYear = calculateSLMDepreciation(
      openingCost + asset.additionalCost,
      asset.residualValue,
      asset.usefulLifeYears,
      depreciationFraction,
    );
  } else {
    // WDV
    depnForYear = calculateWDVDepreciation(
      netBookValueOpening,
      wdvRatePercent ?? asset.wdvRate ?? 25,
      depreciationFraction,
    );
  }

  // Cap depreciation so net book value doesn't go below residual value
  depnForYear = Math.min(depnForYear, Math.max(0, netBookValueOpening - asset.residualValue));

  if (hasDisposal && asset.disposalValue !== undefined) {
    const disposalFraction = 1 - depreciationFraction; // portion of year BEFORE disposal
    if (asset.depreciationMethod === DepreciationMethod.StraightLine) {
      depnOnDisposal = calculateSLMDepreciation(
        openingCost + asset.additionalCost,
        asset.residualValue,
        asset.usefulLifeYears,
        disposalFraction,
      );
    } else {
      depnOnDisposal = calculateWDVDepreciation(
        netBookValueOpening,
        wdvRatePercent ?? asset.wdvRate ?? 25,
        disposalFraction,
      );
    }
    const nbvAtDisposal = netBookValueOpening - depnOnDisposal;
    gainLossOnDisposal = asset.disposalValue - nbvAtDisposal;
    disposalProceeds = asset.disposalValue;
  }

  const closingAccumDepn = accumDepnOpening + depnForYear - depnOnDisposal;
  const netBookValueClosing = Math.max(0, closingCost - closingAccumDepn);

  return {
    assetId: asset.id,
    assetName: asset.assetName,
    categoryId: asset.categoryId,
    openingCost,
    netBookValueOpening,
    additions: asset.additionalCost,
    disposals: hasDisposal ? openingCost : 0,
    closingCost,
    openingAccumDepn: accumDepnOpening,
    depnForYear,
    depnOnDisposal,
    closingAccumDepn,
    netBookValueClosing,
    gainLossOnDisposal,
    disposalProceeds,
  };
}

// ---------------------------------------------------------------------------
// 4. calculateDepreciationSummary
// ---------------------------------------------------------------------------
export function calculateDepreciationSummary(
  assets: AssetItem[],
  assetCategories: AssetCategory[],
  fiscalYear: string,
): { results: DepreciationResult[]; summary: DepreciationSummary[] } {
  // Extract FY start BS year from "2081/82" → 2081
  const fyBSYear = parseInt(fiscalYear.split('/')[0], 10) || 2081;
  // Approximate: fiscal year = 365 days; check if leap
  const isLeap = [2073, 2076, 2082, 2085, 2088].includes(fyBSYear);
  const totalDaysInFY = isLeap ? 366 : 365;

  const results: DepreciationResult[] = [];
  const summaryMap = new Map<string, DepreciationSummary>();

  for (const asset of assets) {
    const category = assetCategories.find((c) => c.id === asset.categoryId);
    const fraction = computeFraction(
      asset.purchaseDateBS,
      fyBSYear,
      totalDaysInFY,
      isLeap,
    );

    const result = calculateAssetDepreciation(
      asset,
      asset.accumDepreciationOpening,
      fraction,
      asset.wdvRate,
    );
    results.push(result);

    // Aggregate into category summary
    const catId = asset.categoryId;
    const catName = category?.name ?? catId;
    if (!summaryMap.has(catId)) {
      summaryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        openingCost: 0, additions: 0, disposals: 0, closingCost: 0,
        openingAccumDepn: 0, depnForYear: 0, depnOnDisposal: 0,
        closingAccumDepn: 0, netBookValueClosing: 0,
        assets: [],
      });
    }
    const cat = summaryMap.get(catId)!;
    cat.openingCost       += result.openingCost;
    cat.additions         += result.additions;
    cat.disposals         += result.disposals;
    cat.closingCost       += result.closingCost;
    cat.openingAccumDepn  += result.openingAccumDepn;
    cat.depnForYear       += result.depnForYear;
    cat.depnOnDisposal    += result.depnOnDisposal;
    cat.closingAccumDepn  += result.closingAccumDepn;
    cat.netBookValueClosing += result.netBookValueClosing;
    cat.assets.push(result);
  }

  return { results, summary: Array.from(summaryMap.values()) };
}

// ---------------------------------------------------------------------------
// 5. calculateTaxDepreciation — Nepal Income Tax Act 2058, Schedule 2 §19
// ---------------------------------------------------------------------------
const TAX_POOL_META: Record<'A' | 'B' | 'C' | 'D', { name: string; rate: number }> = {
  A: { name: 'Buildings & Structures', rate: 0.05  },
  B: { name: 'Computers, Software & IT', rate: 0.25 },
  C: { name: 'Plant, Machinery & Equipment', rate: 0.20 },
  D: { name: 'Vehicles, Furniture & Fixtures', rate: 0.15 },
};

/** Tax apportionment: months 1-6 → 1.0, 7-9 → 2/3, 10-12 → 1/3 */
function taxProportion(purchaseDateBS: string): number {
  const parsed = parseBSLocal(purchaseDateBS);
  if (!parsed) return 1.0;
  const { month } = parsed;
  if (month >= 1 && month <= 6) return 1.0;
  if (month >= 7 && month <= 9) return 2 / 3;
  return 1 / 3;
}

export function calculateTaxDepreciation(
  assets: AssetItem[],
  assetCategories: AssetCategory[],
  openingPoolBases: Record<string, number>,
): TaxDepreciationPool[] {
  const pools: Record<'A' | 'B' | 'C' | 'D', {
    addFull: number; addTwoThirds: number; addOneThird: number;
    disposals: number;
  }> = {
    A: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
    B: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
    C: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
    D: { addFull: 0, addTwoThirds: 0, addOneThird: 0, disposals: 0 },
  };

  for (const asset of assets) {
    const cat = assetCategories.find((c) => c.id === asset.categoryId);
    const pool = taxPool(cat);
    if (!pool) continue;

    // Additions (current year only — identified by purchaseDateBS being in current FY)
    if (asset.additionalCost > 0 || asset.originalCost > 0) {
      const prop = taxProportion(asset.purchaseDateBS);
      const addAmt = asset.additionalCost; // only new additions this year
      if (prop >= 0.99) pools[pool].addFull += addAmt;
      else if (prop >= 0.66) pools[pool].addTwoThirds += addAmt;
      else pools[pool].addOneThird += addAmt;
    }

    // Disposals — deducted at lower of cost or disposal proceeds
    if (asset.disposalValue !== undefined) {
      pools[pool].disposals += Math.min(asset.originalCost, asset.disposalValue);
    }
  }

  return (['A', 'B', 'C', 'D'] as const).map((p) => {
    const meta = TAX_POOL_META[p];
    const opening = openingPoolBases[p] ?? 0;
    const { addFull, addTwoThirds, addOneThird, disposals } = pools[p];

    const depreciationBasis =
      opening +
      addFull +
      (2 / 3) * addTwoThirds +
      (1 / 3) * addOneThird -
      disposals;

    const effectiveBasis = Math.max(0, depreciationBasis);
    const taxDepreciation = effectiveBasis * meta.rate;
    const closingBasis = Math.max(0, effectiveBasis - taxDepreciation);

    return {
      pool: p,
      poolName: meta.name,
      rate: meta.rate,
      openingBasis: opening,
      additionsFullYear: addFull,
      additionsTwoThirds: addTwoThirds,
      additionsOneThird: addOneThird,
      disposals,
      depreciationBasis: effectiveBasis,
      taxDepreciation,
      closingBasis,
    };
  });
}
