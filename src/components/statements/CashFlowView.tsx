// src/components/statements/CashFlowView.tsx
import React from 'react';
import { useAppStore }  from '../../store/appStore';
import { formatNPR }    from '../../utils/numberFormat';

// ── Number formatter — indirect method uses parentheses for outflows ──────────
function cfv(n: number, bracketed?: boolean): string {
  if (n === 0) return '—';
  const abs = formatNPR(Math.abs(n));
  return (bracketed && n > 0) || n < 0 ? `(${abs})` : abs;
}

// ── Row types ─────────────────────────────────────────────────────────────────
interface CFRow {
  label:     string;
  current:   number;
  previous?: number;
  indent?:   number;          // 0 = section head, 1 = direct child, 2 = nested
  italic?:   boolean;
  style?:    'normal' | 'subtotal' | 'total' | 'grand-total' | 'section-head';
  bracketed?: boolean;
}

export default function CashFlowView() {
  const { state } = useAppStore();
  const cf         = state.cashFlow;
  const company    = state.company;
  const fiscalYear = state.company?.fiscalYear;

  // ── item 117: empty state with proper message + action ───────────────────
  if (!cf) {
    return (
      <div className="statement-page max-w-4xl mx-auto flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 10h18M3 14h18M7 6h.01M7 18h.01" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600 mb-1">
          Cash flow data not yet generated
        </p>
        <p className="text-xs text-slate-400 max-w-xs mb-4">
          Ensure financial statements have been computed before viewing the cash flow statement.
        </p>
      </div>
    );
  }

  const endDateBS    = fiscalYear?.endDateBS  ?? '[End Date]';
  const companyName  = company?.companyName   ?? 'Company Name';
  const roundingLevel = company?.accountingPolicies?.roundingLevel ?? 1000;

  // ── Derived values ────────────────────────────────────────────────────────
  const profitBeforeTax = cf.profitBeforeTax ?? 0;
  const depreciation    = cf.addDepreciation ?? 0;
  const impairment      = cf.addImpairment   ?? 0;
  const interestIncome  = cf.lessInterestIncome ?? 0;
  const dividendIncome  = cf.lessDividendIncome ?? 0;
  const interestExpense = cf.addInterestExpense ?? 0;
  const gainLossDisposal = (cf.addLossOnDisposal ?? 0) - (cf.lessGainOnDisposal ?? 0);
  const fvGainLoss      = (cf.addFVLossOnInvestment ?? 0) - (cf.lessFVGainOnInvestment ?? 0);

  const chgReceivables  = cf.decreaseIncreaseReceivables ?? 0;
  const chgInventories  = cf.decreaseIncreaseInventory   ?? 0;
  const chgOtherCA      = cf.decreaseIncreaseOtherCurrentAssets ?? 0;
  const chgPayables     = cf.increaseDecreasePayables    ?? 0;
  const chgTaxPayable   = cf.increaseDecreaseIncomeTaxPayable ?? 0;
  const chgEmployeeLiab = cf.increaseDecreaseEmployeeLiability ?? 0;
  const chgProvisions   = cf.increaseDecreaseProvisions  ?? 0;

  const cashGenFromOps =
    profitBeforeTax + depreciation + impairment
    - interestIncome - dividendIncome + interestExpense
    + gainLossDisposal + fvGainLoss
    + chgReceivables + chgInventories + chgOtherCA
    + chgPayables + chgTaxPayable + chgEmployeeLiab + chgProvisions;

  const interestPaid = cf.interestPaid ?? 0;
  const taxPaid      = cf.incomeTaxPaid ?? 0;
  const netOperating = cashGenFromOps + interestPaid + taxPaid;

  const purchasePPE            = cf.purchaseOfPPE               ?? 0;
  const proceedsDisposal       = cf.proceedsFromPPEDisposal     ?? 0;
  const purchaseInvestments    = cf.purchaseOfInvestments        ?? 0;
  const proceedsInvestments    = cf.proceedsFromInvestmentDisposal ?? 0;
  const interestReceived       = cf.interestReceived             ?? 0;
  const dividendReceived       = cf.dividendReceived             ?? 0;
  const netInvesting = -purchasePPE + proceedsDisposal
    - purchaseInvestments + proceedsInvestments
    + interestReceived + dividendReceived;

  const proceedsLoans     = (cf.proceedsFromBorrowingsNonCurrent ?? 0) + (cf.proceedsFromBorrowingsCurrent ?? 0);
  const repaymentLoans    = (cf.repaymentOfBorrowingsNonCurrent ?? 0) + (cf.repaymentOfBorrowingsCurrent ?? 0);
  const proceedsShareCap  = cf.proceedsFromShareIssue ?? 0;
  const dividendPaid      = cf.dividendPaid ?? 0;
  const netFinancing      = proceedsLoans - repaymentLoans + proceedsShareCap - dividendPaid;

  const netChange         = netOperating + netInvesting + netFinancing;
  const openingCash       = cf.openingCash ?? 0;
  const closingCash       = cf.closingCash ?? 0;
  const reconciliationDiff = closingCash - (openingCash + netChange);

  // ── Row definitions ───────────────────────────────────────────────────────
  type RowStyle = CFRow['style'];

  const rows: CFRow[] = [
    // ── Operating ──
    { label: 'A. CASH FLOWS FROM OPERATING ACTIVITIES',   current: 0,                 style: 'section-head' },
    { label: 'Profit/(Loss) before Tax',                  current: profitBeforeTax,   indent: 1 },
    { label: 'Adjustments for non-cash items:',           current: 0,                 indent: 1, italic: true },
    { label: 'Depreciation and amortisation',             current: depreciation,      indent: 2 },
    { label: 'Impairment losses',                         current: impairment,        indent: 2 },
    { label: 'Interest income',                           current: interestIncome,    indent: 2, bracketed: true },
    { label: 'Dividend income',                           current: dividendIncome,    indent: 2, bracketed: true },
    { label: 'Interest expense',                          current: interestExpense,   indent: 2 },
    { label: 'Loss/(Gain) on disposal of PPE',            current: gainLossDisposal,  indent: 2 },
    { label: 'FV loss/(gain) on investments',             current: fvGainLoss,        indent: 2 },
    { label: 'Changes in working capital:',               current: 0,                 indent: 1, italic: true },
    // item 119: all working capital rows at indent: 2
    { label: 'Decrease/(Increase) in trade receivables',  current: chgReceivables,    indent: 2 },
    { label: 'Decrease/(Increase) in inventories',        current: chgInventories,    indent: 2 },
    { label: 'Decrease/(Increase) in other current assets', current: chgOtherCA,      indent: 2 },
    { label: 'Increase/(Decrease) in trade payables',     current: chgPayables,       indent: 2 },
    { label: 'Increase/(Decrease) in tax payable',        current: chgTaxPayable,     indent: 2 },
    { label: 'Increase/(Decrease) in employee liabilities', current: chgEmployeeLiab, indent: 2 },
    { label: 'Increase/(Decrease) in provisions',         current: chgProvisions,     indent: 2 },
    { label: 'Cash Generated from Operations',            current: cashGenFromOps,    style: 'subtotal' },
    { label: 'Less: Interest paid',                       current: interestPaid,      indent: 1, bracketed: true },
    { label: 'Less: Income tax paid',                     current: taxPaid,           indent: 1, bracketed: true },
    { label: 'NET CASH FROM OPERATING ACTIVITIES',        current: netOperating,      style: 'total' },

    // ── Investing ──
    { label: 'B. CASH FLOWS FROM INVESTING ACTIVITIES',  current: 0,                 style: 'section-head' },
    { label: 'Purchase of property, plant and equipment', current: purchasePPE,       indent: 1, bracketed: true },
    { label: 'Proceeds from disposal of PPE',             current: proceedsDisposal,  indent: 1 },
    { label: 'Purchase of investments',                   current: purchaseInvestments, indent: 1, bracketed: true },
    { label: 'Proceeds from sale of investments',         current: proceedsInvestments, indent: 1 },
    { label: 'Interest received',                         current: interestReceived,  indent: 1 },
    { label: 'Dividend received',                         current: dividendReceived,  indent: 1 },
    { label: 'NET CASH FROM INVESTING ACTIVITIES',        current: netInvesting,      style: 'total' },

    // ── Financing ──
    { label: 'C. CASH FLOWS FROM FINANCING ACTIVITIES',  current: 0,                 style: 'section-head' },
    { label: 'Proceeds from loans and borrowings',        current: proceedsLoans,     indent: 1 },
    { label: 'Repayment of loans and borrowings',         current: repaymentLoans,    indent: 1, bracketed: true },
    { label: 'Proceeds from issue of share capital',      current: proceedsShareCap,  indent: 1 },
    { label: 'Dividends paid',                            current: dividendPaid,      indent: 1, bracketed: true },
    { label: 'NET CASH FROM FINANCING ACTIVITIES',        current: netFinancing,      style: 'total' },

    // ── Reconciliation ──
    { label: 'Net Increase/(Decrease) in Cash and Cash Equivalents', current: netChange, style: 'subtotal' },
    { label: 'Cash and Cash Equivalents at Beginning of Year',        current: openingCash, indent: 1 },
    { label: 'CASH AND CASH EQUIVALENTS AT END OF YEAR',              current: closingCash, style: 'grand-total' },
  ];

  // ── Indent classes ────────────────────────────────────────────────────────
  const indentClass = (indent?: number) => {
    if (indent === 2) return 'pl-10';
    if (indent === 1) return 'pl-5';
    return '';
  };

  // ── Row class ─────────────────────────────────────────────────────────────
  const rowClass = (style?: RowStyle) => {
    if (style === 'total')       return 'row-total';
    if (style === 'grand-total') return 'row-grand-total';
    if (style === 'subtotal')    return 'row-total';
    return '';
  };

  return (
    <div className="statement-page max-w-4xl mx-auto">
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
          Statement of Cash Flows (Indirect Method)
        </p>
        <p className="statement-date">For the year ended {endDateBS}</p>
        <p className="text-xs text-slate-500 italic mt-1">
          All amounts in NPR rounded to nearest {roundingLevel}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="fin-table w-full" style={{ minWidth: 620 }}>
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Particulars</th>
              <th className="text-right">Current Year</th>
              <th className="text-right">Previous Year</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const isSectionHead = row.style === 'section-head';
              const isSummaryRow  = row.style === 'total' || row.style === 'grand-total' || row.style === 'subtotal';
              const isSubHeader   = row.italic && row.current === 0 && !isSummaryRow;

              // item 118: section-head uses .row-section-head class (blue left accent from CSS)
              if (isSectionHead) {
                return (
                  <tr key={i} className="row-section-head">
                    <td colSpan={3}>{row.label}</td>
                  </tr>
                );
              }

              return (
                <tr key={i} className={rowClass(row.style)}>
                  <td
                    className={[
                      indentClass(row.indent),
                      row.italic ? 'italic text-slate-500 text-[12px]' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {row.label}
                  </td>

                  {/* Current year amount */}
                  <td className="amount text-[13px]">
                    {!isSubHeader && row.current !== 0
                      ? cfv(row.current, row.bracketed)
                      : !isSubHeader && isSummaryRow
                      ? cfv(0)
                      : ''}
                  </td>

                  {/* Prior year amount */}
                  <td className="amount text-[13px] text-slate-400">
                    {!isSubHeader && row.previous !== undefined && row.previous !== 0
                      ? cfv(row.previous, row.bracketed)
                      : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reconciliation warning */}
      {Math.abs(reconciliationDiff) > 0.5 && (
        <div className="mt-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono">
          ⚠ Reconciliation difference: {cfv(reconciliationDiff)} — Closing cash per balance sheet
          does not agree with net cash movement. Please review working capital movements.
        </div>
      )}

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
