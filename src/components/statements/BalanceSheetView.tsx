// src/components/statements/BalanceSheetView.tsx
import React from 'react';
import Button        from '../ui/Button';
import PrintButton   from '../output/PrintButton';
import { BalanceSheet } from '../../types/financials';
import { CompanyProfile } from '../../types/company';

interface BalanceSheetViewProps {
  data:         BalanceSheet;
  company:      CompanyProfile;
  previousYear?: Partial<BalanceSheet>;
}

function fmt(n: number | undefined | null, rl: number): string {
  if (n === undefined || n === null || n === 0) return '—';
  const r   = Math.round(n / rl) * rl;
  const abs = Math.abs(r).toLocaleString('en-IN');
  return r < 0 ? `(${abs})` : abs;
}

// ── Table row helpers ──────────────────────────────────────────────────────
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
  indent = false,
}: {
  label:   string;
  note?:   string;
  cy:      number | undefined | null;
  py?:     number | undefined | null;
  rl:      number;
  indent?: boolean;
}) {
  const isZero = !cy || cy === 0;
  return (
    <tr>
      <td className={`${indent ? 'pl-8' : ''} text-xs text-slate-700`}>{label}</td>
      <td className="text-center text-xs">
        {note && <span className="text-blue-600 font-normal">{note}</span>}
      </td>
      <td className={`amount text-xs ${isZero ? 'amount-zero' : ''}`}>
        {fmt(cy, rl)}
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
  grand = false,
}: {
  label:  string;
  cy:     number | undefined | null;
  py?:    number | undefined | null;
  rl:     number;
  grand?: boolean;
}) {
  const cls = grand ? 'row-grand-total' : 'row-total';
  return (
    <tr className={cls}>
      <td className="text-xs">{label}</td>
      <td />
      <td className="amount text-xs">{fmt(cy, rl)}</td>
      <td className="amount text-xs">{fmt(py, rl)}</td>
    </tr>
  );
}

function BlankRow() {
  return <tr><td colSpan={4} className="py-1" /></tr>;
}

export default function BalanceSheetView({
  data,
  company,
  previousYear,
}: BalanceSheetViewProps) {
  const rl   = company.accountingPolicies?.roundingLevel ?? 100;
  const cy   = company.fiscalYear;
  const diff = data.checkDifference ?? (data.totalAssets - data.totalEquityAndLiabilities);

  return (
    <div className="statement-page max-w-4xl mx-auto">
      {/* Print / no-print actions */}
      <div className="no-print flex justify-end mb-3">
        <PrintButton label="Print Statement" />
      </div>

      {/* Statement header */}
      <div className="statement-header">
        <p className="statement-company-name">{company.companyName}</p>
        <p className="statement-title">Statement of Financial Position</p>
        <p className="statement-date">
          As at {cy?.endDateBS ?? '31 Ashadh 2082'} ({cy?.endDateAD ?? 'July 15, 2025'})
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
            <th className="text-right">{cy?.endDateBS ?? 'FY 2081/82'}</th>
            <th className="text-right">FY {
              cy?.bsYear?.replace(/(\d+)\/(\d+)/, (_, a, b) => `${+a-1}/${+b-1}`) ?? 'Prior Year'
            }</th>
          </tr>
        </thead>

        <tbody>
          {/* ── A: NON-CURRENT ASSETS ─────────────────────────────────── */}
          <SectionRow label="A  NON-CURRENT ASSETS" />
          <DataRow label="Property, Plant &amp; Equipment (Net)" note="3.1" cy={data.nca_ppe}        py={previousYear?.nca_ppe}        rl={rl} indent />
          <DataRow label="Investments"                            note="3.2" cy={data.nca_investments} py={previousYear?.nca_investments} rl={rl} indent />
          <DataRow label="Other Receivables"                      note="3.4" cy={data.nca_receivables} py={previousYear?.nca_receivables} rl={rl} indent />
          <DataRow label="Other Non-Current Assets"              note="3.5" cy={data.nca_other}       py={previousYear?.nca_other}       rl={rl} indent />
          <TotalRow label="Total Non-Current Assets"                        cy={data.totalNonCurrentAssets} py={previousYear?.totalNonCurrentAssets} rl={rl} />
          <BlankRow />

          {/* ── B: CURRENT ASSETS ─────────────────────────────────────── */}
          <SectionRow label="B  CURRENT ASSETS" />
          <DataRow label="Inventories"          note="3.7" cy={data.ca_inventories}      py={previousYear?.ca_inventories}      rl={rl} indent />
          <DataRow label="Trade Receivables"    note="3.3" cy={data.ca_tradeReceivables} py={previousYear?.ca_tradeReceivables} rl={rl} indent />
          <DataRow label="Other Current Assets" note="3.4 / 3.6" cy={data.ca_other} py={previousYear?.ca_other_py} rl={rl} indent />
          <DataRow label="Cash and cash equivalents" note="3.8" cy={data.ca_cashAndEquivalents} py={previousYear?.ca_cashAndEquivalents} rl={rl} indent />
          <TotalRow label="Total Current Assets"        cy={data.totalCurrentAssets}    py={previousYear?.totalCurrentAssets}  rl={rl} />
          <BlankRow />
          <TotalRow label="TOTAL ASSETS" cy={data.totalAssets} py={previousYear?.totalAssets} rl={rl} grand />
          <BlankRow />

          {/* ── C: EQUITY ──────────────────────────────────────────────── */}
          <SectionRow label="C  EQUITY" />
          <DataRow label="Share Capital"              note="3.9"  cy={data.eq_shareCapital}   py={previousYear?.eq_shareCapital}   rl={rl} indent />
          <DataRow label="Retained earnings" cy={data.eq_retainedEarnings} py={previousYear?.eq_retainedEarnings} rl={rl} indent />
          <DataRow label="Other reserves" note="3.10" cy={data.eq_reserves} py={previousYear?.eq_reserves} rl={rl} indent />
          <TotalRow label="Total Equity"              cy={data.totalEquity} py={previousYear?.totalEquity} rl={rl} />
          <BlankRow />

          {/* ── D: NON-CURRENT LIABILITIES ─────────────────────────────── */}
          <SectionRow label="D  NON-CURRENT LIABILITIES" />
          <DataRow label="Borrowings — Non-Current"   note="3.11" cy={data.ncl_borrowings}    py={previousYear?.ncl_borrowings}   rl={rl} indent />
          <DataRow label="Employee benefits" note="3.12" cy={data.ncl_employeeBenefits} py={previousYear?.ncl_employeeBenefits} rl={rl} indent />
          <DataRow label="Deferred Tax Liability"              cy={data.ncl_deferredTax}  py={previousYear?.ncl_deferredTax} rl={rl} indent />
          <TotalRow label="Total Non-Current Liabilities" cy={data.totalNonCurrentLiabilities} py={previousYear?.totalNonCurrentLiabilities} rl={rl} />
          <BlankRow />

          {/* ── E: CURRENT LIABILITIES ─────────────────────────────────── */}
          <SectionRow label="E  CURRENT LIABILITIES" />
          <DataRow label="Borrowings — Current"      note="3.11" cy={data.cl_borrowings}     py={previousYear?.cl_borrowings}    rl={rl} indent />
          <DataRow label="Trade payables" note="3.13" cy={data.cl_tradePayables} py={previousYear?.cl_tradePayables} rl={rl} indent />
          <DataRow label="Provisions" cy={data.cl_provisions} py={previousYear?.cl_provisions} rl={rl} indent />
          <DataRow label="Current tax liabilities" note="3.15" cy={data.cl_incomeTaxPayable} py={previousYear?.cl_incomeTaxPayable} rl={rl} indent />
          <DataRow label="Other Current Liabilities" note="3.14" cy={data.cl_other}          py={previousYear?.cl_other}         rl={rl} indent />
          <TotalRow label="Total Current Liabilities" cy={data.totalCurrentLiabilities} py={previousYear?.totalCurrentLiabilities} rl={rl} />
          <BlankRow />

          <TotalRow
            label="TOTAL EQUITY AND LIABILITIES"
            cy={data.totalEquityAndLiabilities}
            py={previousYear?.totalEquityAndLiabilities}
            rl={rl}
            grand
          />

          {/* Balance check row */}
          {Math.abs(diff) > rl && (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200"
                role="alert"
              >
                ERROR: Balance sheet does not balance. Difference: {Math.abs(diff).toLocaleString('en-IN')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Signature block */}
      <div className="border-t border-slate-200 mt-6 pt-4">
        <p className="text-xs text-slate-500 mb-4">For and on behalf of the Board of Directors</p>
        <div className="grid grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <div className="h-10" />
            <p className="border-t border-slate-400 pt-1 font-medium">
              {company.chairperson || '_______________'}
            </p>
            <p className="text-slate-400">Chairperson</p>
          </div>
          <div>
            <div className="h-10" />
            <p className="border-t border-slate-400 pt-1 font-medium">
              {company.director || '_______________'}
            </p>
            <p className="text-slate-400">Director</p>
          </div>
          <div>
            <div className="h-10" />
            <p className="border-t border-slate-400 pt-1 font-medium">
              {company.accountsHead || '_______________'}
            </p>
            <p className="text-slate-400">Head of Accounts</p>
          </div>
        </div>

        <div className="mt-5 text-xs text-slate-500 flex items-start justify-between">
         {/* Auditor */}
        <div className="flex flex-col items-center">
          <div className="w-32 h-16 border-b border-dashed border-slate-400 mb-2"></div>
          <p className="font-bold">{company?.auditorInfo?.auditorName ?? '........................'}</p>
          <p className="text-xs text-slate-500">
            {company?.auditorInfo?.position === 'Partner' ? 'Engagement Partner' : company?.auditorInfo?.position ?? 'Auditor'}
          </p>
          <p className="font-bold mt-1">{company?.auditorInfo?.auditorFirmName ?? '........................'}</p>
          <p className="text-xs text-slate-500">Chartered Accountants</p>
        </div>
          <p>Date: ___________</p>
        </div>
      </div>
    </div>
  );
}
