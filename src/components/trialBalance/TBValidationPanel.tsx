// src/components/trialBalance/TBValidationPanel.tsx
import React from 'react';
import Card from '../ui/Card';

interface ValidationProps {
  validation: {
    isBalanced:         boolean;
    totalDebitBalance:  number;
    totalCreditBalance: number;
    openingDebitTotal:  number;
    openingCreditTotal: number;
    closingDebitTotal:  number;
    closingCreditTotal: number;
    warnings:           string[];
    errors:             string[];
  };
  totalRows:       number;
  autoMappedCount: number;
  needsReviewCount: number;
  unmatchedCount:  number;
}

function fmt(n: number): string {
  return Math.abs(n)
    .toFixed(0)
    .replace(/\B(?=(\d{2})+(?!\d)(?<=\d{3,}))/g, ',')
    .replace(/(\d)(?=(\d{3})+$)/, '$1,');
}

export default function TBValidationPanel({
  validation,
  totalRows,
  autoMappedCount,
  needsReviewCount,
  unmatchedCount,
}: ValidationProps) {
  const diff     = Math.abs(validation.totalDebitBalance - validation.totalCreditBalance);
  const balanced = validation.isBalanced;

  const mappedCount = autoMappedCount;
  const total       = totalRows || 1; // guard against divide-by-zero

  const mappedPct  = Math.round((mappedCount    / total) * 100);
  const reviewPct  = Math.round((needsReviewCount / total) * 100);
  const unmatchPct = Math.round((unmatchedCount  / total) * 100);

  const allMessages = [
    ...validation.errors.map(m => ({ text: m, isError: true  })),
    ...validation.warnings.map(m => ({ text: m, isError: false })),
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* ── Card 1: Balance Status ───────────────────────────────────── */}
      <Card title="Balance Status" padding="md">
        <div className="text-center space-y-2">
          {/* Status dot */}
          <span
            className={`inline-block h-3 w-3 rounded-full ${balanced ? 'bg-emerald-500' : 'bg-red-500'}`}
            aria-hidden="true"
          />

          <p
            className={`text-xs font-semibold tracking-wide ${balanced ? 'text-emerald-700' : 'text-red-700'}`}
          >
            {balanced ? 'BALANCED' : 'UNBALANCED'}
          </p>

          {!balanced && (
            <p className="text-xs text-red-600 font-mono">
              Difference: {fmt(diff)}
            </p>
          )}

          {/* Mini balance table */}
          <table className="w-full text-xs mt-2">
            <tbody>
              {[
                { label: 'Opening Dr', value: validation.openingDebitTotal  },
                { label: 'Opening Cr', value: validation.openingCreditTotal },
                { label: 'Closing Dr', value: validation.closingDebitTotal  },
                { label: 'Closing Cr', value: validation.closingCreditTotal },
              ].map(row => (
                <tr key={row.label} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 text-left text-slate-500">{row.label}</td>
                  <td className="py-1 text-right font-mono text-slate-700">{fmt(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Card 2: Mapping Status ───────────────────────────────────── */}
      <Card title="Mapping Status" padding="md">
        <div className="space-y-2.5">
          {/* Auto-mapped */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Auto-mapped</span>
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold font-mono bg-emerald-50 text-emerald-700">
              {autoMappedCount}
            </span>
          </div>

          {/* Needs review */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Needs Review</span>
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold font-mono bg-amber-50 text-amber-700">
              {needsReviewCount}
            </span>
          </div>

          {/* Unmatched */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Unmatched</span>
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold font-mono bg-red-50 text-red-700">
              {unmatchedCount}
            </span>
          </div>

          {/* Proportion bar */}
          <div
            className="flex h-2 rounded overflow-hidden mt-3"
            role="img"
            aria-label={`Mapping: ${mappedCount} mapped, ${needsReviewCount} needs review, ${unmatchedCount} unmatched`}
          >
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${mappedPct}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${reviewPct}%` }}
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${unmatchPct}%` }}
            />
            {/* Filler for any rounding gap */}
            <div className="flex-1 bg-slate-200" />
          </div>

          <p className="text-[11px] text-slate-400">
            {totalRows} total accounts
          </p>
        </div>
      </Card>

      {/* ── Card 3: Warnings ─────────────────────────────────────────── */}
      <Card title="Warnings" padding="md">
        {allMessages.length === 0 ? (
          <p className="text-xs text-slate-400">No warnings</p>
        ) : (
          <div
            className="max-h-32 overflow-y-auto space-y-0 divide-y divide-amber-100"
            role="list"
            aria-label="Validation warnings"
          >
            {allMessages.map((msg, i) => (
              <p
                key={i}
                role="listitem"
                className={[
                  'text-xs py-1 leading-snug',
                  msg.isError ? 'text-red-600' : 'text-amber-700',
                ].join(' ')}
              >
                {msg.text}
              </p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
