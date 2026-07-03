// ===== src/components/adjustments/SubledgerInputPanel.tsx =====
// Tabbed panel for entering subledger detail:
//   Tab 1: Debtors (party-wise receivable balances)
//   Tab 2: Creditors (party-wise payable balances)
//   Tab 3: Bank Accounts (individual bank ledgers)
//   Tab 4: Related Parties (transactions and outstanding balances)

import React, { useState, useCallback, useEffect } from 'react';
import Button from '../ui/Button';
import Alert  from '../ui/Alert';

// ─── Local types (mirror subledgerStore interfaces) ────────────────────────────

interface DebtorRow {
  id:               string;
  partyName:        string;
  debitBalance:     number | '';
  creditBalance:    number | '';
  isRelatedParty:   boolean;
  relationshipType: string;
  agingDays:        number | '';
}

interface CreditorRow {
  id:               string;
  partyName:        string;
  creditBalance:    number | '';
  debitBalance:     number | '';
  isRelatedParty:   boolean;
  relationshipType: string;
}

interface BankRow {
  id:                    string;
  bankName:              string;
  accountNumber:         string;
  accountType:           string;
  balance:               number | '';
  interestRate:          number | '';
  maturityDate:          string;
  securedBy:             string;
  currentPortionOfLoan:  number | '';
}

interface RelatedPartyRow {
  id:                 string;
  partyName:          string;
  relationshipType:   string;
  transactionDesc:    string;
  transactionAmount:  number | '';
  direction:          'receivable' | 'payable';
  outstandingBalance: number | '';
  isArmLength:        boolean;
}

// ─── Props ──────────────────────────────────────────────────────────────────────

interface SubledgerInputPanelProps {
  companyId:        string;
  tbDebtorTotal:    number;   // from trial balance for reconciliation check
  tbCreditorTotal:  number;
  onSaveComplete?:  () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const BANK_ACCOUNT_TYPES = [
  { value: 'current',         label: 'Current Account' },
  { value: 'savings',         label: 'Savings Account' },
  { value: 'call',            label: 'Call Account' },
  { value: 'fixed_deposit',   label: 'Fixed Deposit (FDR)' },
  { value: 'loan',            label: 'Term Loan' },
  { value: 'overdraft',       label: 'Bank Overdraft (OD)' },
  { value: 'cash_credit',     label: 'Cash Credit (CC)' },
  { value: 'working_capital', label: 'Working Capital Loan' },
];

const RELATIONSHIP_TYPES = [
  { value: 'director',              label: 'Director' },
  { value: 'shareholder_above_5pct',label: 'Shareholder (>5%)' },
  { value: 'key_management',        label: 'Key Management Personnel' },
  { value: 'group_company',         label: 'Group Company' },
  { value: 'associate',             label: 'Associate' },
  { value: 'other',                 label: 'Other Related Party' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

let nextId = 1;
const genId = () => `row-${nextId++}`;

function emptyDebtor(): DebtorRow {
  return { id: genId(), partyName: '', debitBalance: '', creditBalance: '',
           isRelatedParty: false, relationshipType: '', agingDays: '' };
}
function emptyCreditor(): CreditorRow {
  return { id: genId(), partyName: '', creditBalance: '', debitBalance: '',
           isRelatedParty: false, relationshipType: '' };
}
function emptyBank(): BankRow {
  return { id: genId(), bankName: '', accountNumber: '', accountType: 'current',
           balance: '', interestRate: '', maturityDate: '', securedBy: '',
           currentPortionOfLoan: '' };
}
function emptyRelatedParty(): RelatedPartyRow {
  return { id: genId(), partyName: '', relationshipType: 'director',
           transactionDesc: '', transactionAmount: '', direction: 'payable',
           outstandingBalance: '', isArmLength: false };
}

function fmt(n: number | ''): string {
  if (n === '' || n === 0) return '';
  return Math.abs(n as number).toLocaleString('en-IN');
}

function numVal(v: number | ''): number {
  return v === '' ? 0 : (v as number);
}

// ─── Input cell component ────────────────────────────────────────────────────────

function NumCell({
  value,
  onChange,
  negative = false,
}: {
  value: number | '';
  onChange: (v: number | '') => void;
  negative?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={focused ? 'number' : 'text'}
      value={focused ? (value === '' ? '' : String(value)) : (value === '' ? '' : fmt(value))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || raw === '-') { onChange(''); return; }
        const n = parseFloat(raw);
        if (!isNaN(n)) onChange(negative ? -Math.abs(n) : Math.abs(n));
      }}
      className="h-7 w-full text-xs font-mono text-right px-1.5 border border-slate-200
                 rounded bg-white outline-none focus:border-blue-400 transition-colors"
      placeholder="0"
    />
  );
}

function TextCell({
  value,
  onChange,
  placeholder = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 w-full text-xs px-1.5 border border-slate-200 rounded bg-white
                 outline-none focus:border-blue-400 transition-colors"
    />
  );
}

function SelectCell({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full text-xs px-1 border border-slate-200 rounded bg-white
                 outline-none focus:border-blue-400 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-5 w-5 flex items-center justify-center text-slate-300
                 hover:text-red-500 transition-colors mx-auto"
      aria-label="Delete row"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" strokeWidth={2}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
      </svg>
    </button>
  );
}

// ─── Debtors Tab ─────────────────────────────────────────────────────────────────

function DebtorsTab({
  companyId,
  tbTotal,
}: {
  companyId:   string;
  tbTotal:     number;
}) {
  const [rows,   setRows]   = useState<DebtorRow[]>([emptyDebtor()]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  // Load existing data
  useEffect(() => {
    fetch(`/api/adjustments/subledger/${companyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.debtors?.length > 0) {
          setRows(d.debtors.map((entry: any) => ({
            ...entry,
            debitBalance:  entry.debitBalance  ?? '',
            creditBalance: entry.creditBalance ?? '',
            agingDays:     entry.agingDays     ?? '',
          })));
        }
      })
      .catch(() => {/* no existing data — fine */});
  }, [companyId]);

  const setRow = useCallback((id: string, key: keyof DebtorRow, val: any) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: val } : r));
  }, []);

  const addRow  = () => setRows((prev) => [...prev, emptyDebtor()]);
  const delRow  = (id: string) =>
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev);

  const debitTotal  = rows.reduce((s, r) => s + numVal(r.debitBalance), 0);
  const creditTotal = rows.reduce((s, r) => s + numVal(r.creditBalance), 0);
  const diff        = Math.abs(debitTotal - tbTotal);
  const balanced    = diff <= 1 || tbTotal === 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = rows.filter((r) => r.partyName.trim()).map((r) => ({
        id:               r.id,
        partyName:        r.partyName,
        debitBalance:     numVal(r.debitBalance),
        creditBalance:    numVal(r.creditBalance),
        isRelatedParty:   r.isRelatedParty,
        relationshipType: r.relationshipType,
        agingDays:        numVal(r.agingDays) || undefined,
      }));
      const res = await fetch(`/api/adjustments/subledger/debtors`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyId, debtors: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save debtors.');
    } finally {
      setSaving(false);
    }
  };

  const thCls = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 whitespace-nowrap';

  return (
    <div className="space-y-3">
      {!balanced && tbTotal > 0 && (
        <Alert
          type="warning"
          message={`Debtor subledger total (NPR ${debitTotal.toLocaleString('en-IN')}) differs from trial balance (NPR ${tbTotal.toLocaleString('en-IN')}) by NPR ${diff.toLocaleString('en-IN')}. Reconcile before saving.`}
        />
      )}
      {balanced && tbTotal > 0 && rows.some((r) => r.partyName) && (
        <Alert type="success" message="Debtor subledger total matches trial balance." />
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="w-full" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th className={`${thCls} w-8 text-center`}>#</th>
              <th className={`${thCls} text-left`} style={{ width: 220 }}>Party Name</th>
              <th className={`${thCls} text-right`} style={{ width: 130 }}>Debit Balance (Dr)</th>
              <th className={`${thCls} text-right`} style={{ width: 130 }}>Advance Rec'd (Cr)</th>
              <th className={`${thCls} text-right`} style={{ width: 90 }}>Aging (days)</th>
              <th className={`${thCls} text-center`} style={{ width: 80 }}>Related Party</th>
              <th className={`${thCls}`} style={{ width: 130 }}>Relationship</th>
              <th className={`${thCls} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id}
                className="border-b border-slate-100 last:border-0 h-8 hover:bg-slate-50/40">
                <td className="text-center text-[10px] text-slate-400 px-1">{idx + 1}</td>
                <td className="px-1"><TextCell value={row.partyName}
                  onChange={(v) => setRow(row.id, 'partyName', v)} placeholder="Party name" /></td>
                <td className="px-1"><NumCell value={row.debitBalance}
                  onChange={(v) => setRow(row.id, 'debitBalance', v)} /></td>
                <td className="px-1"><NumCell value={row.creditBalance}
                  onChange={(v) => setRow(row.id, 'creditBalance', v)} /></td>
                <td className="px-1"><NumCell value={row.agingDays}
                  onChange={(v) => setRow(row.id, 'agingDays', v)} /></td>
                <td className="text-center px-1">
                  <input type="checkbox" checked={row.isRelatedParty}
                    onChange={(e) => setRow(row.id, 'isRelatedParty', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                </td>
                <td className="px-1">
                  {row.isRelatedParty
                    ? <SelectCell value={row.relationshipType || 'director'}
                        onChange={(v) => setRow(row.id, 'relationshipType', v)}
                        options={RELATIONSHIP_TYPES} />
                    : <span className="text-slate-300 text-xs px-1">—</span>}
                </td>
                <td className="px-1"><DeleteBtn onClick={() => delRow(row.id)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-2 py-1.5 text-xs font-bold text-slate-700">Total</td>
              <td className="px-2 py-1.5 text-right font-mono text-xs font-bold text-slate-800">
                {debitTotal > 0 ? debitTotal.toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-xs font-bold text-slate-800">
                {creditTotal > 0 ? creditTotal.toLocaleString('en-IN') : '—'}
              </td>
              <td colSpan={4} className="px-2 py-1.5 text-xs text-slate-400">
                {tbTotal > 0 && `TB total: ${tbTotal.toLocaleString('en-IN')} | Diff: ${balanced ? '✓ 0' : diff.toLocaleString('en-IN')}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow}
          className="text-xs text-blue-600 hover:text-blue-800 underline">
          + Add Row
        </button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Debtors'}
        </Button>
      </div>
    </div>
  );
}

// ─── Creditors Tab ────────────────────────────────────────────────────────────────

function CreditorsTab({
  companyId,
  tbTotal,
}: {
  companyId: string;
  tbTotal:   number;
}) {
  const [rows,   setRows]   = useState<CreditorRow[]>([emptyCreditor()]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    fetch(`/api/adjustments/subledger/${companyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.creditors?.length > 0) {
          setRows(d.creditors.map((e: any) => ({
            ...e,
            creditBalance: e.creditBalance ?? '',
            debitBalance:  e.debitBalance  ?? '',
          })));
        }
      })
      .catch(() => {});
  }, [companyId]);

  const setRow = useCallback((id: string, key: keyof CreditorRow, val: any) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: val } : r)), []);
  const addRow = () => setRows((prev) => [...prev, emptyCreditor()]);
  const delRow = (id: string) =>
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev);

  const creditTotal = rows.reduce((s, r) => s + numVal(r.creditBalance), 0);
  const debitTotal  = rows.reduce((s, r) => s + numVal(r.debitBalance), 0);
  const diff        = Math.abs(creditTotal - tbTotal);
  const balanced    = diff <= 1 || tbTotal === 0;

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const payload = rows.filter((r) => r.partyName.trim()).map((r) => ({
        id:               r.id,
        partyName:        r.partyName,
        creditBalance:    numVal(r.creditBalance),
        debitBalance:     numVal(r.debitBalance),
        isRelatedParty:   r.isRelatedParty,
        relationshipType: r.relationshipType,
      }));
      const res = await fetch('/api/adjustments/subledger/creditors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyId, creditors: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save creditors.');
    } finally { setSaving(false); }
  };

  const thCls = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 whitespace-nowrap';

  return (
    <div className="space-y-3">
      {!balanced && tbTotal > 0 && (
        <Alert type="warning"
          message={`Creditor subledger total (NPR ${creditTotal.toLocaleString('en-IN')}) differs from trial balance (NPR ${tbTotal.toLocaleString('en-IN')}) by NPR ${diff.toLocaleString('en-IN')}.`} />
      )}
      {balanced && tbTotal > 0 && rows.some((r) => r.partyName) && (
        <Alert type="success" message="Creditor subledger total matches trial balance." />
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="w-full" style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th className={`${thCls} w-8 text-center`}>#</th>
              <th className={`${thCls} text-left`} style={{ width: 220 }}>Party Name</th>
              <th className={`${thCls} text-right`} style={{ width: 130 }}>Credit Balance (Cr)</th>
              <th className={`${thCls} text-right`} style={{ width: 130 }}>Advance Paid (Dr)</th>
              <th className={`${thCls} text-center`} style={{ width: 80 }}>Related Party</th>
              <th className={`${thCls}`} style={{ width: 130 }}>Relationship</th>
              <th className={`${thCls} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id}
                className="border-b border-slate-100 last:border-0 h-8 hover:bg-slate-50/40">
                <td className="text-center text-[10px] text-slate-400 px-1">{idx + 1}</td>
                <td className="px-1"><TextCell value={row.partyName}
                  onChange={(v) => setRow(row.id, 'partyName', v)} placeholder="Party name" /></td>
                <td className="px-1"><NumCell value={row.creditBalance}
                  onChange={(v) => setRow(row.id, 'creditBalance', v)} /></td>
                <td className="px-1"><NumCell value={row.debitBalance}
                  onChange={(v) => setRow(row.id, 'debitBalance', v)} /></td>
                <td className="text-center px-1">
                  <input type="checkbox" checked={row.isRelatedParty}
                    onChange={(e) => setRow(row.id, 'isRelatedParty', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                </td>
                <td className="px-1">
                  {row.isRelatedParty
                    ? <SelectCell value={row.relationshipType || 'director'}
                        onChange={(v) => setRow(row.id, 'relationshipType', v)}
                        options={RELATIONSHIP_TYPES} />
                    : <span className="text-slate-300 text-xs px-1">—</span>}
                </td>
                <td className="px-1"><DeleteBtn onClick={() => delRow(row.id)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-2 py-1.5 text-xs font-bold text-slate-700">Total</td>
              <td className="px-2 py-1.5 text-right font-mono text-xs font-bold text-slate-800">
                {creditTotal > 0 ? creditTotal.toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-xs font-bold text-slate-800">
                {debitTotal > 0 ? debitTotal.toLocaleString('en-IN') : '—'}
              </td>
              <td colSpan={3} className="px-2 py-1.5 text-xs text-slate-400">
                {tbTotal > 0 && `TB total: ${tbTotal.toLocaleString('en-IN')} | Diff: ${balanced ? '✓ 0' : diff.toLocaleString('en-IN')}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow}
          className="text-xs text-blue-600 hover:text-blue-800 underline">+ Add Row</button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Creditors'}
        </Button>
      </div>
    </div>
  );
}

// ─── Bank Accounts Tab ────────────────────────────────────────────────────────────

function BankAccountsTab({ companyId }: { companyId: string }) {
  const [rows,   setRows]   = useState<BankRow[]>([emptyBank()]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    fetch(`/api/adjustments/subledger/${companyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.bankAccounts?.length > 0) {
          setRows(d.bankAccounts.map((e: any) => ({
            ...e,
            balance:             e.balance             ?? '',
            interestRate:        e.interestRate        ?? '',
            currentPortionOfLoan:e.currentPortionOfLoan?? '',
          })));
        }
      })
      .catch(() => {});
  }, [companyId]);

  const setRow = useCallback((id: string, key: keyof BankRow, val: any) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: val } : r)), []);
  const addRow = () => setRows((prev) => [...prev, emptyBank()]);
  const delRow = (id: string) =>
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev);

  const assetRows    = rows.filter((r) => numVal(r.balance) >= 0);
  const liabilityRows= rows.filter((r) => numVal(r.balance) < 0);
  const assetTotal   = assetRows.reduce((s, r) => s + numVal(r.balance), 0);
  const liabilityTotal = liabilityRows.reduce((s, r) => s + Math.abs(numVal(r.balance)), 0);

  const isLiabilityType = (t: string) =>
    ['loan', 'overdraft', 'cash_credit', 'working_capital'].includes(t);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const payload = rows.filter((r) => r.bankName.trim()).map((r) => ({
        id:                    r.id,
        bankName:              r.bankName,
        accountNumber:         r.accountNumber,
        accountType:           r.accountType,
        balance:               numVal(r.balance),
        interestRate:          numVal(r.interestRate) || undefined,
        maturityDate:          r.maturityDate || undefined,
        securedBy:             r.securedBy    || undefined,
        currentPortionOfLoan:  numVal(r.currentPortionOfLoan) || undefined,
      }));
      const res = await fetch('/api/adjustments/subledger/bank-accounts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyId, bankAccounts: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save bank accounts.');
    } finally { setSaving(false); }
  };

  const thCls = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 whitespace-nowrap';

  return (
    <div className="space-y-3">
      {/* Totals summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">Bank Assets (Dr)</p>
          <p className="text-sm font-bold font-mono text-emerald-800 mt-0.5">
            {assetTotal.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-red-600 font-semibold">Bank Liabilities (Cr)</p>
          <p className="text-sm font-bold font-mono text-red-800 mt-0.5">
            {liabilityTotal.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="w-full" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th className={`${thCls} w-8 text-center`}>#</th>
              <th className={`${thCls} text-left`} style={{ width: 160 }}>Bank Name</th>
              <th className={`${thCls}`}            style={{ width: 120 }}>Account No.</th>
              <th className={`${thCls}`}            style={{ width: 130 }}>Account Type</th>
              <th className={`${thCls} text-right`} style={{ width: 110 }}>Balance (Dr+/Cr−)</th>
              <th className={`${thCls} text-right`} style={{ width: 80 }}>Rate %</th>
              <th className={`${thCls}`}            style={{ width: 100 }}>Maturity</th>
              <th className={`${thCls}`}            style={{ width: 120 }}>Secured By</th>
              <th className={`${thCls} text-right`} style={{ width: 100 }}>Current Portion</th>
              <th className={`${thCls} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isLiab = isLiabilityType(row.accountType);
              return (
                <tr key={row.id}
                  className={`border-b border-slate-100 last:border-0 h-8
                    ${isLiab ? 'bg-red-50/30' : 'bg-white'} hover:bg-blue-50/20`}>
                  <td className="text-center text-[10px] text-slate-400 px-1">{idx + 1}</td>
                  <td className="px-1"><TextCell value={row.bankName}
                    onChange={(v) => setRow(row.id, 'bankName', v)} placeholder="Bank name" /></td>
                  <td className="px-1"><TextCell value={row.accountNumber}
                    onChange={(v) => setRow(row.id, 'accountNumber', v)} placeholder="Acc No." /></td>
                  <td className="px-1">
                    <SelectCell value={row.accountType}
                      onChange={(v) => setRow(row.id, 'accountType', v)}
                      options={BANK_ACCOUNT_TYPES} />
                  </td>
                  <td className="px-1">
                    <NumCell value={row.balance}
                      onChange={(v) => setRow(row.id, 'balance', v)}
                      negative={isLiab} />
                  </td>
                  <td className="px-1"><NumCell value={row.interestRate}
                    onChange={(v) => setRow(row.id, 'interestRate', v)} /></td>
                  <td className="px-1">
                    <input type="date" value={row.maturityDate}
                      onChange={(e) => setRow(row.id, 'maturityDate', e.target.value)}
                      className="h-7 w-full text-xs px-1.5 border border-slate-200 rounded bg-white
                                 outline-none focus:border-blue-400" />
                  </td>
                  <td className="px-1"><TextCell value={row.securedBy}
                    onChange={(v) => setRow(row.id, 'securedBy', v)} placeholder="Collateral" /></td>
                  <td className="px-1">
                    {isLiab
                      ? <NumCell value={row.currentPortionOfLoan}
                          onChange={(v) => setRow(row.id, 'currentPortionOfLoan', v)} />
                      : <span className="text-slate-300 text-xs px-1">—</span>}
                  </td>
                  <td className="px-1"><DeleteBtn onClick={() => delRow(row.id)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow}
          className="text-xs text-blue-600 hover:text-blue-800 underline">+ Add Row</button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Bank Accounts'}
        </Button>
      </div>
    </div>
  );
}

// ─── Related Parties Tab ──────────────────────────────────────────────────────────

function RelatedPartiesTab({ companyId }: { companyId: string }) {
  const [rows,   setRows]   = useState<RelatedPartyRow[]>([emptyRelatedParty()]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    fetch(`/api/adjustments/subledger/${companyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.relatedParties?.length > 0) {
          setRows(d.relatedParties.map((e: any) => ({
            id:                  e.id,
            partyName:           e.partyName,
            relationshipType:    e.relationshipType,
            transactionDesc:     e.transactionsCurrentYear?.[0]?.description ?? '',
            transactionAmount:   e.transactionsCurrentYear?.[0]?.amount      ?? '',
            direction:           e.transactionsCurrentYear?.[0]?.direction   ?? 'payable',
            outstandingBalance:  e.outstandingBalance ?? '',
            isArmLength:         e.isArmLength,
          })));
        }
      })
      .catch(() => {});
  }, [companyId]);

  const setRow = useCallback((id: string, key: keyof RelatedPartyRow, val: any) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: val } : r)), []);
  const addRow = () => setRows((prev) => [...prev, emptyRelatedParty()]);
  const delRow = (id: string) =>
    setRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== id) : prev);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const payload = rows.filter((r) => r.partyName.trim()).map((r) => ({
        id:              r.id,
        partyName:       r.partyName,
        relationshipType:r.relationshipType,
        transactionsCurrentYear: r.transactionDesc ? [{
          id:          r.id + '-t1',
          description: r.transactionDesc,
          amount:      numVal(r.transactionAmount),
          direction:   r.direction,
        }] : [],
        outstandingBalance: numVal(r.outstandingBalance),
        balanceType:        r.direction,
        isArmLength:        r.isArmLength,
      }));
      const res = await fetch('/api/adjustments/subledger/related-parties', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyId, relatedParties: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save related parties.');
    } finally { setSaving(false); }
  };

  const thCls = 'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 whitespace-nowrap';

  return (
    <div className="space-y-3">
      <Alert type="info"
        message="Disclose all transactions with directors, shareholders (>5%), group companies, and key management personnel. Required for Note 3.24." />

      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="w-full" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th className={`${thCls} w-8 text-center`}>#</th>
              <th className={`${thCls} text-left`} style={{ width: 150 }}>Party Name</th>
              <th className={`${thCls}`}            style={{ width: 140 }}>Relationship</th>
              <th className={`${thCls} text-left`} style={{ width: 180 }}>Transaction Description</th>
              <th className={`${thCls} text-right`} style={{ width: 100 }}>Amount</th>
              <th className={`${thCls}`}            style={{ width: 100 }}>Direction</th>
              <th className={`${thCls} text-right`} style={{ width: 110 }}>Outstanding Balance</th>
              <th className={`${thCls} text-center`}style={{ width: 70 }}>Arm's Length</th>
              <th className={`${thCls} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id}
                className="border-b border-slate-100 last:border-0 h-8 hover:bg-slate-50/40">
                <td className="text-center text-[10px] text-slate-400 px-1">{idx + 1}</td>
                <td className="px-1"><TextCell value={row.partyName}
                  onChange={(v) => setRow(row.id, 'partyName', v)} placeholder="Name" /></td>
                <td className="px-1">
                  <SelectCell value={row.relationshipType}
                    onChange={(v) => setRow(row.id, 'relationshipType', v)}
                    options={RELATIONSHIP_TYPES} />
                </td>
                <td className="px-1"><TextCell value={row.transactionDesc}
                  onChange={(v) => setRow(row.id, 'transactionDesc', v)}
                  placeholder="e.g. Loan received from director" /></td>
                <td className="px-1"><NumCell value={row.transactionAmount}
                  onChange={(v) => setRow(row.id, 'transactionAmount', v)} /></td>
                <td className="px-1">
                  <SelectCell value={row.direction}
                    onChange={(v) => setRow(row.id, 'direction', v as any)}
                    options={[
                      { value: 'receivable', label: 'Receivable' },
                      { value: 'payable',    label: 'Payable'    },
                    ]} />
                </td>
                <td className="px-1"><NumCell value={row.outstandingBalance}
                  onChange={(v) => setRow(row.id, 'outstandingBalance', v)} /></td>
                <td className="text-center px-1">
                  <input type="checkbox" checked={row.isArmLength}
                    onChange={(e) => setRow(row.id, 'isArmLength', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" />
                </td>
                <td className="px-1"><DeleteBtn onClick={() => delRow(row.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow}
          className="text-xs text-blue-600 hover:text-blue-800 underline">+ Add Row</button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Related Parties'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────────

type TabId = 'debtors' | 'creditors' | 'bank' | 'related';

const TABS: { id: TabId; label: string }[] = [
  { id: 'debtors',  label: 'Debtors'         },
  { id: 'creditors',label: 'Creditors'        },
  { id: 'bank',     label: 'Bank Accounts'    },
  { id: 'related',  label: 'Related Parties'  },
];

export default function SubledgerInputPanel({
  companyId,
  tbDebtorTotal,
  tbCreditorTotal,
  onSaveComplete,
}: SubledgerInputPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('debtors');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Subledger Details</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Enter party-wise balances for Notes 3.3, 3.13, 3.8, and 3.24. These are required for
          ICAN-compliant financial statements.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-0" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'h-9 px-4 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'debtors'   && <DebtorsTab   companyId={companyId} tbTotal={tbDebtorTotal}  />}
        {activeTab === 'creditors' && <CreditorsTab  companyId={companyId} tbTotal={tbCreditorTotal} />}
        {activeTab === 'bank'      && <BankAccountsTab companyId={companyId} />}
        {activeTab === 'related'   && <RelatedPartiesTab companyId={companyId} />}
      </div>
    </div>
  );
}
