// src/components/ui/DataTable.tsx
import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface Column<T> {
  key:       string;
  header:    string;
  render?:   (value: any, row: T, index: number) => React.ReactNode;
  align?:    'left' | 'center' | 'right';
  width?:    string;
  sortable?: boolean;
  mono?:     boolean;
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
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
    if (sortKey !== col.key) return <ChevronsUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} />
      : <ChevronDown size={12} />;
  };

  return (
    <div
      className={`overflow-hidden ${maxHeight ? 'flex flex-col' : ''} ${className}`}
      style={{ border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div className={maxHeight ? 'overflow-y-auto' : ''} style={maxHeight ? { maxHeight } : {}}>
        <table className="w-full text-xs border-collapse" role="grid">
          <thead>
            <tr style={{ background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', borderBottom: '2px solid #e2e8f0' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : {}}
                  className={[
                    cellPad,
                    'font-bold text-slate-500 uppercase tracking-[0.06em] whitespace-nowrap',
                    alignClass(col.align),
                    col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ fontSize: '11px' }}
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
                <td colSpan={columns.length} className="text-center py-12 text-slate-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={row[keyField] ?? i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } }
                      : undefined
                  }
                  className={[
                    'border-b border-slate-100 last:border-0 transition-colors',
                    onRowClick
                      ? 'cursor-pointer hover:bg-blue-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600'
                      : 'hover:bg-slate-50/70',
                    i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
                  ].filter(Boolean).join(' ')}
                >
                  {columns.map(col => {
                    const val = row[col.key];
                    return (
                      <td
                        key={col.key}
                        className={[
                          cellPad,
                          'text-slate-700',
                          alignClass(col.align),
                          col.mono ? 'font-mono tabular-nums' : '',
                        ].filter(Boolean).join(' ')}
                        style={{ fontSize: '12.5px' }}
                      >
                        {col.render ? col.render(val, row, i) : val ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>

          {footer && (
            <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
              {footer}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
