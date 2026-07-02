// src/components/statements/NotesViewer.tsx
import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { formatNPR } from '../../utils/numberFormat';

const TAB_LABELS = [
  '3.1 PPE',
  '3.7–3.8 Assets',
  '3.9–3.11 Capital',
  '3.12–3.14 Liabilities',
  '3.17–3.22 P&L',
  '3.23 Tax',
];

function NoteHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mt-4 mb-2 pb-1 border-b border-slate-200">
      {children}
    </p>
  );
}

function AmountNote({ roundingLevel }: { roundingLevel: number }) {
  return (
    <p className="text-[11px] text-slate-400 mb-2">
      All amounts in NPR {roundingLevel} unless stated otherwise
    </p>
  );
}

function NoteRef({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-slate-400 italic mb-1">{children}</p>
  );
}

function f(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  if (n === 0) return '—';
  if (n < 0) return `(${formatNPR(Math.abs(n))})`;
  return formatNPR(n);
}

// ─── Tab 1: PPE ────────────────────────────────────────────────────────────
function Tab31PPE({ data, roundingLevel }: { data: any; roundingLevel: number }) {
  const ppe = data?.ppe ?? {};
  const categories = ['Land', 'Buildings', 'Vehicles', 'Office Eq.', 'Computers', 'Furniture', 'P&M', 'Intangibles'];

  const costRows = [
    { label: 'Opening Balance', key: 'costOpen' },
    { label: 'Additions during the year', key: 'additions' },
    { label: 'Disposals during the year', key: 'disposals' },
    { label: 'Closing Balance', key: 'costClose', isTotal: true },
  ];

  const depnRows = [
    { label: 'Opening Balance', key: 'accumDepnOpen' },
    { label: 'Charge for the year', key: 'depnCharge' },
    { label: 'On disposals', key: 'depnOnDisposal' },
    { label: 'Closing Balance', key: 'accumDepnClose', isTotal: true },
  ];

  const nbvRows = [
    { label: 'Net Book Value — Current Year', key: 'nbvCurrent', isTotal: true },
    { label: 'Net Book Value — Previous Year', key: 'nbvPrev' },
  ];

  const renderSection = (
    title: string,
    rows: { label: string; key: string; isTotal?: boolean }[]
  ) => (
    <>
      <tr className="row-section-head">
        <td colSpan={categories.length + 2}>{title}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.key} className={r.isTotal ? 'row-total' : ''}>
          <td className="pl-3">{r.label}</td>
          {categories.map((cat) => (
            <td key={cat} className="text-right font-mono tabular-nums text-[11px] px-2 py-1">
              {f(ppe[cat]?.[r.key])}
            </td>
          ))}
          <td className="text-right font-mono tabular-nums text-[11px] px-2 py-1 font-semibold">
            {f(
              categories.reduce((sum, cat) => sum + (ppe[cat]?.[r.key] ?? 0), 0)
            )}
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <div>
      <NoteHeader>Note 3.1: Property, Plant and Equipment</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <div className="overflow-x-auto">
        <table className="fin-table w-full" style={{ minWidth: '800px' }}>
          <thead>
            <tr>
              <th className="text-left" style={{ width: '18%' }}>Particulars</th>
              {categories.map((c) => (
                <th key={c} className="text-right text-[10px]" style={{ width: '9%' }}>
                  {c}
                </th>
              ))}
              <th className="text-right" style={{ width: '10%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {renderSection('COST', costRows)}
            {renderSection('ACCUMULATED DEPRECIATION', depnRows)}
            {renderSection('NET BOOK VALUE', nbvRows)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 2: 3.7–3.8 Assets ────────────────────────────────────────────────
function Tab378Assets({ data, roundingLevel }: { data: any; roundingLevel: number }) {
  const inv = data?.inventories ?? {};
  const cash = data?.cashEquivalents ?? [];

  return (
    <div>
      <NoteHeader>Note 3.7: Inventories</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <NoteRef>Inventories are measured at the lower of cost (FIFO/weighted average) and net realisable value.</NoteRef>
      <table className="fin-table w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Raw Materials', key: 'rawMaterials' },
            { label: 'Work in Progress', key: 'wip' },
            { label: 'Finished Goods', key: 'finishedGoods' },
            { label: 'Consumable Stores', key: 'consumables' },
          ].map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(inv[r.key]?.current)}</td>
              <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(inv[r.key]?.prev)}</td>
            </tr>
          ))}
          <tr className="row-total">
            <td>Total Inventories</td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(Object.values(inv).reduce((s: number, v: any) => s + (v?.current ?? 0), 0))}
            </td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(Object.values(inv).reduce((s: number, v: any) => s + (v?.prev ?? 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>

      <NoteHeader>Note 3.8: Cash and Cash Equivalents</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <NoteRef>Cash and cash equivalents include cash in hand, balances with banks, and short-term deposits with original maturity of three months or less.</NoteRef>
      <table className="fin-table w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left">Bank / Account</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          {cash.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-slate-400 italic text-center py-3">
                No cash account data available
              </td>
            </tr>
          ) : (
            cash.map((row: any, i: number) => (
              <tr key={i}>
                <td>{row.name}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{f(row.current)}</td>
                <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(row.prev)}</td>
              </tr>
            ))
          )}
          <tr className="row-total">
            <td>Total Cash and Cash Equivalents</td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(cash.reduce((s: number, r: any) => s + (r.current ?? 0), 0))}
            </td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(cash.reduce((s: number, r: any) => s + (r.prev ?? 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 3: 3.9–3.11 Capital ──────────────────────────────────────────────
function Tab3911Capital({ data, roundingLevel }: { data: any; roundingLevel: number }) {
  const sc = data?.shareCapital ?? {};
  const res = data?.reserves ?? {};
  const borrow = data?.borrowings ?? [];

  return (
    <div>
      <NoteHeader>Note 3.9: Share Capital</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <table className="fin-table w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Authorised — [X] shares of NPR [Y] each', key: 'authorised' },
            { label: 'Issued, Subscribed and Paid-up', key: 'issuedPaidup' },
          ].map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(sc[r.key]?.current)}</td>
              <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(sc[r.key]?.prev)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <NoteHeader>Note 3.10: Reserves and Surplus</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <table className="fin-table w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'General Reserve', key: 'generalReserve' },
            { label: 'Share Premium', key: 'sharePremium' },
            { label: 'Retained Earnings (Opening)', key: 'retainedOpen' },
            { label: 'Add: Net profit for the year', key: 'netProfit' },
            { label: 'Less: Transfer to General Reserve', key: 'transferToReserve' },
            { label: 'Less: Dividend paid', key: 'dividendPaid' },
          ].map((r) => (
            <tr key={r.key}>
              <td className="pl-3">{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(res[r.key]?.current)}</td>
              <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(res[r.key]?.prev)}</td>
            </tr>
          ))}
          <tr className="row-total">
            <td>Total Reserves and Surplus</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(res.total?.current)}</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(res.total?.prev)}</td>
          </tr>
        </tbody>
      </table>

      <NoteHeader>Note 3.11: Borrowings</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <NoteRef>Secured loans are backed by hypothecation of fixed assets and/or mortgage of property as disclosed in the asset register.</NoteRef>
      <table className="fin-table w-full max-w-2xl">
        <thead>
          <tr>
            <th className="text-left">Lender / Facility</th>
            <th className="text-right">Rate %</th>
            <th className="text-right">Maturity</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          {borrow.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center italic text-slate-400 py-3">No borrowing data</td>
            </tr>
          ) : (
            borrow.map((b: any, i: number) => (
              <tr key={i}>
                <td>{b.name}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{b.rate ?? '—'}</td>
                <td className="text-right text-[12px]">{b.maturity ?? '—'}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{f(b.current)}</td>
                <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(b.prev)}</td>
              </tr>
            ))
          )}
          <tr className="row-total">
            <td colSpan={3}>Total Borrowings</td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(borrow.reduce((s: number, b: any) => s + (b.current ?? 0), 0))}
            </td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(borrow.reduce((s: number, b: any) => s + (b.prev ?? 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 4: 3.12–3.14 Liabilities ─────────────────────────────────────────
function Tab31214Liabilities({ data, roundingLevel }: { data: any; roundingLevel: number }) {
  const eb = data?.employeeBenefits ?? {};
  const tp = data?.tradePayables ?? {};
  const prov = data?.provisions ?? [];

  const simpleTable = (items: { label: string; current: number; prev?: number }[]) => (
    <table className="fin-table w-full max-w-lg">
      <thead>
        <tr>
          <th className="text-left">Particulars</th>
          <th className="text-right">Current Year</th>
          <th className="text-right">Previous Year</th>
        </tr>
      </thead>
      <tbody>
        {items.map((r, i) => (
          <tr key={i}>
            <td>{r.label}</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(r.current)}</td>
            <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(r.prev)}</td>
          </tr>
        ))}
        <tr className="row-total">
          <td>Total</td>
          <td className="text-right font-mono tabular-nums text-[12px]">
            {f(items.reduce((s, r) => s + (r.current ?? 0), 0))}
          </td>
          <td className="text-right font-mono tabular-nums text-[12px]">
            {f(items.reduce((s, r) => s + (r.prev ?? 0), 0))}
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div>
      <NoteHeader>Note 3.12: Employee Benefits Payable</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      {simpleTable([
        { label: 'Gratuity Provision', current: eb.gratuity?.current ?? 0, prev: eb.gratuity?.prev },
        { label: 'Leave Encashment', current: eb.leave?.current ?? 0, prev: eb.leave?.prev },
        { label: 'Staff Bonus Payable', current: eb.bonus?.current ?? 0, prev: eb.bonus?.prev },
        { label: 'Salary and Wages Payable', current: eb.salary?.current ?? 0, prev: eb.salary?.prev },
      ])}

      <NoteHeader>Note 3.13: Trade and Other Payables</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <NoteRef>Trade payables are unsecured and are usually settled within 30–90 days.</NoteRef>
      {simpleTable([
        { label: 'Trade Creditors', current: tp.tradeCreditors?.current ?? 0, prev: tp.tradeCreditors?.prev },
        { label: 'Advance from Customers', current: tp.advanceFromCustomers?.current ?? 0, prev: tp.advanceFromCustomers?.prev },
        { label: 'VAT Payable', current: tp.vatPayable?.current ?? 0, prev: tp.vatPayable?.prev },
        { label: 'TDS Payable', current: tp.tdsPayable?.current ?? 0, prev: tp.tdsPayable?.prev },
        { label: 'Other Payables', current: tp.other?.current ?? 0, prev: tp.other?.prev },
      ])}

      <NoteHeader>Note 3.14: Provisions</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <table className="fin-table w-full max-w-2xl">
        <thead>
          <tr>
            <th className="text-left">Provision</th>
            <th className="text-right">Opening</th>
            <th className="text-right">Addition</th>
            <th className="text-right">Utilised</th>
            <th className="text-right">Reversed</th>
            <th className="text-right">Closing</th>
          </tr>
        </thead>
        <tbody>
          {prov.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center italic text-slate-400 py-3">No provision data</td>
            </tr>
          ) : (
            prov.map((p: any, i: number) => (
              <tr key={i}>
                <td>{p.name}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{f(p.opening)}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{f(p.addition)}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{f(p.utilised)}</td>
                <td className="text-right font-mono tabular-nums text-[12px]">{f(p.reversed)}</td>
                <td className="text-right font-mono tabular-nums text-[12px] font-semibold">{f(p.closing)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 5: 3.17–3.22 P&L ─────────────────────────────────────────────────
function Tab31722PL({ data, roundingLevel }: { data: any; roundingLevel: number }) {
  const pl = data?.pl ?? {};

  const compactNote = (
    noteNum: string,
    title: string,
    items: { label: string; current: number; prev?: number }[]
  ) => (
    <div className="mt-1">
      <NoteHeader>{`Note ${noteNum}: ${title}`}</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <table className="fin-table w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(r.current)}</td>
              <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(r.prev)}</td>
            </tr>
          ))}
          <tr className="row-total">
            <td>Total</td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(items.reduce((s, r) => s + (r.current ?? 0), 0))}
            </td>
            <td className="text-right font-mono tabular-nums text-[12px]">
              {f(items.reduce((s, r) => s + (r.prev ?? 0), 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {compactNote('3.17', 'Revenue from Operations', [
        { label: 'Sale of Goods', current: pl.saleOfGoods?.current ?? 0, prev: pl.saleOfGoods?.prev },
        { label: 'Sale of Services', current: pl.saleOfServices?.current ?? 0, prev: pl.saleOfServices?.prev },
        { label: 'Other Operating Revenue', current: pl.otherRevenue?.current ?? 0, prev: pl.otherRevenue?.prev },
      ])}

      {compactNote('3.18', 'Material Consumed', [
        { label: 'Opening Stock of Raw Materials', current: pl.openingStock?.current ?? 0, prev: pl.openingStock?.prev },
        { label: 'Add: Purchases', current: pl.purchases?.current ?? 0, prev: pl.purchases?.prev },
        { label: 'Less: Closing Stock of Raw Materials', current: pl.closingStock?.current ?? 0, prev: pl.closingStock?.prev },
      ])}

      {compactNote('3.19', 'Direct Expenses', [
        { label: 'Wages and Labour', current: pl.wages?.current ?? 0, prev: pl.wages?.prev },
        { label: 'Factory Overhead', current: pl.factoryOverhead?.current ?? 0, prev: pl.factoryOverhead?.prev },
        { label: 'Power and Fuel', current: pl.power?.current ?? 0, prev: pl.power?.prev },
      ])}

      {compactNote('3.20', 'Employee Benefit Expenses', [
        { label: 'Salaries and Wages', current: pl.salaries?.current ?? 0, prev: pl.salaries?.prev },
        { label: 'Provident Fund Contribution', current: pl.pf?.current ?? 0, prev: pl.pf?.prev },
        { label: 'Gratuity Expense', current: pl.gratuity?.current ?? 0, prev: pl.gratuity?.prev },
        { label: 'Staff Bonus', current: pl.bonus?.current ?? 0, prev: pl.bonus?.prev },
        { label: 'Leave Encashment', current: pl.leave?.current ?? 0, prev: pl.leave?.prev },
        { label: 'Other Staff Expenses', current: pl.otherStaff?.current ?? 0, prev: pl.otherStaff?.prev },
      ])}

      {compactNote('3.22', 'Administrative and Other Expenses', [
        { label: 'Rent and Rates', current: pl.rent?.current ?? 0, prev: pl.rent?.prev },
        { label: 'Repairs and Maintenance', current: pl.repairs?.current ?? 0, prev: pl.repairs?.prev },
        { label: 'Communication Expenses', current: pl.communication?.current ?? 0, prev: pl.communication?.prev },
        { label: 'Professional Fees', current: pl.professional?.current ?? 0, prev: pl.professional?.prev },
        { label: 'Depreciation', current: pl.depreciation?.current ?? 0, prev: pl.depreciation?.prev },
        { label: 'Audit Fees', current: pl.auditFees?.current ?? 0, prev: pl.auditFees?.prev },
        { label: 'Miscellaneous Expenses', current: pl.miscellaneous?.current ?? 0, prev: pl.miscellaneous?.prev },
      ])}
    </div>
  );
}

// ─── Tab 6: 3.23 Tax ──────────────────────────────────────────────────────
function Tab323Tax({ data, roundingLevel }: { data: any; roundingLevel: number }) {
  const tax = data?.tax ?? {};

  return (
    <div>
      <NoteHeader>Note 3.23: Income Tax Expense</NoteHeader>
      <AmountNote roundingLevel={roundingLevel} />
      <NoteRef>Corporate tax rate: {tax.rate ?? 25}% per Income Tax Act 2058 (Nepal)</NoteRef>

      <table className="fin-table w-full max-w-lg mb-4">
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-right">Current Year</th>
            <th className="text-right">Previous Year</th>
          </tr>
        </thead>
        <tbody>
          <tr className="row-section-head">
            <td colSpan={3}>Current Tax</td>
          </tr>
          {[
            { label: 'Profit before tax (per accounts)', key: 'profitBeforeTax' },
            { label: 'Add: Disallowed expenses', key: 'disallowedExpenses' },
            { label: 'Less: Allowable deductions', key: 'allowableDeductions' },
            { label: 'Less: Tax depreciation (pools)', key: 'taxDepreciation' },
            { label: 'Taxable Income', key: 'taxableIncome', isTotal: true },
            { label: `Tax at ${tax.rate ?? 25}%`, key: 'taxAtRate' },
            { label: 'Tax rebates / credits', key: 'taxCredits' },
            { label: 'Current tax payable', key: 'currentTax', isTotal: true },
          ].map((r) => (
            <tr key={r.key} className={r.isTotal ? 'row-total' : ''}>
              <td className={r.isTotal ? '' : 'pl-3'}>{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(tax[r.key]?.current)}</td>
              <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(tax[r.key]?.prev)}</td>
            </tr>
          ))}

          <tr className="row-section-head">
            <td colSpan={3}>Deferred Tax</td>
          </tr>
          {[
            { label: 'Timing differences — Depreciation', key: 'dtDepreciation' },
            { label: 'Timing differences — Provisions', key: 'dtProvisions' },
            { label: 'Deferred tax charge/(credit)', key: 'deferredTax', isTotal: true },
          ].map((r) => (
            <tr key={r.key} className={r.isTotal ? 'row-total' : ''}>
              <td className={r.isTotal ? '' : 'pl-3'}>{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(tax[r.key]?.current)}</td>
              <td className="text-right font-mono tabular-nums text-[12px] text-slate-400">{f(tax[r.key]?.prev)}</td>
            </tr>
          ))}

          <tr className="row-grand-total">
            <td>Total Tax Expense</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(tax.totalTaxExpense?.current)}</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(tax.totalTaxExpense?.prev)}</td>
          </tr>
        </tbody>
      </table>

      <NoteHeader>Effective Tax Rate Reconciliation</NoteHeader>
      <table className="fin-table w-full max-w-lg">
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-right">NPR</th>
            <th className="text-right">Rate %</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: `Tax at statutory rate (${tax.rate ?? 25}%)`, amt: tax.taxAtStatutory?.current, rate: tax.rate ?? 25 },
            { label: 'Effect of non-deductible expenses', amt: tax.effectNonDeductible?.current, rate: tax.rateNonDeductible?.current },
            { label: 'Effect of tax-exempt income', amt: tax.effectExempt?.current, rate: tax.rateExempt?.current },
            { label: 'Other adjustments', amt: tax.otherAdj?.current, rate: tax.rateOtherAdj?.current },
          ].map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{f(r.amt)}</td>
              <td className="text-right font-mono tabular-nums text-[12px]">{r.rate != null ? `${r.rate}%` : '—'}</td>
            </tr>
          ))}
          <tr className="row-total">
            <td>Effective Tax Rate / Total</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(tax.totalTaxExpense?.current)}</td>
            <td className="text-right font-mono tabular-nums text-[12px]">{f(tax.effectiveRate?.current)}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function NotesViewer() {
  const [activeTab, setActiveTab] = useState(0);
  const { state } = useAppStore();
  const financials = state.notes ? { notes: state.notes } : {};
  const company = state.company;

  const roundingLevel = company?.accountingPolicies?.roundingLevel ?? 1000;
  const notes = financials?.notes ?? {};

  const tabContent = [
    <Tab31PPE data={notes} roundingLevel={roundingLevel} />,
    <Tab378Assets data={notes} roundingLevel={roundingLevel} />,
    <Tab3911Capital data={notes} roundingLevel={roundingLevel} />,
    <Tab31214Liabilities data={notes} roundingLevel={roundingLevel} />,
    <Tab31722PL data={notes} roundingLevel={roundingLevel} />,
    <Tab323Tax data={notes} roundingLevel={roundingLevel} />,
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-slate-200 mb-4 no-print">
        <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          {TAB_LABELS.map((label, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={activeTab === i}
              onClick={() => setActiveTab(i)}
              className={[
                'whitespace-nowrap px-3 py-2 text-[11px] font-medium border-b-2 transition-colors',
                activeTab === i
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div role="tabpanel">{tabContent[activeTab]}</div>
    </div>
  );
}
