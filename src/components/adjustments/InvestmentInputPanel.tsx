import React, { useMemo, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { InvestmentAdjustment, MappedTBRow } from '../../types';

interface InvestmentInputPanelProps {
  trialBalanceRows?: MappedTBRow[];
  initialItems?: InvestmentAdjustment[];
  onSave: (items: InvestmentAdjustment[]) => Promise<void> | void;
}

function tbBalance(rows: MappedTBRow[], category: string): number {
  return rows
    .filter((row) => !row.isGroupRow && row.nfrsCategory === category)
    .reduce((sum, row) => sum + (row.closingDr ?? 0), 0);
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

  const listedExisting = initialItems.find((item) => item.investmentType === 'listed_trading' || item.type === 'listed');
  const unlistedExisting = initialItems.find((item) => item.investmentType === 'unlisted' || item.type === 'unlisted');

  const [listedFV, setListedFV] = useState(
    listedExisting?.totalFairValue ?? listedExisting?.carryingAmount ?? listedCost,
  );
  const [unlistedImpairment, setUnlistedImpairment] = useState(
    unlistedExisting?.impairmentAmount ?? 0,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listedGainLoss = listedFV - listedCost;
  const unlistedCarrying = Math.max(0, unlistedCost - unlistedImpairment);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const items: InvestmentAdjustment[] = [];
      if (listedCost > 0) {
        items.push({
          id: listedExisting?.id ?? 'listed-trading',
          type: 'listed',
          investmentType: 'listed_trading',
          name: listedExisting?.investmentName ?? listedExisting?.name ?? 'Listed Shares',
          investmentName: listedExisting?.investmentName ?? 'Listed Shares',
          totalCost: listedCost,
          totalFairValue: listedFV,
          carryingAmount: listedFV,
          fairValueGainLoss: listedGainLoss,
          gainLossOnFV: listedGainLoss,
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

  if (listedCost === 0 && unlistedCost === 0) {
    return null;
  }

  return (
    <Card title="Investment Fair Value / Impairment" padding="md">
      <div className="space-y-4">
        {listedCost > 0 && (
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <p className="text-xs text-slate-500 mb-1">Listed Shares — Cost (TB)</p>
              <p className="font-mono text-sm">{listedCost.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fair Value (CY)</label>
              <input
                type="number"
                min={0}
                value={listedFV || ''}
                onChange={(e) => setListedFV(parseFloat(e.target.value) || 0)}
                className="w-full h-8 text-xs font-mono text-right px-2 border border-slate-200 rounded"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">FV Gain / (Loss)</p>
              <p className={`font-mono text-sm ${listedGainLoss < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {listedGainLoss.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        )}

        {unlistedCost > 0 && (
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <p className="text-xs text-slate-500 mb-1">Unlisted Shares — Cost (TB)</p>
              <p className="font-mono text-sm">{unlistedCost.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Impairment Amount</label>
              <input
                type="number"
                min={0}
                value={unlistedImpairment || ''}
                onChange={(e) => setUnlistedImpairment(parseFloat(e.target.value) || 0)}
                className="w-full h-8 text-xs font-mono text-right px-2 border border-slate-200 rounded"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Carrying Amount</p>
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
