// src/components/statements/ChangesInEquityView.tsx
import React from 'react';
import { useAppStore } from '../../store/appStore';
import { formatNPR } from '../../utils/numberFormat';

function fmtAmt(n: number): string {
  if (n === 0) return '—';
  if (n < 0) return `(${formatNPR(Math.abs(n))})`;
  return formatNPR(n);
}

export default function ChangesInEquityView() {
  const { state } = useAppStore();
  const financials = state.changesInEquity ? { changesInEquity: state.changesInEquity } : {};
  const company = state.company;
  const fiscalYear = state.company?.fiscalYear;

  const startDateBS = fiscalYear?.startDateBS ?? '[Start Date]';
  const endDateBS = fiscalYear?.endDateBS ?? '[End Date]';
  const companyName = company?.companyName ?? 'Company Name';
  const roundingLevel = company?.accountingPolicies?.roundingLevel ?? 1000;

  const eq = financials?.changesInEquity;

  // Opening balances
  const openShareCapital = eq?.cyOpeningShareCapital ?? 0;
  const openSharePremium = eq?.cyOpeningSharePremium ?? 0;
  const openGeneralReserve = eq?.cyOpeningGeneralReserve ?? 0;
  const openRetainedEarnings = eq?.cyOpeningRetainedEarnings ?? 0;
  const openTotal = eq?.cyOpeningTotal ?? 0;

  // Movements
  const netProfit = eq?.cyNetProfit ?? 0;
  const newShareCapital = eq?.cyShareCapitalIssued ?? 0;
  const sharePremium = eq?.cySharePremiumReceived ?? 0;
  const transferToReserve = eq?.cyTransferToReserve ?? 0;
  const dividendPaid = eq?.cyDividends ?? 0;

  // Closing balances
  const closeShareCapital = eq?.cyClosingShareCapital ?? 0;
  const closeSharePremium = eq?.cyClosingSharePremium ?? 0;
  const closeGeneralReserve = eq?.cyClosingGeneralReserve ?? 0;
  const closeRetainedEarnings = eq?.cyClosingRetainedEarnings ?? 0;
  const closeTotal = eq?.cyClosingTotal ?? 0;

  const AmtCell = ({ value, bold }: { value: number; bold?: boolean }) => (
    <td
      className={[
        'text-right font-mono tabular-nums text-[12px] px-3 py-1.5',
        bold ? 'font-semibold' : '',
        value < 0 ? 'text-red-700' : value === 0 ? 'text-slate-300' : 'text-slate-800',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {fmtAmt(value)}
    </td>
  );

  return (
    <div className="statement-page">
      {/* Print button */}
      <div className="flex justify-end mb-3 no-print">
        <button
          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">
          {companyName}
        </p>
        <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
          Statement of Changes in Equity
        </h2>
        <p className="text-[11px] text-slate-500 mt-1">
          For the year ended {endDateBS}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          All amounts in NPR {roundingLevel} unless stated otherwise
        </p>
      </div>

      {/* Wide matrix table */}
      <div className="overflow-x-auto">
        <table className="fin-table w-full" style={{ minWidth: '720px' }}>
          <thead>
            <tr>
              <th className="text-left" style={{ width: '28%' }}>
                Particulars
              </th>
              <th className="text-right" style={{ width: '14.4%' }}>
                Share Capital
              </th>
              <th className="text-right" style={{ width: '14.4%' }}>
                Share Premium
              </th>
              <th className="text-right" style={{ width: '14.4%' }}>
                General Reserve
              </th>
              <th className="text-right" style={{ width: '14.4%' }}>
                Retained Earnings
              </th>
              <th className="text-right" style={{ width: '14.4%' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Opening balance */}
            <tr className="row-section-head">
              <td className="font-semibold">Balance as at {startDateBS}</td>
              <AmtCell value={openShareCapital} bold />
              <AmtCell value={openSharePremium} bold />
              <AmtCell value={openGeneralReserve} bold />
              <AmtCell value={openRetainedEarnings} bold />
              <AmtCell value={openTotal} bold />
            </tr>

            {/* Net profit */}
            <tr>
              <td className="pl-3">Net profit for the year</td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <AmtCell value={netProfit} />
              <AmtCell value={netProfit} />
            </tr>

            {/* Issue of share capital */}
            <tr>
              <td className="pl-3">Issue of share capital</td>
              <AmtCell value={newShareCapital} />
              <AmtCell value={sharePremium} />
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <AmtCell value={newShareCapital + sharePremium} />
            </tr>

            {/* Transfer to general reserve */}
            <tr>
              <td className="pl-3">Transfer to general reserve</td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <AmtCell value={transferToReserve} />
              <AmtCell value={-transferToReserve} />
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
            </tr>

            {/* Dividend paid */}
            <tr>
              <td className="pl-3">Dividend paid</td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <td className="text-right font-mono tabular-nums text-[12px] px-3 py-1.5 text-slate-300">
                —
              </td>
              <AmtCell value={-dividendPaid} />
              <AmtCell value={-dividendPaid} />
            </tr>

            {/* Closing balance */}
            <tr className="row-grand-total">
              <td>Balance as at {endDateBS}</td>
              <AmtCell value={closeShareCapital} bold />
              <AmtCell value={closeSharePremium} bold />
              <AmtCell value={closeGeneralReserve} bold />
              <AmtCell value={closeRetainedEarnings} bold />
              <AmtCell value={closeTotal} bold />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signature block */}
      <div className="mt-10 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="border-t border-slate-800 pt-2 mt-6 text-[11px] text-slate-600">
              Chairperson
            </div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2 mt-6 text-[11px] text-slate-600">
              Director
            </div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2 mt-6 text-[11px] text-slate-600">
              Head of Accounts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
