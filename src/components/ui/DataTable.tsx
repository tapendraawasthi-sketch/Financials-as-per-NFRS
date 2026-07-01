// ===== src/components/ui/DataTable.tsx =====
import React from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  emptyMessage?: string;
  stickyHeader?: boolean;
  striped?: boolean;
  compact?: boolean;
  maxHeight?: string;
  onRowClick?: (row: T) => void;
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data to display.',
  stickyHeader = false,
  striped = true,
  compact = false,
  maxHeight,
  onRowClick,
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    const key = col.key as string;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const cellPadding = compact ? 'px-3 py-1.5' : 'px-4 py-3';
  const headPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table className="w-full text-sm border-collapse">
          {/* Head */}
          <thead
            className={[
              'bg-slate-50',
              stickyHeader ? 'sticky top-0 z-10' : '',
            ].join(' ')}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key as string}
                  style={col.width ? { width: col.width } : undefined}
                  className={[
                    headPadding,
                    'text-slate-600 font-medium text-xs uppercase tracking-wider border-b border-slate-200',
                    alignClass(col.align),
                    col.sortable
                      ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors'
                      : '',
                  ].join(' ')}
                  onClick={() => col.sortable && handleSort(col)}
                  aria-sort={
                    sortKey === (col.key as string)
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="opacity-40 text-slate-400">
                        {sortKey === (col.key as string) ? (
                          sortDir === 'asc' ? '↑' : '↓'
                        ) : (
                          '↕'
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-slate-400 text-sm italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, rowIdx) => {
                const rowKey = String(row[keyField] ?? rowIdx);
                const stripeClass =
                  striped && rowIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white';

                return (
                  <tr
                    key={rowKey}
                    className={[
                      stripeClass,
                      onRowClick
                        ? 'cursor-pointer hover:bg-blue-50 transition-colors'
                        : '',
                    ].join(' ')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => {
                      const rawValue = row[col.key as string];
                      const cell = col.render
                        ? col.render(rawValue, row, rowIdx)
                        : rawValue !== null && rawValue !== undefined
                        ? String(rawValue)
                        : '–';

                      return (
                        <td
                          key={col.key as string}
                          className={[
                            cellPadding,
                            'text-slate-700',
                            alignClass(col.align),
                          ].join(' ')}
                        >
                          {cell as React.ReactNode}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
