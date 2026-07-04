import React, { useState } from 'react';
import Button from '../ui/Button';
import InputField from '../ui/InputField';
import NumberInput from '../ui/NumberInput';
import type { YearEndAdjustments } from '../../types';

type DisallowedItem = YearEndAdjustments['disallowedForTax'][number];

interface DisallowedExpensesPanelProps {
  items: DisallowedItem[];
  onChange: (items: DisallowedItem[]) => void;
  onSave: (items: DisallowedItem[]) => Promise<void>;
}

const EMPTY_ROW = (): DisallowedItem => ({
  description: '',
  amount: 0,
  section: 'Section 21 ITA',
  side: 'expense',
  asPerBooks: 0,
});

export default function DisallowedExpensesPanel({
  items,
  onChange,
  onSave,
}: DisallowedExpensesPanelProps) {
  const [saving, setSaving] = useState(false);
  const rows = items.length > 0 ? items : [EMPTY_ROW()];

  const updateRow = (index: number, patch: Partial<DisallowedItem>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = () => onChange([...rows, EMPTY_ROW()]);

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [EMPTY_ROW()]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const valid = rows.filter((r) => r.description.trim() && r.amount > 0);
      await onSave(valid);
    } finally {
      setSaving(false);
    }
  };

  const expenseTotal = rows
    .filter((r) => (r.side ?? 'expense') !== 'income')
    .reduce((s, r) => s + (r.amount || 0), 0);
  const incomeTotal = rows
    .filter((r) => r.side === 'income')
    .reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
        Route each item to Tax Note I (income exclusions — exempt dividend, etc.) or Note II
        (expense add-backs under Section 21). Amounts sync to Disallow for Tax and Tax Notes sheets.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--surface-sunken)' }}>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-left w-24">Route</th>
              <th className="px-2 py-2 text-left w-28">As per Books</th>
              <th className="px-2 py-2 text-left w-28">Disallowed</th>
              <th className="px-2 py-2 text-left w-36">ITA Section</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <InputField
                    value={row.description}
                    onChange={(v) => updateRow(i, { description: v })}
                    placeholder="e.g. Entertainment (excess over limit)"
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    className="w-full rounded border px-2 py-1 text-xs"
                    value={row.side ?? 'expense'}
                    onChange={(e) => updateRow(i, { side: e.target.value as 'income' | 'expense' })}
                  >
                    <option value="expense">Note II (Expense)</option>
                    <option value="income">Note I (Income)</option>
                  </select>
                </td>
                <td className="px-1 py-1">
                  <NumberInput
                    value={row.asPerBooks ?? row.amount ?? 0}
                    onChange={(v) => updateRow(i, { asPerBooks: v })}
                  />
                </td>
                <td className="px-1 py-1">
                  <NumberInput
                    value={row.amount}
                    onChange={(v) => updateRow(i, { amount: v })}
                  />
                </td>
                <td className="px-1 py-1">
                  <InputField
                    value={row.section}
                    onChange={(v) => updateRow(i, { section: v })}
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <button type="button" onClick={addRow} className="text-xs text-blue-600 underline">
            + Add disallowed item
          </button>
          <span className="text-xs" style={{ color: 'var(--ink-600)' }}>
            Note II add-back: NPR {expenseTotal.toLocaleString('en-IN')}
          </span>
          <span className="text-xs" style={{ color: 'var(--ink-600)' }}>
            Note I exclusion: NPR {incomeTotal.toLocaleString('en-IN')}
          </span>
        </div>
        <Button type="button" variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Disallowed Items
        </Button>
      </div>
    </div>
  );
}
