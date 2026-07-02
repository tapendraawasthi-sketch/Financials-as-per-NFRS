// src/components/trialBalance/TBAccountMapper.tsx
import React, { useState, useMemo, useCallback, useRef } from 'react';
import Tabs   from '../ui/Tabs';
import Button from '../ui/Button';
import { MappedTBRow, NFRSCategory } from '../../types/trialBalance';
import { NFRS_CATEGORY_INFO } from '../../data/nfrsCategories';

const ALL_NFRS_CATEGORIES = NFRS_CATEGORY_INFO.map(c => c.value);
const NFRS_CATEGORY_LABELS = NFRS_CATEGORY_INFO.reduce((acc, c) => {
  acc[c.value] = c.label;
  return acc;
}, {} as Record<NFRSCategory, string>);

interface TBAccountMapperProps {
  rows:            MappedTBRow[];
  companyId:       string;
  onMappingChange: (rowIndex: string, category: NFRSCategory) => void;
  onConfirm:       () => Promise<void> | void;
  onRerunAI?:      () => void;
}

type FilterTab = 'all' | 'review' | 'unmatched' | 'mapped';

// Minimal debounce
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

function fmtBalance(row: MappedTBRow): string {
  const cb = row.closingBalance ?? 0;
  if (cb === 0) return '—';
  const abs = Math.abs(cb)
    .toFixed(0)
    .replace(/(\d)(?=(\d{2})+(?!\d)(?=\d{3}))/g, '$1,');
  return cb > 0 ? `Dr ${abs}` : `Cr ${abs}`;
}

function confidenceColor(n: number): string {
  if (n >= 80) return '#16a34a';
  if (n >= 60) return '#d97706';
  return '#dc2626';
}

function methodLabel(m?: string): string {
  switch (m) {
    case 'exact':   return 'Exact';
    case 'synonym': return 'Synonym';
    case 'fuzzy':   return 'Fuzzy';
    case 'ai':      return 'AI';
    case 'manual':  return 'Manual';
    default:        return '—';
  }
}

export default function TBAccountMapper({
  rows,
  companyId,
  onMappingChange,
  onConfirm,
  onRerunAI,
}: TBAccountMapperProps) {
  const [activeTab,    setActiveTab]    = useState<FilterTab>('all');
  const [search,       setSearch]       = useState('');
  const [confirming,   setConfirming]   = useState(false);
  const [confirmErr,   setConfirmErr]   = useState<string | null>(null);

  // Counts
  const autoMappedCount  = rows.filter(r => (r.confidence ?? 0) >= 80).length;
  const needsReviewCount = rows.filter(r => (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80).length;
  const unmatchedCount   = rows.filter(r => (r.confidence ?? 0) === 0 || !r.nfrsCategory || r.nfrsCategory === 'unclassified').length;
  const mappedCount      = rows.length - unmatchedCount;

  // Filtered rows
  const filteredRows = useMemo(() => {
    const base = rows.filter(r => {
      switch (activeTab) {
        case 'review':
          return (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80;
        case 'unmatched':
          return (r.confidence ?? 0) === 0 || !r.nfrsCategory || r.nfrsCategory === 'unclassified';
        case 'mapped':
          return (r.confidence ?? 0) >= 80;
        default:
          return true;
      }
    });

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(r => r.rawLabel?.toLowerCase().includes(q));
  }, [rows, activeTab, search]);

  // Debounced mapping API call
  const debouncedUpdate = useCallback(
    debounce((rowIndex: string, category: NFRSCategory) => {
      fetch(`/api/trial-balance/${companyId}/mapping/${rowIndex}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nfrsCategory: category }),
      }).catch(console.error);
      onMappingChange(rowIndex, category);
    }, 300),
    [companyId, onMappingChange]
  );

  const handleConfirm = async () => {
    setConfirming(true);
    setConfirmErr(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setConfirmErr(err?.message ?? 'Failed to confirm mappings.');
    } finally {
      setConfirming(false);
    }
  };

  const tabs = [
    { id: 'all',      label: 'All',           count: rows.length        },
    { id: 'review',   label: 'Review Needed', count: needsReviewCount   },
    { id: 'unmatched',label: 'Unmatched',     count: unmatchedCount     },
    { id: 'mapped',   label: 'Mapped',        count: mappedCount        },
  ] as const;

  const thCls = 'px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-left bg-slate-50 border-b border-slate-200 whitespace-nowrap';

  return (
    <div>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-4">
        <Tabs
          variant="pill"
          active={activeTab}
          onChange={id => setActiveTab(id as FilterTab)}
          tabs={tabs.map(t => ({
            id:    t.id,
            label: t.label,
            count: t.count,
          }))}
        />

        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="h-7 w-48 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          aria-label="Search accounts"
        />
      </div>

      {/* ── Mapping table ────────────────────────────────────────────── */}
      <div
        className="border border-slate-200 rounded-md overflow-auto"
        style={{ maxHeight: 560 }}
        role="grid"
        aria-label="Account mapping table"
        aria-rowcount={filteredRows.length + 1}
      >
        <table className="w-full border-collapse text-xs" style={{ minWidth: 740 }}>
          <thead>
            <tr>
              <th className={`${thCls} w-1/3`}>Your Account Name</th>
              <th className={`${thCls} w-1/3`}>NFRS Category</th>
              <th className={`${thCls} w-16 text-center`}>Confidence</th>
              <th className={`${thCls} w-20`}>Method</th>
              <th className={`${thCls} w-24 text-right`}>Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                  {search ? 'No accounts match your search.' : 'No accounts in this category.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, i) => {
                const isUnmatched =
                  (row.confidence ?? 0) === 0 ||
                  !row.nfrsCategory ||
                  row.nfrsCategory === 'unclassified';
                const needsReview =
                  (row.confidence ?? 0) > 0 && (row.confidence ?? 0) < 80;

                const rowBg = isUnmatched
                  ? 'bg-red-50/30'
                  : needsReview
                  ? 'bg-amber-50/40'
                  : i % 2 === 0
                  ? 'bg-white'
                  : 'bg-slate-50/40';

                return (
                  <tr
                    key={row.rowIndex ?? i}
                    className={`${rowBg} border-b border-slate-100 last:border-0 hover:bg-slate-100/60 transition-colors`}
                    aria-rowindex={i + 2}
                  >
                    {/* Account name */}
                    <td
                      className="px-3 py-1.5 text-slate-700 max-w-[240px]"
                      title={row.rawLabel}
                    >
                      <span className="block truncate">
                        {row.rawLabel?.length > 40
                          ? row.rawLabel.slice(0, 40) + '…'
                          : row.rawLabel}
                      </span>
                    </td>

                    {/* NFRS category selector — raw select for compactness */}
                    <td className="px-3 py-1.5">
                      <select
                        value={row.nfrsCategory ?? 'unclassified'}
                        onChange={e =>
                          debouncedUpdate(
                            String(row.rowIndex ?? i),
                            e.target.value as NFRSCategory
                          )
                        }
                        className="h-7 w-full text-xs px-2 border border-slate-200 rounded bg-white text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        aria-label={`NFRS category for ${row.rawLabel}`}
                      >
                        <option value="unclassified">— Select category —</option>
                        {ALL_NFRS_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>
                            {NFRS_CATEGORY_LABELS[cat] ?? cat}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Confidence */}
                    <td className="px-3 py-1.5 text-center">
                      <span
                        className="text-[11px] font-mono font-semibold"
                        style={{ color: confidenceColor(row.confidence ?? 0) }}
                      >
                        {row.confidence ?? 0}%
                      </span>
                    </td>

                    {/* Method */}
                    <td className="px-3 py-1.5">
                      <span className="text-[11px] text-slate-400">
                        {methodLabel(row.matchMethod)}
                      </span>
                    </td>

                    {/* Closing balance */}
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] text-slate-600">
                      {fmtBalance(row)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            {mappedCount} accounts mapped.{' '}
            {needsReviewCount > 0
              ? `${needsReviewCount} still need review.`
              : 'All accounts reviewed.'}
          </p>

          {unmatchedCount > 0 && onRerunAI && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRerunAI}
            >
              Re-match with AI
            </Button>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            variant="primary"
            size="md"
            disabled={needsReviewCount > 0 || unmatchedCount > 0}
            loading={confirming}
            onClick={handleConfirm}
          >
            Confirm Mappings and Continue
          </Button>
          {(needsReviewCount > 0 || unmatchedCount > 0) && (
            <p className="text-xs text-amber-600">
              Map all accounts before continuing.
            </p>
          )}
          {confirmErr && (
            <p className="text-xs text-red-600">{confirmErr}</p>
          )}
        </div>
      </div>
    </div>
  );
}
