// src/components/statements/IncomeStatementView.tsx
import React from 'react';
import PrintButton          from '../output/PrintButton';
import { IncomeStatement }  from '../../types/financials';
import { CompanyProfile }   from '../../types/company';

interface IncomeStatementViewProps {
  data:          IncomeStatement;
  company:       CompanyProfile;
  previousYear?: Partial<IncomeStatement>;
}

function fmt(n: number | undefined | null, rl: number, isExpected = false): string {
  if (n === undefined || n === null || n === 0) return '—';
  const r   = Math.round(n / rl) * rl;
  const abs = Math.abs(r).toLocaleString('en-IN');
  return r < 0 ? `(${abs})` : abs;
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="row-section-head">
      <td colSpan={4}>{label}</td>
    </tr>
  );
}

function DataRow({
  label,
  note,
  cy,
  py,
  rl,
  indent = true,
  negative = false,
}: {
  label:     string;
  note?:     string;
  cy:        number | undefined | null;
  py?:       number | undefined | null;
  rl:        number;
  indent?:   boolean;
  negative?: boolean;
}) {
  const isZero = !cy || cy === 0;
  // For expense rows: display positive (passed positive, shown positive)
  const displayCy = negative && cy && cy > 0 ? cy : cy;
  return (
    <tr>
      <td className={`${indent ? 'pl-8' : ''} text-xs text-slate-700`}>{label}</td>
      <td className="text-center text-xs">
        {note && <span className="text-blue-600 font-normal">{note}</span>}
      </td>
      <td className={`amount text-xs ${isZero ? 'amount-zero' : ''}`}>
        {fmt(displayCy, rl)}
      </td>
      <td className={`amount text-xs ${!py || py === 0 ? 'amount-zero' : ''}`}>
        {fmt(py, rl)}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  cy,
  py,
  rl,
  grand   = false,
  isLoss  = false,
}: {
  label:   string;
  cy:      number | undefined | null;
  py?:     number | undefined | null;
  rl:      number;
  grand?:  boolean;
  isLoss?: boolean;
}) {
  const cls = grand ? 'row-grand-total' : 'row-total';
  return (
    <tr className={cls}>
      <td className="text-xs">{label}</td>
      <td />
      <td className={`amount text-xs ${isLoss && cy && cy < 0 ? 'amount-loss-subtle' : ''}`}>
        {fmt(cy, rl)}
      </td>
      <td className={`amount text-xs ${isLoss && py && py < 0 ? 'amount-loss-subtle' : ''}`}>
        {fmt(py, rl)}
      </td>
    </tr>
  );
}

function BlankRow() {
  return <tr><td colSpan={4} className="py-1" /></tr>;
}

function IncomeStatementView({
  data,
  company,
  previousYear,
}: IncomeStatementViewProps) {
  const rl = company.accountingPolicies?.roundingLevel ?? 100;
  const cy = company.fiscalYear;

  const totalIncome   = (data.revenue ?? 0) + (data.interestIncome ?? 0) + (data.otherIncome ?? 0);
  const totalExpenses =
    (data.materialConsumed  ?? 0) +
    (data.directExpenses    ?? 0) +
    (data.employeeBenefitExpense  ?? 0) +
    (data.financeCharges    ?? 0) +
    (data.depreciation      ?? 0) +
    (data.impairment        ?? 0) +
    (data.adminAndOtherExpenses     ?? 0);

  const profitBeforeBonus = totalIncome - totalExpenses;
  const profitBeforeTax   = profitBeforeBonus - (data.staffBonus ?? 0);
  const netProfit         = profitBeforeTax - (data.incomeTaxExpense ?? 0);

  const pyTotalIncome =
    (previousYear?.revenue       ?? 0) +
    (previousYear?.interestIncome ?? 0) +
    (previousYear?.otherIncome    ?? 0);

  return (
    <div className="statement-page max-w-4xl mx-auto">
      {/* Print button */}
      <div className="no-print flex justify-end mb-3">
        <PrintButton label="Print Statement" />
      </div>

      {/* Statement header */}
      <div className="statement-header">
        <p className="statement-company-name">{company.companyName}</p>
        <p className="statement-title">Statement of Income</p>
        <p className="statement-date">
          For the year ended {cy?.endDateBS ?? '31 Ashadh 2082'} ({cy?.endDateAD ?? 'July 15, 2025'})
        </p>
        <p className="text-xs text-slate-400 mt-1">
          All amounts in NPR rounded to nearest {rl.toLocaleString()}
        </p>
      </div>

      {/* Main table */}
      <table className="fin-table w-full mt-4">
        <colgroup>
          <col style={{ width: '55%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '19.5%' }} />
          <col style={{ width: '19.5%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-center">Note</th>
            <th className="text-right">{cy?.bsYear ?? 'FY 2081/82'}</th>
            <th className="text-right">
              {cy?.bsYear?.replace(/(\d+)\/(\d+)/, (_, a, b) => `${+a-1}/${+b-1}`) ?? 'Prior Year'}
            </th>
          </tr>
        </thead>

        <tbody>
          {/* ── INCOME ─────────────────────────────────────────────────── */}
          <SectionRow label="INCOME" />
          <DataRow label="Revenue from Operations"     note="3.17" cy={data.revenue}        py={previousYear?.revenue}        rl={rl} />
          <DataRow label="Interest Income"                         cy={data.interestIncome}  py={previousYear?.interestIncome} rl={rl} />
          <DataRow label="Other Income"                note="3.16" cy={data.otherIncome}     py={previousYear?.otherIncome}    rl={rl} />
          <TotalRow label="Total Income"              cy={totalIncome}   py={pyTotalIncome}           rl={rl} />
          <BlankRow />

          {/* ── EXPENSES ───────────────────────────────────────────────── */}
          <SectionRow label="EXPENSES" />
          <DataRow label="Material / Purchases Consumed" note="3.18" cy={data.materialConsumed} py={previousYear?.materialConsumed} rl={rl} />
          <DataRow label="Direct Expenses"               note="3.19" cy={data.directExpenses}   py={previousYear?.directExpenses}   rl={rl} />
          <DataRow label="Employee benefits expense"     note="3.20" cy={data.employeeBenefitExpense}  py={previousYear?.employeeBenefitExpense_py} rl={rl} indent negative />
          <DataRow label="Finance Charges"                           cy={data.financeCharges}   py={previousYear?.financeCharges}   rl={rl} />
          <DataRow label="Depreciation &amp; Amortisation" note="3.1" cy={data.depreciation}   py={previousYear?.depreciation}     rl={rl} />
          <DataRow label="Impairment"                    note="3.21" cy={data.impairment}       py={previousYear?.impairment}       rl={rl} />
          <DataRow label="Administrative and other expenses" note="3.22" cy={data.adminAndOtherExpenses} py={previousYear?.adminAndOtherExpenses_py} rl={rl} indent negative />
          <TotalRow label="Total Expenses" cy={totalExpenses} py={undefined} rl={rl} />
          <BlankRow />

          {/* Profit before bonus */}
          <TotalRow
            label="Profit / (Loss) before Staff Bonus"
            cy={profitBeforeBonus}
            rl={rl}
            isLoss
          />
          <DataRow label="Staff Bonus" cy={data.staffBonus} py={previousYear?.staffBonus} rl={rl} />

          {/* Profit before tax */}
          <TotalRow
            label="Profit / (Loss) before Tax"
            cy={profitBeforeTax}
            rl={rl}
            isLoss
          />
          <DataRow label="Income tax expense" note="3.23" cy={data.incomeTaxExpense} py={previousYear?.incomeTaxExpense_py} rl={rl} negative />
          <BlankRow />

          {/* Net profit */}
          <TotalRow
            label="NET PROFIT / (LOSS) FOR THE YEAR"
            cy={data.netProfit ?? ((data.profitBeforeTax ?? 0) - (data.incomeTaxExpense ?? 0))}
            py={(previousYear?.profitBeforeTax ?? 0) - (previousYear?.incomeTaxExpense_py ?? 0)}
            rl={rl}
            grand
            isLoss
          />
        </tbody>
      </table>

      {/* item 116: italic integral part note */}
      <div className="border-t border-slate-200 mt-4 pt-3 text-center">
        <p className="text-xs text-slate-500 italic">
          The notes referred to above form an integral part of these financial statements.
        </p>
      </div>

      {/* item 113: prior year totals note */}
      {(!previousYear?.totalExpenses) && (
        <p className="text-[11px] text-slate-400 italic text-center mt-2">
          Prior year comparative figures not provided — enter directly in the Excel workbook.
        </p>
      )}

      <div className="no-print flex justify-end mt-4">
        <PrintButton label="Print / Export PDF" />
      </div>
    </div>
  );
}

export default React.memo(IncomeStatementView);
