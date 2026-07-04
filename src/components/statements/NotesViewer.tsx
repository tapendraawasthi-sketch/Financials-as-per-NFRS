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
    <div
      className="flex items-center mt-5 mb-3 px-3 py-2.5 rounded-lg"
      style={{
        background: 'var(--brand-50)',
        borderLeft: '3px solid var(--brand-500)',
        color: 'var(--brand-700)',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}
    >
      {children}
    </div>
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
  const ppe = Object.fromEntries((data?.note31_ppe ?? []).map((item: any) => {
    const key = item.categoryName === 'Plant & Machinery' ? 'P&M'
      : item.categoryName === 'Computer & IT Equipment' ? 'Computers'
      : item.categoryName === 'Furniture & Office Equipment' ? 'Furniture'
      : item.categoryName === 'Intangibles / Software' ? 'Intangibles'
      : item.categoryName;
    return [key, {
      costOpen: item.openingCost,
      additions: item.additions,
      disposals: item.disposals,
      costClose: item.closingCost,
      accumDepnOpen: item.openingAccumDepn,
      depnCharge: item.depnForYear,
      depnOnDisposal: item.depnOnDisposal,
      accumDepnClose: item.closingAccumDepn,
      nbvCurrent: item.nbvClosing,
      nbvPrev: item.nbvOpening,
    }];
  }));
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
  const note37 = data?.note37_inventories ?? {};
  const note38 = data?.note38_cashEquivalents ?? {};
  const inv = {
    rawMaterials: { current: note37.rawMaterials?.closing, prev: note37.rawMaterials?.opening },
    wip: { current: note37.wip?.closing, prev: note37.wip?.opening },
    finishedGoods: { current: note37.finishedGoods?.closing, prev: note37.finishedGoods?.opening },
    consumables: { current: 0, prev: 0 },
  };
  const cash = [
    { name: 'Cash in Hand', current: note38.cashInHand_cy, prev: note38.cashInHand_py },
    ...(note38.bankAccounts ?? []).map((row: any) => ({
      name: row.accountName ?? row.bankName,
      current: row.closingBalance,
      prev: row.openingBalance,
    })),
  ].filter((row: any) => (row.current ?? 0) !== 0 || (row.prev ?? 0) !== 0);

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
  const note39 = data?.note39_shareCapital ?? {};
  const ordinaryShares = note39.ordinaryShares ?? {};
  const note310 = data?.note310_reserves ?? {};
  const note311 = data?.note311_borrowings ?? {};
  const sc = {
    authorised: { current: ordinaryShares.authorizedAmount, prev: 0 },
    issuedPaidup: { current: ordinaryShares.closingPaidUp, prev: ordinaryShares.openingPaidUp },
  };
  const res = {
    generalReserve: { current: note310.generalReserve?.closing, prev: note310.generalReserve?.opening },
    sharePremium: { current: note310.sharePremium?.closing, prev: note310.sharePremium?.opening },
    retainedOpen: { current: note310.retainedEarnings?.opening, prev: 0 },
    netProfit: { current: note310.retainedEarnings?.netProfitForYear, prev: 0 },
    transferToReserve: { current: note310.retainedEarnings?.transferToReserve, prev: 0 },
    dividendPaid: { current: note310.retainedEarnings?.dividendsDeclared, prev: 0 },
    total: {
      current: (note310.sharePremium?.closing ?? 0) + (note310.generalReserve?.closing ?? 0) + (note310.retainedEarnings?.closing ?? 0) + (note310.otherReserves ?? 0),
      prev: (note310.sharePremium?.opening ?? 0) + (note310.generalReserve?.opening ?? 0) + (note310.retainedEarnings?.opening ?? 0),
    },
  };
  const borrow = [
    ...(note311.nonCurrent ?? []),
    ...(note311.current ?? []),
  ].map((b: any) => ({
    name: b.lenderName,
    rate: b.interestRate,
    maturity: b.maturityDate,
    current: b.balance_cy,
    prev: b.balance_py,
  }));

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
  const note312 = data?.note312_employeeBenefits ?? {};
  const note313 = data?.note313_tradePayables ?? {};
  const eb = {
    gratuity: { current: note312.definedBenefit?.closingBalance, prev: note312.definedBenefit?.openingBalance },
    leave: { current: note312.leaveEncashment?.closingBalance, prev: note312.leaveEncashment?.openingBalance },
    bonus: { current: note312.bonusPayable, prev: 0 },
    salary: { current: note312.salaryPayable, prev: 0 },
  };
  const tp = {
    tradeCreditors: { current: note313.tradeCreditors, prev: note313.tradeCreditors_py },
    advanceFromCustomers: { current: note313.advanceFromCustomers, prev: 0 },
    vatPayable: { current: note313.vatPayable, prev: note313.vatPayable_py },
    tdsPayable: { current: note313.tdsPayableTotal, prev: note313.tdsPayableTotal_py },
    other: { current: note313.otherAccruals, prev: 0 },
  };
  const prov = (data?.note315_provisions?.items ?? []).map((p: any) => ({
    name: p.description,
    opening: p.opening,
    addition: p.addition,
    utilised: p.utilisation,
    reversed: 0,
    closing: p.closing,
  }));

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
  const note317 = data?.note317_revenueDetailed ?? {};
  const note318 = data?.note318_materialConsumed ?? {};
  const note320 = data?.note320_employeeExpenses ?? {};
  const note321 = data?.note321_depreciation ?? {};
  const note322 = data?.note322_adminExpenses ?? {};
  const adminLine = (label: string) => (note322.lineItems ?? []).find((item: any) => item.label === label) ?? {};
  const pl = {
    saleOfGoods: { current: note317.saleOfGoods?.cy, prev: note317.saleOfGoods?.py },
    saleOfServices: { current: note317.renderingOfServices?.cy, prev: note317.renderingOfServices?.py },
    otherRevenue: { current: note317.otherIncome?.cy, prev: note317.otherIncome?.py },
    openingStock: { current: note318.openingRawMaterial, prev: 0 },
    purchases: { current: note318.purchasesDuringYear, prev: 0 },
    closingStock: { current: note318.closingRawMaterial, prev: 0 },
    wages: { current: note318.directWages, prev: 0 },
    factoryOverhead: { current: note318.otherDirectExpenses, prev: 0 },
    power: { current: 0, prev: 0 },
    salaries: { current: note320.salariesWages?.cy, prev: note320.salariesWages?.py },
    pf: { current: note320.pfSsfContribution?.cy, prev: note320.pfSsfContribution?.py },
    gratuity: { current: note320.gratuityExpense?.cy, prev: note320.gratuityExpense?.py },
    bonus: { current: note320.staffBonusExpense?.cy, prev: note320.staffBonusExpense?.py },
    leave: { current: note320.leaveEncashment?.cy, prev: note320.leaveEncashment?.py },
    otherStaff: { current: note320.otherEmployeeCosts?.cy, prev: note320.otherEmployeeCosts?.py },
    rent: { current: adminLine('Rent / Lease Rentals').cy, prev: adminLine('Rent / Lease Rentals').py },
    repairs: { current: adminLine('Repairs & Maintenance').cy, prev: adminLine('Repairs & Maintenance').py },
    communication: { current: adminLine('Communication Expenses').cy, prev: adminLine('Communication Expenses').py },
    professional: { current: adminLine('Professional & Legal Fees').cy, prev: adminLine('Professional & Legal Fees').py },
    depreciation: { current: note321.totalDepreciation, prev: note321.totalDepreciation_py },
    auditFees: { current: adminLine('Audit Fees').cy, prev: adminLine('Audit Fees').py },
    miscellaneous: { current: adminLine('CSR & Other Miscellaneous').cy, prev: adminLine('CSR & Other Miscellaneous').py },
  };

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
  const note323 = data?.note323_taxExpense ?? {};
  const recon = note323.reconciliation ?? {};
  const statutoryRate = recon.taxableProfit ? Math.round((recon.taxAtStatutoryRate / recon.taxableProfit) * 100) : 25;
  const tax = {
    rate: statutoryRate,
    profitBeforeTax: { current: recon.profitBeforeTax, prev: 0 },
    disallowedExpenses: { current: Object.values(recon.disallowableExpenses ?? {}).reduce((s: number, v: any) => s + (v ?? 0), 0), prev: 0 },
    allowableDeductions: { current: Object.values(recon.allowableDeductions ?? {}).reduce((s: number, v: any) => s + (v ?? 0), 0), prev: 0 },
    taxDepreciation: { current: (note323.taxDepreciationByPool ?? []).reduce((s: number, p: any) => s + (p.taxDepreciation ?? 0), 0), prev: 0 },
    taxableIncome: { current: recon.taxableProfit, prev: 0 },
    taxAtRate: { current: recon.taxAtStatutoryRate, prev: 0 },
    taxCredits: { current: (note323.advanceTaxPaid ?? 0) + (note323.tdsCreditAvailable ?? 0), prev: 0 },
    currentTax: { current: note323.netTaxPayable, prev: 0 },
    dtDepreciation: { current: 0, prev: 0 },
    dtProvisions: { current: 0, prev: 0 },
    deferredTax: { current: note323.deferredTaxExpense, prev: 0 },
    totalTaxExpense: { current: note323.totalTaxExpense, prev: 0 },
    taxAtStatutory: { current: recon.taxAtStatutoryRate },
    effectNonDeductible: { current: Object.values(recon.disallowableExpenses ?? {}).reduce((s: number, v: any) => s + (v ?? 0), 0) * statutoryRate / 100 },
    rateNonDeductible: { current: statutoryRate },
    effectExempt: { current: -Object.values(recon.allowableDeductions ?? {}).reduce((s: number, v: any) => s + (v ?? 0), 0) * statutoryRate / 100 },
    rateExempt: { current: statutoryRate },
    otherAdj: { current: recon.taxAdjustments },
    rateOtherAdj: { current: statutoryRate },
    effectiveRate: { current: note323.effectiveTaxRate },
  };

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
    <div className="statement-page max-w-5xl mx-auto">
      {company?.companyName && (
        <div className="statement-header">
          <p className="statement-company-name">{company.companyName}</p>
          <p className="statement-title">Notes to the Financial Statements</p>
          <p className="statement-date">
            For the year ended {company.fiscalYear?.endDateBS ?? '—'}
          </p>
        </div>
      )}

      <div
        className="rounded-xl p-1 mb-5 no-print flex flex-wrap gap-0.5"
        style={{ background: 'var(--surface-sunken)' }}
        role="tablist"
      >
        {TAB_LABELS.map((label, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={activeTab === i}
            onClick={() => setActiveTab(i)}
            className={[
              'h-8 px-3.5 rounded-lg font-medium transition-all ease-premium focus-visible:outline-none',
              activeTab === i
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
            style={{
              fontSize: '12px',
              boxShadow: activeTab === i ? 'var(--shadow-sm)' : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">{tabContent[activeTab]}</div>
    </div>
  );
}
