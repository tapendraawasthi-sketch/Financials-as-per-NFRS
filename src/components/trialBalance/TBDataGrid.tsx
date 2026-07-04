// src/components/trialBalance/TBDataGrid.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MappedTBRow }      from '../../types/trialBalance';
import { ValidationResult } from '../../utils/validation';

interface TBDataGridProps {
  rows:          MappedTBRow[];
  validation:    ValidationResult;
  roundingLevel: number;
}

// ── Number formatter ──────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const s   = abs.toFixed(0);
  const len = s.length;
  if (len <= 3) return (n < 0 ? '-' : '') + s;
  let out  = s.slice(-3);
  let rest = s.slice(0, -3);
  while (rest.length > 0) {
    out  = rest.slice(-2) + ',' + out;
    rest = rest.slice(0, -2);
  }
  if (out.startsWith(',')) out = out.slice(1);
  return (n < 0 ? '-' : '') + out;
}

// item 66: density settings stored in localStorage
type Density = 'compact' | 'normal' | 'comfortable';

const DENSITY_CONFIG: Record<Density, { rowHeight: number; fontSize: string; cellPad: string }> = {
  compact:     { rowHeight: 32, fontSize: 'text-[11px]', cellPad: 'px-2.5 py-1' },
  normal:      { rowHeight: 36, fontSize: 'text-xs',     cellPad: 'px-2.5 py-1.5' },
  comfortable: { rowHeight: 40, fontSize: 'text-[13px]', cellPad: 'px-3 py-2' },
};

function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>(() => {
    try {
      const stored = localStorage.getItem('tb_grid_density');
      if (stored === 'compact' || stored === 'normal' || stored === 'comfortable') return stored;
    } catch { /* localStorage unavailable */ }
    return 'normal';
  });

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try { localStorage.setItem('tb_grid_density', d); } catch { /* ignore */ }
  }, []);

  return [density, setDensity];
}

const VISIBLE = 20;
const BUFFER  = 4;

export default function TBDataGrid({
  rows,
  validation,
  roundingLevel,
}: TBDataGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // item 66: density toggle with localStorage persistence
  const [density, setDensity] = useDensity();
  const dc = DENSITY_CONFIG[density];

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop),
    []
  );

  // ── Totals (leaf accounts only — exclude group header rows) ───────────────
  const leafRows = rows.filter((r) => !r.isGroupRow);
  const totals = leafRows.reduce(
    (acc, r) => ({
      openDr:   acc.openDr   + Math.max(0, r.openingDr  ?? 0),
      openCr:   acc.openCr   + Math.max(0, r.openingCr  ?? 0),
      closeDr:  acc.closeDr  + Math.max(0, r.closingDr  ?? 0),
      closeCr:  acc.closeCr  + Math.max(0, r.closingCr  ?? 0),
      duringDr: acc.duringDr + (r.duringDr ?? 0),
      duringCr: acc.duringCr + (r.duringCr ?? 0),
    }),
    { openDr: 0, openCr: 0, closeDr: 0, closeCr: 0, duringDr: 0, duringCr: 0 }
  );

  const diff     = Math.abs(totals.closeDr - totals.closeCr);
  const balanced = diff <= roundingLevel;

  // ── Virtual scroll ──────────────────────────────────────────────────────────
  const ROW_HEIGHT  = dc.rowHeight;
  const startIdx    = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIdx      = Math.min(rows.length, startIdx + VISIBLE + BUFFER * 2);
  const visibleRows = rows.slice(startIdx, endIdx);
  const topPad      = startIdx * ROW_HEIGHT;
  const botPad      = Math.max(0, (rows.length - endIdx) * ROW_HEIGHT);
  const containerH  = Math.min(rows.length * ROW_HEIGHT + 48, 540);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const thCls = `${dc.cellPad} ${dc.fontSize} whitespace-nowrap text-right`;
  const thLCls = `${dc.cellPad} ${dc.fontSize} whitespace-nowrap text-left`;
  const tdCls  = `${dc.cellPad} ${dc.fontSize} amount`;

  return (
    <div>
      {/* ── item 64: Metric tile summary bar ──────────────────────────── */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {[
          { label: 'Opening Dr',  value: fmt(totals.openDr) },
          { label: 'Opening Cr',  value: fmt(totals.openCr) },
          { label: 'Closing Dr',  value: fmt(totals.closeDr) },
          { label: 'Closing Cr',  value: fmt(totals.closeCr) },
          { label: 'Difference',  value: balanced ? '✓ 0' : fmt(diff), isStatus: true, balanced },
        ].map(tile => (
          <div
            key={tile.label}
            className="card px-3 py-2.5"
            style={
              'isStatus' in tile && tile.isStatus
                ? {
                    borderColor: tile.balanced ? 'var(--success-600)' : 'var(--danger-600)',
                    background: tile.balanced ? 'var(--success-100)' : 'var(--danger-100)',
                  }
                : undefined
            }
          >
            <p
              className="text-[11px] uppercase tracking-wide font-semibold leading-none"
              style={{ color: 'var(--ink-400)' }}
            >
              {tile.label}
            </p>
            <p
              className={`text-sm font-semibold font-mono mt-1 leading-none ${
                'isStatus' in tile && tile.isStatus
                  ? tile.balanced ? 'text-emerald-700' : 'text-red-700'
                  : ''
              }`}
              style={
                !('isStatus' in tile && tile.isStatus)
                  ? { color: 'var(--ink-800)' }
                  : undefined
              }
            >
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar: Balance status badge + density toggle + row count ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* item 65: larger, more prominent balance badge */}
          <span
            className="text-sm font-bold px-3 py-1 rounded-full"
            style={{
              background: balanced ? 'var(--success-100)' : 'var(--danger-100)',
              color: balanced ? 'var(--success-700)' : 'var(--danger-700)',
            }}
          >
            {balanced ? '✅ BALANCED' : '⚠️ UNBALANCED'}
          </span>
          <span className="text-xs text-slate-400">{rows.length} accounts</span>
        </div>

        {/* item 66: density toggle */}
        <div
          role="group"
          aria-label="Row density"
          className="flex items-center gap-0.5 rounded-md p-0.5"
          style={{ background: 'var(--surface-sunken)' }}
        >
          {(['compact', 'normal', 'comfortable'] as Density[]).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              aria-pressed={density === d}
              className={`h-6 px-2.5 text-[11px] font-medium rounded transition-colors ${
                density === d
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Data table (virtualised) ──────────────────────────────────── */}
      <div
        ref={containerRef}
        className="card overflow-auto"
        style={{ height: containerH }}
        onScroll={handleScroll}
        role="grid"
        aria-rowcount={rows.length + 1}
        aria-label="Trial balance accounts"
      >
        <table className="fin-table w-full" style={{ minWidth: 980 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <th className={`${thLCls} w-9 text-center`}>#</th>
              <th className={`${thLCls}`} style={{ width: 200 }}>Account Name</th>
              {/* item 70: NFRS Category column added */}
              <th className={`${thLCls}`} style={{ width: 150 }}>NFRS Category</th>
              <th className={thCls}>Opening Dr</th>
              <th className={thCls}>Opening Cr</th>
              <th className={thCls}>During Dr</th>
              <th className={thCls}>During Cr</th>
              <th className={thCls}>Adj Dr</th>
              <th className={thCls}>Adj Cr</th>
              <th className={`${thCls} font-bold`}>Closing Dr</th>
              <th className={`${thCls} font-bold`}>Closing Cr</th>
              <th className={thCls}>Net</th>
            </tr>
          </thead>

          <tbody>
            {topPad > 0 && (
              <tr aria-hidden="true" style={{ height: topPad }}>
                <td colSpan={12} />
              </tr>
            )}

            {visibleRows.map((row, relIdx) => {
              const absIdx = startIdx + relIdx;

              const closeDr = row.closingDr  ?? ((row.closingBalance ?? 0) > 0 ? (row.closingBalance ?? 0) : 0);
              const closeCr = row.closingCr  ?? ((row.closingBalance ?? 0) < 0 ? Math.abs(row.closingBalance ?? 0) : 0);
              const bothNonZero = closeDr > 0 && closeCr > 0;

              const net   = closeDr - closeCr;
              const netFm = fmt(Math.abs(net));

              // item 67: proper zebra stripe — bg-slate-50 not bg-slate-50/40
              return (
                <tr
                  key={row.rowIndex ?? absIdx}
                  className="transition-colors"
                  style={{
                    height: dc.rowHeight,
                    ...(bothNonZero ? { background: 'var(--warning-100)' } : {}),
                  }}
                  aria-rowindex={absIdx + 2}
                  // item 68: tooltip on amber rows explaining why they're highlighted
                  title={bothNonZero
                    ? 'Warning: this account has both a Debit and Credit closing balance — please verify'
                    : undefined}
                >
                  <td className={`${dc.cellPad} text-center text-[10px] text-slate-400`}>
                    {absIdx + 1}
                  </td>

                  {/* Account name — item 71: fixed max-w-[200px] truncate */}
                  <td
                    className={`${dc.cellPad} ${dc.fontSize} text-slate-700`}
                    style={{ maxWidth: 200 }}
                    title={row.rawLabel}
                  >
                    <span className="block truncate max-w-[200px]">{row.rawLabel}</span>
                  </td>

                  {/* item 70: NFRS category badge */}
                  <td className={`${dc.cellPad}`} style={{ maxWidth: 150 }}>
                    {row.nfrsCategory && row.nfrsCategory !== 'unclassified' ? (
                      <span
                        className="inline-block text-[10px] rounded px-1.5 py-0.5 font-medium truncate max-w-[140px]"
                        style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
                        title={row.nfrsCategory as string}
                      >
                        {row.nfrsCategory as string}
                      </span>
                    ) : (
                      <span
                        className="inline-block text-[10px] rounded px-1.5 py-0.5 font-medium"
                        style={{ background: 'var(--danger-100)', color: 'var(--danger-600)' }}
                      >
                        unclassified
                      </span>
                    )}
                  </td>

                  {/* Opening Dr */}
                  <td className={`${tdCls} ${(row.openingDr ?? 0) === 0 ? 'amount-zero' : ''}`}>
                    {fmt(row.openingDr ?? 0)}
                  </td>

                  {/* Opening Cr */}
                  <td className={`${tdCls} ${(row.openingCr ?? 0) === 0 ? 'amount-zero' : ''}`}>
                    {fmt(row.openingCr ?? 0)}
                  </td>

                  {/* During Dr */}
                  <td className={`${tdCls} ${(row.duringDr ?? 0) === 0 ? 'amount-zero' : ''}`}>
                    {fmt(row.duringDr ?? 0)}
                  </td>

                  {/* During Cr */}
                  <td className={`${tdCls} ${(row.duringCr ?? 0) === 0 ? 'amount-zero' : ''}`}>
                    {fmt(row.duringCr ?? 0)}
                  </td>

                  {/* Adj Dr */}
                  <td className={`${tdCls} ${(row.adjustmentDr ?? 0) === 0 ? 'amount-zero' : ''}`}>
                    {fmt(row.adjustmentDr ?? 0)}
                  </td>

                  {/* Adj Cr */}
                  <td className={`${tdCls} ${(row.adjustmentCr ?? 0) === 0 ? 'amount-zero' : ''}`}>
                    {fmt(row.adjustmentCr ?? 0)}
                  </td>

                  {/* Closing Dr */}
                  <td className={`${tdCls} font-semibold ${closeDr === 0 ? 'amount-zero' : ''}`}>
                    {fmt(closeDr)}
                  </td>

                  {/* Closing Cr */}
                  <td className={`${tdCls} font-semibold ${closeCr === 0 ? 'amount-zero' : ''}`}>
                    {fmt(closeCr)}
                  </td>

                  {/* Net */}
                  <td
                    className={`${tdCls} font-semibold ${
                      net === 0
                        ? 'amount-zero'
                        : net > 0
                        ? ''
                        : 'amount-negative'
                    }`}
                    style={net > 0 && net !== 0 ? { color: 'var(--brand-600)' } : undefined}
                  >
                    {net === 0 ? '—' : netFm}
                  </td>
                </tr>
              );
            })}

            {botPad > 0 && (
              <tr aria-hidden="true" style={{ height: botPad }}>
                <td colSpan={12} />
              </tr>
            )}
          </tbody>

          {/* ── Totals footer ──────────────────────────────────────────── */}
          <tfoot>
            <tr className="row-total">
              <td className={`${dc.cellPad}`} colSpan={3}>
                <span className={`${dc.fontSize} font-bold text-slate-700`}>TOTAL</span>
              </td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>{fmt(totals.openDr)}</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>{fmt(totals.openCr)}</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>{fmt(totals.duringDr)}</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>{fmt(totals.duringCr)}</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>—</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>—</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>{fmt(totals.closeDr)}</td>
              <td className={`${tdCls} py-2 font-bold text-slate-800`}>{fmt(totals.closeCr)}</td>
              <td
                className={`${tdCls} py-2 font-bold ${balanced ? '' : 'amount-negative'}`}
                style={balanced ? { color: 'var(--success-600)' } : undefined}
              >
                {balanced ? '✓ OK' : fmt(diff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
