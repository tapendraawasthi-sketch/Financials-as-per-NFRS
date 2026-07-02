// src/components/adjustments/AssetRegisterTable.tsx
import React, { useState } from 'react';
import Button from '../ui/Button';
import { DepreciationSummary } from '../../types/adjustments';

interface AssetRow {
  id:           string;
  name:         string;
  category:     string;
  purchaseDate: string;
  cost:         number;
  accumDepn:    number;
  usefulLife:   number;
  method:       'SLM' | 'WDV';
  wdvRate:      number;
  mortgaged:    boolean;
}

interface AssetRegisterTableProps {
  fiscalYear:     string;
  onCalculate:    (assets: AssetRow[]) => Promise<DepreciationSummary[]> | DepreciationSummary[];
  initialAssets?: AssetRow[];
  roundingLevel?: number;
}

const CATEGORIES = [
  'Land', 'Buildings', 'Vehicles', 'Computers',
  'Office Equipment', 'Furniture & Fixtures', 'Plant & Machinery', 'Intangible Assets',
];

let nextId = 1;
function newRow(): AssetRow {
  return {
    id:           `asset-${nextId++}`,
    name:         '',
    category:     'Buildings',
    purchaseDate: '',
    cost:         0,
    accumDepn:    0,
    usefulLife:   10,
    method:       'WDV',
    wdvRate:      20,
    mortgaged:    false,
  };
}

function fmt(n: number, rl = 100): string {
  const r = Math.round(n / rl) * rl;
  if (r === 0) return '—';
  return r.toLocaleString('en-IN');
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

export default function AssetRegisterTable({
  fiscalYear,
  onCalculate,
  initialAssets = [],
  roundingLevel = 100,
}: AssetRegisterTableProps) {
  const [assets,      setAssets]      = useState<AssetRow[]>(
    initialAssets.length > 0 ? initialAssets : [newRow()]
  );
  const [calculating, setCalculating] = useState(false);
  const [depnResult,  setDepnResult]  = useState<DepreciationSummary[] | null>(null);
  const [calcError,   setCalcError]   = useState<string | null>(null);

  const updateRow = (id: string, key: keyof AssetRow, value: any) =>
    setAssets(prev =>
      prev.map(a => (a.id === id ? { ...a, [key]: value } : a))
    );

  const addRow = () => setAssets(prev => [...prev, newRow()]);

  const deleteRow = (id: string) =>
    setAssets(prev => (prev.length > 1 ? prev.filter(a => a.id !== id) : prev));

  const handleCalculate = async () => {
    setCalculating(true);
    setCalcError(null);
    try {
      const result = await onCalculate(assets);
      setDepnResult(result);
    } catch (err: any) {
      setCalcError(err?.message ?? 'Calculation failed. Please check asset data.');
    } finally {
      setCalculating(false);
    }
  };

  const totalCost     = assets.reduce((s, a) => s + (a.cost     || 0), 0);
  const totalAccumDpn = assets.reduce((s, a) => s + (a.accumDepn || 0), 0);

  const totalDepnThisYear  = depnResult?.reduce((s, r) => s + r.depnForYear, 0) ?? 0;
  const totalNBV           = depnResult?.reduce((s, r) => s + r.netBookValueClosing,  0) ?? 0;

  const inCls  = 'h-6 text-xs font-mono text-right px-1.5 outline-none transition-colors border-0 border-b border-slate-200 bg-transparent focus:border-blue-400 w-full';
  const selCls = 'h-6 text-xs px-1 border border-slate-200 rounded bg-white text-slate-700 outline-none focus:border-blue-400 w-full';

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Fixed Asset Register</h2>
        <Button variant="secondary" size="sm" onClick={addRow}>
          Add Asset
        </Button>
      </div>

      {/* Register table */}
      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="fin-table w-full" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th className="w-7 text-center">#</th>
              <th className="text-left" style={{ width: 200 }}>Asset Description</th>
              <th style={{ width: 120 }}>Category</th>
              <th style={{ width: 120 }}>Purchase Date (BS)</th>
              <th className="text-right" style={{ width: 100 }}>Cost (NPR)</th>
              <th className="text-right" style={{ width: 110 }}>Accum Depn Op.</th>
              <th className="text-right" style={{ width: 70 }}>Life (yrs)</th>
              <th style={{ width: 70 }}>Method</th>
              <th className="text-right" style={{ width: 70 }}>WDV %</th>
              <th className="text-center" style={{ width: 60 }}>Mortgaged</th>
              <th className="w-8" />
            </tr>
          </thead>

          <tbody>
            {assets.map((asset, idx) => (
              <tr key={asset.id} className="h-8 border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <td className="text-center text-[10px] text-slate-400">{idx + 1}</td>

                {/* Description */}
                <td className="px-1">
                  <input
                    type="text"
                    value={asset.name}
                    onChange={e => updateRow(asset.id, 'name', e.target.value)}
                    placeholder="Asset name"
                    className={`${inCls} text-left`}
                    aria-label="Asset description"
                  />
                </td>

                {/* Category */}
                <td className="px-1">
                  <select
                    value={asset.category}
                    onChange={e => updateRow(asset.id, 'category', e.target.value)}
                    className={selCls}
                    aria-label="Asset category"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>

                {/* Purchase date */}
                <td className="px-1">
                  <input
                    type="text"
                    value={asset.purchaseDate}
                    onChange={e => updateRow(asset.id, 'purchaseDate', e.target.value)}
                    placeholder="e.g. 15 Poush 2079"
                    className={`${inCls} text-left`}
                    aria-label="Purchase date in Bikram Sambat"
                  />
                </td>

                {/* Cost */}
                <td className="px-1">
                  <input
                    type="number"
                    value={asset.cost || ''}
                    onChange={e => updateRow(asset.id, 'cost', parseFloat(e.target.value) || 0)}
                    min={0}
                    className={inCls}
                    aria-label="Cost"
                  />
                </td>

                {/* Accum Depn */}
                <td className="px-1">
                  <input
                    type="number"
                    value={asset.accumDepn || ''}
                    onChange={e => updateRow(asset.id, 'accumDepn', parseFloat(e.target.value) || 0)}
                    min={0}
                    className={inCls}
                    aria-label="Opening accumulated depreciation"
                  />
                </td>

                {/* Useful life */}
                <td className="px-1">
                  <input
                    type="number"
                    value={asset.usefulLife || ''}
                    onChange={e => updateRow(asset.id, 'usefulLife', parseInt(e.target.value) || 1)}
                    min={1}
                    max={100}
                    disabled={asset.method === 'WDV'}
                    className={`${inCls} ${asset.method === 'WDV' ? 'text-slate-300' : ''}`}
                    aria-label="Useful life in years"
                  />
                </td>

                {/* Method */}
                <td className="px-1">
                  <select
                    value={asset.method}
                    onChange={e => updateRow(asset.id, 'method', e.target.value as 'SLM' | 'WDV')}
                    className={selCls}
                    aria-label="Depreciation method"
                  >
                    <option value="SLM">SLM</option>
                    <option value="WDV">WDV</option>
                  </select>
                </td>

                {/* WDV Rate */}
                <td className="px-1">
                  <input
                    type="number"
                    value={asset.method === 'WDV' ? (asset.wdvRate || '') : ''}
                    onChange={e => updateRow(asset.id, 'wdvRate', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    disabled={asset.method !== 'WDV'}
                    className={`${inCls} ${asset.method !== 'WDV' ? 'text-slate-300' : ''}`}
                    aria-label="WDV rate percentage"
                  />
                </td>

                {/* Mortgaged */}
                <td className="text-center px-1">
                  <input
                    type="checkbox"
                    checked={asset.mortgaged}
                    onChange={e => updateRow(asset.id, 'mortgaged', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                    aria-label="Asset mortgaged"
                  />
                </td>

                {/* Delete */}
                <td className="text-center px-1">
                  <button
                    type="button"
                    onClick={() => deleteRow(asset.id)}
                    disabled={assets.length === 1}
                    className="h-5 w-5 flex items-center justify-center text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors mx-auto"
                    aria-label={`Delete ${asset.name || 'asset'}`}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-slate-700">
                Total
              </td>
              <td className="px-1 py-1.5 text-right text-xs font-bold font-mono text-slate-800">
                {fmt(totalCost, roundingLevel)}
              </td>
              <td className="px-1 py-1.5 text-right text-xs font-bold font-mono text-slate-800">
                {fmt(totalAccumDpn, roundingLevel)}
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-4">
        <Button
          variant="primary"
          size="md"
          loading={calculating}
          onClick={handleCalculate}
        >
          Calculate Depreciation
        </Button>
        <Button variant="secondary" size="sm">
          Import from Trial Balance
        </Button>
      </div>

      {calcError && (
        <p className="text-xs text-red-600 mt-2">{calcError}</p>
      )}

      {/* Depreciation result */}
      {depnResult && depnResult.length > 0 && (
        <div className="border border-slate-200 rounded-md mt-3 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs text-slate-600 font-medium">
              Depreciation for FY {fiscalYear}:&nbsp;
              <span className="font-mono font-semibold text-slate-800">
                NPR {fmt(totalDepnThisYear, roundingLevel)}
              </span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="fin-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Category</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Op. Accum Depn</th>
                  <th className="text-right">Depn This Year</th>
                  <th className="text-right">Cl. Accum Depn</th>
                  <th className="text-right">Net Book Value</th>
                </tr>
              </thead>
              <tbody>
                {depnResult.map(r => (
                  <tr key={r.categoryId} className="border-b border-slate-100 last:border-0">
                    <td className="text-xs text-slate-700">{r.categoryName}</td>
                    <td className="text-right font-mono text-xs">{fmt(r.closingCost, roundingLevel)}</td>
                    <td className="text-right font-mono text-xs">{fmt(r.openingAccumDepn, roundingLevel)}</td>
                    <td className="text-right font-mono text-xs text-amber-700">{fmt(r.depnForYear, roundingLevel)}</td>
                    <td className="text-right font-mono text-xs">{fmt(r.closingAccumDepn, roundingLevel)}</td>
                    <td className="text-right font-mono text-xs font-semibold text-slate-800">{fmt(r.netBookValueClosing, roundingLevel)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="px-3 py-1.5 text-xs font-bold text-slate-800">Total</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-800">
                    {fmt(depnResult.reduce((s, r) => s + r.closingCost, 0), roundingLevel)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-bold">
                    {fmt(depnResult.reduce((s, r) => s + r.openingAccumDepn, 0), roundingLevel)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-bold text-amber-700">
                    {fmt(totalDepnThisYear, roundingLevel)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-slate-800">
                    {fmt(depnResult.reduce((s, r) => s + r.closingAccumDepn, 0), roundingLevel)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-blue-700 bg-blue-50/50">
                    {fmt(depnResult.reduce((s, r) => s + r.netBookValueClosing, 0), roundingLevel)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
