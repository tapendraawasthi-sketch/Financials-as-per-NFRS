// src/components/statements/CashFlowView.tsx
import React from 'react';
import { CashFlowStatement, CompanyProfile } from '../../types';
import { formatNPR } from '../../utils/numberFormat';

interface CashFlowViewProps {
  cashFlow: CashFlowStatement;
  company: CompanyProfile;
}

interface CFRowProps {
  label: string;
  cy?: number;
  py?: number;
  bold?: boolean;
  indent?: number;
  isTotal?: boolean;
  isSectionHeader?: boolean;
  emptyRow?: boolean;
  negative?: boolean;   // renders value in brackets automatically if negative
  highlight?: 'red' | 'green';
}

const CFRow: React.FC<CFRowProps> = ({
  label, cy, py, bold, indent = 0, isTotal, isSectionHeader, emptyRow, highlight,
}) => {
  if (emptyRow) return <tr><td colSpan={3} className="h-3" /></tr>;

  const rowBg = isSectionHeader
    ? 'bg-slate-100'
    : highlight === 'red'
    ? 'bg-red-50'
    : highlight === 'green'
    ? 'bg-green-50'
    : '';

  const labelCls = [
    'px-3 py-1 text-sm',
    bold || isTotal ? 'font-semibold' : '',
    isSectionHeader ? 'font-bold uppercase tracking-wide text-slate-700' : '',
    isTotal ? 'border-t border-slate-300' : '',
    highlight === 'red' ? 'text-red-700' : '',
    highlight === 'green' ? 'text-green-700' : '',
  ].filter(Boolean).join(' ');

  const amtCls = [
    'px-3 py-1 text-sm text-right tabular-nums w-36',
    bold || isTotal ? 'font-semibold' : '',
    isTotal ? 'border-t border-slate-300' : '',
    highlight === 'red' ? 'text-red-700 font-semibold' : '',
    highlight === 'green' ? 'text-green-700 font-semibold' : '',
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowBg}>
      <td className={labelCls} style={{ paddingLeft: `${12 + indent * 16}px` }}>{label}</td>
      <td className={amtCls}>{cy !== undefined ? formatNPR(cy) : ''}</td>
      <td className={`${amtCls} text-slate-400`}>{py !== undefined ? formatNPR(py) : ''}</td>
    </tr>
  );
};

const SectionLabel: React.FC<{ letter: string; title: string }> = ({ letter, title }) => (
  <tr>
    <td colSpan={3} className="px-3 py-2 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">
      {letter}. {title}
    </td>
  </tr>
);

const CashFlowView: React.FC<CashFlowViewProps> = ({ cashFlow: cf, company }) => {
  const fy = company.fiscalYear;

  // Reconciliation check
  const expectedClosing =
    (cf.openingCash?.cy ?? 0) +
    (cf.netCashFromOperating?.cy ?? 0) +
    (cf.netCashFromInvesting?.cy ?? 0) +
    (cf.netCashFromFinancing?.cy ?? 0);
  const reconciliationDiff = (cf.closingCash?.cy ?? 0) - expectedClosing;
  const hasReconciliationError = Math.abs(reconciliationDiff) > 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
      {/* Company Header */}
      <div className="text-center py-6 border-b border-slate-200 bg-slate-50 px-6">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">{company.companyName}</h2>
        {company.address?.district && (
          <p className="text-sm text-slate-500 mt-1">{company.address.district}, Nepal</p>
        )}
        <h3 className="text-base font-semibold text-slate-700 mt-3 uppercase tracking-widest">
          Statement of Cash Flows
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          For the year ended {fy.endDateBS} ({fy.endDateAD})
        </p>
        <p className="text-xs text-slate-400 mt-1">
          (Indirect Method – All amounts in NPR unless otherwise stated)
        </p>
      </div>

      {/* Reconciliation Warning */}
      {hasReconciliationError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <span className="text-red-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Cash Flow Reconciliation Error</p>
            <p className="text-xs text-red-600 mt-0.5">
              Opening cash + net movements ({formatNPR(expectedClosing)}) does not match closing
              cash ({formatNPR(cf.closingCash?.cy ?? 0)}). Difference: {formatNPR(reconciliationDiff)}.
              Check your working capital movements and non-cash adjustments.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-100">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Particulars
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide w-36">
                {fy.bsYear}<br />
                <span className="font-normal text-slate-400 text-xs">(NPR)</span>
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide w-36">
                Previous Year<br />
                <span className="font-normal text-slate-400 text-xs">(NPR)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* ── A: OPERATING ── */}
            <SectionLabel letter="A" title="Cash Flow from Operating Activities" />
            <CFRow label="Profit/(Loss) before Tax" cy={cf.profitBeforeTax?.cy} py={cf.profitBeforeTax?.py} bold />
            <CFRow label="Adjustments for:" isSectionHeader />
            <CFRow label="Depreciation & Amortisation" indent={2} cy={cf.addBackDepreciation?.cy} py={cf.addBackDepreciation?.py} />
            <CFRow label="Impairment Loss" indent={2} cy={cf.addBackImpairment?.cy} py={cf.addBackImpairment?.py} />
            <CFRow label="Interest Income (deducted)" indent={2} cy={cf.deductInterestIncome?.cy} py={cf.deductInterestIncome?.py} />
            <CFRow label="Dividend Income (deducted)" indent={2} cy={cf.deductDividendIncome?.cy} py={cf.deductDividendIncome?.py} />
            <CFRow label="Interest Expense" indent={2} cy={cf.addBackInterestExpense?.cy} py={cf.addBackInterestExpense?.py} />
            <CFRow label="Loss/(Gain) on Disposal of PPE" indent={2} cy={cf.lossGainOnDisposal?.cy} py={cf.lossGainOnDisposal?.py} />
            <CFRow label="FV Loss/(Gain) on Investments" indent={2} cy={cf.fvLossGainInvestments?.cy} py={cf.fvLossGainInvestments?.py} />
            <CFRow label="Other Non-Cash Items" indent={2} cy={cf.otherNonCash?.cy} py={cf.otherNonCash?.py} />

            <CFRow emptyRow />
            <CFRow label="Changes in Working Capital:" isSectionHeader />
            <CFRow label="(Increase)/Decrease in Trade & Other Receivables" indent={2} cy={cf.changeInReceivables?.cy} py={cf.changeInReceivables?.py} />
            <CFRow label="(Increase)/Decrease in Inventories" indent={2} cy={cf.changeInInventories?.cy} py={cf.changeInInventories?.py} />
            <CFRow label="(Increase)/Decrease in Other Current Assets" indent={2} cy={cf.changeInOtherCurrentAssets?.cy} py={cf.changeInOtherCurrentAssets?.py} />
            <CFRow label="Increase/(Decrease) in Trade Payables" indent={2} cy={cf.changeInPayables?.cy} py={cf.changeInPayables?.py} />
            <CFRow label="Increase/(Decrease) in Other Payables & Provisions" indent={2} cy={cf.changeInOtherPayables?.cy} py={cf.changeInOtherPayables?.py} />

            <CFRow emptyRow />
            <CFRow label="Cash Generated from Operations" isTotal bold cy={cf.cashGeneratedFromOps?.cy} py={cf.cashGeneratedFromOps?.py} />
            <CFRow label="Less: Interest Paid" indent={1} cy={cf.interestPaid?.cy} py={cf.interestPaid?.py} />
            <CFRow label="Less: Income Tax Paid" indent={1} cy={cf.incomeTaxPaid?.cy} py={cf.incomeTaxPaid?.py} />
            <CFRow label="NET CASH FROM OPERATING ACTIVITIES" isTotal bold
              cy={cf.netCashFromOperating?.cy} py={cf.netCashFromOperating?.py} />

            <CFRow emptyRow />

            {/* ── B: INVESTING ── */}
            <SectionLabel letter="B" title="Cash Flow from Investing Activities" />
            <CFRow label="Purchase of Property, Plant & Equipment" indent={1} cy={cf.purchaseOfPPE?.cy} py={cf.purchaseOfPPE?.py} />
            <CFRow label="Proceeds from Disposal of PPE" indent={1} cy={cf.proceedsFromDisposalOfPPE?.cy} py={cf.proceedsFromDisposalOfPPE?.py} />
            <CFRow label="Purchase of Investments" indent={1} cy={cf.purchaseOfInvestments?.cy} py={cf.purchaseOfInvestments?.py} />
            <CFRow label="Proceeds from Sale of Investments" indent={1} cy={cf.proceedsFromSaleOfInvestments?.cy} py={cf.proceedsFromSaleOfInvestments?.py} />
            <CFRow label="Interest Received" indent={1} cy={cf.interestReceived?.cy} py={cf.interestReceived?.py} />
            <CFRow label="Dividend Received" indent={1} cy={cf.dividendReceived?.cy} py={cf.dividendReceived?.py} />
            <CFRow label="Capital Work-in-Progress (net)" indent={1} cy={cf.cwipMovement?.cy} py={cf.cwipMovement?.py} />
            <CFRow label="NET CASH FROM INVESTING ACTIVITIES" isTotal bold
              cy={cf.netCashFromInvesting?.cy} py={cf.netCashFromInvesting?.py} />

            <CFRow emptyRow />

            {/* ── C: FINANCING ── */}
            <SectionLabel letter="C" title="Cash Flow from Financing Activities" />
            <CFRow label="Proceeds from Issue of Share Capital" indent={1} cy={cf.proceedsFromShareIssue?.cy} py={cf.proceedsFromShareIssue?.py} />
            <CFRow label="Proceeds from Long-term Borrowings" indent={1} cy={cf.proceedsFromLTBorrowings?.cy} py={cf.proceedsFromLTBorrowings?.py} />
            <CFRow label="Repayment of Long-term Borrowings" indent={1} cy={cf.repaymentOfLTBorrowings?.cy} py={cf.repaymentOfLTBorrowings?.py} />
            <CFRow label="Net Change in Short-term Borrowings" indent={1} cy={cf.changeInSTBorrowings?.cy} py={cf.changeInSTBorrowings?.py} />
            <CFRow label="Dividends Paid" indent={1} cy={cf.dividendsPaid?.cy} py={cf.dividendsPaid?.py} />
            <CFRow label="NET CASH FROM FINANCING ACTIVITIES" isTotal bold
              cy={cf.netCashFromFinancing?.cy} py={cf.netCashFromFinancing?.py} />

            <CFRow emptyRow />

            {/* ── NET CHANGE ── */}
            <CFRow label="NET INCREASE/(DECREASE) IN CASH AND CASH EQUIVALENTS" bold isTotal
              cy={(cf.netCashFromOperating?.cy ?? 0) + (cf.netCashFromInvesting?.cy ?? 0) + (cf.netCashFromFinancing?.cy ?? 0)}
              py={(cf.netCashFromOperating?.py ?? 0) + (cf.netCashFromInvesting?.py ?? 0) + (cf.netCashFromFinancing?.py ?? 0)}
            />
            <CFRow label="Cash and Cash Equivalents at Beginning of Year"
              cy={cf.openingCash?.cy} py={cf.openingCash?.py} />
            <CFRow
              label="CASH AND CASH EQUIVALENTS AT END OF YEAR"
              bold
              isTotal
              cy={cf.closingCash?.cy}
              py={cf.closingCash?.py}
              highlight={hasReconciliationError ? 'red' : 'green'}
            />

            {/* Reconciliation error detail row */}
            {hasReconciliationError && (
              <tr>
                <td colSpan={3} className="px-3 py-2 bg-red-50">
                  <p className="text-xs text-red-600 font-medium">
                    ⚠️ Reconciliation difference: {formatNPR(reconciliationDiff)} — please review your cash movements.
                  </p>
                </td>
              </tr>
            )}

            <CFRow emptyRow />

            {/* Note reconciliation */}
            <tr>
              <td colSpan={3} className="px-3 pt-2 pb-1">
                <p className="text-xs text-slate-500 font-semibold">
                  Note — Cash and Cash Equivalents comprise: (Refer Note 3.8)
                </p>
              </td>
            </tr>
            <CFRow label="Cash on Hand" indent={1} cy={cf.cashOnHand?.cy} py={cf.cashOnHand?.py} />
            <CFRow label="Balance with Banks (Current Accounts)" indent={1} cy={cf.bankCurrentAccounts?.cy} py={cf.bankCurrentAccounts?.py} />
            <CFRow label="Short-term Deposits (maturity ≤ 3 months)" indent={1} cy={cf.shortTermDeposits?.cy} py={cf.shortTermDeposits?.py} />
            <CFRow label="Total Cash and Cash Equivalents" isTotal bold cy={cf.closingCash?.cy} py={cf.closingCash?.py} />
          </tbody>
        </table>
      </div>

      {/* Signatory footer */}
      <div className="mt-8 mx-6 mb-6 grid grid-cols-3 gap-8 border-t border-slate-200 pt-6 print:mt-12">
        {['Prepared by', 'Approved by Director', 'Auditor'].map((role) => (
          <div key={role} className="text-center">
            <div className="border-b border-slate-400 mb-1 h-10" />
            <p className="text-xs text-slate-500">{role}</p>
            <p className="text-xs text-slate-400 mt-0.5">Name / Signature / Date</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CashFlowView;
