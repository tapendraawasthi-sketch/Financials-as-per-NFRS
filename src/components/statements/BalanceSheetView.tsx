// src/components/statements/BalanceSheetView.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import PrintButton    from '../output/PrintButton';
import { BalanceSheet } from '../../types/financials';
import { CompanyProfile } from '../../types/company';

interface BalanceSheetViewProps {
  data:          BalanceSheet;
  company:       CompanyProfile;
  previousYear?: Partial<BalanceSheet>;
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

function DataRow({ label, note, cy, py, rl, indent = false }: {
  label: string; note?: string; cy: number | undefined | null;
  py?: number | undefined | null; rl: number; indent?: boolean;
}) {
  const isZero = !cy || cy === 0;
  return (
    <tr>
      <td className={`${indent ? 'pl-8' : ''}`} style={{ fontSize: '13px', color: '#334155' }}>{label}</td>
      <td className="text-center w-[7%] px-2" style={{ fontSize: '11px' }}>
        {note && <span style={{ color: '#6366f1', fontWeight: 500 }}>{note}</span>}
      </td>
      <td className={`amount text-[13px] ${isZero ? 'amount-zero' : ''}`}>{fmt(cy, rl)}</td>
      <td className={`amount text-[13px] ${!py || py === 0 ? 'amount-zero' : ''}`}>{fmt(py, rl)}</td>
    </tr>
  );
}

function TotalRow({ label, cy, py, rl, grand = false }: {
  label: string; cy: number | undefined | null; py?: number | undefined | null; rl: number; grand?: boolean;
}) {
  return (
    <tr className={grand ? 'row-grand-total' : 'row-total'}>
      <td style={{ fontSize: '13px' }}>{label}</td>
      <td />
      <td className="amount text-[13px]">{fmt(cy, rl)}</td>
      <td className="amount text-[13px]">{fmt(py, rl)}</td>
    </tr>
  );
}

function BlankRow() {
  return <tr className="spacer-row"><td colSpan={4} /></tr>;
}

function BalanceSheetView({ data, company, previousYear }: BalanceSheetViewProps) {
  const rl   = company.accountingPolicies?.roundingLevel ?? 100;
  const cy   = company.fiscalYear;
  const diff = data.checkDifference ?? (data.totalAssets - data.totalEquityAndLiabilities);

  return (
    <div className="statement-page max-w-4xl mx-auto">
      <div className="no-print flex justify-end mb-3">
        <PrintButton label="Print / Export PDF" />
      </div>

      <div className="statement-header">
        <p className="statement-company-name">{company.companyName}</p>
        <p className="statement-title">Statement of Financial Position</p>
        <p className="statement-date">
          As at {cy?.endDateBS ?? '31 Ashadh 2082'} ({cy?.endDateAD ?? 'July 15, 2025'})
        </p>
        <p className="text-xs text-slate-400 italic mt-1">
          All amounts in NPR rounded to nearest {rl.toLocaleString()}
        </p>
      </div>

      <table className="fin-table w-full mt-5">
        <colgroup>
          <col style={{ width: '55%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '19%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="text-left">Particulars</th>
            <th className="text-center">Note</th>
            <th className="text-right">{cy?.endDateBS ?? 'FY 2081/82'}</th>
            <th className="text-right">
              {cy?.bsYear?.replace(/(\d+)\/(\d+)/, (_, a, b) => `${+a-1}/${+b-1}`) ?? 'Prior Year'}
            </th>
          </tr>
        </thead>
        <tbody>
          <SectionRow label="A  NON-CURRENT ASSETS" />
          <DataRow label="Property, Plant & Equipment (Net)" note="3.1" cy={data.nca_ppe}        py={previousYear?.nca_ppe}        rl={rl} indent />
          <DataRow label="Investments"                        note="3.2" cy={data.nca_investments} py={previousYear?.nca_investments} rl={rl} indent />
          <DataRow label="Other Receivables"                  note="3.4" cy={data.nca_receivables} py={previousYear?.nca_receivables} rl={rl} indent />
          <DataRow label="Other Non-Current Assets"           note="3.5" cy={data.nca_other}       py={previousYear?.nca_other}       rl={rl} indent />
          <TotalRow label="Total Non-Current Assets"          cy={data.totalNonCurrentAssets} py={previousYear?.totalNonCurrentAssets} rl={rl} />
          <BlankRow />
          <SectionRow label="B  CURRENT ASSETS" />
          <DataRow label="Inventories"               note="3.7" cy={data.ca_inventories}      py={previousYear?.ca_inventories}      rl={rl} indent />
          <DataRow label="Trade Receivables"         note="3.3" cy={data.ca_tradeReceivables} py={previousYear?.ca_tradeReceivables} rl={rl} indent />
          <DataRow label="Other Current Assets"      note="3.6" cy={data.ca_other}            py={previousYear?.ca_other_py}         rl={rl} indent />
          <DataRow label="Cash and Cash Equivalents" note="3.8" cy={data.ca_cashAndEquivalents} py={previousYear?.ca_cashAndEquivalents} rl={rl} indent />
          <TotalRow label="Total Current Assets"     cy={data.totalCurrentAssets}  py={previousYear?.totalCurrentAssets}  rl={rl} />
          <BlankRow />
          <TotalRow label="TOTAL ASSETS"             cy={data.totalAssets}         py={previousYear?.totalAssets}         rl={rl} grand />
          <BlankRow />
          <SectionRow label="C  EQUITY" />
          <DataRow label="Share Capital"     note="3.9"  cy={data.eq_shareCapital}    py={previousYear?.eq_shareCapital}    rl={rl} indent />
          <DataRow label="Retained Earnings"            cy={data.eq_retainedEarnings} py={previousYear?.eq_retainedEarnings} rl={rl} indent />
          <DataRow label="Other Reserves"   note="3.10" cy={data.eq_reserves}        py={previousYear?.eq_reserves}        rl={rl} indent />
          <TotalRow label="Total Equity"               cy={data.totalEquity}        py={previousYear?.totalEquity}        rl={rl} />
          <BlankRow />
          <SectionRow label="D  NON-CURRENT LIABILITIES" />
          <DataRow label="Borrowings — Non-Current"    note="3.11" cy={data.ncl_borrowings}       py={previousYear?.ncl_borrowings}       rl={rl} indent />
          <DataRow label="Employee Benefits"           note="3.12" cy={data.ncl_employeeBenefits} py={previousYear?.ncl_employeeBenefits} rl={rl} indent />
          <DataRow label="Deferred Tax Liability"                 cy={data.ncl_deferredTax}      py={previousYear?.ncl_deferredTax}      rl={rl} indent />
          <TotalRow label="Total Non-Current Liabilities"        cy={data.totalNonCurrentLiabilities} py={previousYear?.totalNonCurrentLiabilities} rl={rl} />
          <BlankRow />
          <SectionRow label="E  CURRENT LIABILITIES" />
          <DataRow label="Borrowings — Current"       note="3.11" cy={data.cl_borrowings}     py={previousYear?.cl_borrowings}     rl={rl} indent />
          <DataRow label="Trade Payables"             note="3.13" cy={data.cl_tradePayables}  py={previousYear?.cl_tradePayables}  rl={rl} indent />
          <DataRow label="Provisions"                            cy={data.cl_provisions}     py={previousYear?.cl_provisions}     rl={rl} indent />
          <DataRow label="Current Tax Liability"     note="3.15" cy={data.cl_incomeTaxPayable} py={previousYear?.cl_incomeTaxPayable} rl={rl} indent />
          <DataRow label="Other Current Liabilities"            cy={data.cl_other}          py={previousYear?.cl_other}          rl={rl} indent />
          <TotalRow label="Total Current Liabilities"           cy={data.totalCurrentLiabilities} py={previousYear?.totalCurrentLiabilities} rl={rl} />
          <BlankRow />
          <TotalRow label="TOTAL EQUITY AND LIABILITIES" cy={data.totalEquityAndLiabilities} py={previousYear?.totalEquityAndLiabilities} rl={rl} grand />

          {Math.abs(diff) > rl && (
            <tr>
              <td colSpan={4} className="px-3 py-2 text-xs text-red-700 bg-red-50" style={{ border: '1px solid #fecaca' }} role="alert">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  ERROR: Balance sheet does not balance. Difference: {Math.abs(diff).toLocaleString('en-IN')}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-slate-200 mt-6 pt-3 text-center">
        <p className="text-xs text-slate-400 italic">
          The notes referred to above form an integral part of these financial statements.
        </p>
      </div>

      <div className="border-t-2 border-slate-200 mt-8 pt-5 signature-block">
        <p className="text-xs text-slate-500 mb-5">For and on behalf of the Board of Directors</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-xs text-slate-600">
          {[
            { name: company.chairperson  || '—', role: 'Chairperson'      },
            { name: company.director     || '—', role: 'Director'         },
            { name: company.accountsHead || '—', role: 'Head of Accounts' },
          ].map(sig => (
            <div key={sig.role} className="flex flex-col items-start">
              <div className="h-12 w-full" />
              <div className="w-full pb-1 mb-1" style={{ borderBottom: '1px solid #475569' }}>
                <p className="font-semibold text-slate-800" style={{ fontSize: '13px' }}>{sig.name}</p>
              </div>
              <p className="text-slate-400">{sig.role}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start justify-between flex-wrap gap-4">
          <div className="flex flex-col items-start">
            <p className="text-xs text-slate-500 mb-2">
              For {company.auditorInfo?.auditorFirmName ?? 'Audit Firm'}
            </p>
            <div
              className="w-40 h-16 rounded-lg flex items-center justify-center mb-2"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <span className="text-xs text-slate-300 italic">Signature</span>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              {company.auditorInfo?.auditorName ?? '—'}
            </p>
            <p className="text-xs text-slate-400">
              {company.auditorInfo?.position === 'Partner' ? 'Engagement Partner' : company.auditorInfo?.position ?? '—'}
            </p>
          </div>
          <p className="text-xs text-slate-500 self-end">Date: ___________</p>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BalanceSheetView);
