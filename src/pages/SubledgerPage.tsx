import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { MappedTBRow } from '../types';
import Tabs from '../components/ui/Tabs';
import Alert from '../components/ui/Alert';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatNPRSimple } from '../utils/numberFormat';
import { tbApi } from '../api/client';

// ── Sub-ledger entry types ────────────────────────────────────────────────────

interface DebtorEntry {
  id: string;
  partyName: string;
  openingBalance: number;
  duringDr: number;
  duringCr: number;
  closingBalance: number;
  isLongTerm: boolean;
  notes: string;
}

interface CreditorEntry {
  id: string;
  partyName: string;
  openingBalance: number;
  duringDr: number;
  duringCr: number;
  closingBalance: number;
  notes: string;
}

interface BankEntry {
  id: string;
  bankName: string;
  accountType: 'Current' | 'Savings' | 'Fixed Deposit' | 'Overdraft';
  accountNumber: string;
  openingBalance: number;
  closingBalance: number;
  currency: string;
}

interface RelatedPartyEntry {
  id: string;
  partyName: string;
  relationship: 'Director' | 'KMP' | 'Group Company' | 'Associate' | 'Other';
  natureOfTransaction: string;
  outstandingBalance: number;
  transactionsDuringYear: number;
}

interface BorrowingEntry {
  id: string;
  lenderName: string;
  loanType: 'Term Loan' | 'Working Capital' | 'Overdraft' | 'Cash Credit';
  interestRatePercent: number;
  security: string;
  repaymentTerms: string;
  nonCurrentPortion: number;
  currentPortion: number;
  totalBalance: number;
}

// ── Helper: derive entries from TB rows ───────────────────────────────────────

function rowsToDebtors(rows: MappedTBRow[]): DebtorEntry[] {
  return rows
    .filter((r) => r.nfrsCategory === 'trade_receivables')
    .map((r, idx) => ({
      id: `debtor-${idx}`,
      partyName: r.rawLabel,
      openingBalance: r.openingDr ?? 0,
      duringDr: r.duringDr ?? 0,
      duringCr: r.duringCr ?? 0,
      closingBalance: r.closingDr ?? 0,
      isLongTerm: false,
      notes: '',
    }));
}

function rowsToCreditors(rows: MappedTBRow[]): CreditorEntry[] {
  return rows
    .filter((r) => r.nfrsCategory === 'trade_payables_creditors')
    .map((r, idx) => ({
      id: `creditor-${idx}`,
      partyName: r.rawLabel,
      openingBalance: r.openingCr ?? 0,
      duringDr: r.duringDr ?? 0,
      duringCr: r.duringCr ?? 0,
      closingBalance: r.closingCr ?? 0,
      notes: '',
    }));
}

function rowsToBanks(rows: MappedTBRow[]): BankEntry[] {
  return rows
    .filter((r) =>
      ['bank_current_account', 'bank_savings_account', 'borrowings_current_od',
       'bank_fixed_deposit_current', 'cash_in_hand'].includes(r.nfrsCategory ?? '')
    )
    .map((r, idx) => {
      const accountType: BankEntry['accountType'] =
        r.nfrsCategory === 'bank_savings_account' ? 'Savings' :
        r.nfrsCategory === 'borrowings_current_od' ? 'Overdraft' :
        r.nfrsCategory === 'bank_fixed_deposit_current' ? 'Fixed Deposit' : 'Current';
      return {
        id: `bank-${idx}`,
        bankName: r.rawLabel,
        accountType,
        accountNumber: '',
        openingBalance: (r.openingDr ?? 0) - (r.openingCr ?? 0),
        closingBalance: (r.closingDr ?? 0) - (r.closingCr ?? 0),
        currency: 'NPR',
      };
    });
}

// ── Debtor Tab ────────────────────────────────────────────────────────────────

const DebtorTab: React.FC<{
  entries: DebtorEntry[];
  onChange: (entries: DebtorEntry[]) => void;
}> = ({ entries, onChange }) => {
  const addRow = () => {
    onChange([
      ...entries,
      {
        id: `debtor-new-${Date.now()}`,
        partyName: '',
        openingBalance: 0,
        duringDr: 0,
        duringCr: 0,
        closingBalance: 0,
        isLongTerm: false,
        notes: '',
      },
    ]);
  };

  const updateRow = (id: string, field: keyof DebtorEntry, value: unknown) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeRow = (id: string) => {
    onChange(entries.filter((e) => e.id !== id));
  };

  const totalClosing = entries.reduce((s, e) => s + e.closingBalance, 0);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs text-blue-700">
          Sundry Debtors are pre-populated from your trial balance. Verify the amounts, mark any
          long-term debtors (over 12 months), and add additional parties if needed.
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Party Name</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">Opening (NPR)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">During Dr</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">During Cr</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">Closing (NPR)</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-20">Long-term</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-32">Notes</th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={entry.partyName}
                    onChange={(e) => updateRow(entry.id, 'partyName', e.target.value)}
                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                    placeholder="Party name"
                  />
                </td>
                {(['openingBalance', 'duringDr', 'duringCr', 'closingBalance'] as const).map((field) => (
                  <td key={field} className="px-3 py-1.5">
                    <input
                      type="number"
                      value={entry[field] || ''}
                      onChange={(e) => updateRow(entry.id, field, parseFloat(e.target.value) || 0)}
                      className="w-full text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={entry.isLongTerm}
                    onChange={(e) => updateRow(entry.id, 'isLongTerm', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) => updateRow(entry.id, 'notes', e.target.value)}
                    className="w-full text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                    placeholder="Optional note"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => removeRow(entry.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                  No trade receivables found in trial balance. Add debtors manually if needed.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300">
            <tr>
              <td className="px-3 py-2 font-semibold text-sm text-slate-700">TOTAL</td>
              <td colSpan={3} />
              <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">
                {formatNPRSimple(totalClosing)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        onClick={addRow}
        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-blue-50 transition-colors"
      >
        <span className="text-base font-bold">+</span>
        Add Additional Debtor
      </button>
    </div>
  );
};

// ── Creditor Tab ──────────────────────────────────────────────────────────────

const CreditorTab: React.FC<{
  entries: CreditorEntry[];
  onChange: (entries: CreditorEntry[]) => void;
}> = ({ entries, onChange }) => {
  const addRow = () => {
    onChange([
      ...entries,
      {
        id: `creditor-new-${Date.now()}`,
        partyName: '',
        openingBalance: 0,
        duringDr: 0,
        duringCr: 0,
        closingBalance: 0,
        notes: '',
      },
    ]);
  };

  const updateRow = (id: string, field: keyof CreditorEntry, value: unknown) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeRow = (id: string) => onChange(entries.filter((e) => e.id !== id));
  const total = entries.reduce((s, e) => s + e.closingBalance, 0);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Party Name</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">Opening Cr</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">During Dr</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">During Cr</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">Closing Cr</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-32">Notes</th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={entry.partyName}
                    onChange={(e) => updateRow(entry.id, 'partyName', e.target.value)}
                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                  />
                </td>
                {(['openingBalance', 'duringDr', 'duringCr', 'closingBalance'] as const).map((f) => (
                  <td key={f} className="px-3 py-1.5">
                    <input
                      type="number"
                      value={entry[f] || ''}
                      onChange={(e) => updateRow(entry.id, f, parseFloat(e.target.value) || 0)}
                      className="w-full text-sm text-right border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <input type="text" value={entry.notes} onChange={(e) => updateRow(entry.id, 'notes', e.target.value)}
                    className="w-full text-xs border-0 bg-transparent focus:outline-none rounded px-1" />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => removeRow(entry.id)} className="text-slate-300 hover:text-red-400">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300">
            <tr>
              <td className="px-3 py-2 font-semibold text-sm text-slate-700">TOTAL</td>
              <td colSpan={3} />
              <td className="px-3 py-2 text-right font-bold text-slate-800 tabular-nums">{formatNPRSimple(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addRow} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-blue-50 transition-colors">
        <span className="text-base font-bold">+</span> Add Additional Creditor
      </button>
    </div>
  );
};

// ── Bank Tab ──────────────────────────────────────────────────────────────────

const BankTab: React.FC<{
  entries: BankEntry[];
  onChange: (entries: BankEntry[]) => void;
}> = ({ entries, onChange }) => {
  const updateRow = (id: string, field: keyof BankEntry, value: unknown) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Bank / Account Name</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-32">Account Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-36">Account Number</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">Opening (NPR)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-28">Closing (NPR)</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-20">Currency</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5">
                  <input type="text" value={entry.bankName}
                    onChange={(e) => updateRow(entry.id, 'bankName', e.target.value)}
                    className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1" />
                </td>
                <td className="px-3 py-1.5">
                  <select value={entry.accountType}
                    onChange={(e) => updateRow(entry.id, 'accountType', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
                    {['Current', 'Savings', 'Fixed Deposit', 'Overdraft'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input type="text" value={entry.accountNumber}
                    onChange={(e) => updateRow(entry.id, 'accountNumber', e.target.value)}
                    className="w-full text-sm border-0 bg-transparent focus:outline-none rounded px-1"
                    placeholder="Optional" />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" value={entry.openingBalance || ''}
                    onChange={(e) => updateRow(entry.id, 'openingBalance', parseFloat(e.target.value) || 0)}
                    className="w-full text-sm text-right border-0 bg-transparent focus:outline-none rounded px-1" />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" value={entry.closingBalance || ''}
                    onChange={(e) => updateRow(entry.id, 'closingBalance', parseFloat(e.target.value) || 0)}
                    className="w-full text-sm text-right border-0 bg-transparent focus:outline-none rounded px-1" />
                </td>
                <td className="px-3 py-1.5">
                  <span className="text-xs text-slate-500">NPR</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Related Parties Tab ───────────────────────────────────────────────────────

const RelatedPartyTab: React.FC<{
  entries: RelatedPartyEntry[];
  onChange: (entries: RelatedPartyEntry[]) => void;
}> = ({ entries, onChange }) => {
  const addRow = () => {
    onChange([...entries, {
      id: `rp-${Date.now()}`,
      partyName: '',
      relationship: 'Director',
      natureOfTransaction: '',
      outstandingBalance: 0,
      transactionsDuringYear: 0,
    }]);
  };

  const updateRow = (id: string, field: keyof RelatedPartyEntry, value: unknown) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeRow = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <p className="text-xs text-amber-700">
          <strong>Note:</strong> Transactions with related parties (Directors, KMPs, Group companies)
          must be disclosed under NAS for MEs. Enter all significant related party transactions here.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-slate-200 rounded-xl">
          <p className="text-sm">No related party transactions to disclose.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                {['Party Name', 'Relationship', 'Nature of Transaction', 'Outstanding Balance', 'Transactions (CY)', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5">
                    <input type="text" value={entry.partyName}
                      onChange={(e) => updateRow(entry.id, 'partyName', e.target.value)}
                      className="w-full text-sm border-0 bg-transparent focus:outline-none rounded px-1" />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={entry.relationship}
                      onChange={(e) => updateRow(entry.id, 'relationship', e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded px-1 py-0.5 bg-white focus:outline-none">
                      {['Director', 'KMP', 'Group Company', 'Associate', 'Other'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={entry.natureOfTransaction}
                      onChange={(e) => updateRow(entry.id, 'natureOfTransaction', e.target.value)}
                      className="w-full text-sm border-0 bg-transparent focus:outline-none rounded px-1"
                      placeholder="e.g. Loan given, Rent paid" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={entry.outstandingBalance || ''}
                      onChange={(e) => updateRow(entry.id, 'outstandingBalance', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm text-right border-0 bg-transparent focus:outline-none rounded px-1" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={entry.transactionsDuringYear || ''}
                      onChange={(e) => updateRow(entry.id, 'transactionsDuringYear', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm text-right border-0 bg-transparent focus:outline-none rounded px-1" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeRow(entry.id)} className="text-slate-300 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={addRow}
        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-blue-50 transition-colors">
        <span className="text-base font-bold">+</span> Add Related Party Transaction
      </button>
    </div>
  );
};

// ── Borrowings Tab ────────────────────────────────────────────────────────────

const BorrowingsTab: React.FC<{
  entries: BorrowingEntry[];
  onChange: (entries: BorrowingEntry[]) => void;
}> = ({ entries, onChange }) => {
  const addRow = () => {
    onChange([...entries, {
      id: `borrow-${Date.now()}`,
      lenderName: '',
      loanType: 'Term Loan',
      interestRatePercent: 0,
      security: '',
      repaymentTerms: '',
      nonCurrentPortion: 0,
      currentPortion: 0,
      totalBalance: 0,
    }]);
  };

  const updateRow = (id: string, field: keyof BorrowingEntry, value: unknown) => {
    onChange(entries.map((e) => {
      if (e.id !== id) return e;
      const updated = { ...e, [field]: value };
      // Auto-compute total
      if (field === 'nonCurrentPortion' || field === 'currentPortion') {
        updated.totalBalance = (updated.nonCurrentPortion || 0) + (updated.currentPortion || 0);
      }
      return updated;
    }));
  };

  const removeRow = (id: string) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                {['Lender Name', 'Loan Type', 'Rate %', 'Security', 'Repayment Terms', 'Non-Current', 'Current', 'Total', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5">
                    <input type="text" value={entry.lenderName}
                      onChange={(e) => updateRow(entry.id, 'lenderName', e.target.value)}
                      className="w-full text-sm border-0 bg-transparent focus:outline-none rounded px-1"
                      placeholder="Bank/Lender name" />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={entry.loanType}
                      onChange={(e) => updateRow(entry.id, 'loanType', e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded px-1 py-0.5 bg-white focus:outline-none">
                      {['Term Loan', 'Working Capital', 'Overdraft', 'Cash Credit'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 w-16">
                    <input type="number" value={entry.interestRatePercent || ''}
                      onChange={(e) => updateRow(entry.id, 'interestRatePercent', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm text-right border-0 bg-transparent focus:outline-none rounded px-1" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={entry.security}
                      onChange={(e) => updateRow(entry.id, 'security', e.target.value)}
                      className="w-full text-sm border-0 bg-transparent focus:outline-none rounded px-1"
                      placeholder="Land & Building" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={entry.repaymentTerms}
                      onChange={(e) => updateRow(entry.id, 'repaymentTerms', e.target.value)}
                      className="w-full text-sm border-0 bg-transparent focus:outline-none rounded px-1"
                      placeholder="Monthly EMI / Bullet" />
                  </td>
                  {(['nonCurrentPortion', 'currentPortion'] as const).map((f) => (
                    <td key={f} className="px-3 py-1.5">
                      <input type="number" value={entry[f] || ''}
                        onChange={(e) => updateRow(entry.id, f, parseFloat(e.target.value) || 0)}
                        className="w-full text-sm text-right border-0 bg-transparent focus:outline-none rounded px-1" />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-700 tabular-nums text-xs">
                    {formatNPRSimple(entry.totalBalance)}
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeRow(entry.id)} className="text-slate-300 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={addRow}
        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-blue-50 transition-colors">
        <span className="text-base font-bold">+</span> Add Loan / Borrowing
      </button>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const SubledgerPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState('debtors');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const tbRows = useMemo(() => state.trialBalance?.rows ?? [], [state.trialBalance]);

  const [debtors, setDebtors] = useState<DebtorEntry[]>(() => rowsToDebtors(tbRows));
  const [creditors, setCreditors] = useState<CreditorEntry[]>(() => rowsToCreditors(tbRows));
  const [banks, setBanks] = useState<BankEntry[]>(() => rowsToBanks(tbRows));
  const [relatedParties, setRelatedParties] = useState<RelatedPartyEntry[]>([]);
  const [borrowings, setBorrowings] = useState<BorrowingEntry[]>([]);

  const companyId = state.company?.id ?? '';

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    setError(null);
    try {
      await tbApi.saveSubledgers(companyId, {
        debtors,
        creditors,
        banks,
        relatedParties,
        borrowings,
      });
      setSavedOk(true);
      dispatch({ type: 'COMPLETE_STEP', payload: 'subledger_details' });
      dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save subledger details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    dispatch({ type: 'COMPLETE_STEP', payload: 'subledger_details' });
    dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' });
  };

  const tabs = [
    { id: 'debtors', label: 'Sundry Debtors', badge: debtors.length > 0 ? String(debtors.length) : undefined },
    { id: 'creditors', label: 'Sundry Creditors', badge: creditors.length > 0 ? String(creditors.length) : undefined },
    { id: 'banks', label: 'Bank Accounts', badge: banks.length > 0 ? String(banks.length) : undefined },
    { id: 'related', label: 'Related Parties', badge: relatedParties.length > 0 ? String(relatedParties.length) : undefined },
    { id: 'borrowings', label: 'Loans & Borrowings', badge: borrowings.length > 0 ? String(borrowings.length) : undefined },
  ];

  if (isSaving) return <LoadingSpinner message="Saving subledger details…" fullPage />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Subledger Details</h2>
        <p className="text-sm text-slate-500 mt-1">
          Enter detailed information for debtors, creditors, bank accounts, and borrowings.
          This data populates the notes and schedules in the Excel output.
        </p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}
      {savedOk && <Alert type="success" message="Subledger details saved successfully." />}

      <Tabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id)} variant="pill" />

      <div className="min-h-64">
        {activeTab === 'debtors' && <DebtorTab entries={debtors} onChange={setDebtors} />}
        {activeTab === 'creditors' && <CreditorTab entries={creditors} onChange={setCreditors} />}
        {activeTab === 'banks' && <BankTab entries={banks} onChange={setBanks} />}
        {activeTab === 'related' && <RelatedPartyTab entries={relatedParties} onChange={setRelatedParties} />}
        {activeTab === 'borrowings' && <BorrowingsTab entries={borrowings} onChange={setBorrowings} />}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4 border-t border-slate-200">
        <button
          onClick={handleSkip}
          className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Skip for now — I'll fill details in Excel
        </button>
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          Save Subledger Details & Continue →
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Note: You can also enter subledger details directly in the downloaded Excel file in the
        Sundry Debtors, Sundry Creditors, and Bank Accounts sheets.
      </p>
    </div>
  );
};

export default SubledgerPage;
