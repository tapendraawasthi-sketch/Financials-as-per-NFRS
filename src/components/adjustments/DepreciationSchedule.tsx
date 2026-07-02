import React, { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { DepreciationSummary } from '../../types';
import { formatNPR } from '../../utils/numberFormat';

interface DepreciationScheduleProps {
  summary: DepreciationSummary[];
  totalDepreciation: number;
  gainOnDisposals: number;
  lossOnDisposals: number;
  roundingLevel: number;
}

function fmt(n: number, rl: number): string {
  const rounded = Math.round(n / rl) * rl;
  return formatNPR(rounded);
}

const TAX_POOLS: { pool: string; rate: number; label: string }[] = [
  { pool: 'A', rate: 0.05,  label: 'Pool A (5%)  – Buildings / Structures' },
  { pool: 'B', rate: 0.25,  label: 'Pool B (25%) – Computers / IT Assets' },
  { pool: 'C', rate: 0.20,  label: 'Pool C (20%) – Vehicles / Plant & Machinery' },
  { pool: 'D', rate: 0.15,  label: 'Pool D (15%) – Furniture / Office Equipment' },
];

export default function DepreciationSchedule({
  summary,
  totalDepreciation,
  gainOnDisposals,
  lossOnDisposals,
  roundingLevel,
}: DepreciationScheduleProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const netGainLoss = gainOnDisposals - lossOnDisposals;

  // Compute summary totals
  const totals = {
    openingCost:       summary.reduce((acc, s) => acc + s.openingCost, 0),
    additions:         summary.reduce((acc, s) => acc + s.additions, 0),
    disposals:         summary.reduce((acc, s) => acc + s.disposals, 0),
    closingCost:       summary.reduce((acc, s) => acc + s.closingCost, 0),
    openingAccumDepn:  summary.reduce((acc, s) => acc + s.openingAccumDepn, 0),
    depnForYear:       summary.reduce((acc, s) => acc + s.depnForYear, 0),
    closingAccumDepn:  summary.reduce((acc, s) => acc + s.closingAccumDepn, 0),
    netBookValue:      summary.reduce((acc, s) => acc + s.netBookValueClosing, 0),
  };

  // Tax depreciation estimation (pool-based)
  const taxDepreciation = summary.reduce((total, s) => {
    const pool = TAX_POOLS.find(p =>
      s.categoryId.toLowerCase().includes('building')   ? p.pool === 'A' :
      s.categoryId.toLowerCase().includes('computer')   ? p.pool === 'B' :
      s.categoryId.toLowerCase().includes('vehicle')    ? p.pool === 'C' : p.pool === 'D'
    ) ?? TAX_POOLS[3];
    const basis = s.openingCost + s.additions - s.disposals;
    return total + basis * pool.rate;
  }, 0);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const thCls = 'px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-100 border-b border-slate-200';
  const thLCls = 'px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-100 border-b border-slate-200';
  const tdCls = 'px-3 py-2 text-right text-sm text-slate-700 tabular-nums';
  const tdLCls = 'px-3 py-2 text-left text-sm text-slate-700';

  return (
    <div className="space-y-6">
      {/* ── Summary Card ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-xl p-6 text-white shadow-md">
        <p className="text-blue-100 text-sm font-medium mb-1">Total Depreciation for FY 2081/82</p>
        <p className="text-3xl font-bold tracking-tight">
          NPR {fmt(totalDepreciation, roundingLevel)}
        </p>

        {(gainOnDisposals !== 0 || lossOnDisposals !== 0) && (
          <div className="mt-4 pt-4 border-t border-blue-400 flex flex-wrap gap-6 text-sm">
            {gainOnDisposals > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp size={15} className="text-green-300" />
                Gain on Disposals: NPR {fmt(gainOnDisposals, roundingLevel)}
              </span>
            )}
            {lossOnDisposals > 0 && (
              <span className="flex items-center gap-1">
                <TrendingDown size={15} className="text-red-300" />
                Loss on Disposals: NPR {fmt(lossOnDisposals, roundingLevel)}
              </span>
            )}
            <span className="font-semibold">
              Net {netGainLoss >= 0 ? 'Gain' : 'Loss'} on Disposals:&nbsp;
              <span className={netGainLoss >= 0 ? 'text-green-200' : 'text-red-200'}>
                {netGainLoss < 0 ? '(' : ''}NPR {fmt(Math.abs(netGainLoss), roundingLevel)}{netGainLoss < 0 ? ')' : ''}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Category-wise Summary Table ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Category-wise Depreciation Schedule</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click a row to expand individual asset details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className={`${thLCls} w-44`}>Category</th>
                <th className={thCls}>Opening Cost</th>
                <th className={thCls}>Additions</th>
                <th className={thCls}>Disposals</th>
                <th className={thCls}>Closing Cost</th>
                <th className={`${thCls} border-l border-slate-300`}>Op. Accum Depn</th>
                <th className={thCls}>Depn for Year</th>
                <th className={thCls}>Cl. Accum Depn</th>
                <th className={`${thCls} bg-blue-50 text-blue-700`}>Net Book Value</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, idx) => {
                const isExpanded = expandedCategories.has(row.categoryId);
                const hasAssets = row.assets && row.assets.length > 0;
                return (
                  <React.Fragment key={row.categoryId}>
                    {/* Category Row */}
                    <tr
                      className={`border-t border-slate-100 ${hasAssets ? 'cursor-pointer hover:bg-blue-50' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} transition-colors`}
                      onClick={() => hasAssets && toggleCategory(row.categoryId)}
                    >
                      <td className={`${tdLCls} font-medium`}>
                        <span className="flex items-center gap-1.5">
                          {hasAssets ? (
                            isExpanded
                              ? <ChevronDown size={14} className="text-blue-500" />
                              : <ChevronRight size={14} className="text-slate-400" />
                          ) : <span className="w-3.5" />}
                          {row.categoryName}
                        </span>
                      </td>
                      <td className={tdCls}>{fmt(row.openingCost, roundingLevel)}</td>
                      <td className={tdCls}>{row.additions ? fmt(row.additions, roundingLevel) : '–'}</td>
                      <td className={tdCls}>{row.disposals ? `(${fmt(row.disposals, roundingLevel)})` : '–'}</td>
                      <td className={tdCls}>{fmt(row.closingCost, roundingLevel)}</td>
                      <td className={`${tdCls} border-l border-slate-200`}>{fmt(row.openingAccumDepn, roundingLevel)}</td>
                      <td className={`${tdCls} text-amber-700 font-medium`}>{fmt(row.depnForYear, roundingLevel)}</td>
                      <td className={tdCls}>{fmt(row.closingAccumDepn, roundingLevel)}</td>
                      <td className={`${tdCls} font-semibold text-blue-700 bg-blue-50`}>{fmt(row.netBookValueClosing, roundingLevel)}</td>
                    </tr>

                    {/* Expanded Asset Detail Rows */}
                    {isExpanded && hasAssets && row.assets.map(asset => (
                      <React.Fragment key={asset.assetId}>
                        <tr className="bg-blue-50/60 border-t border-blue-100">
                          <td colSpan={9} className="px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                            ↳ Individual Assets – {row.categoryName}
                          </td>
                        </tr>
                        <tr className="bg-blue-50/30 border-t border-blue-100 text-xs">
                          <td className="px-3 py-1.5 pl-8 text-left text-slate-500 font-medium">Asset Name</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">Purchase Date</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">Cost</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">WDV Rate/Life</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">Op. Accum Depn</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">Depn This Year</td>
                          <td className="px-3 py-1.5 text-right text-slate-500" colSpan={2}>Cl. Accum Depn</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">Net Book Value</td>
                        </tr>

                        <tr key={`${asset.assetId}-detail`} className="bg-white border-t border-blue-100 hover:bg-blue-50/20 transition-colors">
                          <td className="px-3 py-2 pl-8 text-left text-sm font-medium text-slate-800">{asset.assetName}</td>
                          <td className="px-3 py-2 text-right text-xs text-slate-500">-</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">{fmt(asset.openingCost, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-xs text-slate-600">
                            -
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">{fmt(asset.openingAccumDepn, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums text-amber-700 font-medium">{fmt(asset.depnForYear, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums" colSpan={2}>{fmt(asset.closingAccumDepn, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold text-blue-700">{fmt(asset.netBookValueClosing, roundingLevel)}</td>
                        </tr>

                        {/* Disposal Row */}
                        {asset.disposals > 0 && (
                          <tr className="bg-red-50/40 border-t border-red-100">
                            <td colSpan={2} className="px-3 py-1.5 pl-8 text-xs font-medium text-red-700">
                              ⚠ Disposed
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs text-slate-600">
                              Proceeds: {fmt(asset.disposalProceeds ?? 0, roundingLevel)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs text-slate-600">
                              NBV at disposal: {fmt((asset.openingCost - asset.openingAccumDepn) - asset.depnOnDisposal, roundingLevel)}
                            </td>
                            <td colSpan={5} className={`px-3 py-1.5 text-right text-xs font-semibold ${(asset.gainLossOnDisposal ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {(asset.gainLossOnDisposal ?? 0) >= 0 ? 'Gain' : 'Loss'} on Disposal:&nbsp;
                              {(asset.gainLossOnDisposal ?? 0) < 0 && '('}
                              {fmt(Math.abs(asset.gainLossOnDisposal ?? 0), roundingLevel)}
                              {(asset.gainLossOnDisposal ?? 0) < 0 && ')'}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Total Row */}
              <tr className="border-t-2 border-slate-400 bg-slate-100 font-bold">
                <td className="px-3 py-2.5 text-left text-sm text-slate-900">TOTAL</td>
                <td className={`${tdCls} text-slate-900`}>{fmt(totals.openingCost, roundingLevel)}</td>
                <td className={`${tdCls} text-slate-900`}>{totals.additions ? fmt(totals.additions, roundingLevel) : '–'}</td>
                <td className={`${tdCls} text-slate-900`}>{totals.disposals ? `(${fmt(totals.disposals, roundingLevel)})` : '–'}</td>
                <td className={`${tdCls} text-slate-900`}>{fmt(totals.closingCost, roundingLevel)}</td>
                <td className={`${tdCls} border-l border-slate-300 text-slate-900`}>{fmt(totals.openingAccumDepn, roundingLevel)}</td>
                <td className={`${tdCls} text-amber-800`}>{fmt(totals.depnForYear, roundingLevel)}</td>
                <td className={`${tdCls} text-slate-900`}>{fmt(totals.closingAccumDepn, roundingLevel)}</td>
                <td className={`${tdCls} text-blue-800 bg-blue-100`}>{fmt(totals.netBookValue, roundingLevel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tax Depreciation Preview Card ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Calculator size={18} className="text-purple-600" />
          <h3 className="text-base font-semibold text-slate-800">Tax Depreciation Preview</h3>
          <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Income Tax Act – Pool Method</span>
        </div>

        <div className="p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className={thLCls}>Pool</th>
                  <th className={thCls}>Opening Basis</th>
                  <th className={thCls}>Additions</th>
                  <th className={thCls}>Disposals</th>
                  <th className={thCls}>Depn Basis</th>
                  <th className={thCls}>Rate</th>
                  <th className={`${thCls} text-purple-700 bg-purple-50`}>Tax Depreciation</th>
                </tr>
              </thead>
              <tbody>
                {TAX_POOLS.map(({ pool, rate, label }) => {
                  const poolSummaries = summary.filter(s => {
                    const cat = s.categoryId.toLowerCase();
                    if (pool === 'A') return cat.includes('building') || cat.includes('land');
                    if (pool === 'B') return cat.includes('computer') || cat.includes('it') || cat.includes('software');
                    if (pool === 'C') return cat.includes('vehicle') || cat.includes('plant') || cat.includes('machine');
                    return true; // Pool D catches the rest
                  });

                  const openBasis = poolSummaries.reduce((a, s) => a + s.openingCost - s.openingAccumDepn, 0);
                  const additions = poolSummaries.reduce((a, s) => a + s.additions, 0);
                  const disposals = poolSummaries.reduce((a, s) => a + s.disposals, 0);
                  const basis    = openBasis + additions - disposals;
                  const taxDepn  = basis * rate;

                  return (
                    <tr key={pool} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-left">
                        <span className="font-semibold text-slate-800">{label}</span>
                      </td>
                      <td className={tdCls}>{fmt(openBasis, roundingLevel)}</td>
                      <td className={tdCls}>{additions ? fmt(additions, roundingLevel) : '–'}</td>
                      <td className={tdCls}>{disposals ? `(${fmt(disposals, roundingLevel)})` : '–'}</td>
                      <td className={`${tdCls} font-medium`}>{fmt(basis, roundingLevel)}</td>
                      <td className="px-3 py-2 text-right text-sm text-slate-500">{(rate * 100).toFixed(0)}%</td>
                      <td className={`${tdCls} font-semibold text-purple-700 bg-purple-50`}>{fmt(taxDepn, roundingLevel)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-400 bg-slate-100 font-bold">
                  <td colSpan={6} className="px-3 py-2.5 text-left text-sm">TOTAL TAX DEPRECIATION</td>
                  <td className={`${tdCls} text-purple-800 bg-purple-100`}>{fmt(taxDepreciation, roundingLevel)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Book vs Tax Comparison */}
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">
              Book vs. Tax Depreciation Comparison
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">Book Depreciation</p>
                <p className="text-lg font-bold text-slate-800">{fmt(totalDepreciation, roundingLevel)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Tax Depreciation</p>
                <p className="text-lg font-bold text-purple-700">{fmt(taxDepreciation, roundingLevel)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Difference (Tax Adj.)</p>
                <p className={`text-lg font-bold ${totalDepreciation - taxDepreciation >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {totalDepreciation - taxDepreciation >= 0 ? '' : '('}
                  {fmt(Math.abs(totalDepreciation - taxDepreciation), roundingLevel)}
                  {totalDepreciation - taxDepreciation >= 0 ? '' : ')'}
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-700 mt-3">
              ⓘ This difference is a temporary timing difference. It forms the basis of the tax depreciation adjustment in Note 3.23. A positive difference means book depreciation exceeds tax depreciation (add-back required).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
