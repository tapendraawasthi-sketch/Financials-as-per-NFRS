import React, { useMemo, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { InvestmentAdjustment, MappedTBRow } from '../../types';
import { computeListedShareMetrics } from '../../utils/investmentCalculations';

interface InvestmentInputPanelProps {
  trialBalanceRows?: MappedTBRow[];
  initialItems?: InvestmentAdjustment[];
  onSave: (items: InvestmentAdjustment[]) => Promise<void> | void;
}

interface ListedShareRow {
  id: string;
  companyName: string;
  openingUnits: number;
  unitsPurchased: number;
  unitsSold: number;
  openingLtp: number;
  closingLtp: number;
  soldUnitGainLoss: number;
}

function tbBalance(rows: MappedTBRow[], category: string): number {
  return rows
    .filter((row) => !row.isGroupRow && row.nfrsCategory === category)
    .reduce((sum, row) => sum + (row.closingDr ?? 0), 0);
}

function isListedItem(item: InvestmentAdjustment): boolean {
  const t = item.investmentType ?? item.type ?? '';
  return t === 'listed_trading' || t === 'listed_ats' || t === 'listed';
}

function initListedRows(initialItems: InvestmentAdjustment[], tbCost: number): ListedShareRow[] {
  const listed = initialItems.filter(isListedItem);
  if (listed.length > 0) {
    return listed.map((item) => ({
      id: item.id,
      companyName: item.investmentName ?? item.name ?? 'Listed Shares',
      openingUnits: item.openingUnits ?? item.units ?? 0,
      unitsPurchased: item.unitsPurchased ?? 0,
      unitsSold: item.unitsSold ?? 0,
      openingLtp: item.costPerUnit ?? (item.totalCost && (item.openingUnits ?? item.units)
        ? item.totalCost / (item.openingUnits ?? item.units ?? 1)
        : 0),
      closingLtp: item.ltp ?? item.fairValuePerUnit ?? item.costPerUnit ?? 0,
      soldUnitGainLoss: item.soldUnitGainLoss ?? 0,
    }));
  }
  if (tbCost <= 0) return [];
  return [{
    id: 'listed-trading',
    companyName: 'Listed Shares',
    openingUnits: 0,
    unitsPurchased: 0,
    unitsSold: 0,
    openingLtp: 0,
    closingLtp: 0,
    soldUnitGainLoss: 0,
  }];
}

let rowId = 1;

function numInput(value: number, onChange: (v: number) => void, min = 0) {
  return (
    <input
      type="number"
      min={min}
      step="any"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full h-8 text-xs font-mono text-right px-2 border border-[var(--border-strong)] rounded bg-[var(--surface)] outline-none focus:border-[var(--brand-500)]"
    />
  );
}

export default function InvestmentInputPanel({
  trialBalanceRows = [],
  initialItems = [],
  onSave,
}: InvestmentInputPanelProps) {
  const listedCost = useMemo(
    () => tbBalance(trialBalanceRows, 'investment_listed_trading'),
    [trialBalanceRows],
  );
  const unlistedCost = useMemo(
    () => tbBalance(trialBalanceRows, 'investment_unlisted'),
    [trialBalanceRows],
  );

  const unlistedExisting = initialItems.find((item) => item.investmentType === 'unlisted' || item.type === 'unlisted');
  const [listedRows, setListedRows] = useState<ListedShareRow[]>(() => initListedRows(initialItems, listedCost));
  const [unlistedImpairment, setUnlistedImpairment] = useState(unlistedExisting?.impairmentAmount ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listedMetrics = listedRows.map((row) => ({
    row,
    metrics: computeListedShareMetrics(row),
  }));
  const totalFvGainLoss = listedMetrics.reduce((s, { metrics }) => s + metrics.fvGainLoss, 0);
  const totalSoldPnl = listedMetrics.reduce((s, { metrics }) => s + metrics.soldUnitGainLoss, 0);
  const unlistedCarrying = Math.max(0, unlistedCost - unlistedImpairment);

  const updateListedRow = (id: string, patch: Partial<ListedShareRow>) => {
    setListedRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addListedRow = () => {
    rowId += 1;
    setListedRows((prev) => [...prev, {
      id: `listed-${rowId}`,
      companyName: '',
      openingUnits: 0,
      unitsPurchased: 0,
      unitsSold: 0,
      openingLtp: 0,
      closingLtp: 0,
      soldUnitGainLoss: 0,
    }]);
  };

  const removeListedRow = (id: string) => {
    setListedRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const items: InvestmentAdjustment[] = [];

      for (const { row, metrics } of listedMetrics) {
        if (!row.companyName.trim() && metrics.closingFv <= 0 && metrics.openingFv <= 0) continue;
        items.push({
          id: row.id,
          type: 'listed',
          investmentType: 'listed_trading',
          name: row.companyName || 'Listed Shares',
          investmentName: row.companyName || 'Listed Shares',
          openingUnits: row.openingUnits,
          units: metrics.closingUnits,
          unitsPurchased: row.unitsPurchased,
          unitsSold: row.unitsSold,
          costPerUnit: row.openingLtp || undefined,
          fairValuePerUnit: row.closingLtp || undefined,
          ltp: row.closingLtp || undefined,
          totalCost: metrics.openingFv,
          totalFairValue: metrics.closingFv,
          carryingAmount: metrics.closingFv,
          marketValue: metrics.closingFv,
          fairValueGainLoss: metrics.fvGainLoss,
          gainLossOnFV: metrics.fvGainLoss,
          soldUnitGainLoss: row.soldUnitGainLoss,
        });
      }

      if (unlistedCost > 0) {
        items.push({
          id: unlistedExisting?.id ?? 'unlisted-shares',
          type: 'unlisted',
          investmentType: 'unlisted',
          name: unlistedExisting?.investmentName ?? unlistedExisting?.name ?? 'Unlisted Shares',
          investmentName: unlistedExisting?.investmentName ?? 'Unlisted Shares',
          totalCost: unlistedCost,
          impairmentAmount: unlistedImpairment,
          carryingAmount: unlistedCarrying,
        });
      }

      await onSave(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save investment adjustments.');
    } finally {
      setSaving(false);
    }
  };

  if (listedCost === 0 && unlistedCost === 0 && listedRows.length === 0) {
    return null;
  }

  return (
    <Card title="Investment Fair Value / Impairment" padding="md">
      <div className="space-y-4">
        {(listedCost > 0 || listedRows.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Listed shares — per-script roll-forward (Fair Value Change sheet). TB cost balance: NPR {listedCost.toLocaleString('en-IN')}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--surface-sunken)' }}>
                    <th className="px-2 py-2 text-left min-w-[120px]">Script</th>
                    <th className="px-2 py-2 text-right w-20">Open Units</th>
                    <th className="px-2 py-2 text-right w-20">Purchased</th>
                    <th className="px-2 py-2 text-right w-20">Sold</th>
                    <th className="px-2 py-2 text-right w-20">Close Units</th>
                    <th className="px-2 py-2 text-right w-24">Open LTP</th>
                    <th className="px-2 py-2 text-right w-24">Close LTP</th>
                    <th className="px-2 py-2 text-right w-24">FV Gain/(Loss)</th>
                    <th className="px-2 py-2 text-right w-24">Sold P&L</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {listedMetrics.map(({ row, metrics }) => (
                    <tr key={row.id}>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          value={row.companyName}
                          onChange={(e) => updateListedRow(row.id, { companyName: e.target.value })}
                          placeholder="Company / script"
                          className="w-full h-8 text-xs px-2 border border-[var(--border-strong)] rounded bg-[var(--surface)] outline-none focus:border-[var(--brand-500)]"
                        />
                      </td>
                      <td className="px-1 py-1">{numInput(row.openingUnits, (v) => updateListedRow(row.id, { openingUnits: v }))}</td>
                      <td className="px-1 py-1">{numInput(row.unitsPurchased, (v) => updateListedRow(row.id, { unitsPurchased: v }))}</td>
                      <td className="px-1 py-1">{numInput(row.unitsSold, (v) => updateListedRow(row.id, { unitsSold: v }))}</td>
                      <td className="px-1 py-1 text-right font-mono text-[var(--ink-600)]">{metrics.closingUnits.toLocaleString('en-IN')}</td>
                      <td className="px-1 py-1">{numInput(row.openingLtp, (v) => updateListedRow(row.id, { openingLtp: v }))}</td>
                      <td className="px-1 py-1">{numInput(row.closingLtp, (v) => updateListedRow(row.id, { closingLtp: v }))}</td>
                      <td className="px-1 py-1 text-right font-mono" style={{ color: metrics.fvGainLoss < 0 ? 'var(--danger-600)' : 'var(--success-700)' }}>
                        {metrics.fvGainLoss.toLocaleString('en-IN')}
                      </td>
                      <td className="px-1 py-1">{numInput(row.soldUnitGainLoss, (v) => updateListedRow(row.id, { soldUnitGainLoss: v }))}</td>
                      <td className="px-1 py-1">
                        <button type="button" onClick={() => removeListedRow(row.id)} className="text-red-500 hover:text-red-700" aria-label="Remove script">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--ink-600)' }}>
              <span>Total FV gain/(loss): NPR {totalFvGainLoss.toLocaleString('en-IN')}</span>
              <span>Sold-unit P&L (TB): NPR {totalSoldPnl.toLocaleString('en-IN')}</span>
              <button type="button" onClick={addListedRow} className="text-blue-600 underline">+ Add script</button>
            </div>
          </div>
        )}

        {unlistedCost > 0 && (
          <div className="grid grid-cols-3 gap-3 items-end border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--ink-500)' }}>Unlisted Shares — Cost (TB)</p>
              <p className="font-mono text-sm">{unlistedCost.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--ink-500)' }}>Impairment Amount</label>
              {numInput(unlistedImpairment, setUnlistedImpairment)}
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--ink-500)' }}>Carrying Amount</p>
              <p className="font-mono text-sm">{unlistedCarrying.toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end mt-4">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Investment Adjustments
        </Button>
      </div>
    </Card>
  );
}
