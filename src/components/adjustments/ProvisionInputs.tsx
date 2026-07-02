// src/components/adjustments/ProvisionInputs.tsx
import React, { useState } from 'react';
import Card   from '../ui/Card';
import Button from '../ui/Button';

interface ProvisionRow {
  id:             string;
  type:           string;
  openingBalance: number;
  addition:       number;
  utilised:       number;
  reversed:       number;
  classification: 'Current' | 'Non-current';
  editable:       boolean; // false = standard, true = custom row
}

interface ProvisionInputsProps {
  onSave:          (rows: ProvisionRow[]) => Promise<void> | void;
  initialData?:    Partial<Record<string, number>>;
  roundingLevel?:  number;
}

const DEFAULT_ROWS: Omit<ProvisionRow, 'addition' | 'utilised' | 'reversed'>[] = [
  { id: 'gratuity',   type: 'Gratuity Provision',          openingBalance: 0, classification: 'Non-current', editable: false },
  { id: 'leave',      type: 'Leave Encashment',            openingBalance: 0, classification: 'Current',     editable: false },
  { id: 'bonus',      type: 'Staff Bonus Payable',         openingBalance: 0, classification: 'Current',     editable: false },
  { id: 'audit',      type: 'Audit Fee Payable',           openingBalance: 0, classification: 'Current',     editable: false },
  { id: 'doubtful',   type: 'Provision for Doubtful Debts',openingBalance: 0, classification: 'Current',     editable: false },
];

function initRows(data?: Partial<Record<string, number>>): ProvisionRow[] {
  return DEFAULT_ROWS.map(r => ({
    ...r,
    addition:  0,
    utilised:  0,
    reversed:  0,
    openingBalance: data?.[r.id] ?? 0,
  }));
}

let customId = 1;

export default function ProvisionInputs({
  onSave,
  initialData,
  roundingLevel = 100,
}: ProvisionInputsProps) {
  const [rows,   setRows]   = useState<ProvisionRow[]>(initRows(initialData));
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const update = (id: string, key: keyof ProvisionRow, value: any) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));

  const addCustom = () =>
    setRows(prev => [
      ...prev,
      {
        id:             `custom-${customId++}`,
        type:           'Other Provision',
        openingBalance: 0,
        addition:       0,
        utilised:       0,
        reversed:       0,
        classification: 'Current',
        editable:       true,
      },
    ]);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(rows);
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const numIn = (
    id:    string,
    key:   'addition' | 'utilised' | 'reversed',
    value: number
  ) => (
    <input
      type="number"
      value={value || ''}
      min={0}
      onChange={e => update(id, key, parseFloat(e.target.value) || 0)}
      className="w-full h-6 text-xs font-mono text-right px-1 border border-slate-200 rounded bg-white outline-none focus:border-blue-500 transition-colors"
      aria-label={key}
    />
  );

  function closing(r: ProvisionRow): number {
    return r.openingBalance + r.addition - r.utilised - r.reversed;
  }

  function fmtN(n: number): string {
    if (n === 0) return '—';
    const abs = Math.abs(n);
    return (n < 0 ? '(' : '') +
      abs.toLocaleString('en-IN') +
      (n < 0 ? ')' : '');
  }

  return (
    <Card title="Year-End Provisions" padding="md">
      <div className="overflow-x-auto">
        <table className="fin-table w-full" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th className="text-left w-48">Provision Type</th>
              <th className="text-right w-32">Opening Balance</th>
              <th className="text-right w-32">Addition for Year</th>
              <th className="text-right w-28">Utilised</th>
              <th className="text-right w-28">Reversed</th>
              <th className="text-right w-32">Closing Balance</th>
              <th className="text-center w-28">Current / Non-Current</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(row => {
              const cl = closing(row);
              return (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 h-8">
                  {/* Provision type — editable for custom rows */}
                  <td className="px-2.5">
                    {row.editable ? (
                      <input
                        type="text"
                        value={row.type}
                        onChange={e => update(row.id, 'type', e.target.value)}
                        className="w-full h-6 text-xs px-1 border-0 border-b border-slate-200 bg-transparent outline-none focus:border-blue-400"
                        aria-label="Provision type name"
                      />
                    ) : (
                      <span className="text-xs text-slate-700">{row.type}</span>
                    )}
                  </td>

                  {/* Opening — readonly */}
                  <td className="px-2.5 text-right font-mono text-xs text-slate-500">
                    {fmtN(row.openingBalance)}
                  </td>

                  {/* Addition */}
                  <td className="px-1">{numIn(row.id, 'addition', row.addition)}</td>

                  {/* Utilised */}
                  <td className="px-1">{numIn(row.id, 'utilised', row.utilised)}</td>

                  {/* Reversed */}
                  <td className="px-1">{numIn(row.id, 'reversed', row.reversed)}</td>

                  {/* Closing — computed */}
                  <td className={`px-2.5 text-right font-mono text-xs font-bold ${cl < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {fmtN(cl)}
                  </td>

                  {/* Classification */}
                  <td className="px-1">
                    <select
                      value={row.classification}
                      onChange={e => update(row.id, 'classification', e.target.value as 'Current' | 'Non-current')}
                      className="h-6 w-full text-xs px-1 border border-slate-200 rounded bg-white outline-none focus:border-blue-400"
                      aria-label="Classification"
                    >
                      <option value="Current">Current</option>
                      <option value="Non-current">Non-current</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-2">
        Provisions reduce profit and create liabilities. Closing balance feeds into the balance sheet.
      </p>

      {err && (
        <p className="text-xs text-red-600 mt-1" role="alert">{err}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={addCustom}
          className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
        >
          Add Custom Provision
        </button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Provisions
        </Button>
      </div>
    </Card>
  );
}
