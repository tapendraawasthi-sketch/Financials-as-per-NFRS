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
  editable:       boolean;
  // item 85: applicable toggle
  applicable:     boolean;
}

interface ProvisionInputsProps {
  onSave:         (rows: ProvisionRow[]) => Promise<void> | void;
  initialData?:   Partial<Record<string, number>>;
  roundingLevel?: number;
}

// item 84: statutory basis tooltips per provision type
const PROVISION_TOOLTIPS: Record<string, string> = {
  'Gratuity Provision':
    'Nepal Labour Act 2074 (Section 52): Employees are entitled to one month\'s salary for each year of service after completing one year. Provision = (Last monthly salary × Years of service) / 12 × 15 days.',
  'Leave Encashment':
    'Nepal Labour Act 2074: Employees are entitled to 18 days of paid leave per year. Accumulated unused leave is encashable. Provision = (Daily salary × Unused leave days).',
  'Staff Bonus Payable':
    'Nepal Bonus Act 2030: Companies must distribute 10% of net profit before tax as employee bonus. Provision = Net Profit before tax × 10%.',
  'Audit Fee Payable':
    'Accrual accounting (NAS for MEs §2.4): Audit fees for the current period must be accrued even if the invoice has not been received by year-end.',
  'Provision for Doubtful Debts':
    'NAS for MEs §11: Trade receivables must be assessed for impairment. Provision is made for receivables where recovery is doubtful based on debtor ageing and collection history.',
};

const DEFAULT_ROWS: Omit<ProvisionRow, 'addition' | 'utilised' | 'reversed'>[] = [
  { id: 'gratuity',  type: 'Gratuity Provision',           openingBalance: 0, classification: 'Non-current', editable: false, applicable: true  },
  { id: 'leave',     type: 'Leave Encashment',             openingBalance: 0, classification: 'Current',     editable: false, applicable: true  },
  { id: 'bonus',     type: 'Staff Bonus Payable',          openingBalance: 0, classification: 'Current',     editable: false, applicable: true  },
  { id: 'audit',     type: 'Audit Fee Payable',            openingBalance: 0, classification: 'Current',     editable: false, applicable: true  },
  { id: 'doubtful',  type: 'Provision for Doubtful Debts', openingBalance: 0, classification: 'Current',     editable: false, applicable: false },
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

// ── Tooltip icon ──────────────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="h-4 w-4 rounded-full bg-slate-200 text-slate-500 hover:bg-blue-100 hover:text-blue-600 flex items-center justify-center text-[10px] font-bold transition-colors ml-1"
        aria-label="More information"
      >
        ?
      </button>
      {visible && (
        <span
          className="absolute left-5 top-0 z-50 w-64 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-xl pointer-events-none"
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}

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
        applicable:     true,
      },
    ]);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(rows.filter(r => r.applicable));
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const numIn = (id: string, key: 'addition' | 'utilised' | 'reversed', value: number) => (
    <input
      type="number"
      value={value || ''}
      min={0}
      onChange={e => update(id, key, parseFloat(e.target.value) || 0)}
      className="w-full h-7 text-xs font-mono text-right px-1.5 border border-slate-200 rounded bg-white outline-none focus:border-blue-500 transition-colors disabled:bg-slate-50 disabled:text-slate-300"
      aria-label={key}
    />
  );

  function closing(r: ProvisionRow): number {
    return r.openingBalance + r.addition - r.utilised - r.reversed;
  }

  function fmtN(n: number): string {
    if (n === 0) return '—';
    const abs = Math.abs(n);
    return (n < 0 ? '(' : '') + abs.toLocaleString('en-IN') + (n < 0 ? ')' : '');
  }

  return (
    <Card title="Year-End Provisions" padding="md">
      <div className="overflow-x-auto">
        <table className="fin-table w-full" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              {/* item 85: "Applicable" column header */}
              <th className="text-center w-24">Applicable</th>
              <th className="text-left w-52">Provision Type</th>
              <th className="text-right w-32">Opening Balance</th>
              <th className="text-right w-32">Addition for Year</th>
              <th className="text-right w-28">Utilised</th>
              <th className="text-right w-28">Reversed</th>
              <th className="text-right w-32">Closing Balance</th>
              <th className="text-center w-28">Classification</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(row => {
              const cl = closing(row);
              const tooltip = PROVISION_TOOLTIPS[row.type];
              return (
                <tr key={row.id}
                  className={`border-b border-slate-100 last:border-0 h-9 ${
                    !row.applicable ? 'opacity-40' : ''
                  }`}>

                  {/* item 85: toggle with "Applicable / Not Applicable" state label */}
                  <td className="px-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.applicable}
                        onClick={() => update(row.id, 'applicable', !row.applicable)}
                        className={[
                          'relative w-8 h-4 rounded-full cursor-pointer transition-colors duration-200',
                          row.applicable ? 'bg-blue-600' : 'bg-slate-300',
                        ].join(' ')}
                      >
                        <span className={[
                          'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200',
                          row.applicable ? 'translate-x-4' : 'translate-x-0.5',
                        ].join(' ')} />
                      </button>
                      {/* item 85: adjacent state label */}
                      <span className={`text-[9px] font-medium leading-none ${
                        row.applicable ? 'text-blue-600' : 'text-slate-400'
                      }`}>
                        {row.applicable ? 'Applicable' : 'Not applicable'}
                      </span>
                    </div>
                  </td>

                  {/* Provision type + item 84: tooltip info icon */}
                  <td className="px-2.5">
                    <div className="flex items-center gap-0.5">
                      {row.editable ? (
                        <input
                          type="text"
                          value={row.type}
                          onChange={e => update(row.id, 'type', e.target.value)}
                          className="flex-1 h-6 text-xs px-1 border-0 border-b border-slate-200 bg-transparent outline-none focus:border-blue-400"
                          aria-label="Provision type name"
                        />
                      ) : (
                        <span className="text-xs text-slate-700">{row.type}</span>
                      )}
                      {tooltip && !row.editable && (
                        <InfoTooltip text={tooltip} />
                      )}
                    </div>
                  </td>

                  {/* Opening — readonly */}
                  <td className="px-2.5 text-right font-mono text-xs text-slate-500">
                    {fmtN(row.openingBalance)}
                  </td>

                  {/* Addition */}
                  <td className="px-1">{row.applicable ? numIn(row.id, 'addition', row.addition) : <span className="text-slate-300 text-xs px-1">—</span>}</td>

                  {/* Utilised */}
                  <td className="px-1">{row.applicable ? numIn(row.id, 'utilised', row.utilised) : <span className="text-slate-300 text-xs px-1">—</span>}</td>

                  {/* Reversed */}
                  <td className="px-1">{row.applicable ? numIn(row.id, 'reversed', row.reversed) : <span className="text-slate-300 text-xs px-1">—</span>}</td>

                  {/* Closing */}
                  <td className={`px-2.5 text-right font-mono text-xs font-bold ${cl < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {row.applicable ? fmtN(cl) : '—'}
                  </td>

                  {/* Classification */}
                  <td className="px-1">
                    <select
                      value={row.classification}
                      onChange={e => update(row.id, 'classification', e.target.value as 'Current' | 'Non-current')}
                      disabled={!row.applicable}
                      className="h-6 w-full text-xs px-1 border border-slate-200 rounded bg-white outline-none focus:border-blue-400 disabled:opacity-40"
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

      <p className="text-xs text-slate-500 mt-3">
        Only "Applicable" provisions are included in the financial statements. Closing balance = Opening + Addition − Utilised − Reversed.
      </p>

      {err && <p className="text-xs text-red-600 mt-1" role="alert">{err}</p>}

      <div className="flex items-center justify-between mt-4">
        <button type="button" onClick={addCustom}
          className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors">
          + Add Custom Provision
        </button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Provisions
        </Button>
      </div>
    </Card>
  );
}
