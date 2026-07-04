// src/components/ui/DataTable.tsx
import React, { useState } from 'react';
import { ChevronUp, ChevronDown, AlertCircle, AlertTriangle } from 'lucide-react';

interface Column<T> {
  key:       string;
  header:    string;
  render?:   (value: any, row: T, index: number) => React.ReactNode;
  align?:    'left' | 'center' | 'right';
  width?:    string;
  sortable?: boolean;
  mono?:     boolean;
  numeric?:  boolean;
}

interface DataTableProps<T extends Record<string, any>> {
  columns:       Column<T>[];
  data:          T[];
  keyField:      string;
  emptyMessage?: string;
  maxHeight?:    string;
  compact?:      boolean;
  onRowClick?:   (row: T) => void;
  footer?:       React.ReactNode;
  className?:    string;
  getRowStatus?: (row: T) => 'error' | 'warning' | undefined;
}

function isZeroValue(val: unknown): boolean {
  if (val === 0 || val === '0') return true;
  if (typeof val === 'string' && val.replace(/[,.\s]/g, '') === '0') return true;
  return false;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data',
  maxHeight,
  compact      = false,
  onRowClick,
  footer,
  className    = '',
  getRowStatus,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hoveredKey, setHoveredKey] = useState<string | number | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const cellPad = compact ? 'px-3 py-1.5' : 'px-3 py-2';

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    const active = sortKey === col.key;
    const color = active ? 'var(--brand-500)' : 'var(--ink-400)';
    if (!active) return <ChevronUp size={12} style={{ color, opacity: 0.35 }} aria-hidden="true" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ color }} aria-hidden="true" />
      : <ChevronDown size={12} style={{ color }} aria-hidden="true" />;
  };

  const renderCellContent = (col: Column<T>, val: unknown, row: T, i: number) => {
    if (col.render) return col.render(val, row, i);
    const isNumeric = col.numeric || col.mono || col.align === 'right';
    if (isNumeric && isZeroValue(val)) {
      return <span className="amount-zero num">0</span>;
    }
    if (isNumeric && typeof val === 'number') {
      return <span className="num">{val}</span>;
    }
    return val ?? '—';
  };

  return (
    <div
      className={`overflow-hidden card ${maxHeight ? 'flex flex-col' : ''} ${className}`}
    >
      <div
        className={maxHeight ? 'overflow-y-auto relative' : 'overflow-x-auto'}
        style={maxHeight ? { maxHeight } : {}}
      >
        <table className="w-full border-collapse" role="grid" style={{ fontSize: 'var(--text-base)' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  style={{
                    ...(col.width ? { width: col.width } : {}),
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    background: 'var(--surface-sunken)',
                    color: 'var(--ink-600)',
                    fontWeight: 700,
                    fontSize: 'var(--text-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    borderBottom: '1px solid var(--border-strong)',
                  }}
                  className={[
                    cellPad,
                    'whitespace-nowrap',
                    alignClass(col.align),
                    col.sortable ? 'cursor-pointer select-none' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    col.sortable && sortKey === col.key
                      ? sortDir === 'asc' ? 'ascending' : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12"
                  style={{ color: 'var(--ink-400)', fontSize: 'var(--text-sm)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => {
                const rowKey = row[keyField] ?? i;
                const rowStatus = getRowStatus?.(row);
                const isHovered = hoveredKey === rowKey;

                return (
                  <tr
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } }
                        : undefined
                    }
                    onMouseEnter={() => setHoveredKey(rowKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                    className={onRowClick ? 'cursor-pointer datatable-row-interactive focus-visible:outline-none' : ''}
                    style={{
                      borderLeft: rowStatus === 'error'
                        ? '3px solid var(--danger-600)'
                        : rowStatus === 'warning'
                        ? '3px solid var(--warning-600)'
                        : '3px solid transparent',
                      background: isHovered ? 'var(--surface-hover)' : 'transparent',
                      transition: 'background var(--dur-fast) var(--ease-premium)',
                    }}
                  >
                    {columns.map((col, colIdx) => {
                      const val = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={[
                            cellPad,
                            alignClass(col.align),
                            col.mono || col.numeric ? 'num font-mono' : '',
                          ].filter(Boolean).join(' ')}
                          style={{
                            fontSize: 'var(--text-base)',
                            color: 'var(--ink-700)',
                            borderBottom: '1px solid var(--border-hairline)',
                            verticalAlign: 'middle',
                          }}
                        >
                          {colIdx === 0 && rowStatus ? (
                            <span className="inline-flex items-center gap-2">
                              {rowStatus === 'error' ? (
                                <AlertCircle size={13} style={{ color: 'var(--danger-600)', flexShrink: 0 }} aria-hidden="true" />
                              ) : (
                                <AlertTriangle size={13} style={{ color: 'var(--warning-600)', flexShrink: 0 }} aria-hidden="true" />
                              )}
                              {renderCellContent(col, val, row, i)}
                            </span>
                          ) : (
                            renderCellContent(col, val, row, i)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {footer && (
            <tfoot>
              <tr
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 2,
                  background: 'var(--surface-sunken)',
                  borderTop: '1px solid var(--border-strong)',
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                }}
              >
                {footer}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
