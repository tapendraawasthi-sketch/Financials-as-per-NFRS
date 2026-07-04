// Normalized trial balance preview — raw rows before NFRS classification.
import React, { useMemo, useState } from 'react';
import type { RawTBRow } from '../../types/trialBalance';
import Button from '../ui/Button';
import { computeRawTBTotals } from '../../utils/tbTotals';

function fmt(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

interface TBRawPreviewGridProps {
  rows: RawTBRow[];
  onRowsChange: (rows: RawTBRow[]) => void;
  mappingProfileAppliedCount?: number;
  mappingProfileTotalAccounts?: number;
  detectedFormat?: string;
  warnings?: string[];
  onConfirm: () => void;
  onExport: () => void;
  confirming?: boolean;
  exporting?: boolean;
}

export default function TBRawPreviewGrid({
  rows,
  onRowsChange,
  mappingProfileAppliedCount = 0,
  mappingProfileTotalAccounts = 0,
  detectedFormat,
  warnings = [],
  onConfirm,
  onExport,
  confirming = false,
  exporting = false,
}: TBRawPreviewGridProps) {
  const totals = useMemo(() => computeRawTBTotals(rows), [rows]);
  const leafCount = rows.filter((r) => !r.isGroupRow).length;
  const groupCount = rows.filter((r) => r.isGroupRow).length;
  const profilePct = mappingProfileTotalAccounts > 0
    ? Math.round((mappingProfileAppliedCount / mappingProfileTotalAccounts) * 100)
    : 0;

  const updateRow = (rowIndex: number, patch: Partial<RawTBRow>) => {
    onRowsChange(rows.map((r) => (r.rowIndex === rowIndex ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}
      >
        <p className="font-medium" style={{ color: 'var(--brand-800)' }}>
          Review normalized trial balance before account mapping
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--brand-700)' }}>
          Confirm that accounts, amounts, and group hierarchy look correct. You can edit labels and
          balances below, export as Excel, then proceed to NFRS classification.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--ink-600)' }}>
        <span>{leafCount} ledger accounts{groupCount > 0 ? ` · ${groupCount} group headers` : ''}</span>
        {detectedFormat && <span>Format: <strong>{detectedFormat}</strong></span>}
        <span>
          Balance:{' '}
          <strong style={{ color: totals.isBalanced ? 'var(--success-700)' : 'var(--warning-700)' }}>
            {totals.isBalanced ? 'Balanced' : `Difference NPR ${Math.abs(totals.difference).toLocaleString('en-IN')}`}
          </strong>
        </span>
        {mappingProfileTotalAccounts > 0 && mappingProfileAppliedCount > 0 && (
          <span style={{ color: 'var(--success-700)' }}>
            Returning client: {mappingProfileAppliedCount} of {mappingProfileTotalAccounts} accounts
            ({profilePct}%) will be pre-mapped from last year
          </span>
        )}
      </div>

      {warnings.length > 0 && (
        <details className="text-xs" style={{ color: 'var(--warning-700)' }}>
          <summary className="cursor-pointer">{warnings.length} parser notice{warnings.length === 1 ? '' : 's'}</summary>
          <ul className="mt-1 list-disc list-inside max-h-24 overflow-y-auto">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      )}

      <div
        className="overflow-auto rounded-lg border"
        style={{ borderColor: 'var(--border-hairline)', maxHeight: '420px' }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--surface-sunken)' }}>
            <tr>
              {['Account', 'Opening Dr', 'Opening Cr', 'During Dr', 'During Cr', 'Closing Dr', 'Closing Cr', 'Parent Group'].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.rowIndex}
                style={{
                  background: row.isGroupRow ? 'var(--surface-sunken)' : undefined,
                  fontWeight: row.isGroupRow ? 600 : undefined,
                }}
              >
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={row.rawLabel}
                    onChange={(e) => updateRow(row.rowIndex, { rawLabel: e.target.value })}
                    className="w-full min-w-[160px] bg-transparent border-0 border-b border-transparent focus:border-blue-400 outline-none"
                    style={{ paddingLeft: `${Math.min(row.rawIndentSpaces, 20)}px` }}
                  />
                </td>
                {!row.isGroupRow ? (
                  <>
                    {(['openingDr', 'openingCr', 'duringDr', 'duringCr', 'closingDr', 'closingCr'] as const).map((field) => (
                      <td key={field} className="px-2 py-1">
                        <input
                          type="number"
                          value={row[field] || ''}
                          onChange={(e) => updateRow(row.rowIndex, { [field]: Number(e.target.value) || 0 })}
                          className="w-24 bg-transparent border-0 border-b border-transparent focus:border-blue-400 outline-none text-right font-mono"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-slate-500">{row.parentGroup || '—'}</td>
                  </>
                ) : (
                  <td colSpan={7} className="px-2 py-1 text-slate-400 italic">Group header</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot style={{ background: 'var(--surface-sunken)' }}>
            <tr className="font-semibold">
              <td className="px-2 py-2">Totals (leaf accounts)</td>
              <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalOpeningDr)}</td>
              <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalOpeningCr)}</td>
              <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalDuringDr)}</td>
              <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalDuringCr)}</td>
              <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalClosingDr)}</td>
              <td className="px-2 py-2 text-right font-mono">{fmt(totals.totalClosingCr)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="secondary" size="sm" loading={exporting} onClick={onExport}>
          Export Normalized Excel
        </Button>
        <Button type="button" variant="primary" size="sm" loading={confirming} onClick={onConfirm}>
          Confirm &amp; Start Account Mapping
        </Button>
      </div>
    </div>
  );
}
