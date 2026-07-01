// src/components/statements/ChangesInEquityView.tsx
import React from 'react';
import { ChangesInEquity, CompanyProfile } from '../../types';
import { formatNPR } from '../../utils/numberFormat';

interface ChangesInEquityViewProps {
  changesInEquity: ChangesInEquity;
  company: CompanyProfile;
}

interface MatrixRow {
  label: string;
  shareCapital: number;
  sharePremium: number;
  generalReserve: number;
  retainedEarnings: number;
  otherReserves?: number;
  total: number;
  bold?: boolean;
  isTotal?: boolean;
  isSectionHeader?: boolean;
  emptyRow?: boolean;
  indented?: boolean;
}

const formatCell = (val: number | undefined): string => {
  if (val === undefined || val === null) return '–';
  return formatNPR(val);
};

const ChangesInEquityView: React.FC<ChangesInEquityViewProps> = ({ changesInEquity: ce, company }) => {
  const fy = company.fiscalYear;

  const columns = [
    { key: 'shareCapital', label: 'Share Capital' },
    { key: 'sharePremium', label: 'Share Premium' },
    { key: 'generalReserve', label: 'General Reserve' },
    { key: 'retainedEarnings', label: 'Retained Earnings' },
    { key: 'total', label: 'Total' },
  ] as const;

  const rows: MatrixRow[] = [
    // ── Prior Year ──
    {
      label: `Balance at ${fy.startDateBS} (Opening — Previous Year)`,
      shareCapital: ce.pyOpeningShareCapital ?? 0,
      sharePremium: ce.pyOpeningSharePremium ?? 0,
      generalReserve: ce.pyOpeningGeneralReserve ?? 0,
      retainedEarnings: ce.pyOpeningRetainedEarnings ?? 0,
      total: ce.pyOpeningTotal ?? 0,
      bold: true,
      isTotal: false,
    },
    {
      label: 'Net Profit/(Loss) for the Previous Year',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: 0,
      retainedEarnings: ce.pyNetProfit ?? 0,
      total: ce.pyNetProfit ?? 0,
      indented: true,
    },
    {
      label: 'Dividends Paid (Previous Year)',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: 0,
      retainedEarnings: ce.pyDividends ?? 0,
      total: ce.pyDividends ?? 0,
      indented: true,
    },
    {
      label: 'Transfer to General Reserve',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: ce.pyTransferToReserve ?? 0,
      retainedEarnings: ce.pyTransferToReserve ? -(ce.pyTransferToReserve) : 0,
      total: 0,
      indented: true,
    },
    {
      label: 'Other Comprehensive Income (Previous Year)',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: 0,
      retainedEarnings: ce.pyOtherComprehensiveIncome ?? 0,
      total: ce.pyOtherComprehensiveIncome ?? 0,
      indented: true,
    },
    {
      label: `Balance at ${fy.endDateBS ? fy.endDateBS.replace(`/${fy.bsYear.split('/')[1]}`, `/${String(parseInt(fy.bsYear.split('/')[1]) - 1).padStart(2, '0')}`) : 'End of Previous Year'} (Closing — Previous Year)`,
      shareCapital: ce.cyOpeningShareCapital ?? 0,
      sharePremium: ce.cyOpeningSharePremium ?? 0,
      generalReserve: ce.cyOpeningGeneralReserve ?? 0,
      retainedEarnings: ce.cyOpeningRetainedEarnings ?? 0,
      total: ce.cyOpeningTotal ?? 0,
      bold: true,
      isTotal: true,
    },
    // ── Spacer ──
    {
      label: '',
      shareCapital: 0, sharePremium: 0, generalReserve: 0, retainedEarnings: 0, total: 0,
      emptyRow: true,
    },
    // ── Current Year ──
    {
      label: `Balance at Start of ${fy.bsYear} (Opening — Current Year)`,
      shareCapital: ce.cyOpeningShareCapital ?? 0,
      sharePremium: ce.cyOpeningSharePremium ?? 0,
      generalReserve: ce.cyOpeningGeneralReserve ?? 0,
      retainedEarnings: ce.cyOpeningRetainedEarnings ?? 0,
      total: ce.cyOpeningTotal ?? 0,
      bold: true,
    },
    {
      label: 'Net Profit/(Loss) for the Year',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: 0,
      retainedEarnings: ce.cyNetProfit ?? 0,
      total: ce.cyNetProfit ?? 0,
      indented: true,
    },
    {
      label: 'Dividends Paid',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: 0,
      retainedEarnings: ce.cyDividends ?? 0,
      total: ce.cyDividends ?? 0,
      indented: true,
    },
    {
      label: 'Issue of Share Capital',
      shareCapital: ce.cyShareCapitalIssued ?? 0,
      sharePremium: ce.cySharePremiumReceived ?? 0,
      generalReserve: 0,
      retainedEarnings: 0,
      total: (ce.cyShareCapitalIssued ?? 0) + (ce.cySharePremiumReceived ?? 0),
      indented: true,
    },
    {
      label: 'Transfer to General Reserve',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: ce.cyTransferToReserve ?? 0,
      retainedEarnings: ce.cyTransferToReserve ? -(ce.cyTransferToReserve) : 0,
      total: 0,
      indented: true,
    },
    {
      label: 'Other Comprehensive Income / (Loss)',
      shareCapital: 0,
      sharePremium: 0,
      generalReserve: 0,
      retainedEarnings: ce.cyOtherComprehensiveIncome ?? 0,
      total: ce.cyOtherComprehensiveIncome ?? 0,
      indented: true,
    },
    // ── Closing ──
    {
      label: `Balance at ${fy.endDateBS} (Closing — Current Year)`,
      shareCapital: ce.cyClosingShareCapital ?? 0,
      sharePremium: ce.cyClosingSharePremium ?? 0,
      generalReserve: ce.cyClosingGeneralReserve ?? 0,
      retainedEarnings: ce.cyClosingRetainedEarnings ?? 0,
      total: ce.cyClosingTotal ?? 0,
      bold: true,
      isTotal: true,
    },
  ];

  const getCellValue = (row: MatrixRow, key: typeof columns[number]['key']): number => {
    return row[key] ?? 0;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
      {/* Company Header */}
      <div className="text-center py-6 border-b border-slate-200 bg-slate-50 px-6">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">{company.companyName}</h2>
        {company.address?.district && (
          <p className="text-sm text-slate-500 mt-1">{company.address.district}, Nepal</p>
        )}
        <h3 className="text-base font-semibold text-slate-700 mt-3 uppercase tracking-widest">
          Statement of Changes in Equity
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          For the year ended {fy.endDateBS} ({fy.endDateAD})
        </p>
        <p className="text-xs text-slate-400 mt-1">(All amounts in NPR unless otherwise stated)</p>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-100">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[220px]">
                Particulars
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide w-28 ${
                    col.key === 'total' ? 'bg-slate-200 border-l-2 border-slate-300' : ''
                  }`}
                >
                  {col.label}<br />
                  <span className="font-normal text-slate-400 text-xs">(NPR)</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (row.emptyRow) {
                return <tr key={idx}><td colSpan={6} className="h-3 bg-slate-50" /></tr>;
              }

              const rowCls = [
                row.isTotal ? 'border-t-2 border-b-2 border-slate-400 bg-slate-50' : '',
                row.bold ? 'bg-slate-50' : 'hover:bg-blue-50/30',
              ].filter(Boolean).join(' ');

              const labelCls = [
                'px-3 py-2 text-sm border-b border-slate-100',
                row.bold ? 'font-semibold text-slate-800' : 'text-slate-600',
                row.isTotal ? 'font-bold text-slate-800' : '',
              ].filter(Boolean).join(' ');

              const cellCls = (isLast: boolean) => [
                'px-3 py-2 text-right text-sm tabular-nums border-b border-slate-100',
                row.bold ? 'font-semibold' : '',
                row.isTotal ? 'font-bold' : '',
                isLast ? 'bg-slate-100 border-l-2 border-slate-300' : '',
              ].filter(Boolean).join(' ');

              return (
                <tr key={idx} className={rowCls}>
                  <td className={labelCls} style={{ paddingLeft: row.indented ? '28px' : '12px' }}>
                    {row.indented && <span className="text-slate-300 mr-1">└</span>}
                    {row.label}
                  </td>
                  {columns.map((col, ci) => (
                    <td key={col.key} className={cellCls(ci === columns.length - 1)}>
                      {formatCell(getCellValue(row, col.key))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-500">
          <span className="font-semibold">Note:</span> The above statement should be read in conjunction with the
          accompanying notes to the financial statements (Notes 3.1 to 3.23). Figures in brackets represent
          reductions/negative amounts.
        </p>
      </div>

      {/* Signatory footer */}
      <div className="mt-4 mx-6 mb-6 grid grid-cols-3 gap-8 border-t border-slate-200 pt-6 print:mt-12">
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

export default ChangesInEquityView;
