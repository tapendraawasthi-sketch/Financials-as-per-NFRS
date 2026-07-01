import React from 'react';
import { TBValidationResult } from '../../utils/validation';
import { formatNPR } from '../../utils/numberFormat';

interface TBValidationPanelProps {
  validation: TBValidationResult;
  totalRows: number;
  autoMappedCount: number;
  needsReviewCount: number;
  unmatchedCount: number;
}

// ── CSS Pie Chart (pure SVG, no charting library) ─────────────────────────────
interface PieSegment {
  value: number;
  color: string;
  label: string;
}

const SVGPieChart: React.FC<{ segments: PieSegment[]; size?: number }> = ({
  segments,
  size = 120,
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div
        className="rounded-full bg-slate-200 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-slate-400">No data</span>
      </div>
    );
  }

  const r = size / 2;
  const cx = r;
  const cy = r;
  const innerR = r * 0.55;

  let cumulative = 0;
  const paths: React.ReactNode[] = [];

  segments.forEach((seg, idx) => {
    if (seg.value === 0) return;
    const fraction = seg.value / total;
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += seg.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    const d = [
      `M ${xi1} ${yi1}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');

    paths.push(
      <path key={idx} d={d} fill={seg.color} stroke="white" strokeWidth={1.5} />
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  );
};

// ── Balance Status Card ───────────────────────────────────────────────────────
const BalanceStatusCard: React.FC<{ validation: TBValidationResult }> = ({ validation }) => {
  const balanced = validation.isBalanced;
  const difference = Math.abs(
    (validation.totalClosingDr ?? 0) - (validation.totalClosingCr ?? 0)
  );

  return (
    <div className={`rounded-xl border p-5 ${balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-start gap-4">
        <div className={`text-3xl flex-shrink-0 ${balanced ? 'text-green-500' : 'text-red-500'}`}>
          {balanced ? '✅' : '❌'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-base ${balanced ? 'text-green-800' : 'text-red-800'}`}>
            Trial Balance is {balanced ? 'BALANCED' : 'NOT BALANCED'}
          </h3>
          {!balanced && (
            <p className="text-sm text-red-600 mt-0.5">
              Difference: {formatNPR(difference)} — check for missing or duplicate entries.
            </p>
          )}
        </div>
      </div>

      {/* Totals summary table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className={`${balanced ? 'bg-green-100' : 'bg-red-100'}`}>
              <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Period</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Debit (NPR)</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Credit (NPR)</th>
              <th className="px-3 py-1.5 text-right font-semibold text-slate-600">Difference</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: 'Opening Balance',
                dr: validation.totalOpeningDr,
                cr: validation.totalOpeningCr,
              },
              {
                label: 'Transactions',
                dr: validation.totalDuringDr,
                cr: validation.totalDuringCr,
              },
              {
                label: 'Closing Balance',
                dr: validation.totalClosingDr,
                cr: validation.totalClosingCr,
              },
            ].map((row) => {
              const diff = (row.dr ?? 0) - (row.cr ?? 0);
              return (
                <tr key={row.label} className="border-t border-white/50 hover:bg-white/30">
                  <td className="px-3 py-1.5 font-medium text-slate-700">{row.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {formatNPR(row.dr ?? 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {formatNPR(row.cr ?? 0)}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${Math.abs(diff) < 1 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(diff) < 1 ? '✓' : formatNPR(diff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Mapping Status Card ───────────────────────────────────────────────────────
const MappingStatusCard: React.FC<{
  totalRows: number;
  autoMappedCount: number;
  needsReviewCount: number;
  unmatchedCount: number;
}> = ({ totalRows, autoMappedCount, needsReviewCount, unmatchedCount }) => {
  const segments: PieSegment[] = [
    { value: autoMappedCount, color: '#22c55e', label: 'Auto-mapped' },
    { value: needsReviewCount, color: '#f59e0b', label: 'Needs Review' },
    { value: unmatchedCount, color: '#ef4444', label: 'Unmatched' },
  ];

  const allGood = needsReviewCount === 0 && unmatchedCount === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-700 mb-4">Account Mapping Status</h3>
      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <div className="flex-shrink-0">
          <SVGPieChart segments={segments} size={100} />
        </div>

        {/* Legend + counts */}
        <div className="flex-1 min-w-0 space-y-2">
          {[
            {
              label: 'Auto-mapped',
              count: autoMappedCount,
              color: 'bg-green-500',
              textColor: 'text-green-700',
              bgColor: 'bg-green-50',
            },
            {
              label: 'Needs Review',
              count: needsReviewCount,
              color: 'bg-amber-400',
              textColor: 'text-amber-700',
              bgColor: 'bg-amber-50',
            },
            {
              label: 'Unmatched',
              count: unmatchedCount,
              color: 'bg-red-500',
              textColor: 'text-red-700',
              bgColor: 'bg-red-50',
            },
          ].map((item) => (
            <div key={item.label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${item.bgColor}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color} flex-shrink-0`} />
                <span className="text-xs font-medium text-slate-600">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${item.textColor}`}>{item.count}</span>
                <span className="text-xs text-slate-400">
                  ({totalRows > 0 ? Math.round((item.count / totalRows) * 100) : 0}%)
                </span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 mt-1">
            <span className="text-xs font-semibold text-slate-600">Total Accounts</span>
            <span className="text-sm font-bold text-slate-800">{totalRows}</span>
          </div>
        </div>
      </div>

      {allGood && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-center">
          <span className="text-xs font-semibold text-green-700">
            ✅ All accounts successfully mapped — ready to proceed!
          </span>
        </div>
      )}
    </div>
  );
};

// ── Warnings + Errors List ────────────────────────────────────────────────────
const WarningsList: React.FC<{ validation: TBValidationResult }> = ({ validation }) => {
  const hasIssues =
    (validation.errors && validation.errors.length > 0) ||
    (validation.warnings && validation.warnings.length > 0) ||
    (validation.negativBalanceWarnings && validation.negativBalanceWarnings.length > 0);

  if (!hasIssues) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-semibold text-green-700">✅ No warnings or errors found.</p>
        <p className="text-xs text-green-600 mt-0.5">Your trial balance passed all validation checks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Errors */}
      {(validation.errors ?? []).map((err, idx) => (
        <div key={`err-${idx}`} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-500 flex-shrink-0 mt-0.5">🔴</span>
          <div>
            <p className="text-xs font-semibold text-red-700">Error</p>
            <p className="text-xs text-red-600 mt-0.5">{err}</p>
          </div>
        </div>
      ))}

      {/* Warnings */}
      {(validation.warnings ?? []).map((warn, idx) => (
        <div key={`warn-${idx}`} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-amber-700">Warning</p>
            <p className="text-xs text-amber-600 mt-0.5">{warn}</p>
          </div>
        </div>
      ))}

      {/* Negative Balance Warnings */}
      {(validation.negativBalanceWarnings ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-semibold text-amber-700 mb-2">
            ⚠️ Accounts with Unexpected Balance Direction:
          </h4>
          <div className="space-y-1">
            {validation.negativBalanceWarnings!.map((warn, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-600">
                <span className="flex-shrink-0 mt-0.5">•</span>
                <span>{warn}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-500 mt-2 italic">
            These may be intentional (e.g. bank overdraft shown as debit). Please verify.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const TBValidationPanel: React.FC<TBValidationPanelProps> = ({
  validation,
  totalRows,
  autoMappedCount,
  needsReviewCount,
  unmatchedCount,
}) => {
  return (
    <div className="space-y-4">
      {/* Balance Status */}
      <BalanceStatusCard validation={validation} />

      {/* Mapping Status */}
      <MappingStatusCard
        totalRows={totalRows}
        autoMappedCount={autoMappedCount}
        needsReviewCount={needsReviewCount}
        unmatchedCount={unmatchedCount}
      />

      {/* Warnings + Errors */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Validation Messages</h3>
        <WarningsList validation={validation} />
      </div>
    </div>
  );
};

export default TBValidationPanel;
