// src/components/trialBalance/TBValidationPanel.tsx
import React from 'react';
import Card from '../ui/Card';
import Alert from '../ui/Alert';

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
        <div className="space-y-3">
          <Alert
            type={balanced ? 'success' : 'error'}
            title={balanced ? 'Trial Balance Balanced' : 'Trial Balance Unbalanced'}
            message={
              balanced
                ? 'Closing debit and credit totals match within the rounding tolerance.'
                : `Closing debit and credit totals differ by NPR ${fmt(diff)}. Review account balances before proceeding.`
            }
          />

          {/* Mini balance table */}
          <table className="fin-table w-full text-xs">
            <tbody>
              {[
                { label: 'Opening Dr', value: validation.openingDebitTotal  },
                { label: 'Opening Cr', value: validation.openingCreditTotal },
                { label: 'Closing Dr', value: validation.closingDebitTotal  },
                { label: 'Closing Cr', value: validation.closingCreditTotal },
              ].map(row => (
                <tr key={row.label}>
                  <td style={{ color: 'var(--ink-500)' }}>{row.label}</td>
                  <td className="amount">{fmt(row.value)}</td>
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
            <span className="text-xs" style={{ color: 'var(--ink-500)' }}>Auto-mapped</span>
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold font-mono"
              style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}
            >
              {autoMappedCount}
            </span>
          </div>

          {/* Needs review */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--ink-500)' }}>Needs Review</span>
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold font-mono"
              style={{ background: 'var(--warning-100)', color: 'var(--warning-700)' }}
            >
              {needsReviewCount}
            </span>
          </div>

          {/* Unmatched */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--ink-500)' }}>Unmatched</span>
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold font-mono"
              style={{ background: 'var(--danger-100)', color: 'var(--danger-700)' }}
            >
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
              className="transition-all"
              style={{ width: `${mappedPct}%`, background: 'var(--success-600)' }}
            />
            <div
              className="transition-all"
              style={{ width: `${reviewPct}%`, background: 'var(--warning-600)' }}
            />
            <div
              className="transition-all"
              style={{ width: `${unmatchPct}%`, background: 'var(--danger-600)' }}
            />
            {/* Filler for any rounding gap */}
            <div className="flex-1" style={{ background: 'var(--surface-sunken)' }} />
          </div>

          <p className="text-[11px]" style={{ color: 'var(--ink-400)' }}>
            {totalRows} total accounts
          </p>
        </div>
      </Card>

      {/* ── Card 3: Warnings ─────────────────────────────────────────── */}
      <Card title="Warnings" padding="md">
        {allMessages.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--ink-400)' }}>No warnings</p>
        ) : (
          <div className="space-y-2">
            {allMessages.map((msg, i) => (
              <Alert
                key={i}
                type={msg.isError ? 'error' : 'warning'}
                message={msg.text}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
