// src/components/adjustments/AssetRegisterTable.tsx
import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { DepreciationSummary } from '../../types';
import type { AssetRow } from '../../utils/assetMapping';
import { previewAnnualDepreciation } from '../../utils/depreciationPreview';
import { formatNPR } from '../../utils/numberFormat';

interface AssetRegisterTableProps {
  fiscalYear: string;
  onCalculate: (assets: AssetRow[]) => Promise<DepreciationSummary[]> | DepreciationSummary[];
  initialAssets?: AssetRow[];
  roundingLevel?: number;
  hasBorrowings?: boolean;
  hasDisposalIndicators?: boolean;
  onImportFromTrialBalance?: () => AssetRow[];
}

const CATEGORIES = [
  'Land', 'Buildings', 'Vehicles', 'Computers',
  'Office Equipment', 'Furniture & Fixtures', 'Plant & Machinery', 'Intangible Assets',
];

let nextId = 1;
function newRow(): AssetRow {
  return {
    id: `asset-${nextId++}`,
    name: '',
    category: 'Buildings',
    purchaseDate: '',
    cost: 0,
    accumDepn: 0,
    usefulLife: 10,
    method: 'WDV',
    wdvRate: 20,
    mortgaged: false,
    disposed: false,
    disposalDate: '',
    disposalValue: 0,
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

function GateQuestion({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 mb-3"
      style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-hairline)' }}
    >
      <p className="text-xs font-medium" style={{ color: 'var(--ink-800)' }}>{label}</p>
      {detail && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--ink-500)' }}>{detail}</p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className="px-3 py-1 text-xs rounded-md border transition-colors"
          style={{
            borderColor: value === true ? 'var(--brand-500)' : 'var(--border-strong)',
            background: value === true ? 'var(--brand-50)' : 'var(--surface)',
            color: value === true ? 'var(--brand-700)' : 'var(--ink-600)',
          }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className="px-3 py-1 text-xs rounded-md border transition-colors"
          style={{
            borderColor: value === false ? 'var(--brand-500)' : 'var(--border-strong)',
            background: value === false ? 'var(--brand-50)' : 'var(--surface)',
            color: value === false ? 'var(--brand-700)' : 'var(--ink-600)',
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default function AssetRegisterTable({
  fiscalYear,
  onCalculate,
  initialAssets = [],
  roundingLevel = 100,
  hasBorrowings = false,
  hasDisposalIndicators = false,
  onImportFromTrialBalance,
}: AssetRegisterTableProps) {
  const [assets, setAssets] = useState<AssetRow[]>(
    initialAssets.length > 0 ? initialAssets : [newRow()],
  );
  useEffect(() => {
    if (initialAssets.length > 0) {
      setAssets(initialAssets);
    }
  }, [initialAssets]);

  const hasSavedDisposals = initialAssets.some((asset) => asset.disposed);
  const hasSavedMortgaged = initialAssets.some((asset) => asset.mortgaged);

  const [disposalsAnswer, setDisposalsAnswer] = useState<boolean | null>(
    hasDisposalIndicators || hasSavedDisposals ? true : null,
  );
  const [mortgagedAnswer, setMortgagedAnswer] = useState<boolean | null>(
    hasSavedMortgaged ? true : null,
  );

  const showDisposalColumns = Boolean(disposalsAnswer);
  const showMortgagedColumn = hasBorrowings && Boolean(mortgagedAnswer);
  const needsDisposalQuestion = !hasDisposalIndicators && !hasSavedDisposals;
  const needsMortgagedQuestion = hasBorrowings && !hasSavedMortgaged;

  const [calculating, setCalculating] = useState(false);
  const [depnResult, setDepnResult] = useState<DepreciationSummary[] | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const updateRow = (id: string, key: keyof AssetRow, value: AssetRow[keyof AssetRow]) =>
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)),
    );

  const addRow = () => setAssets((prev) => [...prev, newRow()]);

  const deleteRow = (id: string) =>
    setAssets((prev) => (prev.length > 1 ? prev.filter((a) => a.id !== id) : prev));

  const handleImport = () => {
    if (!onImportFromTrialBalance) return;
    const imported = onImportFromTrialBalance();
    if (imported.length === 0) return;
    setAssets(imported);
    setDepnResult(null);
    setCalcError(null);
  };

  const handleCalculate = async () => {
    if (needsDisposalQuestion && disposalsAnswer === null) {
      setCalcError('Please answer whether any assets were disposed during the year.');
      return;
    }
    if (needsMortgagedQuestion && mortgagedAnswer === null) {
      setCalcError('Please confirm whether any assets are pledged as security for borrowings.');
      return;
    }

    setCalculating(true);
    setCalcError(null);
    try {
      const normalized = assets.map((asset) => ({
        ...asset,
        mortgaged: showMortgagedColumn ? asset.mortgaged : false,
        disposed: showDisposalColumns ? asset.disposed : false,
        disposalDate: showDisposalColumns && asset.disposed ? asset.disposalDate : '',
        disposalValue: showDisposalColumns && asset.disposed ? asset.disposalValue : 0,
      }));
      const result = await onCalculate(normalized);
      setDepnResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Calculation failed. Please check asset data.';
      setCalcError(message);
    } finally {
      setCalculating(false);
    }
  };

  const totalCost = assets.reduce((s, a) => s + (a.cost || 0), 0);
  const totalAccumDpn = assets.reduce((s, a) => s + (a.accumDepn || 0), 0);
  const totalDepnThisYear = depnResult?.reduce((s, r) => s + r.depnForYear, 0) ?? 0;

  const inCls = 'asset-inline-input h-6 text-xs font-mono text-right px-1.5 outline-none transition-colors border-0 border-b border-[var(--border-hairline)] bg-transparent w-full';
  const selCls = 'asset-inline-select h-6 text-xs px-1 border border-[var(--border-strong)] rounded bg-[var(--surface)] text-[var(--ink-700)] outline-none w-full';

  const extraCols = (showDisposalColumns ? 3 : 0) + (showMortgagedColumn ? 1 : 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ink-900)' }}>Fixed Asset Register</h2>
        <Button variant="secondary" size="sm" onClick={addRow}>
          Add Asset
        </Button>
      </div>

      {hasDisposalIndicators && (
        <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}>
          Disposal activity was detected in your trial balance — disposal columns are shown automatically.
        </p>
      )}

      {needsDisposalQuestion && (
        <GateQuestion
          label="Did you dispose of any fixed assets during the year?"
          detail="Only answer Yes if you need to record disposal proceeds and gain/loss on sale."
          value={disposalsAnswer}
          onChange={setDisposalsAnswer}
        />
      )}

      {needsMortgagedQuestion && (
        <GateQuestion
          label="Are any fixed assets pledged as security for borrowings?"
          detail="Borrowings were detected in your trial balance. Secured assets are disclosed in Note 3.1."
          value={mortgagedAnswer}
          onChange={setMortgagedAnswer}
        />
      )}

      <div className="overflow-x-auto border rounded-md" style={{ borderColor: 'var(--border-hairline)' }}>
        <table className="fin-table w-full" style={{ minWidth: 960 + extraCols * 90 }}>
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
              {showMortgagedColumn && (
                <th className="text-center" style={{ width: 60 }}>Mortgaged</th>
              )}
              {showDisposalColumns && (
                <>
                  <th className="text-center" style={{ width: 60 }}>Disposed</th>
                  <th style={{ width: 110 }}>Disposal Date</th>
                  <th className="text-right" style={{ width: 90 }}>Proceeds</th>
                </>
              )}
              <th className="w-8" />
            </tr>
          </thead>

          <tbody>
            {assets.map((asset, idx) => (
              <tr key={asset.id} className="h-8">
                <td className="text-center text-[10px]" style={{ color: 'var(--ink-400)' }}>{idx + 1}</td>

                <td className="px-1">
                  <input
                    type="text"
                    value={asset.name}
                    onChange={(e) => updateRow(asset.id, 'name', e.target.value)}
                    placeholder="Asset name"
                    className={`${inCls} text-left`}
                    aria-label="Asset description"
                  />
                </td>

                <td className="px-1">
                  <select
                    value={asset.category}
                    onChange={(e) => updateRow(asset.id, 'category', e.target.value)}
                    className={selCls}
                    aria-label="Asset category"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>

                <td className="px-1">
                  <input
                    type="text"
                    value={asset.purchaseDate}
                    onChange={(e) => updateRow(asset.id, 'purchaseDate', e.target.value)}
                    placeholder="e.g. 15 Poush 2079"
                    className={`${inCls} text-left`}
                    aria-label="Purchase date in Bikram Sambat"
                  />
                </td>

                <td className="px-1">
                  <input
                    type="number"
                    value={asset.cost || ''}
                    onChange={(e) => updateRow(asset.id, 'cost', parseFloat(e.target.value) || 0)}
                    min={0}
                    className={inCls}
                    aria-label="Cost"
                  />
                </td>

                <td className="px-1">
                  <input
                    type="number"
                    value={asset.accumDepn || ''}
                    onChange={(e) => updateRow(asset.id, 'accumDepn', parseFloat(e.target.value) || 0)}
                    min={0}
                    className={inCls}
                    aria-label="Opening accumulated depreciation"
                  />
                </td>

                <td className="px-1 align-top">
                  <input
                    type="number"
                    value={asset.usefulLife || ''}
                    onChange={(e) => updateRow(asset.id, 'usefulLife', parseInt(e.target.value, 10) || 1)}
                    min={1}
                    max={100}
                    disabled={asset.method === 'WDV'}
                    className={`${inCls} ${asset.method === 'WDV' ? 'text-[var(--ink-300)]' : ''}`}
                    aria-label="Useful life in years"
                  />
                  {asset.method === 'SLM' && asset.cost > 0 && (
                    <p className="mt-0.5 num" style={{ fontSize: '10px', color: 'var(--ink-400)' }}>
                      ≈ Rs. {formatNPR(previewAnnualDepreciation(asset))}/yr
                    </p>
                  )}
                </td>

                <td className="px-1 align-top">
                  <select
                    value={asset.method}
                    onChange={(e) => updateRow(asset.id, 'method', e.target.value as 'SLM' | 'WDV')}
                    className={selCls}
                    aria-label="Depreciation method"
                  >
                    <option value="SLM">SLM</option>
                    <option value="WDV">WDV</option>
                  </select>
                </td>

                <td className="px-1 align-top">
                  <input
                    type="number"
                    value={asset.method === 'WDV' ? (asset.wdvRate || '') : ''}
                    onChange={(e) => updateRow(asset.id, 'wdvRate', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    disabled={asset.method !== 'WDV'}
                    className={`${inCls} ${asset.method !== 'WDV' ? 'text-[var(--ink-300)]' : ''}`}
                    aria-label="WDV rate percentage"
                  />
                  {asset.method === 'WDV' && asset.cost > 0 && (
                    <p className="mt-0.5 num" style={{ fontSize: '10px', color: 'var(--ink-400)' }}>
                      ≈ Rs. {formatNPR(previewAnnualDepreciation(asset))}/yr
                    </p>
                  )}
                </td>

                {showMortgagedColumn && (
                  <td className="text-center px-1">
                    <input
                      type="checkbox"
                      checked={asset.mortgaged}
                      onChange={(e) => updateRow(asset.id, 'mortgaged', e.target.checked)}
                      className="h-3.5 w-3.5 rounded"
                      style={{ borderColor: 'var(--border-strong)', accentColor: 'var(--brand-500)' }}
                      aria-label="Asset mortgaged"
                    />
                  </td>
                )}

                {showDisposalColumns && (
                  <>
                    <td className="text-center px-1">
                      <input
                        type="checkbox"
                        checked={asset.disposed}
                        onChange={(e) => updateRow(asset.id, 'disposed', e.target.checked)}
                        className="h-3.5 w-3.5 rounded"
                      style={{ borderColor: 'var(--border-strong)', accentColor: 'var(--brand-500)' }}
                        aria-label="Asset disposed"
                      />
                    </td>
                    <td className="px-1">
                      <input
                        type="text"
                        value={asset.disposalDate}
                        onChange={(e) => updateRow(asset.id, 'disposalDate', e.target.value)}
                        disabled={!asset.disposed}
                        placeholder="BS date"
                        className={`${inCls} text-left ${!asset.disposed ? 'text-[var(--ink-300)]' : ''}`}
                        aria-label="Disposal date"
                      />
                    </td>
                    <td className="px-1">
                      <input
                        type="number"
                        value={asset.disposed ? (asset.disposalValue || '') : ''}
                        onChange={(e) => updateRow(asset.id, 'disposalValue', parseFloat(e.target.value) || 0)}
                        disabled={!asset.disposed}
                        min={0}
                        className={`${inCls} ${!asset.disposed ? 'text-[var(--ink-300)]' : ''}`}
                        aria-label="Disposal proceeds"
                      />
                    </td>
                  </>
                )}

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

          <tfoot>
            <tr className="row-total">
              <td colSpan={4} className="px-3 py-1.5 text-xs font-bold" style={{ color: 'var(--ink-700)' }}>
                Total
              </td>
              <td className="px-1 py-1.5 text-right text-xs font-bold font-mono" style={{ color: 'var(--ink-900)' }}>
                {fmt(totalCost, roundingLevel)}
              </td>
              <td className="px-1 py-1.5 text-right text-xs font-bold font-mono" style={{ color: 'var(--ink-900)' }}>
                {fmt(totalAccumDpn, roundingLevel)}
              </td>
              <td colSpan={3 + extraCols + 1} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Button
          variant="primary"
          size="md"
          loading={calculating}
          onClick={handleCalculate}
        >
          Calculate Depreciation
        </Button>
        {onImportFromTrialBalance && (
          <Button variant="secondary" size="sm" onClick={handleImport}>
            Import from Trial Balance
          </Button>
        )}
      </div>

      {calcError && (
        <p className="text-xs text-red-600 mt-2">{calcError}</p>
      )}

      {depnResult && depnResult.length > 0 && (
        <div className="border rounded-md mt-3 overflow-hidden" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-600)' }}>
              Depreciation for FY {fiscalYear}:&nbsp;
              <span className="font-mono font-semibold" style={{ color: 'var(--ink-900)' }}>
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
                {depnResult.map((r) => (
                  <tr key={r.categoryId}>
                    <td className="text-xs" style={{ color: 'var(--ink-700)' }}>{r.categoryName}</td>
                    <td className="amount text-xs">{fmt(r.closingCost, roundingLevel)}</td>
                    <td className="amount text-xs">{fmt(r.openingAccumDepn, roundingLevel)}</td>
                    <td className="amount text-xs" style={{ color: 'var(--warning-700)' }}>{fmt(r.depnForYear, roundingLevel)}</td>
                    <td className="amount text-xs">{fmt(r.closingAccumDepn, roundingLevel)}</td>
                    <td className="amount text-xs font-semibold" style={{ color: 'var(--ink-900)' }}>{fmt(r.netBookValueClosing, roundingLevel)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="row-grand-total">
                  <td className="px-3 py-1.5 text-xs font-bold" style={{ color: 'var(--ink-900)' }}>Total</td>
                  <td className="px-3 py-1.5 amount text-xs font-bold" style={{ color: 'var(--ink-900)' }}>
                    {fmt(depnResult.reduce((s, r) => s + r.closingCost, 0), roundingLevel)}
                  </td>
                  <td className="px-3 py-1.5 amount text-xs font-bold">
                    {fmt(depnResult.reduce((s, r) => s + r.openingAccumDepn, 0), roundingLevel)}
                  </td>
                  <td className="px-3 py-1.5 amount text-xs font-bold" style={{ color: 'var(--warning-700)' }}>
                    {fmt(totalDepnThisYear, roundingLevel)}
                  </td>
                  <td className="px-3 py-2 amount text-sm font-bold" style={{ color: 'var(--ink-900)' }}>
                    {fmt(depnResult.reduce((s, r) => s + r.closingAccumDepn, 0), roundingLevel)}
                  </td>
                  <td className="px-3 py-2 amount text-sm font-bold" style={{ color: 'var(--brand-700)', background: 'var(--brand-50)' }}>
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
