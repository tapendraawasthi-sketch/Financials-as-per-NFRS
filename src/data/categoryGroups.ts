import { NFRS_CATEGORY_INFO } from './nfrsCategories';
import type { NFRSCategory } from '../types/trialBalance';

const GROUP_LABELS: Record<string, string> = {
  'BS NCA PPE': 'Non-Current Assets — PPE',
  'BS NCA PPE Contra': 'Non-Current Assets — Accumulated Depreciation',
  'BS NCA Investments': 'Non-Current Assets — Investments',
  'BS NCA/CA Investments': 'Investments',
  'BS NCA Other': 'Non-Current Assets — Other',
  'BS NCA': 'Non-Current Assets',
  'BS NCA Contra': 'Non-Current Assets — Contra',
  'BS CA Inventory': 'Current Assets — Inventories',
  'BS CA Receivables': 'Current Assets — Receivables',
  'BS CA Other Receivables': 'Current Assets — Other Receivables',
  'BS CA Cash': 'Current Assets — Cash & Bank',
  'BS CA Tax': 'Current Assets — Tax',
  'BS CA Other': 'Current Assets — Other',
  'BS CA Contra': 'Current Assets — Contra',
  'BS Equity': 'Equity',
  'BS NCL Borrowings': 'Non-Current Liabilities — Borrowings',
  'BS NCL Employee Benefits': 'Non-Current Liabilities — Employee Benefits',
  'BS NCL Provisions': 'Non-Current Liabilities — Provisions',
  'BS NCL': 'Non-Current Liabilities',
  'BS CL Borrowings': 'Current Liabilities — Borrowings',
  'BS CL Trade Payables': 'Current Liabilities — Trade Payables',
  'BS CL Employee': 'Current Liabilities — Employee Payables',
  'BS CL Tax': 'Current Liabilities — Tax',
  'BS CL Provisions': 'Current Liabilities — Provisions',
  'BS CL Other': 'Current Liabilities — Other',
  'BS CL': 'Current Liabilities',
  'IS Revenue': 'Income — Revenue',
  'IS COGS': 'Income — Cost of Goods Sold',
  'IS Other Income': 'Income — Other Income',
  'IS Employee Benefits': 'Income — Employee Benefits',
  'IS Finance Costs': 'Income — Finance Costs',
  'IS Depreciation': 'Income — Depreciation',
  'IS Impairment': 'Income — Impairment',
  'IS Admin': 'Income — Administrative Expenses',
  'IS Tax': 'Income — Tax',
};

const GROUP_ORDER = [
  'BS NCA PPE', 'BS NCA PPE Contra', 'BS NCA Investments', 'BS NCA/CA Investments',
  'BS NCA Other', 'BS NCA', 'BS NCA Contra',
  'BS CA Inventory', 'BS CA Receivables', 'BS CA Other Receivables', 'BS CA Cash',
  'BS CA Tax', 'BS CA Other', 'BS CA Contra',
  'BS Equity',
  'BS NCL Borrowings', 'BS NCL Employee Benefits', 'BS NCL Provisions', 'BS NCL',
  'BS CL Borrowings', 'BS CL Trade Payables', 'BS CL Employee', 'BS CL Tax',
  'BS CL Provisions', 'BS CL Other', 'BS CL',
  'IS Revenue', 'IS COGS', 'IS Other Income', 'IS Employee Benefits',
  'IS Finance Costs', 'IS Depreciation', 'IS Impairment', 'IS Admin', 'IS Tax',
];

/** Dropdown optgroups derived from the full chart of accounts. */
export function buildCategoryGroups(): Array<{ label: string; categories: NFRSCategory[] }> {
  const grouped = new Map<string, NFRSCategory[]>();

  for (const entry of NFRS_CATEGORY_INFO) {
    if (entry.value === 'unclassified') continue;
    const key = entry.statementLine || 'Other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry.value);
  }

  const orderedKeys = [
    ...GROUP_ORDER.filter((k) => grouped.has(k)),
    ...[...grouped.keys()].filter((k) => !GROUP_ORDER.includes(k)).sort(),
  ];

  return orderedKeys.map((key) => ({
    label: GROUP_LABELS[key] ?? key,
    categories: grouped.get(key) ?? [],
  }));
}

/** Human-readable labels for canonical and legacy category ids. */
export function buildCategoryLabelMap(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of NFRS_CATEGORY_INFO) {
    labels[entry.value] = entry.label;
  }
  return labels;
}
