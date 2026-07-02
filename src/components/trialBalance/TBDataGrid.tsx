// src/components/trialBalance/TBDataGrid.tsx
import React, { useState, useRef, useCallback } from 'react';
import { MappedTBRow }        from '../../types/trialBalance';
import { ValidationResult } from '../../utils/validation';
import Badge                  from '../ui/Badge';

interface TBDataGridProps {
  rows:         MappedTBRow[];
  validation:   ValidationResult;
  roundingLevel: number;
}

function fmt(n: number): string {
  if (n === 0) return '—';
  const abs = Math.abs(n);
  // Indian comma grouping
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

// Virtual scroll constants
const ROW_HEIGHT   = 36;
const VISIBLE      = 20;
const BUFFER       = 4;

export default function TBDataGrid({
  rows,
  validation,
  roundingLevel,
}: TBDataGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop),
    []
  );

  // Derived totals
  const totals = rows.reduce(
    (acc, r) => ({
      openDr:   acc.openDr   + Math.max(0,  r.openingDr   ?? 0),
      openCr:   acc.openCr   + Math.max(0,  r.openingCr   ?? 0),
      closeDr:  acc.closeDr  + Math.max(0,  r.closingDr   ?? 0),
      closeCr:  acc.closeCr  + Math.max(0,  r.closingCr   ?? 0),
      duringDr: acc.duringDr + (r.duringDr  ?? 0),
      duringCr: acc.duringCr + (r.duringCr ?? 0),
    }),
    { openDr: 0, openCr: 0, closeDr: 0, closeCr: 0, duringDr: 0, duringCr: 0 }
  );

  const diff      = Math.abs(totals.closeDr - totals.closeCr);
  const balanced  = diff <= roundingLevel;

  // Virtual scroll slicing
  const startIdx     = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIdx       = Math.min(rows.length, startIdx + VISIBLE + BUFFER * 2);
  const visibleRows  = rows.slice(startIdx, endIdx);
  const topPad       = startIdx * ROW_HEIGHT;
  const botPad       = Math.max(0, (rows.length - endIdx) * ROW_HEIGHT);
  const containerH   = Math.min(rows.length * ROW_HEIGHT + 40, 520);

  const thCls = 'px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap bg-slate-50 border-b border-slate-200';
  const tdCls = 'px-2.5 text-[11px] font-mono text-right whitespace-nowrap';

  return (
    <div>
      {/* ── Summary bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 px-4 py-2 bg-white border border-slate-200 rounded-md mb-3 text-xs flex-wrap">
        <span className="text-slate-400">
          Opening Dr{' '}
          <span className="font-mono font-semibold text-slate-700">
            {fmt(totals.openDr)}
          </span>
        </span>
        <span className="text-slate-400">
          Opening Cr{' '}
          <span className="font-mono font-semibold text-slate-700">
            {fmt(totals.openCr)}
          </span>
        </span>
        <span className="text-slate-400">
          Closing Dr{' '}
          <span className="font-mono font-semibold text-slate-700">
            {fmt(totals.closeDr)}
          </span>
        </span>
        <span className="text-slate-400">
          Closing Cr{' '}
          <span className="font-mono font-semibold text-slate-700">
            {fmt(totals.closeCr)}
          </span>
        </span>
        <span className="text-slate-400">
          Difference{' '}
          <span
            className={`font-mono font-semibold ${balanced ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {fmt(diff)}
          </span>
        </span>
        <Badge
          label={balanced ? 'BALANCED' : 'UNBALANCED'}
          variant={balanced ? 'green' : 'red'}
        />
        <span className="ml-auto text-slate-400">
          {rows.length} accounts
        </span>
      </div>

      {/* ── Main table (virtualised) ──────────────────────────────────── */}
      <div
        ref={containerRef}
        className="border border-slate-200 rounded-md overflow-auto"
        style={{ height: containerH }}
        onScroll={handleScroll}
        role="grid"
        aria-rowcount={rows.length + 1}
        aria-label="Trial balance accounts"
      >
        <table className="w-full border-collapse text-[11px]" style={{ minWidth: 900 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <th className={`${thCls} text-center w-9`}>#</th>
              <th className={`${thCls} text-left`}>Account Name</th>
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
            {/* Top spacer */}
            {topPad > 0 && (
              <tr aria-hidden="true" style={{ height: topPad }}>
                <td colSpan={11} />
              </tr>
            )}

            {visibleRows.map((row, relIdx) => {
              const absIdx = startIdx + relIdx;

              const closeDr = row.closingDr  ?? (row.closingBalance > 0 ? row.closingBalance : 0);
              const closeCr = row.closingCr ?? (row.closingBalance < 0 ? Math.abs(row.closingBalance) : 0);
              const bothNonZero = closeDr > 0 && closeCr > 0;

              const net   = closeDr - closeCr;
              const netFm = fmt(Math.abs(net));

              const rowBg = bothNonZero
                ? 'bg-amber-50'
                : absIdx % 2 === 0
                ? 'bg-white'
                : 'bg-slate-50/40';

              return (
                <tr
                  key={row.rowIndex ?? absIdx}
                  className={`${rowBg} border-b border-slate-100 hover:bg-slate-100/60 transition-colors`}
                  style={{ height: ROW_HEIGHT }}
                  aria-rowindex={absIdx + 2}
                >
                  <td className="px-2.5 text-center text-[10px] text-slate-400">
                    {absIdx + 1}
                  </td>

                  <td
                    className="px-2.5 text-xs text-slate-700 max-w-[220px] truncate"
                    title={row.rawLabel}
                  >
                    {row.rawLabel}
                  </td>

                  {/* Opening Dr */}
                  <td className={`${tdCls} ${(row.openingDr ?? 0) === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                    {fmt(row.openingDr ?? 0)}
                  </td>

                  {/* Opening Cr */}
                  <td className={`${tdCls} ${(row.openingCr ?? 0) === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                    {fmt(row.openingCr ?? 0)}
                  </td>

                  {/* During Dr */}
                  <td className={`${tdCls} ${(row.duringDr ?? 0) === 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                    {fmt(row.duringDr ?? 0)}
                  </td>

                  {/* During Cr */}
                  <td className={`${tdCls} ${(row.duringCr ?? 0) === 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                    {fmt(row.duringCr ?? 0)}
                  </td>

                  {/* Adj Dr */}
                  <td className={`${tdCls} ${(row.adjustmentDr ?? 0) === 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                    {fmt(row.adjustmentDr ?? 0)}
                  </td>

                  {/* Adj Cr */}
                  <td className={`${tdCls} ${(row.adjustmentCr ?? 0) === 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                    {fmt(row.adjustmentCr ?? 0)}
                  </td>

                  {/* Closing Dr */}
                  <td className={`${tdCls} font-semibold ${closeDr === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                    {fmt(closeDr)}
                  </td>

                  {/* Closing Cr */}
                  <td className={`${tdCls} font-semibold ${closeCr === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                    {fmt(closeCr)}
                  </td>

                  {/* Net */}
                  <td
                    className={`${tdCls} font-semibold ${
                      net === 0
                        ? 'text-slate-300'
                        : net > 0
                        ? 'text-blue-700'
                        : 'text-red-600'
                    }`}
                  >
                    {net === 0 ? '—' : netFm}
                  </td>
                </tr>
              );
            })}

            {/* Bottom spacer */}
            {botPad > 0 && (
              <tr aria-hidden="true" style={{ height: botPad }}>
                <td colSpan={11} />
              </tr>
            )}
          </tbody>

          {/* ── Totals footer ─────────────────────────────────────────── */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td className="px-2.5 py-2" colSpan={2}>
                <span className="text-[11px] font-bold text-slate-700">TOTAL</span>
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
                className={`${tdCls} py-2 font-bold ${balanced ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {balanced ? 'OK' : fmt(diff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
