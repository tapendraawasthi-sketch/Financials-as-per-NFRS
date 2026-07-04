// src/components/adjustments/AdjustmentJournalView.tsx
import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import InputField from '../ui/InputField';
import NumberInput from '../ui/NumberInput';
import type { JournalEntryGroup, JournalLine } from '../../types/adjustments';

interface AdjustmentJournalViewProps {
  groups: JournalEntryGroup[];
  onAddManual: (group: Omit<JournalEntryGroup, 'groupId' | 'totalDr' | 'totalCr' | 'isBalanced'>) => void;
  roundingLevel?: number;
  readOnly?: boolean;
}

interface LineDraft {
  account: string;
  amount: number | '';
}

const BLANK_DR: LineDraft = { account: '', amount: '' };
const BLANK_CR: LineDraft = { account: '', amount: '' };

function fmtAmt(n: number): string {
  if (n === 0) return '—';
  return Math.abs(n).toLocaleString('en-IN');
}

function sumLines(lines: LineDraft[]): number {
  return lines.reduce((s, l) => s + (typeof l.amount === 'number' ? l.amount : 0), 0);
}

export default function AdjustmentJournalView({
  groups,
  onAddManual,
  roundingLevel = 1,
  readOnly = false,
}: AdjustmentJournalViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [narration, setNarration] = useState('');
  const [drLines, setDrLines] = useState<LineDraft[]>([{ ...BLANK_DR }]);
  const [crLines, setCrLines] = useState<LineDraft[]>([{ ...BLANK_CR }]);
  const [formErr, setFormErr] = useState<string | null>(null);

  const systemGroups = groups.filter((g) => g.lines.some((l) => l.source === 'System'));
  const manualGroups = groups.filter((g) => g.lines.every((l) => l.source !== 'System'));

  const totalDr = groups.reduce((s, g) => s + g.totalDr, 0);
  const totalCr = groups.reduce((s, g) => s + g.totalCr, 0);
  const balanced = Math.abs(totalDr - totalCr) <= roundingLevel;

  const drSum = sumLines(drLines);
  const crSum = sumLines(crLines);
  const formBalanced = Math.abs(drSum - crSum) <= roundingLevel
    && drLines.every((l) => l.account.trim() && typeof l.amount === 'number' && l.amount > 0)
    && crLines.every((l) => l.account.trim() && typeof l.amount === 'number' && l.amount > 0);

  const resetForm = () => {
    setNarration('');
    setDrLines([{ ...BLANK_DR }]);
    setCrLines([{ ...BLANK_CR }]);
    setFormErr(null);
  };

  const handleAdd = () => {
    if (!formBalanced) {
      setFormErr('Dr and Cr totals must match within NPR 1, with all accounts and amounts filled.');
      return;
    }
    const groupId = `manual-${Date.now()}`;
    const lines: JournalLine[] = [
      ...drLines.map((l, i) => ({
        id: `${groupId}-dr-${i}`,
        groupId,
        lineType: 'Dr' as const,
        account: l.account.trim(),
        amount: l.amount as number,
        linkedTo: 'Trial',
        source: 'Manual' as const,
      })),
      ...crLines.map((l, i) => ({
        id: `${groupId}-cr-${i}`,
        groupId,
        lineType: 'Cr' as const,
        account: l.account.trim(),
        amount: l.amount as number,
        linkedTo: 'Trial',
        source: 'Manual' as const,
      })),
    ];
    onAddManual({ narration: narration.trim() || 'Manual adjustment', lines });
    resetForm();
    setModalOpen(false);
  };

  const updateLine = (
    setter: React.Dispatch<React.SetStateAction<LineDraft[]>>,
    idx: number,
    field: keyof LineDraft,
    value: string | number | '',
  ) => {
    setter((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
    setFormErr(null);
  };

  const tdCls = 'text-xs';

  return (
    <>
      <Card title="Year-End Adjustment Journal Entries" padding="none">
        <div className="overflow-x-auto">
          <table className="fin-table w-full" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th className="w-8 text-center">S.No.</th>
                <th className="w-12">Dr/Cr</th>
                <th style={{ width: 220 }}>Particulars</th>
                <th className="text-right" style={{ width: 110 }}>Dr. Amount</th>
                <th className="text-right" style={{ width: 110 }}>Cr. Amount</th>
                <th className="w-16">Source</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-xs" style={{ color: 'var(--ink-400)' }}>
                    No adjustment entries yet. Download the template, upload your Excel file, or click &quot;No adjustment entries to upload&quot;.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <React.Fragment key={group.groupId}>
                    {group.narration && (
                      <tr>
                        <td colSpan={6} className="text-xs font-semibold py-2 px-3" style={{ background: 'var(--surface-raised)', color: 'var(--ink-700)' }}>
                          {group.narration}
                          <span
                            className="ml-2 text-[10px] font-medium"
                            style={{ color: group.isBalanced ? 'var(--success-600)' : 'var(--danger-600)' }}
                          >
                            {group.isBalanced ? 'Balanced ✓' : 'Unbalanced ✗'}
                          </span>
                        </td>
                      </tr>
                    )}
                    {group.lines.map((line, li) => (
                      <tr key={line.id}>
                        <td className="text-center text-[10px]" style={{ color: 'var(--ink-400)' }}>
                          {li === 0 ? group.groupId : ''}
                        </td>
                        <td className={`${tdCls} font-medium`}>{line.lineType}</td>
                        <td className={tdCls} title={line.account}>
                          <span className="block truncate max-w-[200px]">{line.account}</span>
                        </td>
                        <td className="amount text-xs font-semibold" style={{ color: 'var(--ink-900)' }}>
                          {line.lineType === 'Dr' ? fmtAmt(line.amount) : '—'}
                        </td>
                        <td className="amount text-xs font-semibold" style={{ color: 'var(--ink-900)' }}>
                          {line.lineType === 'Cr' ? fmtAmt(line.amount) : '—'}
                        </td>
                        <td className="text-[10px]" style={{ color: 'var(--ink-400)' }}>
                          {line.source}
                        </td>
                      </tr>
                    ))}
                    {!group.narration && (
                      <tr>
                        <td colSpan={6} className="text-[10px] py-1 px-3" style={{ color: group.isBalanced ? 'var(--success-600)' : 'var(--danger-600)' }}>
                          {group.isBalanced ? 'Balanced ✓' : 'Unbalanced ✗'}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="row-total">
                <td colSpan={3} className="text-xs font-bold" style={{ color: 'var(--ink-700)' }}>
                  Total Adjustments
                </td>
                <td className="amount text-xs font-bold" style={{ color: 'var(--ink-900)' }}>
                  {fmtAmt(totalDr)}
                </td>
                <td className="amount text-xs font-bold" style={{ color: 'var(--ink-900)' }}>
                  {fmtAmt(totalCr)}
                </td>
                <td>
                  {groups.length > 0 && (
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: balanced ? 'var(--success-600)' : 'var(--danger-600)' }}
                    >
                      {balanced ? 'Balanced' : `NOT BALANCED — Diff: ${fmtAmt(Math.abs(totalDr - totalCr))}`}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-hairline)' }}>
          <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
            {systemGroups.length} system {systemGroups.length === 1 ? 'group' : 'groups'},&nbsp;
            {manualGroups.length} manual/upload {manualGroups.length === 1 ? 'group' : 'groups'}
          </p>
          {!readOnly && (
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
              + Add Manual Entry
            </Button>
          )}
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setFormErr(null); }}
        title="Add Manual Journal Entry"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleAdd} disabled={!formBalanced}>
              Save Entry
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <InputField
            label="Narration (optional)"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="e.g. (Being audit fee accrual)"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--ink-700)' }}>Dr Lines</span>
              <Button variant="link" size="xs" onClick={() => setDrLines((p) => [...p, { ...BLANK_DR }])}>
                + Add Dr Line
              </Button>
            </div>
            {drLines.map((line, idx) => (
              <div key={`dr-${idx}`} className="form-grid-2 mb-2">
                <InputField
                  label={idx === 0 ? 'Dr Account' : ''}
                  value={line.account}
                  onChange={(e) => updateLine(setDrLines, idx, 'account', e.target.value)}
                  placeholder="Account name"
                />
                <NumberInput
                  label={idx === 0 ? 'Dr Amount' : ''}
                  value={line.amount}
                  onChange={(v) => updateLine(setDrLines, idx, 'amount', v)}
                  prefix="NPR"
                  min={0}
                />
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--ink-700)' }}>Cr Lines</span>
              <Button variant="link" size="xs" onClick={() => setCrLines((p) => [...p, { ...BLANK_CR }])}>
                + Add Cr Line
              </Button>
            </div>
            {crLines.map((line, idx) => (
              <div key={`cr-${idx}`} className="form-grid-2 mb-2">
                <InputField
                  label={idx === 0 ? 'Cr Account' : ''}
                  value={line.account}
                  onChange={(e) => updateLine(setCrLines, idx, 'account', e.target.value)}
                  placeholder="Account name"
                />
                <NumberInput
                  label={idx === 0 ? 'Cr Amount' : ''}
                  value={line.amount}
                  onChange={(v) => updateLine(setCrLines, idx, 'amount', v)}
                  prefix="NPR"
                  min={0}
                />
              </div>
            ))}
          </div>

          <p className="text-xs" style={{ color: formBalanced ? 'var(--success-600)' : 'var(--ink-500)' }}>
            Dr Total: NPR {drSum.toLocaleString('en-IN')} | Cr Total: NPR {crSum.toLocaleString('en-IN')}
            {formBalanced ? ' — Balanced ✓' : ` — Difference: NPR ${Math.abs(drSum - crSum).toLocaleString('en-IN')}`}
          </p>
          {formErr && (
            <p className="text-xs" style={{ color: 'var(--danger-600)' }}>{formErr}</p>
          )}
        </div>
      </Modal>
    </>
  );
}
