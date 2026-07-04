import React, { useMemo, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import type { YearEndAdjustments } from '../../types';
import { ADVANCE_TAX_CHECKPOINTS } from '../../data/advanceTaxCheckpoints';
import { computeAdvanceTaxInterest, defaultAdvanceTaxDaysLate } from '../../utils/advanceTaxCalculations';

export interface AdvanceTaxFormData {
  advanceTax1: number;
  advanceTax2: number;
  advanceTax3: number;
  advanceTaxDaysLate1: number;
  advanceTaxDaysLate2: number;
  advanceTaxDaysLate3: number;
  tdsCredit: number;
  priorYearLosses: Array<{ fiscalYear: string; amount: number }>;
}

interface AdvanceTaxInstallmentsPanelProps {
  initialData?: Partial<YearEndAdjustments>;
  estimatedTaxLiability?: number;
  onSave: (data: AdvanceTaxFormData) => Promise<void> | void;
}

const DEFAULT_DAYS = defaultAdvanceTaxDaysLate();

function numInput(value: number, onChange: (v: number) => void) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full h-8 text-xs font-mono text-right px-2 border border-[var(--border-strong)] rounded bg-[var(--surface)] outline-none focus:border-[var(--brand-500)]"
    />
  );
}

export default function AdvanceTaxInstallmentsPanel({
  initialData = {},
  estimatedTaxLiability = 0,
  onSave,
}: AdvanceTaxInstallmentsPanelProps) {
  const [payments, setPayments] = useState([
    initialData.advanceTax1 ?? 0,
    initialData.advanceTax2 ?? 0,
    initialData.advanceTax3 ?? 0,
  ]);
  const [daysLate, setDaysLate] = useState([
    initialData.advanceTaxDaysLate1 ?? DEFAULT_DAYS[0],
    initialData.advanceTaxDaysLate2 ?? DEFAULT_DAYS[1],
    initialData.advanceTaxDaysLate3 ?? DEFAULT_DAYS[2],
  ]);
  const [tdsCredit, setTdsCredit] = useState(initialData.tdsCredit ?? 0);
  const [lossRows, setLossRows] = useState<Array<{ fiscalYear: string; amount: number }>>(
    initialData.priorYearLosses?.length
      ? initialData.priorYearLosses
      : [{ fiscalYear: '', amount: 0 }],
  );
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    if (estimatedTaxLiability <= 0) return null;
    const installments = ADVANCE_TAX_CHECKPOINTS.map((cp, i) => ({
      checkpoint: cp.checkpoint,
      cumulativePercent: cp.cumulativePercent,
      paidAmount: payments[i] ?? 0,
      daysLate: daysLate[i] ?? cp.defaultDaysLate,
    }));
    return computeAdvanceTaxInterest(estimatedTaxLiability, installments);
  }, [estimatedTaxLiability, payments, daysLate]);

  const updatePayment = (index: number, value: number) => {
    setPayments((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const updateDaysLate = (index: number, value: number) => {
    setDaysLate((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        advanceTax1: payments[0] ?? 0,
        advanceTax2: payments[1] ?? 0,
        advanceTax3: payments[2] ?? 0,
        advanceTaxDaysLate1: daysLate[0] ?? DEFAULT_DAYS[0],
        advanceTaxDaysLate2: daysLate[1] ?? DEFAULT_DAYS[1],
        advanceTaxDaysLate3: daysLate[2] ?? DEFAULT_DAYS[2],
        tdsCredit,
        priorYearLosses: lossRows.filter((r) => r.fiscalYear.trim() && r.amount > 0),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Advance Tax Installments (u/s 118 & 119)" padding="md">
      <p className="text-xs mb-3" style={{ color: 'var(--ink-500)' }}>
        Enter cumulative tax paid at each checkpoint and days late for Section 118 interest.
        Values flow to the Tax Calculation workbook sheet.
      </p>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--surface-sunken)' }}>
              <th className="px-2 py-2 text-left">Checkpoint</th>
              <th className="px-2 py-2 text-right w-16">Cum. %</th>
              <th className="px-2 py-2 text-right w-28">Tax Paid (NPR)</th>
              <th className="px-2 py-2 text-right w-24">Days Late</th>
              {preview && <th className="px-2 py-2 text-right w-28">Interest @15%</th>}
            </tr>
          </thead>
          <tbody>
            {ADVANCE_TAX_CHECKPOINTS.map((cp, i) => (
              <tr key={cp.checkpoint}>
                <td className="px-2 py-1">{cp.checkpoint}</td>
                <td className="px-2 py-1 text-right font-mono">{(cp.cumulativePercent * 100).toFixed(0)}%</td>
                <td className="px-1 py-1">{numInput(payments[i] ?? 0, (v) => updatePayment(i, v))}</td>
                <td className="px-1 py-1">{numInput(daysLate[i] ?? cp.defaultDaysLate, (v) => updateDaysLate(i, v))}</td>
                {preview && (
                  <td className="px-2 py-1 text-right font-mono">
                    {(preview.installments[i]?.interestAmount ?? 0).toLocaleString('en-IN')}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && estimatedTaxLiability > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div>
            <p style={{ color: 'var(--ink-500)' }}>Est. tax liability (preview)</p>
            <p className="font-mono">{estimatedTaxLiability.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p style={{ color: 'var(--ink-500)' }}>Interest u/s 118</p>
            <p className="font-mono">{preview.totalInterest118.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p style={{ color: 'var(--ink-500)' }}>Interest u/s 119 (final shortfall)</p>
            <p className="font-mono">{preview.totalInterest119.toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--ink-500)' }}>TDS / WHT Credit</label>
          {numInput(tdsCredit, setTdsCredit)}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-700)' }}>Prior-year losses (u/s 20 carry-forward)</p>
        {lossRows.map((row, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              value={row.fiscalYear}
              onChange={(e) => setLossRows((prev) => prev.map((r, j) => (j === i ? { ...r, fiscalYear: e.target.value } : r)))}
              placeholder="FY e.g. 2079/80"
              className="flex-1 h-8 text-xs px-2 border border-[var(--border-strong)] rounded bg-[var(--surface)]"
            />
            {numInput(row.amount, (v) => setLossRows((prev) => prev.map((r, j) => (j === i ? { ...r, amount: v } : r))))}
            <button
              type="button"
              className="text-red-500 px-2"
              onClick={() => setLossRows((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Remove loss row"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-blue-600 underline"
          onClick={() => setLossRows((prev) => [...prev, { fiscalYear: '', amount: 0 }])}
        >
          + Add loss year
        </button>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Advance Tax & Losses
        </Button>
      </div>
    </Card>
  );
}
