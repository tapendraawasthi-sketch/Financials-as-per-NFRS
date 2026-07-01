// ===== src/components/adjustments/AssetRegisterTable.tsx =====
import React, { useState } from 'react';
import type { AssetItem, AssetCategory } from '../../types';
import { formatNPR } from '../../utils/numberFormat';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import { Trash2, Plus, Calculator } from 'lucide-react';

interface AssetRegisterTableProps {
  companyId: string;
  assetCategories: AssetCategory[];
  fiscalYear: string;
  onSave: (assets: AssetItem[]) => void;
}

const emptyAsset = (id: string): AssetItem => ({
  id, assetName: '', categoryId: '', purchaseDateBS: '', purchaseDateAD: '',
  originalCost: 0, additionalCost: 0, usefulLifeYears: 10, residualValue: 0,
  depreciationMethod: 'StraightLine', accumDepreciationOpening: 0,
  isFullyDepreciated: false, isMortgaged: false,
});

export default function AssetRegisterTable({ companyId, assetCategories, fiscalYear, onSave }: AssetRegisterTableProps): React.ReactElement {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [depPreview, setDepPreview] = useState<{ assetId: string; depnForYear: number }[] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAsset = () => setAssets((prev) => [...prev, emptyAsset(Date.now().toString())]);
  const removeAsset = (id: string) => setAssets((prev) => prev.filter((a) => a.id !== id));
  const updateAsset = (id: string, key: keyof AssetItem, val: unknown) =>
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, [key]: val } : a));

  const calculateDepreciation = async () => {
    setIsCalculating(true); setError(null);
    try {
      await fetch(`/api/adjustments/${companyId}/assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assets }) });
      const res = await fetch(`/api/adjustments/${companyId}/calculate-depreciation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      setDepPreview(data.summary?.map((s: any) => ({ assetId: s.categoryId, depnForYear: s.depnForYear })) ?? []);
    } catch (e) { setError('Failed to calculate depreciation.'); }
    setIsCalculating(false);
  };

  const totalCost = assets.reduce((s, a) => s + a.originalCost + a.additionalCost, 0);
  const totalAccumDepn = assets.reduce((s, a) => s + a.accumDepreciationOpening, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Fixed Asset Register — FY {fiscalYear}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<Calculator size={14} />} onClick={calculateDepreciation} loading={isCalculating}>Calculate Depreciation</Button>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addAsset}>Add Asset</Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}

      {assets.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">No assets added yet. Click "Add Asset" to begin entering your fixed asset register.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Asset Name', 'Category', 'Purchase Date (BS)', 'Original Cost', 'Additions', 'Useful Life (yrs)', 'Residual Value', 'Opening Accum. Depn', 'Mortgaged', 'Disposal Date', 'Disposal Value', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2"><input className="w-36 px-2 py-1 border border-slate-200 rounded text-xs" placeholder="e.g. Toyota Hiace" value={asset.assetName} onChange={(e) => updateAsset(asset.id, 'assetName', e.target.value)} /></td>
                  <td className="px-3 py-2">
                    <select className="w-32 px-2 py-1 border border-slate-200 rounded text-xs" value={asset.categoryId} onChange={(e) => updateAsset(asset.id, 'categoryId', e.target.value)}>
                      <option value="">Select…</option>
                      {assetCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input className="w-28 px-2 py-1 border border-slate-200 rounded text-xs" placeholder="15 Poush 2079" value={asset.purchaseDateBS} onChange={(e) => updateAsset(asset.id, 'purchaseDateBS', e.target.value)} /></td>
                  {(['originalCost', 'additionalCost', 'usefulLifeYears', 'residualValue', 'accumDepreciationOpening'] as const).map((field) => (
                    <td key={field} className="px-3 py-2"><input type="number" className="w-24 px-2 py-1 border border-slate-200 rounded text-xs text-right" value={asset[field] as number} onChange={(e) => updateAsset(asset.id, field, Number(e.target.value))} /></td>
                  ))}
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={asset.isMortgaged} onChange={(e) => updateAsset(asset.id, 'isMortgaged', e.target.checked)} /></td>
                  <td className="px-3 py-2"><input className="w-28 px-2 py-1 border border-slate-200 rounded text-xs" placeholder="Optional" value={asset.disposalDateBS ?? ''} onChange={(e) => updateAsset(asset.id, 'disposalDateBS', e.target.value)} /></td>
                  <td className="px-3 py-2"><input type="number" className="w-24 px-2 py-1 border border-slate-200 rounded text-xs text-right" value={asset.disposalValue ?? ''} placeholder="0" onChange={(e) => updateAsset(asset.id, 'disposalValue', Number(e.target.value))} /></td>
                  <td className="px-3 py-2"><button onClick={() => removeAsset(asset.id)} className="text-red-400 hover:text-red-600 transition-colors p-1"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 font-semibold text-slate-700 text-xs">TOTALS</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-xs">{formatNPR(totalCost)}</td>
                <td colSpan={3} />
                <td className="px-3 py-2 text-right font-mono font-bold text-xs">{formatNPR(totalAccumDepn)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {depPreview && (
        <Card title="Depreciation Preview" subtitle="Computed depreciation charge for the current fiscal year">
          <div className="space-y-2">
            {depPreview.map((d) => (
              <div key={d.assetId} className="flex justify-between text-sm">
                <span className="text-slate-600">{d.assetId}</span>
                <span className="font-mono font-semibold text-slate-800">{formatNPR(d.depnForYear)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={() => onSave(assets)} disabled={assets.length === 0}>Save Asset Register</Button>
      </div>
    </div>
  );
}
