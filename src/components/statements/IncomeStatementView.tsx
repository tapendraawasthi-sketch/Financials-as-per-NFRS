// src/components/statements/IncomeStatementView.tsx
import React from 'react';
import { IncomeStatement, CompanyProfile } from '../../types';
import { formatNPR } from '../../utils/numberFormat';

interface IncomeStatementViewProps {
  incomeStatement: IncomeStatement;
  company: CompanyProfile;
}

const Row: React.FC<{
  label: string;
  note?: string;
  cy?: number;
  py?: number;
  bold?: boolean;
  doubleUnderline?: boolean;
  indent?: number;
  isTotal?: boolean;
  isSectionHeader?: boolean;
  emptyRow?: boolean;
}> = ({ label, note, cy, py, bold, doubleUnderline, indent = 0, isTotal, isSectionHeader, emptyRow }) => {
  if (emptyRow) return <tr><td colSpan={4} className="h-2" /></tr>;

  const labelClass = [
    isSectionHeader ? 'font-bold uppercase tracking-wide text-slate-700 bg-slate-50' : '',
    isTotal ? 'font-semibold border-t border-slate-400' : '',
    bold ? 'font-bold' : '',
    doubleUnderline ? 'border-b-4 border-double border-slate-800' : '',
  ].filter(Boolean).join(' ');

  const cellClass = [
    'px-3 py-1 text-sm',
    isTotal ? 'border-t border-slate-400' : '',
    bold ? 'font-bold' : '',
    doubleUnderline ? 'border-b-4 border-double border-slate-800' : '',
  ].filter(Boolean).join(' ');

  return (
    <tr className={isSectionHeader ? 'bg-slate-50' : 'hover:bg-slate-50/50'}>
      <td className={`${labelClass} px-3 py-1 text-sm w-full`} style={{ paddingLeft: `${12 + indent * 16}px` }}>
        {label}
      </td>
      <td className={`${cellClass} text-center text-slate-500 w-16`}>{note || ''}</td>
      <td className={`${cellClass} text-right tabular-nums w-36`}>
        {cy !== undefined ? formatNPR(cy) : ''}
      </td>
      <td className={`${cellClass} text-right tabular-nums w-36 text-slate-500`}>
        {py !== undefined ? formatNPR(py) : ''}
      </td>
    </tr>
  );
};

const IncomeStatementView: React.FC<IncomeStatementViewProps> = ({ incomeStatement: is, company }) => {
  const fy = company.fiscalYear;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
      {/* Company Header */}
      <div className="text-center py-6 border-b border-slate-200 bg-slate-50 px-6">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">{company.companyName}</h2>
        {company.address?.district && (
          <p className="text-sm text-slate-500 mt-1">{company.address.district}, Nepal</p>
        )}
        <h3 className="text-base font-semibold text-slate-700 mt-3 uppercase tracking-widest">
          Statement of Income
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          For the year ended {fy.endDateBS} ({fy.endDateAD})
        </p>
        <p className="text-xs text-slate-400 mt-1">(All amounts in NPR unless otherwise stated)</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-100">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Particulars
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide w-16">
                Note
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
            {/* ── INCOME ── */}
            <Row label="INCOME" isSectionHeader />
            <Row label="Revenue from Operations" note="3.17" indent={1}
              cy={is.revenueFromOperations?.cy} py={is.revenueFromOperations?.py} />
            <Row label="Interest Income" indent={1}
              cy={is.interestIncome?.cy} py={is.interestIncome?.py} />
            <Row label="Dividend Income" indent={1}
              cy={is.dividendIncome?.cy} py={is.dividendIncome?.py} />
            <Row label="Other Income" note="3.17" indent={1}
              cy={is.otherIncome?.cy} py={is.otherIncome?.py} />
            <Row label="Total Income" isTotal bold
              cy={is.totalIncome?.cy} py={is.totalIncome?.py} />

            <Row emptyRow />

            {/* ── EXPENSES ── */}
            <Row label="EXPENSES" isSectionHeader />
            <Row label="Material Consumed" note="3.18" indent={1}
              cy={is.materialConsumed?.cy} py={is.materialConsumed?.py} />
            <Row label="Purchases" note="3.18" indent={1}
              cy={is.purchases?.cy} py={is.purchases?.py} />
            <Row label="(Increase)/Decrease in Inventories" note="3.18" indent={1}
              cy={is.inventoryChange?.cy} py={is.inventoryChange?.py} />
            <Row label="Direct Expenses" note="3.19" indent={1}
              cy={is.directExpenses?.cy} py={is.directExpenses?.py} />
            <Row label="Employee Benefit Expenses" note="3.20" indent={1}
              cy={is.employeeBenefitExpenses?.cy} py={is.employeeBenefitExpenses?.py} />
            <Row label="Finance Charges" indent={1}
              cy={is.financeCharges?.cy} py={is.financeCharges?.py} />
            <Row label="Depreciation & Amortisation" note="3.1" indent={1}
              cy={is.depreciation?.cy} py={is.depreciation?.py} />
            <Row label="Impairment Loss" note="3.21" indent={1}
              cy={is.impairmentLoss?.cy} py={is.impairmentLoss?.py} />
            <Row label="Administrative & Other Expenses" note="3.22" indent={1}
              cy={is.adminExpenses?.cy} py={is.adminExpenses?.py} />
            <Row label="Total Expenses" isTotal bold
              cy={is.totalExpenses?.cy} py={is.totalExpenses?.py} />

            <Row emptyRow />

            {/* ── PROFIT WATERFALL ── */}
            <Row label="Profit/(Loss) before Staff Bonus and Tax" bold
              cy={is.profitBeforeStaffBonusAndTax?.cy}
              py={is.profitBeforeStaffBonusAndTax?.py} />
            <Row label="Staff Bonus (10% of net profit before tax)" indent={1}
              cy={is.staffBonus?.cy} py={is.staffBonus?.py} />
            <Row label="Profit/(Loss) before Tax" bold isTotal
              cy={is.profitBeforeTax?.cy} py={is.profitBeforeTax?.py} />
            <Row label="Income Tax Expense" note="3.23" indent={1}
              cy={is.incomeTaxExpense?.cy} py={is.incomeTaxExpense?.py} />
            <Row label="Deferred Tax (Income)/Expense" indent={1}
              cy={is.deferredTax?.cy} py={is.deferredTax?.py} />

            <Row emptyRow />

            {/* ── NET PROFIT ── */}
            <Row
              label="NET PROFIT/(LOSS) FOR THE YEAR"
              bold
              doubleUnderline
              cy={is.netProfit?.cy}
              py={is.netProfit?.py}
            />

            <Row emptyRow />

            {/* ── EPS (if available) ── */}
            {(is.earningsPerShare?.cy !== undefined) && (
              <Row
                label="Earnings Per Share (NPR)"
                cy={is.earningsPerShare?.cy}
                py={is.earningsPerShare?.py}
              />
            )}
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

export default IncomeStatementView;
