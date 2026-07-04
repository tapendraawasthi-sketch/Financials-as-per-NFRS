import React, { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { DepreciationSummary, TaxDepreciationPool } from '../../types';
import { ITA_TAX_DEPRECIATION_POOLS } from '../../data/taxDepreciationPools';
import { formatNPR } from '../../utils/numberFormat';

interface DepreciationScheduleProps {
  summary: DepreciationSummary[];
  totalDepreciation: number;
  gainOnDisposals: number;
  lossOnDisposals: number;
  roundingLevel: number;
  fiscalYear?: string;
  taxDepreciationPools?: TaxDepreciationPool[];
}

function fmt(n: number, rl: number): string {
  const rounded = Math.round(n / rl) * rl;
  return formatNPR(rounded);
}

const TAX_POOLS = ITA_TAX_DEPRECIATION_POOLS;

export default function DepreciationSchedule({
  summary,
  totalDepreciation,
  gainOnDisposals,
  lossOnDisposals,
  roundingLevel,
  fiscalYear = '2081/82',
  taxDepreciationPools,
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

  // Tax depreciation — prefer server-computed pools when available
  const useServerPools = Boolean(taxDepreciationPools && taxDepreciationPools.length > 0);
  const taxDepreciation = useServerPools
    ? (taxDepreciationPools ?? []).reduce((sum, pool) => sum + (pool.taxDepreciation ?? 0), 0)
    : summary.reduce((total, s) => {
      const cat = s.categoryId.toLowerCase();
      const pool = TAX_POOLS.find((entry) => {
        if (entry.pool === 'A') return cat.includes('building') || cat.includes('land');
        if (entry.pool === 'B') return cat.includes('computer') || cat.includes('intangible') || cat.includes('software');
        if (entry.pool === 'C') return cat.includes('office') || cat.includes('furniture');
        if (entry.pool === 'D') return cat.includes('vehicle');
        if (entry.pool === 'E') return cat.includes('plant') || cat.includes('machine') || cat.includes('machinery');
        return false;
      }) ?? TAX_POOLS[4];
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

  const thCls = 'px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide';
  const thLCls = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide';
  const tdCls = 'px-3 py-2 text-right text-sm tabular-nums';
  const tdLCls = 'px-3 py-2 text-left text-sm';

  return (
    <div className="space-y-6">
      {/* ── Summary Card ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-6 text-white shadow-md"
        style={{ background: 'linear-gradient(90deg, var(--brand-700), var(--brand-500))' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--brand-100)' }}>Total Depreciation for FY {fiscalYear}</p>
        <p className="text-3xl font-bold tracking-tight">
          NPR {fmt(totalDepreciation, roundingLevel)}
        </p>

        {(gainOnDisposals !== 0 || lossOnDisposals !== 0) && (
          <div className="mt-4 pt-4 flex flex-wrap gap-6 text-sm" style={{ borderTop: '1px solid var(--brand-400)' }}>
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
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink-900)' }}>Category-wise Depreciation Schedule</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>Click a row to expand individual asset details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="fin-table w-full">
            <thead>
              <tr>
                <th className={`${thLCls} w-44`}>Category</th>
                <th className={thCls}>Opening Cost</th>
                <th className={thCls}>Additions</th>
                <th className={thCls}>Disposals</th>
                <th className={thCls}>Closing Cost</th>
                <th className={`${thCls} border-l`} style={{ borderColor: 'var(--border-strong)' }}>Op. Accum Depn</th>
                <th className={thCls}>Depn for Year</th>
                <th className={thCls}>Cl. Accum Depn</th>
                <th className={thCls} style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}>Net Book Value</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => {
                const isExpanded = expandedCategories.has(row.categoryId);
                const hasAssets = row.assets && row.assets.length > 0;
                return (
                  <React.Fragment key={row.categoryId}>
                    {/* Category Row */}
                    <tr
                      className={hasAssets ? 'cursor-pointer' : ''}
                      onClick={() => hasAssets && toggleCategory(row.categoryId)}
                    >
                      <td className={`${tdLCls} font-medium`}>
                        <span className="flex items-center gap-1.5">
                          {hasAssets ? (
                            isExpanded
                              ? <ChevronDown size={14} style={{ color: 'var(--brand-500)' }} />
                              : <ChevronRight size={14} style={{ color: 'var(--ink-400)' }} />
                          ) : <span className="w-3.5" />}
                          {row.categoryName}
                        </span>
                      </td>
                      <td className={tdCls}>{fmt(row.openingCost, roundingLevel)}</td>
                      <td className={tdCls}>{row.additions ? fmt(row.additions, roundingLevel) : '–'}</td>
                      <td className={tdCls}>{row.disposals ? `(${fmt(row.disposals, roundingLevel)})` : '–'}</td>
                      <td className={tdCls}>{fmt(row.closingCost, roundingLevel)}</td>
                      <td className={tdCls} style={{ borderLeft: '1px solid var(--border-hairline)' }}>{fmt(row.openingAccumDepn, roundingLevel)}</td>
                      <td className={tdCls} style={{ color: 'var(--warning-700)', fontWeight: 500 }}>{fmt(row.depnForYear, roundingLevel)}</td>
                      <td className={tdCls}>{fmt(row.closingAccumDepn, roundingLevel)}</td>
                      <td className={tdCls} style={{ fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-50)' }}>{fmt(row.netBookValueClosing, roundingLevel)}</td>
                    </tr>

                    {/* Expanded Asset Detail Rows */}
                    {isExpanded && hasAssets && row.assets.map(asset => (
                      <React.Fragment key={asset.assetId}>
                        <tr style={{ background: 'var(--brand-50)' }}>
                          <td colSpan={9} className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-700)' }}>
                            ↳ Individual Assets – {row.categoryName}
                          </td>
                        </tr>
                        <tr className="text-xs" style={{ background: 'color-mix(in srgb, var(--brand-50) 60%, transparent)' }}>
                          <td className="px-3 py-1.5 pl-8 text-left font-medium" style={{ color: 'var(--ink-500)' }}>Asset Name</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }}>Purchase Date</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }}>Cost</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }}>WDV Rate/Life</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }}>Op. Accum Depn</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }}>Depn This Year</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }} colSpan={2}>Cl. Accum Depn</td>
                          <td className="px-3 py-1.5 text-right" style={{ color: 'var(--ink-500)' }}>Net Book Value</td>
                        </tr>

                        <tr key={`${asset.assetId}-detail`}>
                          <td className="px-3 py-2 pl-8 text-left text-sm font-medium" style={{ color: 'var(--ink-900)' }}>{asset.assetName}</td>
                          <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--ink-500)' }}>-</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">{fmt(asset.openingCost, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--ink-600)' }}>
                            -
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">{fmt(asset.openingAccumDepn, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums" style={{ color: 'var(--warning-700)', fontWeight: 500 }}>{fmt(asset.depnForYear, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums" colSpan={2}>{fmt(asset.closingAccumDepn, roundingLevel)}</td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums font-semibold" style={{ color: 'var(--brand-700)' }}>{fmt(asset.netBookValueClosing, roundingLevel)}</td>
                        </tr>

                        {/* Disposal Row */}
                        {asset.disposals > 0 && (
                          <tr style={{ background: 'var(--danger-100)' }}>
                            <td colSpan={2} className="px-3 py-1.5 pl-8 text-xs font-medium" style={{ color: 'var(--danger-700)' }}>
                              ⚠ Disposed
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs" style={{ color: 'var(--ink-600)' }}>
                              Proceeds: {fmt(asset.disposalProceeds ?? 0, roundingLevel)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs" style={{ color: 'var(--ink-600)' }}>
                              NBV at disposal: {fmt((asset.openingCost - asset.openingAccumDepn) - asset.depnOnDisposal, roundingLevel)}
                            </td>
                            <td colSpan={5} className={`px-3 py-1.5 text-right text-xs font-semibold`} style={{ color: (asset.gainLossOnDisposal ?? 0) >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
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
              <tr className="row-grand-total">
                <td className="px-3 py-2.5 text-left text-sm" style={{ color: 'var(--ink-950)' }}>TOTAL</td>
                <td className={tdCls} style={{ color: 'var(--ink-950)' }}>{fmt(totals.openingCost, roundingLevel)}</td>
                <td className={tdCls} style={{ color: 'var(--ink-950)' }}>{totals.additions ? fmt(totals.additions, roundingLevel) : '–'}</td>
                <td className={tdCls} style={{ color: 'var(--ink-950)' }}>{totals.disposals ? `(${fmt(totals.disposals, roundingLevel)})` : '–'}</td>
                <td className={tdCls} style={{ color: 'var(--ink-950)' }}>{fmt(totals.closingCost, roundingLevel)}</td>
                <td className={tdCls} style={{ borderLeft: '1px solid var(--border-strong)', color: 'var(--ink-950)' }}>{fmt(totals.openingAccumDepn, roundingLevel)}</td>
                <td className={tdCls} style={{ color: 'var(--warning-700)' }}>{fmt(totals.depnForYear, roundingLevel)}</td>
                <td className={tdCls} style={{ color: 'var(--ink-950)' }}>{fmt(totals.closingAccumDepn, roundingLevel)}</td>
                <td className={tdCls} style={{ color: 'var(--brand-800)', background: 'var(--brand-100)' }}>{fmt(totals.netBookValue, roundingLevel)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tax Depreciation Preview Card ─────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
          <Calculator size={18} style={{ color: 'var(--brand-600)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink-900)' }}>Tax Depreciation Preview</h3>
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}
          >
            {useServerPools ? 'Server-computed pools' : 'Income Tax Act – Pool Method'}
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="overflow-x-auto">
            <table className="fin-table w-full text-sm">
              <thead>
                <tr>
                  <th className={thLCls}>Pool</th>
                  <th className={thCls}>Opening Basis</th>
                  <th className={thCls}>Additions</th>
                  <th className={thCls}>Disposals</th>
                  <th className={thCls}>Depn Basis</th>
                  <th className={thCls}>Rate</th>
                  <th className={`${thCls}`} style={{ color: 'var(--brand-700)', background: 'var(--brand-50)' }}>Tax Depreciation</th>
                </tr>
              </thead>
              <tbody>
                {(useServerPools ? taxDepreciationPools! : TAX_POOLS).map((entry) => {
                  if (useServerPools) {
                    const pool = entry as TaxDepreciationPool;
                    const basis = pool.depreciationBasis ?? pool.openingBasis ?? 0;
                    const taxDepn = pool.taxDepreciation ?? 0;
                    const rate = pool.rate;
                    const label = pool.poolName || `Pool ${pool.pool}`;

                    return (
                      <tr key={`${pool.pool}-${label}`}>
                        <td className="px-3 py-2 text-left">
                          <span className="font-semibold" style={{ color: 'var(--ink-900)' }}>{label}</span>
                        </td>
                        <td className={tdCls}>{fmt(pool.openingBasis ?? 0, roundingLevel)}</td>
                        <td className={tdCls}>{pool.additions ? fmt(pool.additions, roundingLevel) : '–'}</td>
                        <td className={tdCls}>{pool.disposals ? `(${fmt(pool.disposals, roundingLevel)})` : '–'}</td>
                        <td className={`${tdCls} font-medium`}>{fmt(basis, roundingLevel)}</td>
                        <td className="px-3 py-2 text-right text-sm" style={{ color: 'var(--ink-500)' }}>{(rate * 100).toFixed(0)}%</td>
                        <td className={tdCls} style={{ fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-50)' }}>{fmt(taxDepn, roundingLevel)}</td>
                      </tr>
                    );
                  }

                  const { pool, rate, label } = entry as { pool: string; rate: number; label: string };
                  const poolSummaries = summary.filter((s) => {
                    const cat = s.categoryId.toLowerCase();
                    if (pool === 'A') return cat.includes('building') || cat.includes('land');
                    if (pool === 'B') return cat.includes('computer') || cat.includes('intangible') || cat.includes('software');
                    if (pool === 'C') return cat.includes('office') || cat.includes('furniture');
                    if (pool === 'D') return cat.includes('vehicle');
                    if (pool === 'E') return cat.includes('plant') || cat.includes('machine') || cat.includes('machinery');
                    return false;
                  });

                  const openBasis = poolSummaries.reduce((a, s) => a + s.openingCost - s.openingAccumDepn, 0);
                  const additions = poolSummaries.reduce((a, s) => a + s.additions, 0);
                  const disposals = poolSummaries.reduce((a, s) => a + s.disposals, 0);
                  const basis    = openBasis + additions - disposals;
                  const taxDepn  = basis * rate;

                  return (
                    <tr key={pool}>
                      <td className="px-3 py-2 text-left">
                        <span className="font-semibold" style={{ color: 'var(--ink-900)' }}>{label}</span>
                      </td>
                      <td className={tdCls}>{fmt(openBasis, roundingLevel)}</td>
                      <td className={tdCls}>{additions ? fmt(additions, roundingLevel) : '–'}</td>
                      <td className={tdCls}>{disposals ? `(${fmt(disposals, roundingLevel)})` : '–'}</td>
                      <td className={`${tdCls} font-medium`}>{fmt(basis, roundingLevel)}</td>
                      <td className="px-3 py-2 text-right text-sm" style={{ color: 'var(--ink-500)' }}>{(rate * 100).toFixed(0)}%</td>
                      <td className={tdCls} style={{ fontWeight: 600, color: 'var(--brand-700)', background: 'var(--brand-50)' }}>{fmt(taxDepn, roundingLevel)}</td>
                    </tr>
                  );
                })}
                <tr className="row-grand-total">
                  <td colSpan={6} className="px-3 py-2.5 text-left text-sm">TOTAL TAX DEPRECIATION</td>
                  <td className={tdCls} style={{ color: 'var(--brand-800)', background: 'var(--brand-100)' }}>{fmt(taxDepreciation, roundingLevel)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Book vs Tax Comparison */}
          <div
            className="mt-4 rounded-lg p-4"
            style={{ background: 'var(--warning-100)', border: '1px solid var(--warning-600)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--warning-700)' }}>
              Book vs. Tax Depreciation Comparison
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--ink-500)' }}>Book Depreciation</p>
                <p className="text-lg font-bold" style={{ color: 'var(--ink-900)' }}>{fmt(totalDepreciation, roundingLevel)}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--ink-500)' }}>Tax Depreciation</p>
                <p className="text-lg font-bold" style={{ color: 'var(--brand-700)' }}>{fmt(taxDepreciation, roundingLevel)}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--ink-500)' }}>Difference (Tax Adj.)</p>
                <p className="text-lg font-bold" style={{ color: totalDepreciation - taxDepreciation >= 0 ? 'var(--danger-600)' : 'var(--success-600)' }}>
                  {totalDepreciation - taxDepreciation >= 0 ? '' : '('}
                  {fmt(Math.abs(totalDepreciation - taxDepreciation), roundingLevel)}
                  {totalDepreciation - taxDepreciation >= 0 ? '' : ')'}
                </p>
              </div>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--warning-700)' }}>
              ⓘ This difference is a temporary timing difference. It forms the basis of the tax depreciation adjustment in Note 3.23. A positive difference means book depreciation exceeds tax depreciation (add-back required).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
