// ===== src/components/trialBalance/TBAccountMapper.tsx =====
import React, { useState, useMemo } from 'react';
import type { ParsedTrialBalance, NFRSCategory } from '../../types';
import { CHART_OF_ACCOUNTS } from '../../data/chartOfAccounts';
import { formatNPR } from '../../utils/numberFormat';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Tabs from '../ui/Tabs';

interface TBAccountMapperProps {
  companyId: string;
  parsedTB: ParsedTrialBalance;
  onMappingComplete: (updatedTB: ParsedTrialBalance) => void;
}

const METHOD_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'default' | 'danger'> = {
  exact: 'info', synonym: 'info', fuzzy: 'warning', ai: 'purple', manual: 'success', unmatched: 'danger',
};

const ALL_CATEGORIES = [...new Set(CHART_OF_ACCOUNTS.map((e) => e.nfrsCategory))].sort();

const GROUPED_OPTIONS = [
  { group: 'Assets', cats: ALL_CATEGORIES.filter((c) => c.startsWith('ppe_') || c.startsWith('nca_') || c.startsWith('ca_') || c.startsWith('investment_') || c.startsWith('inventory_') || c.startsWith('trade_receivables') || c.startsWith('other_') || c.startsWith('cash_') || c.startsWith('bank_') || c === 'accum_depreciation') },
  { group: 'Liabilities', cats: ALL_CATEGORIES.filter((c) => c.startsWith('borrowings_') || c.startsWith('trade_payables') || c.startsWith('employee_payables') || c.endsWith('_payable') || c.startsWith('tds_') || c.startsWith('other_payables') || c === 'income_tax_payable' || c === 'audit_fee_payable') },
  { group: 'Equity', cats: ALL_CATEGORIES.filter((c) => ['share_capital','share_premium','general_reserve','retained_earnings'].includes(c)) },
  { group: 'Income', cats: ALL_CATEGORIES.filter((c) => c.startsWith('revenue_') || c.startsWith('other_income_') || c.startsWith('cogs_opening')) },
  { group: 'Expenses', cats: ALL_CATEGORIES.filter((c) => c.startsWith('cogs_') || c.startsWith('direct_') || c.startsWith('emp_expense_') || c.startsWith('finance_cost_') || c.startsWith('depreciation_') || c.startsWith('impairment_') || c.startsWith('admin_') || c === 'income_tax_expense') },
];

export default function TBAccountMapper({ companyId, parsedTB, onMappingComplete }: TBAccountMapperProps): React.ReactElement {
  const [tb, setTB] = useState(parsedTB);
  const [activeTab, setActiveTab] = useState('needs_review');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<number | null>(null);

  const stats = useMemo(() => {
    const total = tb.rows.length;
    const autoMatched = tb.rows.filter((r) => (r.confidence ?? 0) >= 80 && !r.needsReview).length;
    const needsReview = tb.rows.filter((r) => r.needsReview && (r.nfrsCategory as string) !== 'unclassified').length;
    const unmatched = tb.rows.filter((r) => (r.nfrsCategory as string) === 'unclassified' || !r.matchedLabel).length;
    return { total, autoMatched, needsReview, unmatched };
  }, [tb]);

  const filteredRows = useMemo(() => {
    let rows = tb.rows;
    if (search) rows = rows.filter((r) => r.rawLabel.toLowerCase().includes(search.toLowerCase()));
    if (activeTab === 'needs_review') rows = rows.filter((r) => r.needsReview);
    if (activeTab === 'unmatched') rows = rows.filter((r) => (r.nfrsCategory as string) === 'unclassified' || !r.matchedLabel);
    if (activeTab === 'mapped') rows = rows.filter((r) => !r.needsReview && r.matchedLabel);
    return rows;
  }, [tb.rows, search, activeTab]);

  const handleMappingChange = async (rowIndex: number, nfrsCategory: NFRSCategory) => {
    setSaving(rowIndex);
    const matchedLabel = CHART_OF_ACCOUNTS.find((a) => a.nfrsCategory === nfrsCategory)?.label ?? nfrsCategory;
    try {
      const response = await fetch(`/api/trial-balance/${companyId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ rowIndex, nfrsCategory, matchedLabel }] }),
      });
      if (response.ok) {
        const updated = await response.json() as ParsedTrialBalance;
        setTB(updated);
      }
    } catch {}
    setSaving(null);
  };

  const tabs = [
    { id: 'all',          label: 'All',         badge: stats.total },
    { id: 'needs_review', label: 'Needs Review', badge: stats.needsReview },
    { id: 'unmatched',    label: 'Unmatched',    badge: stats.unmatched },
    { id: 'mapped',       label: 'Mapped',       badge: stats.autoMatched },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge label={`Total: ${stats.total}`} variant="default" size="md" />
        <Badge label={`Auto-matched: ${stats.autoMatched}`} variant="success" size="md" />
        <Badge label={`Needs Review: ${stats.needsReview}`} variant="warning" size="md" />
        <Badge label={`Unmatched: ${stats.unmatched}`} variant="danger" size="md" />
        <div className="ml-auto">
          <input type="text" placeholder="Search accounts…" className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-56"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl px-4 py-2">
        <p className="text-xs text-slate-600">Mapping completion: <strong>{stats.autoMatched + stats.needsReview}</strong> / {stats.total} accounts classified</p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Account Name', 'NFRS Category', 'Confidence', 'Method', 'Closing Balance'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic text-sm">No accounts in this category.</td></tr>
            ) : filteredRows.map((row) => (
              <tr key={row.rowIndex} className={row.needsReview ? 'bg-amber-50/30' : ''}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800 truncate max-w-xs" title={row.rawLabel}>{row.rawLabel}</p>
                  {row.matchedLabel && <p className="text-xs text-slate-400">{row.matchedLabel}</p>}
                </td>
                <td className="px-4 py-3">
                  <select className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    value={(row.nfrsCategory as string) ?? ''}
                    disabled={saving === row.rowIndex}
                    onChange={(e) => handleMappingChange(row.rowIndex, e.target.value as NFRSCategory)}
                  >
                    <option value="">-- Select NFRS Category --</option>
                    {GROUPED_OPTIONS.map(({ group, cats }) => (
                      <optgroup key={group} label={group}>
                        {cats.map((cat) => <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>)}
                      </optgroup>
                    ))}
                    <option value="unclassified">Unclassified</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Badge label={`${row.confidence ?? 0}%`} variant={(row.confidence ?? 0) >= 90 ? 'success' : (row.confidence ?? 0) >= 75 ? 'warning' : 'danger'} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <Badge label={row.matchMethod ?? 'unknown'} variant={METHOD_VARIANT[row.matchMethod ?? ''] ?? 'default'} size="sm" />
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                  {formatNPR((row.closingDr ?? 0) - (row.closingCr ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.unmatched > 0 && <Alert type="warning" title="Unmatched Accounts" message={`${stats.unmatched} account(s) are still unclassified. These will be excluded from financial statements. Please select a category for each.`} />}

      <div className="flex justify-end">
        <Button size="lg" disabled={stats.unmatched > 0} onClick={() => onMappingComplete(tb)}>
          Confirm Mappings &amp; Continue →
        </Button>
      </div>
    </div>
  );
}
