// src/components/statements/IncomeStatementView.tsx
import React from 'react';
import { IncomeStatement } from '../../types/financials';
import { CompanyProfile }  from '../../types/company';

interface IncomeStatementViewProps {
  data:          IncomeStatement;
  company:       CompanyProfile;
  previousYear?: Partial<IncomeStatement>;
}

function fmt(n: number | undefined | null, rl: number): string {
  if (n === undefined || n === null || n === 0) return '—';
  const r   = Math.round(n / rl) * rl;
  const abs = Math.abs(r).toLocaleString('en-IN');
  return r < 0 ? `(${abs})` : abs;
}

function SectionRow({ label }: { label: string }) {
  return <tr className="row-section-head"><td colSpan={4}>{label}</td></tr>;
}

function DataRow({ label, note, cy, py, rl, indent = true }: {
  label: string; note?: string; cy: number | undefined | null;
  py?: number | undefined | null; rl: number; indent?: boolean;
}) {
  const isZero = !cy || cy === 0;
  return (
    <tr>
      <td className={indent ? 'pl-8' : ''}>{label}</td>
      <td className="text-center">
        {note && <span className="text-indigo-600 font-medium text-xs">{note}</span>}
      </td>
      <td className={`amount ${isZero ? 'amount-zero' : ''}`}>{fmt(cy, rl)}</td>
      <td className={`amount ${!py || py === 0 ? 'amount-zero' : ''}`}>{fmt(py, rl)}</td>
    </tr>
  );
}

function TotalRow({ label, cy, py, rl, grand = false, isLoss = false }: {
  label: string; cy: number | undefined | null; py?: number | undefined | null;
  rl: number; grand?: boolean; isLoss?: boolean;
}) {
  return (
    <tr className={grand ? 'row-grand-total' : 'row-total'}>
      <td>{label}</td>
      <td />
      <td className={`amount ${isLoss && cy && cy < 0 ? 'amount-loss-subtle' : ''}`}>{fmt(cy, rl)}</td>
      <td className={`amount ${isLoss && py && py < 0 ? 'amount-loss-subtle' : ''}`}>{fmt(py, rl)}</td>
    </tr>
  );
}

function BlankRow() { return <tr><td colSpan={4} className="py-1" /></tr>; }

function IncomeStatementView({ data, company, previousYear }: IncomeStatementViewProps) {
  const rl = company.accountingPolicies?.roundingLevel ?? 100;
  const cy = company.fiscalYear;

  const totalIncome   = (data.revenue ?? 0) + (data.interestIncome ?? 0) + (data.otherIncome ?? 0);
  const totalExpenses =
    (data.materialConsumed ?? 0) + (data.directExpenses ?? 0) +
    (data.employeeBenefitExpense ?? 0) + (data.financeCharges ?? 0) +
    (data.depreciation ?? 0) + (data.impairment ?? 0) + (data.adminAndOtherExpenses ?? 0);
  const profitBeforeBonus = totalIncome - totalExpenses;
  const profitBeforeTax   = profitBeforeBonus - (data.staffBonus ?? 0);
  const pyTotalIncome     = (previousYear?.revenue ?? 0) + (previousYear?.interestIncome ?? 0) + (previousYear?.otherIncome ?? 0);

  return (
    <div className="statement-page max-w-4xl mx-auto">
      <div className="statement-header">
        <p className="statement-company-name">{company.companyName}</p>
        <p className="statement-title">Statement of Income</p>
        <p className="statement-date">
          For the year ended {cy?.endDateBS ?? '31 Ashadh 2082'} ({cy?.endDateAD ?? 'July 15, 2025'})
        </p>
        <p className="statement-date italic mt-1">
          All amounts in NPR rounded to nearest {rl.toLocaleString()}
        </p>
      </div>

      <table className="fin-table w-full mt-5">
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
            <th className="text-right">{cy?.bsFY ?? 'FY 2081/82'}</th>
            <th className="text-right">
              {cy?.bsFY?.replace(/(\d+)\/(\d+)/, (_, a, b) => `${+a-1}/${+b-1}`) ?? 'Prior Year'}
            </th>
          </tr>
        </thead>
        <tbody>
          <SectionRow label="INCOME" />
          <DataRow label="Revenue from Operations" note="3.17" cy={data.revenue}       py={previousYear?.revenue}       rl={rl} />
          <DataRow label="Interest Income"                     cy={data.interestIncome} py={previousYear?.interestIncome} rl={rl} />
          <DataRow label="Other Income"            note="3.16" cy={data.otherIncome}   py={previousYear?.otherIncome}   rl={rl} />
          <TotalRow label="Total Income"  cy={totalIncome} py={pyTotalIncome} rl={rl} />
          <BlankRow />
          <SectionRow label="EXPENSES" />
          <DataRow label="Material / Purchases Consumed"    note="3.18" cy={data.materialConsumed}         py={previousYear?.materialConsumed}         rl={rl} />
          <DataRow label="Direct Expenses"                  note="3.19" cy={data.directExpenses}           py={previousYear?.directExpenses}           rl={rl} />
          <DataRow label="Employee benefits expense"        note="3.20" cy={data.employeeBenefitExpense}   py={previousYear?.employeeBenefitExpense_py} rl={rl} indent />
          <DataRow label="Finance Charges"                             cy={data.financeCharges}            py={previousYear?.financeCharges}           rl={rl} />
          <DataRow label="Depreciation & Amortisation"     note="3.1"  cy={data.depreciation}             py={previousYear?.depreciation}             rl={rl} />
          <DataRow label="Impairment"                       note="3.21" cy={data.impairment}               py={previousYear?.impairment}               rl={rl} />
          <DataRow label="Administrative and other expenses" note="3.22" cy={data.adminAndOtherExpenses}   py={previousYear?.adminAndOtherExpenses_py} rl={rl} indent />
          <TotalRow label="Total Expenses" cy={totalExpenses} rl={rl} />
          <BlankRow />
          <TotalRow label="Profit / (Loss) before Staff Bonus" cy={profitBeforeBonus} rl={rl} isLoss />
          <DataRow label="Staff Bonus" cy={data.staffBonus} py={previousYear?.staffBonus} rl={rl} />
          <TotalRow label="Profit / (Loss) before Tax" cy={profitBeforeTax} rl={rl} isLoss />
          <DataRow label="Income tax expense" note="3.23" cy={data.incomeTaxExpense} py={previousYear?.incomeTaxExpense_py} rl={rl} />
          <BlankRow />
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

      <div className="border-t border-slate-200 mt-6 pt-3 text-center">
        <p className="text-xs text-slate-400 italic">
          The notes referred to above form an integral part of these financial statements.
        </p>
      </div>
      {(!previousYear?.totalExpenses) && (
        <p className="statement-date italic text-center mt-2">
          Prior year comparative figures not provided — enter directly in the Excel workbook.
        </p>
      )}
    </div>
  );
}

export default React.memo(IncomeStatementView);
