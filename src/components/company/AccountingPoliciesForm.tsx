// ===== src/components/company/AccountingPoliciesForm.tsx =====
import React, { useState } from 'react';
import type { AccountingPolicies } from '../../types';
import { validateAccountingPolicies } from '../../utils/validation';
import Button from '../ui/Button';
import Card from '../ui/Card';
import InputField from '../ui/InputField';
import SelectDropdown from '../ui/SelectDropdown';
import Alert from '../ui/Alert';

interface AccountingPoliciesFormProps {
  initialPolicies?: AccountingPolicies;
  fiscalYear: string;
  onSubmit: (policies: AccountingPolicies) => void;
  isLoading?: boolean;
}

const DEFAULT_POLICIES: Partial<AccountingPolicies> = {
  depreciationMethod: 'StraightLine',
  incomeTaxRatePercent: 25,
  bonusRatePercent: 10,
  gratuityDaysPerYear: 15,
  roundingLevel: 100,
  assetCategories: [
    { id: 'land', name: 'Land', usefulLifeYears: 0, residualValuePercent: 100, depreciationMethod: 'StraightLine' },
    { id: 'buildings', name: 'Buildings', usefulLifeYears: 25, residualValuePercent: 5, depreciationMethod: 'StraightLine' },
    { id: 'vehicles', name: 'Vehicles', usefulLifeYears: 10, residualValuePercent: 5, depreciationMethod: 'StraightLine' },
    { id: 'computers', name: 'Computers & IT', usefulLifeYears: 5, residualValuePercent: 5, depreciationMethod: 'StraightLine' },
    { id: 'furniture', name: 'Furniture & Fixtures', usefulLifeYears: 10, residualValuePercent: 5, depreciationMethod: 'StraightLine' },
    { id: 'plant', name: 'Plant & Machinery', usefulLifeYears: 15, residualValuePercent: 5, depreciationMethod: 'StraightLine' },
    { id: 'intangibles', name: 'Intangible Assets', usefulLifeYears: 5, residualValuePercent: 0, depreciationMethod: 'StraightLine' },
  ],
};

const ROUNDING_OPTIONS = [
  { value: '1',     label: '1 (Exact)' },
  { value: '10',    label: '10' },
  { value: '100',   label: '100 (Recommended)' },
  { value: '1000',  label: '1,000' },
  { value: '10000', label: '10,000' },
];

const COST_FORMULA_OPTIONS = [{ value: 'fifo', label: 'FIFO (First-In, First-Out)' }, { value: 'weighted_avg', label: 'Weighted Average Method' }];

export default function AccountingPoliciesForm({ initialPolicies, fiscalYear, onSubmit, isLoading }: AccountingPoliciesFormProps): React.ReactElement {
  const [policies, setPolicies] = useState<Partial<AccountingPolicies>>(initialPolicies ?? DEFAULT_POLICIES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recognizeGratuity, setRecognizeGratuity] = useState(true);
  const [recognizeLeave, setRecognizeLeave] = useState(false);

  const set = (key: string, val: unknown) => setPolicies((p) => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateAccountingPolicies(policies);
    if (!validation.isValid) { setErrors(validation.errors); return; }
    setErrors({});
    onSubmit(policies as AccountingPolicies);
  };

  const roundingExample = (level: number) => {
    const val = 1234567;
    const rounded = Math.round(val / level) * level;
    return `1,234,567 → ${rounded.toLocaleString()}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <Card title="Property, Plant & Equipment (PPE)" subtitle="Depreciation method selection">
        <div className="flex gap-6 mb-4">
          {(['StraightLine', 'WrittenDownValue'] as const).map((method) => (
            <label key={method} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="depMethod" value={method} checked={(policies.depreciationMethod as string) === method}
                onChange={() => set('depreciationMethod', method)} className="text-blue-700 focus:ring-blue-500" />
              <span className="text-sm font-medium text-slate-700">{method === 'StraightLine' ? 'Straight Line Method (SLM)' : 'Written Down Value (WDV)'}</span>
            </label>
          ))}
        </div>
        <Alert type="info" message={policies.depreciationMethod === 'StraightLine' ? 'SLM: Equal annual depreciation charge over asset life. Common for buildings and furniture in Nepal.' : 'WDV: Higher depreciation in early years, reduces each year. Common for vehicles and computers.'} />
      </Card>

      <Card title="Asset Category Configuration" subtitle="Useful life and rates per category">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Category', 'Useful Life (Years)', 'Residual Value %', 'WDV Rate %'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(policies.assetCategories ?? []).map((cat, idx) => (
                <tr key={cat.id}>
                  <td className="px-3 py-2 font-medium text-slate-700">{cat.name}</td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                      value={cat.usefulLifeYears} onChange={(e) => {
                        const cats = [...(policies.assetCategories ?? [])];
                        cats[idx] = { ...cats[idx], usefulLifeYears: Number(e.target.value) };
                        set('assetCategories', cats);
                      }} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} max={100} className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                      value={cat.residualValuePercent ?? 5} onChange={(e) => {
                        const cats = [...(policies.assetCategories ?? [])];
                        cats[idx] = { ...cats[idx], residualValuePercent: Number(e.target.value) };
                        set('assetCategories', cats);
                      }} />
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs">
                    {policies.depreciationMethod === 'WrittenDownValue' ? '25% (default)' : 'N/A (SLM)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Inventories">
        <SelectDropdown label="Inventory Cost Formula" options={COST_FORMULA_OPTIONS}
          value={(policies as any).inventoryCostFormula ?? 'weighted_avg'}
          onChange={(e) => set('inventoryCostFormula', e.target.value)} />
        <p className="text-xs text-slate-500 mt-2">FIFO: Oldest stock treated as sold first. Weighted Average: Cost averaged over all units. Most Nepal businesses use Weighted Average.</p>
      </Card>

      <Card title="Employee Benefits">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={recognizeGratuity} onChange={(e) => setRecognizeGratuity(e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-slate-700">Recognise Gratuity Provision</span>
          </label>
          {recognizeGratuity && (
            <div className="ml-6">
              <InputField label="Gratuity Days per Year" type="number" error={errors.gratuityDaysPerYear}
                value={String(policies.gratuityDaysPerYear ?? 15)}
                onChange={(e) => set('gratuityDaysPerYear', Number(e.target.value))} />
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={recognizeLeave} onChange={(e) => setRecognizeLeave(e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-slate-700">Recognise Leave Encashment Provision</span>
          </label>
          <InputField label="Bonus Rate %" type="number" error={errors.bonusRatePercent}
            helperText="% of Net Profit (per Nepal Company Act / Bonus Act 2030)"
            value={String(policies.bonusRatePercent ?? 10)}
            onChange={(e) => set('bonusRatePercent', Number(e.target.value))} />
        </div>
      </Card>

      <Card title="Income Tax">
        <InputField label="Corporate Income Tax Rate (%)" type="number" error={errors.incomeTaxRatePercent}
          helperText="Standard rate is 25%. Listed companies: 20%. Manufacturing: 20%. Consult your tax advisor."
          value={String(policies.incomeTaxRatePercent ?? 25)}
          onChange={(e) => set('incomeTaxRatePercent', Number(e.target.value))} />
      </Card>

      <Card title="Presentation">
        <div className="mb-3">
          <p className="text-sm font-medium text-slate-700 mb-1">Currency</p>
          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">NPR (Nepalese Rupees) — fixed for Nepal NFRS compliance</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Level of Rounding</p>
          <div className="space-y-2">
            {[1, 10, 100, 1000, 10000].map((level) => (
              <label key={level} className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="rounding" value={String(level)} checked={(policies.roundingLevel as number) === level}
                  onChange={() => set('roundingLevel', level)} className="text-blue-700 focus:ring-blue-500" />
                <span className="text-sm text-slate-700">{level.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-mono">{roundingExample(level)}</span>
                {level === 100 && <span className="text-xs text-green-600 font-semibold">Recommended</span>}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isLoading}>Save Policies &amp; Continue →</Button>
      </div>
    </form>
  );
}
