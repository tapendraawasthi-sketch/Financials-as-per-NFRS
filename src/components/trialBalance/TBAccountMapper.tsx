// src/components/trialBalance/TBAccountMapper.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import Button      from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import { MappedTBRow, NFRSCategory } from '../../types/trialBalance';
import { buildCategoryGroups, buildCategoryLabelMap } from '../../data/categoryGroups';
import { tbApi } from '../../api/client';
import { useAppStore } from '../../store/appStore';

// ── Category grouping for <optgroup> — full COA taxonomy ───────────────────
const CATEGORY_GROUPS = buildCategoryGroups();
const NFRS_LABELS = buildCategoryLabelMap();

// ── Similarity helpers ───────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isSimilarLabel(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return false; // same account, skip self
  // Tokenize and check if one starts with the same words as the other
  const tA = na.split(' ');
  const tB = nb.split(' ');
  // Share at least 2 tokens OR one starts with the base of the other
  const shared = tA.filter(t => tB.includes(t));
  return shared.length >= 2 || na.startsWith(tB[0] + ' ' + tB[1]) || nb.startsWith(tA[0] + ' ' + tA[1]);
}

// ── Debounce ─────────────────────────────────────────────────────────────────
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

function fmtBalance(row: MappedTBRow): string {
  const cb = (row as any).closingBalance ?? 0;
  if (cb === 0) return '—';
  const abs = Math.abs(cb).toFixed(0).replace(/(\d)(?=(\d{2})+(?!\d)(?=\d{3}))/g, '$1,');
  return cb > 0 ? `Dr ${abs}` : `Cr ${abs}`;
}

function confidenceColor(n: number): string {
  if (n >= 80) return 'var(--success-600)';
  if (n >= 60) return 'var(--warning-600)';
  return 'var(--danger-600)';
}

function methodLabel(m?: string): string {
  const map: Record<string, string> = {
    exact: 'Exact', synonym: 'Synonym', fuzzy: 'Fuzzy',
    ai: 'AI', manual: 'Manual',
  };
  return map[m ?? ''] ?? '—';
}

// ── Suggestion Banner — item 74 ──────────────────────────────────────────────
interface SimilarSuggestion {
  sourceLabel:   string;
  nfrsCategory:  NFRSCategory;
  matchingRows:  MappedTBRow[];
}

function SimilarSuggestionBanner({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: SimilarSuggestion;
  onApply:    () => void;
  onDismiss:  () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3 animate-fade-in"
      style={{
        background: 'var(--warning-100)',
        border: '1px solid var(--warning-600)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--warning-700)' }}>
          Apply "{NFRS_LABELS[suggestion.nfrsCategory] ?? suggestion.nfrsCategory}" to{' '}
          <strong>{suggestion.matchingRows.length}</strong> similar account
          {suggestion.matchingRows.length !== 1 ? 's' : ''}?
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--warning-600)' }}>
          {suggestion.matchingRows.map(r => r.rawLabel).join(', ')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          Skip
        </Button>
        <Button variant="primary" size="sm" onClick={onApply}>
          Apply to {suggestion.matchingRows.length}
        </Button>
      </div>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface TBAccountMapperProps {
  rows:            MappedTBRow[];
  companyId:       string;
  onMappingChange: (rowIndex: string, category: NFRSCategory) => void;
  onConfirm:       () => Promise<void> | void;
  onRerunAI?:      () => void;
}

type FilterTab = 'all' | 'review' | 'unmatched' | 'mapped';

// ── Main Component ───────────────────────────────────────────────────────────
export default function TBAccountMapper({
  rows,
  companyId,
  onMappingChange,
  onConfirm,
  onRerunAI,
}: TBAccountMapperProps) {
  const { dispatch } = useAppStore();
  const [activeTab,     setActiveTab]     = useState<FilterTab>('review');  // default to review
  const [search,        setSearch]        = useState('');
  const [confirming,    setConfirming]    = useState(false);
  const [confirmErr,    setConfirmErr]    = useState<string | null>(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  // item 74: suggestion state
  const [suggestion,    setSuggestion]    = useState<SimilarSuggestion | null>(null);

  // ── Counts (leaf ledgers only — group headers are not mapped) ───────────
  const leafRows = rows.filter((r) => !r.isGroupRow);
  const autoMappedCount  = leafRows.filter(r => (r.confidence ?? 0) >= 80).length;
  const needsReviewCount = leafRows.filter(r => (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80).length;
  const unmatchedCount   = leafRows.filter(r => (r.confidence ?? 0) === 0 || !r.nfrsCategory || r.nfrsCategory === 'unclassified').length;
  const mappedCount      = leafRows.length - unmatchedCount;
  const completePct      = leafRows.length > 0 ? Math.round((mappedCount / leafRows.length) * 100) : 0;

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let base = leafRows;

    // item 73: "Needs Review" tab surfaces unmapped + low-confidence rows first
    switch (activeTab) {
      case 'review':
        base = leafRows.filter(r => (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80);
        break;
      case 'unmatched':
        base = leafRows.filter(r => (r.confidence ?? 0) === 0 || !r.nfrsCategory || r.nfrsCategory === 'unclassified');
        break;
      case 'mapped':
        base = leafRows.filter(r => (r.confidence ?? 0) >= 80);
        break;
      default:
        // Sort: unmapped first, then needs review, then mapped — item 73 triage
        base = [
          ...leafRows.filter(r => (r.confidence ?? 0) === 0 || r.nfrsCategory === 'unclassified'),
          ...leafRows.filter(r => (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80),
          ...leafRows.filter(r => (r.confidence ?? 0) >= 80),
        ];
        break;
    }

    // item 73: search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(r => r.rawLabel?.toLowerCase().includes(q));
    }

    return base;
  }, [rows, activeTab, search]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, MappedTBRow[]>();
    for (const row of filteredRows) {
      const key = (row as MappedTBRow & { parentGroup?: string }).parentGroup?.trim() || 'Ungrouped Accounts';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries());
  }, [filteredRows]);

  const isUnmappedRow = (row: MappedTBRow) =>
    (row.confidence ?? 0) === 0 || !row.nfrsCategory || row.nfrsCategory === 'unclassified';

  const handleAIRematch = async () => {
    setAiLoading(true);
    try {
      if (onRerunAI) {
        await Promise.resolve(onRerunAI());
      } else if (companyId) {
        const result = await tbApi.rematchWithAI(companyId);
        dispatch({ type: 'SET_TRIAL_BALANCE', payload: result.trialBalance });
      }
    } catch (err) {
      console.error('[TBAccountMapper] AI rematch failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Handle category change + similar suggestion ──────────────────────────
  // item 74: detect similar accounts and surface suggestion
  const handleCategoryChange = useCallback((
    row: MappedTBRow,
    rowIndex: string,
    category: NFRSCategory,
  ) => {
    // Apply this row
    onMappingChange(rowIndex, category);

    // Look for similar unmapped rows
    const similarUnmapped = rows.filter(r => {
      const isUnmapped = !r.nfrsCategory || r.nfrsCategory === 'unclassified' || (r.confidence ?? 0) < 60;
      const isSelf     = String(r.rowIndex ?? '') === String(rowIndex);
      return !isSelf && isUnmapped && isSimilarLabel(r.rawLabel, row.rawLabel);
    });

    if (similarUnmapped.length > 0) {
      setSuggestion({
        sourceLabel:  row.rawLabel,
        nfrsCategory: category,
        matchingRows: similarUnmapped.slice(0, 5),
      });
    } else {
      setSuggestion(null);
    }

    // Also fire the debounced API call
    debouncedApiUpdate(rowIndex, category);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, onMappingChange]);

  // ── Debounced API call ────────────────────────────────────────────────────
  const debouncedApiUpdate = useCallback(
    debounce((rowIndex: string, category: NFRSCategory) => {
      fetch(`/api/trial-balance/${companyId}/mapping/${rowIndex}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nfrsCategory: category }),
      }).catch(console.error);
    }, 300),
    [companyId]
  );

  const handleBulkMap = useCallback((
    groupRows: MappedTBRow[],
    category: NFRSCategory,
  ) => {
    groupRows
      .filter(isUnmappedRow)
      .forEach(row => {
        const idx = String(row.rowIndex ?? rows.indexOf(row));
        onMappingChange(idx, category);
        debouncedApiUpdate(idx, category);
      });
  }, [rows, onMappingChange, debouncedApiUpdate]);

  // ── Apply suggestion ──────────────────────────────────────────────────────
  const applySuggestion = useCallback(() => {
    if (!suggestion) return;
    suggestion.matchingRows.forEach(r => {
      const idx = String(r.rowIndex ?? rows.indexOf(r));
      onMappingChange(idx, suggestion.nfrsCategory);
      debouncedApiUpdate(idx, suggestion.nfrsCategory);
    });
    setSuggestion(null);
  }, [suggestion, rows, onMappingChange, debouncedApiUpdate]);

  // ── Confirm ───────────────────────────────────────────────────────────────
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

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'all',       label: 'All',           count: rows.length       },
    { id: 'review',    label: 'Needs Review',  count: needsReviewCount  },
    { id: 'unmatched', label: 'Unmatched',     count: unmatchedCount    },
    { id: 'mapped',    label: 'Mapped',        count: mappedCount       },
  ] as const;

  const thCls = 'px-3 py-2 text-[11px] whitespace-nowrap text-left';

  return (
    <div className="space-y-3">

      {/* ── item 75: live completion counter ───────────────────────── */}
      <div className="card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>
            <span className="font-bold" style={{ color: 'var(--brand-600)' }}>{mappedCount}</span>
            <span style={{ color: 'var(--ink-400)' }}> of </span>
            <span className="font-bold" style={{ color: 'var(--ink-700)' }}>{rows.length}</span>
            <span style={{ color: 'var(--ink-500)' }}> accounts mapped</span>
          </p>
          <span className="text-sm font-semibold" style={{ color: 'var(--ink-600)' }}>{completePct}%</span>
        </div>
        <ProgressBar
          value={completePct}
          color={completePct === 100 ? 'green' : 'blue'}
          size="md"
        />
        {needsReviewCount > 0 && (
          <p className="text-xs text-amber-600 mt-1.5">
            {needsReviewCount} account{needsReviewCount !== 1 ? 's' : ''} still need review
          </p>
        )}
      </div>

      {unmatchedCount === 0 && rows.length > 0 && (
        <div
          className="flex items-center justify-between gap-4 rounded-lg px-4 py-3"
          style={{ background: 'var(--success-100)', border: '1px solid var(--success-600)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--success-700)' }}>
            All {rows.length} accounts mapped. Ready to proceed.
          </p>
          <Button
            variant="primary"
            size="md"
            loading={confirming}
            onClick={handleConfirm}
          >
            Confirm &amp; Continue
          </Button>
        </div>
      )}

      {/* ── Similar suggestion banner — item 74 ───────────────────── */}
      {suggestion && (
        <SimilarSuggestionBanner
          suggestion={suggestion}
          onApply={applySuggestion}
          onDismiss={() => setSuggestion(null)}
        />
      )}

      {/* ── Top bar: tabs + search ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* item 73: tabs with counts */}
        <div
          className="flex items-center rounded-md p-0.5 gap-0.5"
          style={{ background: 'var(--surface-sunken)' }}
        >
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as FilterTab)}
              aria-pressed={activeTab === t.id}
              className={[
                'h-7 px-3 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
                activeTab === t.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${
                  activeTab === t.id
                    ? t.id === 'unmatched' ? 'bg-red-100 text-red-700'
                      : t.id === 'review' ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* item 73: live search input */}
        <div className="relative flex-1 max-w-[280px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search account name…"
            className="h-8 w-full rounded border bg-white pl-8 pr-3 text-xs outline-none focus:ring-1"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--ink-700)',
            }}
            aria-label="Search accounts"
          />
        </div>
      </div>

      {/* ── Mapping table ──────────────────────────────────────────── */}
      <div
        className="card overflow-auto"
        style={{ maxHeight: 540 }}
        role="grid"
        aria-label="Account mapping table"
        aria-rowcount={filteredRows.length + 1}
      >
        <table className="fin-table w-full text-xs" style={{ minWidth: 780 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <th className={`${thCls} w-8 text-center`}>#</th>
              <th className={thCls} style={{ width: '28%' }}>Your Account Name</th>
              <th className={thCls} style={{ width: '34%' }}>NFRS Category</th>
              <th className={`${thCls} w-16 text-center`}>Confidence</th>
              <th className={`${thCls} w-20`}>Method</th>
              <th className={`${thCls} w-24 text-right`}>Closing Balance</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                  {search
                    ? `No accounts match "${search}".`
                    : activeTab === 'review'
                    ? '✓ All accounts reviewed — no items need attention.'
                    : activeTab === 'unmatched'
                    ? '✓ All accounts are classified.'
                    : 'No accounts in this category.'}
                </td>
              </tr>
            ) : (
              groupedRows.map(([groupName, groupRows]) => {
                const unmappedInGroup = groupRows.filter(isUnmappedRow).length;
                let rowCounter = 0;

                return (
                  <React.Fragment key={groupName}>
                    <tr className="row-section-head">
                      <td colSpan={6}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: 'var(--brand-700)' }}>{groupName}</span>
                          {unmappedInGroup > 0 && (
                            <select
                              defaultValue=""
                              onChange={e => {
                                const category = e.target.value as NFRSCategory;
                                if (category) {
                                  handleBulkMap(groupRows, category);
                                  e.target.value = '';
                                }
                              }}
                              className="h-7 text-xs px-2 border border-slate-300 rounded bg-white text-slate-600 outline-none focus:border-blue-500 max-w-[220px]"
                              aria-label={`Map all unmapped accounts in ${groupName}`}
                            >
                              <option value="">Map all in category…</option>
                              {CATEGORY_GROUPS.map(group => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.categories.map(cat => (
                                    <option key={cat} value={cat}>
                                      {NFRS_LABELS[cat] ?? cat}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>

                    {groupRows.map((row, i) => {
                      rowCounter += 1;
                      const isUnmatched = isUnmappedRow(row);
                      const needsReview =
                        (row.confidence ?? 0) > 0 && (row.confidence ?? 0) < 80;

                      const rowStyle: React.CSSProperties | undefined = isUnmatched
                        ? { background: 'var(--danger-100)' }
                        : needsReview
                        ? { background: 'var(--warning-100)' }
                        : undefined;

                      return (
                        <tr
                          key={row.rowIndex ?? `${groupName}-${i}`}
                          className="transition-colors"
                          style={rowStyle}
                          aria-rowindex={rowCounter + 1}
                        >
                          <td className="px-2.5 py-1.5 text-center text-[10px] text-slate-400">
                            {rowCounter}
                          </td>

                          <td
                            className="px-3 py-1.5 text-slate-700 max-w-[200px]"
                            title={row.rawLabel}
                          >
                            <span className="block truncate font-medium">{row.rawLabel}</span>
                          </td>

                          <td className="px-3 py-1.5">
                            <select
                              value={row.nfrsCategory ?? 'unclassified'}
                              onChange={e =>
                                handleCategoryChange(
                                  row,
                                  String(row.rowIndex ?? i),
                                  e.target.value as NFRSCategory,
                                )
                              }
                              className={`h-7 w-full text-xs px-2 border rounded bg-white text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer ${
                                isUnmatched ? 'border-red-300' : needsReview ? 'border-amber-300' : 'border-slate-200'
                              }`}
                              aria-label={`NFRS category for ${row.rawLabel}`}
                            >
                              <option value="unclassified">— Select category —</option>
                              {CATEGORY_GROUPS.map(group => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.categories.map(cat => (
                                    <option key={cat} value={cat}>
                                      {NFRS_LABELS[cat] ?? cat}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </td>

                          <td className="px-3 py-1.5 text-center">
                            <span
                              className="text-[11px] font-mono font-semibold"
                              style={{ color: confidenceColor(row.confidence ?? 0) }}
                            >
                              {row.confidence ?? 0}%
                            </span>
                          </td>

                          <td className="px-3 py-1.5">
                            <span className="text-[11px] text-slate-400">
                              {methodLabel(row.matchMethod)}
                            </span>
                          </td>

                          <td className="px-3 py-1.5 text-right font-mono text-[11px] amount">
                            {fmtBalance(row)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            {mappedCount} accounts mapped.{' '}
            {needsReviewCount > 0 ? `${needsReviewCount} still need review.` : 'All accounts reviewed.'}
          </p>
          {unmatchedCount > 0 && (onRerunAI || companyId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAIRematch}
              disabled={aiLoading}
            >
              {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 inline" aria-hidden="true" />}
              Re-match with AI
            </Button>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            variant="primary"
            size="md"
            disabled={unmatchedCount > 0}
            loading={confirming}
            onClick={handleConfirm}
          >
            Confirm Mappings and Continue →
          </Button>
          {unmatchedCount > 0 && (
            <p className="text-xs text-red-600">
              {unmatchedCount} account{unmatchedCount !== 1 ? 's' : ''} must be classified before continuing.
            </p>
          )}
          {needsReviewCount > 0 && unmatchedCount === 0 && (
            <p className="text-xs text-amber-600">
              {needsReviewCount} low-confidence mapping{needsReviewCount !== 1 ? 's' : ''} — verify before confirming.
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
