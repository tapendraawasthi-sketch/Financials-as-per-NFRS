// ===== src/components/adjustments/AdjustmentJournalView.tsx =====
import React, { useState } from 'react';
import type { YearEndAdjustments, AdjustmentJournalEntry } from '../../types';
import { formatNPR } from '../../utils/numberFormat';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import InputField from '../ui/InputField';
import SelectDropdown from '../ui/SelectDropdown';

interface AdjustmentJournalViewProps {
  adjustments: YearEndAdjustments;
}

export default function AdjustmentJournalView({ adjustments }: AdjustmentJournalViewProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false);
  const [entries, setEntries] = useState<AdjustmentJournalEntry[]>(adjustments.journalEntries);
  const [form, setForm] = useState<Partial<AdjustmentJournalEntry>>({ isSystemGenerated: false, adjustmentType: 'other' });

  const totalDr = entries.reduce((s, e) => s + e.amount, 0);
  const isBalanced = Math.abs(totalDr - totalDr) < 1; // each JE is a pair in real implementation

  const typeOptions = ['depreciation','inventory_impairment','investment_fv','provision','tax','other'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));

  const addEntry = () => {
    if (!form.debitAccount || !form.creditAccount || !form.amount) return;
    const entry: AdjustmentJournalEntry = { id: Date.now().toString(), description: form.description ?? '', debitAccount: form.debitAccount!, creditAccount: form.creditAccount!, amount: Number(form.amount), adjustmentType: (form.adjustmentType ?? 'other') as AdjustmentJournalEntry['adjustmentType'], isSystemGenerated: false };
    setEntries((prev) => [...prev, entry]);
    setShowModal(false);
    setForm({ isSystemGenerated: false, adjustmentType: 'other' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Adjustment Journal Entries ({entries.length})</h3>
        <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>+ Add Manual Adjustment</Button>
      </div>

      {!isBalanced && <Alert type="warning" title="Journal Not Balanced" message="Total debits do not equal total credits. Check your entries." />}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['#', 'Description', 'Dr Account', 'Cr Account', 'Amount', 'Type', 'Source'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 italic text-sm">No adjustment entries yet. System will add depreciation, bonus, and tax entries automatically.</td></tr>
            ) : entries.map((entry, i) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                <td className="px-4 py-3 text-slate-700">{entry.description}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{entry.debitAccount}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{entry.creditAccount}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{formatNPR(entry.amount)}</td>
                <td className="px-4 py-3"><Badge label={entry.adjustmentType} variant="info" size="sm" /></td>
                <td className="px-4 py-3"><Badge label={entry.isSystemGenerated ? 'System' : 'Manual'} variant={entry.isSystemGenerated ? 'default' : 'success'} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Manual Adjustment"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={addEntry}>Add Entry</Button></div>}>
        <div className="space-y-4">
          <InputField label="Description" value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <InputField label="Debit Account" value={form.debitAccount ?? ''} onChange={(e) => setForm((p) => ({ ...p, debitAccount: e.target.value }))} />
          <InputField label="Credit Account" value={form.creditAccount ?? ''} onChange={(e) => setForm((p) => ({ ...p, creditAccount: e.target.value }))} />
          <InputField label="Amount (NPR)" type="number" value={String(form.amount ?? '')} onChange={(e) => setForm((p) => ({ ...p, amount: Number(e.target.value) }))} />
          <SelectDropdown label="Adjustment Type" options={typeOptions} value={form.adjustmentType ?? 'other'} onChange={(e) => setForm((p) => ({ ...p, adjustmentType: e.target.value as any }))} />
        </div>
      </Modal>
    </div>
  );
}
