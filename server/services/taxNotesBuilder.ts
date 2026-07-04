// Builds Tax Notes sheet data (Note I income / Note II expense) from disallowed items
// and per-line admin/employee expense schedules — synced with Disallow for Tax sheet.

import type { YearEndAdjustments } from '../../src/types/adjustments.js';

export interface TaxNoteLine {
  label: string;
  asPerBooks: number;
  disallowed: number;
  reason: string;
}

export interface TaxNotesData {
  noteI_income: TaxNoteLine[];
  noteII_expenses: TaxNoteLine[];
  totalIncomeDisallowed: number;
  totalExpenseDisallowed: number;
}

type DisallowedItem = YearEndAdjustments['disallowedForTax'][number];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchDisallowed(
  label: string,
  items: DisallowedItem[],
): DisallowedItem | undefined {
  const n = norm(label);
  return items.find((d) => {
    if ((d.side ?? 'expense') === 'income') return false;
    const desc = norm(d.description ?? '');
    return desc === n || desc.includes(n) || n.includes(desc);
  });
}

export function buildTaxNotesData(input: {
  disallowedForTax: DisallowedItem[];
  adminLineItems?: Array<{ label: string; cy: number }>;
  employeeLineItems?: Array<{ label: string; cy: number }>;
}): TaxNotesData {
  const { disallowedForTax, adminLineItems = [], employeeLineItems = [] } = input;

  const noteI_income: TaxNoteLine[] = disallowedForTax
    .filter((d) => d.side === 'income' && (d.amount ?? 0) > 0)
    .map((d) => ({
      label: d.description,
      asPerBooks: d.asPerBooks ?? d.amount ?? 0,
      disallowed: d.amount ?? 0,
      reason: d.section ?? 'Excluded from taxable income (final withholding / exempt)',
    }));

  if (noteI_income.length === 0) {
    noteI_income.push({
      label: 'Dividend income (exempt — final withholding)',
      asPerBooks: 0,
      disallowed: 0,
      reason: 'No income-side disallowances entered',
    });
  }

  const expenseDisallowed = disallowedForTax.filter((d) => (d.side ?? 'expense') !== 'income');
  const noteII_expenses: TaxNoteLine[] = [];

  for (const line of [...employeeLineItems, ...adminLineItems]) {
    if (line.cy <= 0 && !matchDisallowed(line.label, expenseDisallowed)) continue;
    const match = matchDisallowed(line.label, expenseDisallowed);
    noteII_expenses.push({
      label: line.label,
      asPerBooks: line.cy,
      disallowed: match?.amount ?? 0,
      reason: match?.section ?? (match ? '' : ''),
    });
  }

  for (const d of expenseDisallowed) {
    const already = noteII_expenses.some(
      (l) => norm(l.label) === norm(d.description) || !!matchDisallowed(l.label, [d]),
    );
    if (!already) {
      noteII_expenses.push({
        label: d.description,
        asPerBooks: d.asPerBooks ?? d.amount ?? 0,
        disallowed: d.amount ?? 0,
        reason: d.section ?? '',
      });
    }
  }

  if (noteII_expenses.length === 0) {
    noteII_expenses.push({
      label: 'No expense disallowances',
      asPerBooks: 0,
      disallowed: 0,
      reason: '',
    });
  }

  return {
    noteI_income,
    noteII_expenses,
    totalIncomeDisallowed: noteI_income.reduce((s, l) => s + l.disallowed, 0),
    totalExpenseDisallowed: noteII_expenses.reduce((s, l) => s + l.disallowed, 0),
  };
}

/** Default Section 118 installment checkpoints (Nepal FY convention). */
export const ADVANCE_TAX_CHECKPOINTS = [
  { checkpoint: 'End of Poush', cumulativePercent: 0.40, defaultDaysLate: 150 },
  { checkpoint: 'End of Chaitra', cumulativePercent: 0.70, defaultDaysLate: 90 },
  { checkpoint: 'End of Ashadh', cumulativePercent: 0.90, defaultDaysLate: 0 },
] as const;

export function defaultAdvanceTaxPayments(adjustments: Pick<YearEndAdjustments, 'advanceTax1' | 'advanceTax2' | 'advanceTax3'>): number[] {
  return [
    adjustments.advanceTax1 ?? 0,
    adjustments.advanceTax2 ?? 0,
    adjustments.advanceTax3 ?? 0,
  ];
}
