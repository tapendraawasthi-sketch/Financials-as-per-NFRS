import React, { useMemo, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { InventoryAdjustment, MappedTBRow } from '../../types';

interface InventoryInputPanelProps {
  trialBalanceRows?: MappedTBRow[];
  initialItems?: InventoryAdjustment[];
  onSave: (items: InventoryAdjustment[]) => Promise<void> | void;
}

const INVENTORY_LINES: Array<{ category: string; label: string; tbCategory: string }> = [
  { category: 'raw_materials', label: 'Raw Materials', tbCategory: 'inventory_raw_materials' },
  { category: 'wip', label: 'Work in Progress', tbCategory: 'inventory_wip' },
  { category: 'finished_goods', label: 'Finished Goods', tbCategory: 'inventory_finished_goods' },
];

export default function InventoryInputPanel({
  trialBalanceRows = [],
  initialItems = [],
  onSave,
}: InventoryInputPanelProps) {
  const tbCostByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of trialBalanceRows) {
      if (row.isGroupRow) continue;
      map.set(String(row.nfrsCategory), (map.get(String(row.nfrsCategory)) ?? 0) + (row.closingDr ?? 0));
    }
    return map;
  }, [trialBalanceRows]);

  const [rows, setRows] = useState(() =>
    INVENTORY_LINES.map((line) => {
      const existing = initialItems.find((item) => item.category === line.category);
      const costAmount = existing?.costAmount
        ?? tbCostByCategory.get(line.tbCategory)
        ?? 0;
      return {
        category: line.category,
        label: line.label,
        costAmount,
        nrvAmount: existing?.nrvAmount ?? costAmount,
        impairmentAmount: existing?.impairmentAmount ?? Math.max(0, costAmount - (existing?.nrvAmount ?? costAmount)),
      };
    }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (category: string, key: 'costAmount' | 'nrvAmount', value: number) => {
    setRows((prev) => prev.map((row) => {
      if (row.category !== category) return row;
      const next = { ...row, [key]: value };
      next.impairmentAmount = Math.max(0, next.costAmount - next.nrvAmount);
      return next;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const items: InventoryAdjustment[] = rows
        .filter((row) => row.costAmount > 0)
        .map((row) => ({
          category: row.category,
          costAmount: row.costAmount,
          nrvAmount: row.nrvAmount,
          impairmentAmount: row.impairmentAmount,
        }));
      await onSave(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save inventory adjustments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Inventory NRV / Impairment" padding="md">
      <p className="text-xs mb-3" style={{ color: 'var(--ink-500)' }}>
        Enter net realisable value where inventory cost exceeds recoverable amount. Impairment is calculated automatically.
      </p>
      <div className="overflow-x-auto">
        <table className="fin-table w-full" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th className="text-left">Category</th>
              <th className="text-right">Cost (TB)</th>
              <th className="text-right">NRV</th>
              <th className="text-right">Impairment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category}>
                <td className="px-2 py-2 text-sm" style={{ color: 'var(--ink-700)' }}>{row.label}</td>
                <td className="px-2 py-2 amount text-sm">{row.costAmount.toLocaleString('en-IN')}</td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min={0}
                    value={row.nrvAmount || ''}
                    onChange={(e) => updateRow(row.category, 'nrvAmount', parseFloat(e.target.value) || 0)}
                    className="w-full h-8 text-xs font-mono text-right px-2 border border-[var(--border-strong)] rounded bg-[var(--surface)] outline-none focus:border-[var(--brand-500)]"
                  />
                </td>
                <td className="px-2 py-2 amount text-sm" style={{ color: 'var(--warning-700)' }}>
                  {row.impairmentAmount > 0 ? row.impairmentAmount.toLocaleString('en-IN') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end mt-4">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Inventory Adjustments
        </Button>
      </div>
    </Card>
  );
}
