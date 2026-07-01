// ===== src/components/statements/BalanceSheetView.tsx =====
import React from 'react';
import type { BalanceSheet, CompanyProfile, NotesData } from '../../types';
import { formatNPR } from '../../utils/numberFormat';

interface BalanceSheetViewProps {
  balanceSheet: BalanceSheet;
  company: CompanyProfile;
  notes?: NotesData;
}

interface LineProps { label: string; note?: string; cy: number; py: number; isTotal?: boolean; isSubTotal?: boolean; isSectionHeader?: boolean; indent?: number; }

function Line({ label, note, cy, py, isTotal, isSubTotal, isSectionHeader, indent = 0 }: LineProps): React.ReactElement {
  if (isSectionHeader) {
    return (
      <tr className="bg-slate-800">
        <td colSpan={4} className="px-4 py-2 text-white font-bold text-sm uppercase tracking-wide">{label}</td>
      </tr>
    );
  }
  const rowCls = isTotal ? 'bg-blue-50 border-t-2 border-b-2 border-blue-600' : isSubTotal ? 'bg-slate-50 border-t border-b border-slate-300' : '';
  const fontCls = (isTotal || isSubTotal) ? 'font-bold text-slate-900' : 'text-slate-700';
  const indent_px = `${indent * 16}px`;

  return (
    <tr className={`${rowCls} hover:bg-blue-50/30 transition-colors`}>
      <td className={`px-4 py-2 ${fontCls} text-sm`} style={{ paddingLeft: `calc(1rem + ${indent_px})` }}>
        {label}
      </td>
      <td className="px-2 py-2 text-xs text-blue-600 italic text-center w-12">{note}</td>
      <td className={`px-4 py-2 text-right font-mono text-sm ${fontCls} w-36`}>{cy !== 0 ? formatNPR(cy, 100) : '–'}</td>
      <td className={`px-4 py-2 text-right font-mono text-sm text-slate-500 w-36`}>{py !== 0 ? formatNPR(py, 100) : '–'}</td>
    </tr>
  );
}

export default function BalanceSheetView({ balanceSheet: bs, company }: BalanceSheetViewProps): React.ReactElement {
  const fy = company.fiscalYear ?? '2081/82';
  const [, endBS] = fy.split('/');

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-0">
      {/* Header */}
      <div className="bg-slate-900 text-white text-center py-6 px-8">
        <h1 className="text-xl font-bold uppercase tracking-wide">{company.companyName}</h1>
        <h2 className="text-base font-semibold mt-1">STATEMENT OF FINANCIAL POSITION</h2>
        <p className="text-sm text-slate-300 italic mt-0.5">As at 31 Ashadh {endBS ?? ''} (15 July 2025)</p>
        <p className="text-xs text-slate-400 mt-1">All figures in NPR (Nepalese Rupees)</p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-4 gap-0 bg-blue-50 border-b border-blue-200 px-4 py-2">
        <div className="text-sm font-semibold text-slate-700">Particulars</div>
        <div className="text-xs font-medium text-slate-500 text-center">Note</div>
        <div className="text-sm font-semibold text-slate-700 text-right">31 Ashadh {endBS ?? ''}</div>
        <div className="text-sm font-medium text-slate-500 text-right">Previous Year</div>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <Line label="A.  NON-CURRENT ASSETS" isSectionHeader />
          <Line label="Property, Plant and Equipment" note="3.1" cy={bs.nca_ppe} py={bs.nca_ppe_py} indent={1} />
          <Line label="Investments" note="3.2" cy={bs.nca_investments} py={bs.nca_investments_py} indent={1} />
          <Line label="Other Receivables (Non-current)" note="3.4" cy={bs.nca_receivables} py={bs.nca_receivables_py} indent={1} />
          <Line label="Other Non-Current Assets" note="3.5" cy={bs.nca_other} py={bs.nca_other_py} indent={1} />
          <Line label="Total Non-Current Assets" cy={bs.totalNonCurrentAssets} py={bs.totalNonCurrentAssets_py} isSubTotal />

          <Line label="B.  CURRENT ASSETS" isSectionHeader />
          <Line label="Investments (Current)" note="3.2" cy={bs.ca_investments} py={bs.ca_investments_py} indent={1} />
          <Line label="Inventories" note="3.7" cy={bs.ca_inventories} py={bs.ca_inventories_py} indent={1} />
          <Line label="Trade and Other Receivables" note="3.3" cy={bs.ca_tradeReceivables} py={bs.ca_tradeReceivables_py} indent={1} />
          <Line label="Cash and Cash Equivalents" note="3.8" cy={bs.ca_cashAndEquivalents} py={bs.ca_cashAndEquivalents_py} indent={1} />
          <Line label="Other Current Assets" note="3.6" cy={bs.ca_other} py={bs.ca_other_py} indent={1} />
          <Line label="Total Current Assets" cy={bs.totalCurrentAssets} py={bs.totalCurrentAssets_py} isSubTotal />

          <Line label="TOTAL ASSETS" cy={bs.totalAssets} py={bs.totalAssets_py} isTotal />

          <Line label="C.  EQUITY" isSectionHeader />
          <Line label="Share Capital" note="3.9" cy={bs.eq_shareCapital} py={bs.eq_shareCapital_py} indent={1} />
          <Line label="Reserves" note="3.10" cy={bs.eq_reserves} py={bs.eq_reserves_py} indent={1} />
          <Line label="Retained Earnings" cy={bs.eq_retainedEarnings} py={bs.eq_retainedEarnings_py} indent={1} />
          <Line label="Total Equity" cy={bs.totalEquity} py={bs.totalEquity_py} isSubTotal />

          <Line label="D.  NON-CURRENT LIABILITIES" isSectionHeader />
          <Line label="Loans and Borrowings" note="3.11" cy={bs.ncl_borrowings} py={bs.ncl_borrowings_py} indent={1} />
          <Line label="Employee Benefit Liabilities" note="3.12" cy={bs.ncl_employeeBenefits} py={bs.ncl_employeeBenefits_py} indent={1} />
          <Line label="Provisions" cy={bs.ncl_provisions} py={bs.ncl_provisions_py} indent={1} />
          <Line label="Total Non-Current Liabilities" cy={bs.totalNonCurrentLiabilities} py={bs.totalNonCurrentLiabilities_py} isSubTotal />

          <Line label="E.  CURRENT LIABILITIES" isSectionHeader />
          <Line label="Loans and Borrowings" note="3.11" cy={bs.cl_borrowings} py={bs.cl_borrowings_py} indent={1} />
          <Line label="Trade and Other Payables" note="3.13" cy={bs.cl_tradePayables} py={bs.cl_tradePayables_py} indent={1} />
          <Line label="Income Tax Liability" cy={bs.cl_incomeTaxPayable} py={bs.cl_incomeTaxPayable_py} indent={1} />
          <Line label="Employee Benefit Liability" note="3.12" cy={bs.cl_provisions} py={bs.cl_provisions_py} indent={1} />
          <Line label="Other Current Liabilities" cy={bs.cl_other} py={bs.cl_other_py} indent={1} />
          <Line label="Total Current Liabilities" cy={bs.totalCurrentLiabilities} py={bs.totalCurrentLiabilities_py} isSubTotal />

          <Line label="TOTAL EQUITY AND LIABILITIES" cy={bs.totalEquityAndLiabilities} py={bs.totalEquityAndLiabilities_py} isTotal />

          {bs.checkDifference !== 0 && (
            <tr className="bg-red-50">
              <td colSpan={2} className="px-4 py-2 text-red-700 font-semibold text-sm">⚠️ Balance Sheet does not balance!</td>
              <td className="px-4 py-2 text-right font-mono text-sm text-red-700 font-bold">{formatNPR(bs.checkDifference)}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-500 italic">The notes referred to above form an integral part of these financial statements.</p>
        <div className="grid grid-cols-2 mt-6 gap-8">
          <div>
            <p className="text-xs font-medium text-slate-600">For and on behalf of the Board of Directors</p>
            <div className="mt-6 border-t border-slate-400 pt-1">
              <p className="text-sm font-medium text-slate-700">{company.chairperson ?? 'Chairperson'}</p>
              <p className="text-xs text-slate-500">Chairperson</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">For {company.auditorInfo?.auditorFirmName ?? 'Audit Firm'}</p>
            <div className="mt-6 border-t border-slate-400 pt-1">
              <p className="text-sm font-medium text-slate-700">{company.auditorInfo?.auditorName ?? 'Auditor'}</p>
              <p className="text-xs text-slate-500">{company.auditorInfo?.position ?? 'Engagement Partner'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
