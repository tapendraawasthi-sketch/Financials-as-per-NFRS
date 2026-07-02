// src/components/adjustments/AdjustmentJournalView.tsx
import React, { useState } from 'react';
import Card           from '../ui/Card';
import Button         from '../ui/Button';
import Modal          from '../ui/Modal';
import InputField     from '../ui/InputField';
import NumberInput    from '../ui/NumberInput';
import SelectDropdown from '../ui/SelectDropdown';

type AdjType = 'DEPN' | 'PROV' | 'INV' | 'INV-FV' | 'TAX' | 'OTHER';
type Source  = 'System' | 'Manual';

interface JournalEntry {
  id:          string;
  description: string;
  drAccount:   string;
  crAccount:   string;
  amount:      number;
  type:        AdjType;
  source:      Source;
}

interface AdjustmentJournalViewProps {
  entries:      JournalEntry[];
  onAddManual:  (entry: Omit<JournalEntry, 'id' | 'source'>) => void;
  roundingLevel?: number;
}

const TYPE_OPTIONS = [
  { value: 'DEPN',   label: 'DEPN — Depreciation'  },
  { value: 'PROV',   label: 'PROV — Provision'      },
  { value: 'INV',    label: 'INV — Inventory'       },
  { value: 'INV-FV', label: 'INV-FV — Inventory FV' },
  { value: 'TAX',    label: 'TAX — Tax'             },
  { value: 'OTHER',  label: 'OTHER — Other'         },
];

const BLANK_FORM = {
  description: '',
  drAccount:   '',
  crAccount:   '',
  amount:      0 as number | '',
  type:        'OTHER' as AdjType,
};

function fmtAmt(n: number): string {
  if (n === 0) return '—';
  return Math.abs(n).toLocaleString('en-IN');
}

export default function AdjustmentJournalView({
  entries,
  onAddManual,
  roundingLevel = 100,
}: AdjustmentJournalViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState({ ...BLANK_FORM });
  const [formErr,   setFormErr]   = useState<Partial<Record<keyof typeof BLANK_FORM, string>>>({});

  const systemCount = entries.filter(e => e.source === 'System').length;
  const manualCount = entries.filter(e => e.source === 'Manual').length;

  const totalDr = entries.reduce((s, e) => s + e.amount, 0);
  const totalCr = entries.reduce((s, e) => s + e.amount, 0);
  const balanced = Math.abs(totalDr - totalCr) <= roundingLevel;

  const setF = <K extends keyof typeof BLANK_FORM>(k: K, v: (typeof BLANK_FORM)[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (formErr[k as keyof typeof formErr])
      setFormErr(prev => ({ ...prev, [k]: undefined }));
  };

  const validateForm = (): boolean => {
    const e: typeof formErr = {};
    if (!form.description.trim()) e.description = 'Required';
    if (!form.drAccount.trim())   e.drAccount   = 'Required';
    if (!form.crAccount.trim())   e.crAccount   = 'Required';
    if (!form.amount || form.amount <= 0) e.amount = 'Enter a positive amount';
    setFormErr(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    onAddManual({
      description: form.description,
      drAccount:   form.drAccount,
      crAccount:   form.crAccount,
      amount:      form.amount as number,
      type:        form.type,
    });
    setForm({ ...BLANK_FORM });
    setFormErr({});
    setModalOpen(false);
  };

  const thCls = 'px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-left bg-slate-50 border-b border-slate-200 whitespace-nowrap';
  const tdCls = 'px-2.5 py-1.5 text-xs text-slate-700';

  return (
    <>
      <Card title="Year-End Adjustment Journal Entries" padding="none">
        <div className="overflow-x-auto">
          <table className="fin-table w-full" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th className={`${thCls} w-8 text-center`}>#</th>
                <th className={`${thCls}`} style={{ width: 200 }}>Description</th>
                <th className={`${thCls}`} style={{ width: 160 }}>Dr Account</th>
                <th className={`${thCls} text-right`} style={{ width: 100 }}>Amount (Dr)</th>
                <th className={`${thCls}`} style={{ width: 160 }}>Cr Account</th>
                <th className={`${thCls} text-right`} style={{ width: 100 }}>Amount (Cr)</th>
                <th className={`${thCls} w-20`}>Type</th>
                <th className={`${thCls} w-16`}>Source</th>
              </tr>
            </thead>

            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    No adjustment entries yet. Click "Calculate Depreciation" or add manually.
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-slate-100/50 transition-colors`}
                  >
                    <td className="px-2.5 py-1.5 text-center text-[10px] text-slate-400">
                      {i + 1}
                    </td>
                    <td className={tdCls} title={e.description}>
                      <span className="block truncate max-w-[180px]">{e.description}</span>
                    </td>
                    <td className={`${tdCls} text-slate-600`} title={e.drAccount}>
                      <span className="block truncate max-w-[140px]">{e.drAccount}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-xs font-semibold text-slate-800">
                      {fmtAmt(e.amount)}
                    </td>
                    <td className={`${tdCls} text-slate-600`} title={e.crAccount}>
                      <span className="block truncate max-w-[140px]">{e.crAccount}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-xs font-semibold text-slate-800">
                      {fmtAmt(e.amount)}
                    </td>
                    <td className="px-2.5 py-1.5 text-[10px] uppercase text-slate-400">
                      {e.type}
                    </td>
                    <td className="px-2.5 py-1.5 text-[10px] text-slate-400">
                      {e.source}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-2.5 py-2 text-xs font-bold text-slate-700">
                  Total Adjustments
                </td>
                <td className="px-2.5 py-2 text-right font-mono text-xs font-bold text-slate-800">
                  {fmtAmt(totalDr)}
                </td>
                <td />
                <td className="px-2.5 py-2 text-right font-mono text-xs font-bold text-slate-800">
                  {fmtAmt(totalCr)}
                </td>
                <td colSpan={2} className="px-2.5 py-2">
                  {entries.length > 0 && (
                    <span
                      className={`text-[11px] font-semibold ${
                        balanced ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {balanced
                        ? 'Balanced'
                        : `NOT BALANCED — Difference: ${fmtAmt(Math.abs(totalDr - totalCr))}`}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {systemCount} system {systemCount === 1 ? 'entry' : 'entries'},&nbsp;
            {manualCount} manual {manualCount === 1 ? 'entry' : 'entries'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            + Add Manual Entry
          </Button>
        </div>
      </Card>

      {/* Add Manual Entry modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setFormErr({}); }}
        title="Add Manual Journal Entry"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleAdd}>
              Add Entry
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <InputField
            label="Description"
            value={form.description}
            onChange={e => setF('description', e.target.value)}
            error={formErr.description}
            required
            placeholder="e.g. Prior year audit fee accrual"
          />
          <div className="form-grid-2">
            <InputField
              label="Dr Account"
              value={form.drAccount}
              onChange={e => setF('drAccount', e.target.value)}
              error={formErr.drAccount}
              required
              placeholder="e.g. Audit Fee Expense"
            />
            <InputField
              label="Cr Account"
              value={form.crAccount}
              onChange={e => setF('crAccount', e.target.value)}
              error={formErr.crAccount}
              required
              placeholder="e.g. Audit Fee Payable"
            />
          </div>
          <div className="form-grid-2">
            <NumberInput
              label="Amount (NPR)"
              value={form.amount}
              onChange={v => setF('amount', v)}
              error={formErr.amount}
              required
              prefix="NPR"
              min={0}
            />
            <SelectDropdown
              label="Type"
              value={form.type}
              onChange={e => setF('type', e.target.value as AdjType)}
              options={TYPE_OPTIONS}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
