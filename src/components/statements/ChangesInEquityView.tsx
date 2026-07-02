// src/components/statements/ChangesInEquityView.tsx
import React from 'react';
import { useAppStore } from '../../store/appStore';
import { formatNPR }   from '../../utils/numberFormat';

function fmtAmt(n: number): string {
  if (n === 0) return '—';
  if (n < 0) return `(${formatNPR(Math.abs(n))})`;
  return formatNPR(n);
}

export default function ChangesInEquityView() {
  const { state }  = useAppStore();
  const eq         = state.changesInEquity;
  const company    = state.company;
  const fiscalYear = state.company?.fiscalYear;

  const startDateBS   = fiscalYear?.startDateBS  ?? '[Start Date]';
  const endDateBS     = fiscalYear?.endDateBS    ?? '[End Date]';
  const companyName   = company?.companyName     ?? 'Company Name';
  const roundingLevel = company?.accountingPolicies?.roundingLevel ?? 1000;

  if (!eq) {
    return (
      <div className="statement-page max-w-4xl mx-auto flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-semibold text-slate-600 mb-1">
          Equity data not yet generated
        </p>
        <p className="text-xs text-slate-400">
          Ensure financial statements have been computed to view this statement.
        </p>
      </div>
    );
  }

  // Opening balances
  const openShareCapital     = eq.cyOpeningShareCapital     ?? 0;
  const openSharePremium     = eq.cyOpeningSharePremium     ?? 0;
  const openGeneralReserve   = eq.cyOpeningGeneralReserve   ?? 0;
  const openRetainedEarnings = eq.cyOpeningRetainedEarnings ?? 0;
  const openTotal            = eq.cyOpeningTotal            ?? 0;

  const netProfit         = eq.cyNetProfit           ?? 0;
  const newShareCapital   = eq.cyShareCapitalIssued  ?? 0;
  const sharePremium      = eq.cySharePremiumReceived ?? 0;
  const transferToReserve = eq.cyTransferToReserve   ?? 0;
  const dividendPaid      = eq.cyDividends           ?? 0;

  const closeShareCapital     = eq.cyClosingShareCapital     ?? 0;
  const closeSharePremium     = eq.cyClosingSharePremium     ?? 0;
  const closeGeneralReserve   = eq.cyClosingGeneralReserve   ?? 0;
  const closeRetainedEarnings = eq.cyClosingRetainedEarnings ?? 0;
  const closeTotal            = eq.cyClosingTotal            ?? 0;

  // item 120: overflow-x-auto wrapper to handle wide matrix table
  // item 121: center-aligned amount column headers

  interface EqRow {
    label: string;
    sc:    number;
    sp:    number;
    gr:    number;
    re:    number;
    total: number;
    isGrandTotal?: boolean;
    isSectionHead?: boolean;
  }

  const rows: EqRow[] = [
    { label: `Balance at ${startDateBS}`,    sc: openShareCapital, sp: openSharePremium, gr: openGeneralReserve, re: openRetainedEarnings, total: openTotal, isSectionHead: true },
    { label: 'Net profit for the year',      sc: 0, sp: 0, gr: 0, re: netProfit,          total: netProfit },
    { label: 'Issue of share capital',       sc: newShareCapital, sp: sharePremium, gr: 0, re: 0, total: newShareCapital + sharePremium },
    { label: 'Transfer to general reserve',  sc: 0, sp: 0, gr: transferToReserve, re: -transferToReserve, total: 0 },
    { label: 'Dividends paid',               sc: 0, sp: 0, gr: 0, re: -dividendPaid, total: -dividendPaid },
    { label: `Balance at ${endDateBS}`,      sc: closeShareCapital, sp: closeSharePremium, gr: closeGeneralReserve, re: closeRetainedEarnings, total: closeTotal, isGrandTotal: true },
  ];

  // ── Amount cell ───────────────────────────────────────────────────────────
  function AmtCell({
    value,
    bold = false,
    isGrand = false,
  }: { value: number; bold?: boolean; isGrand?: boolean }) {
    return (
      <td
        className={[
          // item 121: text-center for equity table amount columns
          'text-center font-mono tabular-nums text-[13px] px-3 py-1.5',
          bold || isGrand ? 'font-semibold' : '',
          value < 0 ? 'text-red-700' : value === 0 ? 'amount-zero' : 'text-slate-800',
        ].filter(Boolean).join(' ')}
      >
        {fmtAmt(value)}
      </td>
    );
  }

  return (
    // item 120: overflow-x-auto on statement wrapper for wide table
    <div className="statement-page max-w-5xl mx-auto overflow-x-auto">
      {/* Print button */}
      <div className="flex justify-end mb-3 no-print">
        <button
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={() => window.print()}
        >
          Print / Export PDF
        </button>
      </div>

      {/* Statement header */}
      <div className="statement-header">
        <p className="statement-company-name" style={{ fontSize: '1.125rem' }}>
          {companyName}
        </p>
        <p className="statement-title" style={{ fontSize: '0.875rem' }}>
          Statement of Changes in Equity
        </p>
        <p className="statement-date">For the year ended {endDateBS}</p>
        <p className="text-xs text-slate-500 italic mt-1">
          All amounts in NPR rounded to nearest {roundingLevel}
        </p>
      </div>

      {/* item 120: min-w to force horizontal scroll on narrow screens */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="fin-table" style={{ minWidth: '720px', width: '100%' }}>
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Particulars</th>
              {/* item 121: center-aligned period-amount headers */}
              {[
                'Share Capital',
                'Share Premium',
                'General Reserve',
                'Retained Earnings',
                'Total',
              ].map(h => (
                <th key={h} className="text-center">{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={
                  row.isGrandTotal  ? 'row-grand-total' :
                  row.isSectionHead ? 'row-section-head' :
                  'border-b border-slate-100'
                }
              >
                <td className="text-[13px] text-slate-700 px-3 py-1.5">
                  {row.label}
                </td>
                <AmtCell value={row.sc} bold={row.isGrandTotal || row.isSectionHead} isGrand={row.isGrandTotal} />
                <AmtCell value={row.sp} bold={row.isGrandTotal || row.isSectionHead} isGrand={row.isGrandTotal} />
                <AmtCell value={row.gr} bold={row.isGrandTotal || row.isSectionHead} isGrand={row.isGrandTotal} />
                <AmtCell value={row.re} bold={row.isGrandTotal || row.isSectionHead} isGrand={row.isGrandTotal} />
                <AmtCell value={row.total} bold={row.isGrandTotal || row.isSectionHead} isGrand={row.isGrandTotal} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Integral part note */}
      <div className="border-t border-slate-200 mt-4 pt-3 text-center">
        <p className="text-xs text-slate-500 italic">
          The notes referred to above form an integral part of these financial statements.
        </p>
      </div>

      {/* Signature block */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-6 text-xs text-slate-600">
          {['Chairperson', 'Director', 'Head of Accounts'].map(role => (
            <div key={role} className="flex flex-col items-start">
              <div className="h-10 w-full" />
              <div className="w-full border-b border-slate-600 pb-1 mb-1">
                <p className="font-semibold text-slate-800">—</p>
              </div>
              <p className="text-slate-400">{role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
