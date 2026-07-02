// src/components/company/AccountingPoliciesForm.tsx
import React, { useState } from 'react';
import Card           from '../ui/Card';
import Alert          from '../ui/Alert';
import SelectDropdown from '../ui/SelectDropdown';
import NumberInput    from '../ui/NumberInput';
import Button         from '../ui/Button';
import { useToast }   from '../ui/Toast';
import { AccountingPolicies } from '../../types/company';

// ── Asset category defaults ────────────────────────────────────────────────
interface AssetCategoryRow {
  id:          string;
  name:        string;
  usefulLife:  number;
  residualPct: number;
  method:      'SLM' | 'WDV';
  wdvRate:     number;
  noDepn:      boolean;
}

const DEFAULTS: AssetCategoryRow[] = [
  { id: 'land',       name: 'Land',                noDepn: true,  usefulLife: 0,  residualPct: 100, method: 'SLM', wdvRate: 0  },
  { id: 'buildings',  name: 'Buildings',            noDepn: false, usefulLife: 40, residualPct: 5,   method: 'SLM', wdvRate: 5  },
  { id: 'vehicles',   name: 'Vehicles',             noDepn: false, usefulLife: 5,  residualPct: 10,  method: 'WDV', wdvRate: 25 },
  { id: 'computers',  name: 'Computers',            noDepn: false, usefulLife: 5,  residualPct: 0,   method: 'SLM', wdvRate: 25 },
  { id: 'office_eq',  name: 'Office Equipment',     noDepn: false, usefulLife: 10, residualPct: 5,   method: 'WDV', wdvRate: 15 },
  { id: 'furniture',  name: 'Furniture & Fixtures', noDepn: false, usefulLife: 10, residualPct: 5,   method: 'WDV', wdvRate: 15 },
  { id: 'plant',      name: 'Plant & Machinery',    noDepn: false, usefulLife: 15, residualPct: 5,   method: 'WDV', wdvRate: 20 },
  { id: 'intangible', name: 'Intangible Assets',    noDepn: false, usefulLife: 5,  residualPct: 0,   method: 'SLM', wdvRate: 0  },
];

// item 55: Rounding options with explanatory description
const ROUNDING_OPTIONS = [
  { value: '1',     label: '1 — Exact (no rounding)' },
  { value: '10',    label: '10 — Nearest ten' },
  { value: '100',   label: '100 — Nearest hundred (recommended for small companies)' },
  { value: '1000',  label: '1,000 — Nearest thousand (medium companies)' },
  { value: '10000', label: '10,000 — Nearest ten-thousand (large companies)' },
];

const INVENTORY_OPTIONS = [
  { value: 'WeightedAverage', label: 'Weighted Average Cost' },
  { value: 'FIFO',            label: 'FIFO (First-In First-Out)' },
];

// ── Radio Card — item 54 ──────────────────────────────────────────────────
interface DeprecMethodCardProps {
  value:       'SLM' | 'WDV';
  selected:    boolean;
  onSelect:    (v: 'SLM' | 'WDV') => void;
  title:       string;
  description: string;
  detail:      string;
}

function DeprecMethodCard({
  value, selected, onSelect, title, description, detail,
}: DeprecMethodCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={[
        'flex items-start gap-3 w-full rounded-lg border-2 px-4 py-3.5 text-left transition-all duration-150',
        selected
          ? 'border-blue-600 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {/* Radio indicator */}
      <span
        className={[
          'mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
          selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white',
        ].join(' ')}
      >
        {selected && (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        )}
      </span>

      <div className="min-w-0">
        <p className={`text-sm font-semibold leading-tight ${selected ? 'text-blue-800' : 'text-slate-700'}`}>
          {title}
        </p>
        <p className={`text-xs mt-0.5 leading-snug ${selected ? 'text-blue-600' : 'text-slate-500'}`}>
          {description}
        </p>
        <p className={`text-[11px] mt-1 leading-snug ${selected ? 'text-blue-500' : 'text-slate-400'}`}>
          {detail}
        </p>
      </div>

      {selected && (
        <span className="ml-auto flex-shrink-0 mt-0.5">
          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
    </button>
  );
}

// ── Tiny inline cell input ─────────────────────────────────────────────────
const CellInput = ({
  value, onChange, disabled = false, min, max,
}: {
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) => (
  <input
    type="number"
    value={value}
    disabled={disabled}
    min={min}
    max={max}
    onChange={e => onChange(e.target.value)}
    className={[
      'h-7 w-full rounded border text-xs text-right px-1.5 outline-none transition-colors duration-150',
      disabled
        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
        : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    ].join(' ')}
  />
);

const CellSelect = ({
  value, onChange, options, disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) => (
  <select
    value={value}
    disabled={disabled}
    onChange={e => onChange(e.target.value)}
    className={[
      'h-7 w-full rounded border text-xs px-1 outline-none transition-colors duration-150 appearance-none',
      disabled
        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
        : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500 cursor-pointer',
    ].join(' ')}
  >
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

// ── Component ──────────────────────────────────────────────────────────────
interface FormState {
  defaultDepnMethod: 'SLM' | 'WDV';
  inventoryMethod:   string;
  recognizeGratuity: boolean;
  gratuityDays:      number;
  recognizeLeave:    boolean;
  bonusRate:         number | '';
  taxRate:           number | '';
  roundingLevel:     string;
  categories:        AssetCategoryRow[];
}

interface AccountingPoliciesFormProps {
  initialData?: Partial<AccountingPolicies>;
  onSave:       (data: FormState) => Promise<void> | void;
}

function buildInitial(d?: Partial<AccountingPolicies>): Partial<FormState> {
  if (!d) return {};
  return {
    defaultDepnMethod: d.depreciationMethod as 'SLM' | 'WDV' | undefined,
    inventoryMethod:   d.inventoryCostMethod,
    recognizeGratuity: d.recognizeGratuity,
    gratuityDays:      d.gratuityDaysPerYear,
    recognizeLeave:    d.recognizeLeaveEncashment,
    bonusRate:         d.bonusRatePercent,
    taxRate:           d.incomeTaxRatePercent,
    roundingLevel:     String(d.roundingLevel ?? 100),
  };
}

export default function AccountingPoliciesForm({
  initialData,
  onSave,
}: AccountingPoliciesFormProps) {
  const [form, setForm] = useState<FormState>({
    defaultDepnMethod: 'WDV',
    inventoryMethod:   'WeightedAverage',
    recognizeGratuity: true,
    gratuityDays:      15,
    recognizeLeave:    true,
    bonusRate:         10,
    taxRate:           25,
    roundingLevel:     '100',
    categories:        DEFAULTS.map(d => ({ ...d })),
    ...buildInitial(initialData),
  });

  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const { show } = useToast();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setCategory = (idx: number, key: keyof AssetCategoryRow, value: any) =>
    setForm(prev => {
      const cats = prev.categories.map((c, i) =>
        i === idx ? { ...c, [key]: value } : c
      );
      return { ...prev, categories: cats };
    });

  const restoreDefaults = () =>
    setForm(prev => ({ ...prev, categories: DEFAULTS.map(d => ({ ...d })) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      await onSave(form);
      show('Accounting policies saved.', 'success', 2500);
    } catch (err: any) {
      setSaveErr(err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="max-w-3xl space-y-5"
      aria-label="Accounting policies"
    >
      {/* ── item 53: prominent info banner ─────────────── */}
      <Alert
        type="info"
        title="Important"
        message="These settings apply to all financial statements. If you change them after generating statements, you must regenerate the output."
        className="border-l-4 border-l-blue-500"
      />

      {/* ── Card 1: Depreciation Policy ─────────────────── */}
      <Card title="Depreciation Policy" padding="md">
        {/* item 54: radio card pattern for depreciation method */}
        <p className="text-[13px] font-medium text-slate-700 mb-3">Default Depreciation Method</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <DeprecMethodCard
            value="WDV"
            selected={form.defaultDepnMethod === 'WDV'}
            onSelect={v => set('defaultDepnMethod', v)}
            title="Written-Down Value (WDV)"
            description="Depreciates a fixed percentage of the remaining book value each year."
            detail="Most common in Nepal — higher depreciation in early years. Nepal Income Tax Act pools use WDV."
          />
          <DeprecMethodCard
            value="SLM"
            selected={form.defaultDepnMethod === 'SLM'}
            onSelect={v => set('defaultDepnMethod', v)}
            title="Straight-Line Method (SLM)"
            description="Depreciates an equal amount each year over the asset's useful life."
            detail="Used for buildings and assets with predictable, uniform wear patterns."
          />
        </div>

        <p className="text-[13px] font-medium text-slate-700 mb-2">Per-Category Overrides</p>
        <div className="overflow-x-auto">
          <table className="fin-table w-full">
            <thead>
              <tr>
                <th className="text-left w-40">Asset Class</th>
                <th className="text-right w-24">Useful Life (yrs)</th>
                <th className="text-right w-28">Residual Value %</th>
                <th className="text-center w-28">Method</th>
                <th className="text-right w-24">WDV Rate %</th>
              </tr>
            </thead>
            <tbody>
              {form.categories.map((cat, idx) => (
                <tr key={cat.id} className={cat.noDepn ? 'opacity-50' : ''}>
                  <td className="text-slate-700 text-xs font-medium">{cat.name}</td>
                  <td className="text-right">
                    <CellInput
                      value={cat.noDepn ? '' : cat.usefulLife}
                      onChange={v => setCategory(idx, 'usefulLife', parseInt(v) || 0)}
                      disabled={cat.noDepn}
                      min={1} max={100}
                    />
                  </td>
                  <td className="text-right">
                    <CellInput
                      value={cat.noDepn ? '' : cat.residualPct}
                      onChange={v => setCategory(idx, 'residualPct', parseFloat(v) || 0)}
                      disabled={cat.noDepn}
                      min={0} max={100}
                    />
                  </td>
                  <td>
                    <CellSelect
                      value={cat.method}
                      onChange={v => setCategory(idx, 'method', v)}
                      disabled={cat.noDepn}
                      options={[
                        { value: 'SLM', label: 'SLM' },
                        { value: 'WDV', label: 'WDV' },
                      ]}
                    />
                  </td>
                  <td className="text-right">
                    <CellInput
                      value={cat.noDepn || cat.method !== 'WDV' ? '' : cat.wdvRate}
                      onChange={v => setCategory(idx, 'wdvRate', parseFloat(v) || 0)}
                      disabled={cat.noDepn || cat.method !== 'WDV'}
                      min={0} max={100}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={restoreDefaults}
            className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            Restore Defaults
          </button>
        </div>
      </Card>

      {/* ── Card 2: Inventory ─────────────────────────── */}
      <Card title="Inventory Costing" padding="md">
        <div className="grid grid-cols-2 gap-4">
          <SelectDropdown
            label="Cost Formula"
            value={form.inventoryMethod}
            onChange={e => set('inventoryMethod', e.target.value)}
            options={INVENTORY_OPTIONS}
            helperText="Applies to all inventory valuation under NAS for MEs §11"
          />
          <div />
        </div>
      </Card>

      {/* ── Card 3: Employee Benefits ─────────────────── */}
      <Card title="Employee Benefits" padding="md">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.recognizeGratuity}
                onChange={e => set('recognizeGratuity', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[13px] font-medium text-slate-700">
                Recognize Gratuity Provision
              </span>
            </label>
            {form.recognizeGratuity && (
              <NumberInput
                label="Days per year of service"
                value={form.gratuityDays}
                onChange={v => set('gratuityDays', v)}
                suffix="days"
                min={1} max={365}
                helperText="Labour Act 2074: 15 days/year (minimum)"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.recognizeLeave}
                onChange={e => set('recognizeLeave', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[13px] font-medium text-slate-700">
                Recognize Leave Encashment
              </span>
            </label>
          </div>

          <NumberInput
            label="Staff Bonus Rate"
            value={form.bonusRate}
            onChange={v => set('bonusRate', v)}
            suffix="% of net profit"
            placeholder="10"
            min={0} max={100}
            helperText="Nepal Bonus Act 2030: 10% of net profit before tax"
          />
        </div>
      </Card>

      {/* ── Card 4: Income Tax ────────────────────────── */}
      <Card title="Income Tax" padding="md">
        <div className="grid grid-cols-3 gap-4">
          <NumberInput
            label="Corporate Tax Rate"
            value={form.taxRate}
            onChange={v => set('taxRate', v)}
            suffix="%"
            min={0} max={100}
            helperText="Standard rate per Nepal Income Tax Act 2058: 25%"
          />
          <div />
          <div />
        </div>
      </Card>

      {/* ── Card 5: Presentation ──────────────────────── */}
      {/* item 55: rounding explanation */}
      <Card title="Presentation & Rounding" padding="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-slate-700 leading-none">
              Currency
            </label>
            <input
              type="text"
              value="NPR — Nepalese Rupees"
              disabled
              className="h-9 w-full rounded border border-slate-200 px-2.5 text-sm text-slate-400 bg-slate-50 cursor-not-allowed outline-none"
            />
          </div>

          <div>
            <SelectDropdown
              label="Rounding Level"
              value={form.roundingLevel}
              onChange={e => set('roundingLevel', e.target.value)}
              options={ROUNDING_OPTIONS}
            />
            {/* item 55: persistent explanation note below the dropdown */}
            <p className="text-xs text-slate-400 mt-2 leading-snug">
              All amounts in the output Excel will be rounded to this level.
              NPR 100 is recommended for small companies; NPR 1,000 for medium companies.
              This does not affect calculation accuracy — only the displayed values.
            </p>
          </div>
        </div>
      </Card>

      {/* Save error */}
      {saveErr && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          <svg className="h-4 w-4 flex-shrink-0 text-red-500" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9"  y1="9" x2="15" y2="15" />
          </svg>
          {saveErr}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-slate-400">
          Asset category rates can be overridden per-asset in the Fixed Asset Register.
        </p>
        <Button type="submit" variant="primary" size="md" loading={saving}>
          Save and Continue
        </Button>
      </div>
    </form>
  );
}
