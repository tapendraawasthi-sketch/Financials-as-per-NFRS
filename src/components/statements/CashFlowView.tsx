// src/components/statements/CashFlowView.tsx
import React from 'react';
import { useAppStore } from '../../store/appStore';
import { formatNPR } from '../../utils/numberFormat';

interface CashFlowItem {
  label: string;
  current: number;
  previous?: number;
  indent?: number;
  italic?: boolean;
  style?: 'normal' | 'subtotal' | 'total' | 'grand-total' | 'section-head';
  bracketed?: boolean;
}

function cfv(n: number, bracketed?: boolean): string {
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const str = formatNPR(abs);
  return bracketed || n < 0 ? `(${str})` : str;
}

export default function CashFlowView() {
  const { state } = useAppStore();
  const financials = state.cashFlow ? { cashFlow: state.cashFlow } : {};
  const company = state.company;
  const fiscalYear = state.company?.fiscalYear;

  const endDateBS = fiscalYear?.endDateBS ?? '[End Date]';
  const companyName = company?.companyName ?? 'Company Name';
  const roundingLevel = company?.accountingPolicies?.roundingLevel ?? 1000;

  const cf = financials?.cashFlow;

  // Operating section values
  const profitBeforeTax = cf?.profitBeforeTax ?? 0;
  const depreciation = cf?.addDepreciation ?? 0;
  const impairment = cf?.addImpairment ?? 0;
  const interestIncome = cf?.lessInterestIncome ?? 0;
  const dividendIncome = cf?.lessDividendIncome ?? 0;
  const interestExpense = cf?.addInterestExpense ?? 0;
  const gainLossDisposal = (cf?.addLossOnDisposal ?? 0) - (cf?.lessGainOnDisposal ?? 0);
  const fvGainLoss = (cf?.addFVLossOnInvestment ?? 0) - (cf?.lessFVGainOnInvestment ?? 0);
  const chgReceivables = cf?.decreaseIncreaseReceivables ?? 0;
  const chgInventories = cf?.decreaseIncreaseInventory ?? 0;
  const chgOtherCA = cf?.decreaseIncreaseOtherCurrentAssets ?? 0;
  const chgPayables = cf?.increaseDecreasePayables ?? 0;
  const chgTaxPayable = cf?.increaseDecreaseIncomeTaxPayable ?? 0;
  const chgEmployeeLiab = cf?.increaseDecreaseEmployeeLiability ?? 0;
  const chgProvisions = cf?.increaseDecreaseProvisions ?? 0;
  const interestPaid = cf?.interestPaid ?? 0;
  const taxPaid = cf?.incomeTaxPaid ?? 0;

  const cashGenFromOps =
    profitBeforeTax +
    depreciation +
    impairment -
    interestIncome -
    dividendIncome +
    interestExpense +
    gainLossDisposal +
    fvGainLoss +
    chgReceivables +
    chgInventories +
    chgOtherCA +
    chgPayables +
    chgTaxPayable +
    chgEmployeeLiab +
    chgProvisions;

  const netOperating = cashGenFromOps - interestPaid - taxPaid;

  // Investing
  const purchasePPE = cf?.purchaseOfPPE ?? 0;
  const proceedsDisposal = cf?.proceedsFromPPEDisposal ?? 0;
  const purchaseInvestments = cf?.purchaseOfInvestments ?? 0;
  const proceedsInvestments = cf?.proceedsFromInvestmentDisposal ?? 0;
  const interestReceived = cf?.interestReceived ?? 0;
  const dividendReceived = cf?.dividendReceived ?? 0;
  const netInvesting =
    -purchasePPE +
    proceedsDisposal -
    purchaseInvestments +
    proceedsInvestments +
    interestReceived +
    dividendReceived;

  // Financing
  const proceedsLoans = (cf?.proceedsFromBorrowingsNonCurrent ?? 0) + (cf?.proceedsFromBorrowingsCurrent ?? 0);
  const repaymentLoans = (cf?.repaymentOfBorrowingsNonCurrent ?? 0) + (cf?.repaymentOfBorrowingsCurrent ?? 0);
  const proceedsShareCapital = cf?.proceedsFromShareIssue ?? 0;
  const dividendPaid = cf?.dividendPaid ?? 0;
  const netFinancing = proceedsLoans - repaymentLoans + proceedsShareCapital - dividendPaid;

  const netChange = netOperating + netInvesting + netFinancing;
  const openingCash = cf?.openingCash ?? 0;
  const closingCash = cf?.closingCash ?? 0;
  const reconciliationDifference = closingCash - (openingCash + netChange);

  type RowStyle = 'normal' | 'subtotal' | 'total' | 'grand-total' | 'section-head';

  const rows: CashFlowItem[] = [
    // A
    { label: 'A. CASH FLOW FROM OPERATING ACTIVITIES', current: 0, style: 'section-head' },
    { label: 'Profit/(Loss) before Tax', current: profitBeforeTax, previous: undefined },
    { label: 'Adjustments for:', current: 0, indent: 1, italic: true },
    { label: 'Depreciation', current: depreciation, indent: 2 },
    { label: 'Impairment losses', current: impairment, indent: 2 },
    { label: 'Interest income', current: interestIncome, indent: 2, bracketed: true },
    { label: 'Dividend income', current: dividendIncome, indent: 2, bracketed: true },
    { label: 'Interest expense', current: interestExpense, indent: 2 },
    { label: 'Loss/(Gain) on disposal of PPE', current: gainLossDisposal, indent: 2 },
    { label: 'FV Loss/(Gain) on investments', current: fvGainLoss, indent: 2 },
    { label: 'Changes in working capital:', current: 0, indent: 1, italic: true },
    { label: 'Decrease/(Increase) in receivables', current: chgReceivables, indent: 2 },
    { label: 'Decrease/(Increase) in inventories', current: chgInventories, indent: 2 },
    { label: 'Decrease/(Increase) in other current assets', current: chgOtherCA, indent: 2 },
    { label: 'Increase/(Decrease) in payables', current: chgPayables, indent: 2 },
    { label: 'Increase/(Decrease) in tax payable', current: chgTaxPayable, indent: 2 },
    { label: 'Increase/(Decrease) in employee liabilities', current: chgEmployeeLiab, indent: 2 },
    { label: 'Increase/(Decrease) in provisions', current: chgProvisions, indent: 2 },
    { label: 'Cash Generated from Operations', current: cashGenFromOps, style: 'total' },
    { label: 'Less: Interest Paid', current: interestPaid, bracketed: true },
    { label: 'Less: Income Tax Paid', current: taxPaid, bracketed: true },
    { label: 'NET CASH FROM OPERATING ACTIVITIES', current: netOperating, style: 'grand-total' },

    // B
    { label: 'B. CASH FLOW FROM INVESTING ACTIVITIES', current: 0, style: 'section-head' },
    { label: 'Purchase of property, plant and equipment', current: purchasePPE, bracketed: true },
    { label: 'Proceeds from disposal of PPE', current: proceedsDisposal },
    { label: 'Purchase of investments', current: purchaseInvestments, bracketed: true },
    { label: 'Proceeds from sale of investments', current: proceedsInvestments },
    { label: 'Interest received', current: interestReceived },
    { label: 'Dividend received', current: dividendReceived },
    { label: 'NET CASH FROM INVESTING ACTIVITIES', current: netInvesting, style: 'grand-total' },

    // C
    { label: 'C. CASH FLOW FROM FINANCING ACTIVITIES', current: 0, style: 'section-head' },
    { label: 'Proceeds from loans and borrowings', current: proceedsLoans },
    { label: 'Repayment of loans and borrowings', current: repaymentLoans, bracketed: true },
    { label: 'Proceeds from issue of share capital', current: proceedsShareCapital },
    { label: 'Dividend paid', current: dividendPaid, bracketed: true },
    { label: 'NET CASH FROM FINANCING ACTIVITIES', current: netFinancing, style: 'grand-total' },

    // Reconciliation
    { label: 'Net Increase/(Decrease) in Cash and Cash Equivalents', current: netChange, style: 'total' },
    { label: 'Cash and Cash Equivalents at Beginning of Year', current: openingCash },
    { label: 'CASH AND CASH EQUIVALENTS AT END OF YEAR', current: closingCash, style: 'grand-total' },
  ];

  const indentClass = (indent?: number) => {
    if (indent === 1) return 'pl-4';
    if (indent === 2) return 'pl-8';
    return '';
  };

  const rowClass = (style?: RowStyle) => {
    if (style === 'section-head') return 'row-section-head';
    if (style === 'total') return 'row-total';
    if (style === 'grand-total') return 'row-grand-total';
    return '';
  };

  const isHeaderRow = (style?: RowStyle) =>
    style === 'section-head' || style === 'total' || style === 'grand-total';

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
          Statement of Cash Flows
        </h2>
        <p className="text-[11px] text-slate-500 mt-1">
          For the year ended {endDateBS}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          All amounts in NPR {roundingLevel} unless stated otherwise
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="fin-table w-full">
          <thead>
            <tr>
              <th className="text-left" style={{ width: '55%' }}>Particulars</th>
              <th className="text-right" style={{ width: '22.5%' }}>
                Current Year
              </th>
              <th className="text-right" style={{ width: '22.5%' }}>
                Previous Year
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isHeader = isHeaderRow(row.style);
              const showAmount = !isHeader || row.style === 'total' || row.style === 'grand-total';
              const hideAmount = row.style === 'section-head';
              const isSubHeader = row.italic && row.current === 0 && !row.style;

              return (
                <tr key={i} className={rowClass(row.style as RowStyle)}>
                  <td
                    className={[
                      indentClass(row.indent),
                      row.italic ? 'italic text-slate-500' : '',
                      isSubHeader ? 'text-[11px]' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {row.label}
                  </td>
                  <td className="amount-cell text-right font-mono tabular-nums">
                    {!hideAmount && !isSubHeader && row.current !== 0
                      ? cfv(row.current, row.bracketed)
                      : !hideAmount && !isSubHeader && row.current === 0
                      ? (row.style === 'total' || row.style === 'grand-total' ? cfv(0) : '')
                      : ''}
                  </td>
                  <td className="amount-cell text-right font-mono tabular-nums text-slate-400">
                    {!hideAmount && !isSubHeader && row.previous !== undefined && row.previous !== 0
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
      {Math.abs(reconciliationDifference) > 0.5 && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-mono">
          Reconciliation difference: {cfv(reconciliationDifference)} — Closing cash per balance
          sheet does not agree with net cash movement. Please review.
        </div>
      )}

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
