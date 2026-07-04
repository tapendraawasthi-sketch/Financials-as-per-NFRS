// ===== server/services/adjustmentSync.ts =====
import type { JournalEntryGroup, JournalLine } from '../../src/types/adjustments.js';
import type { MappedTBRow, ParsedTrialBalance } from '../../src/types/trialBalance.js';
import { normalize, classifyAll } from './accountMatcher.js';
import { deriveClosingBalances, computeRawTBTotals } from './tbHierarchy.js';

function makeLine(
  groupId: string,
  lineType: 'Dr' | 'Cr',
  account: string,
  amount: number,
  source: JournalLine['source'],
): JournalLine {
  return {
    id: `${groupId}-${lineType}-${account}`,
    groupId,
    lineType,
    account,
    amount,
    linkedTo: 'Trial',
    source,
  };
}

function buildSystemGroup(
  groupId: string,
  narration: string,
  lines: JournalLine[],
): JournalEntryGroup | null {
  if (lines.length === 0) return null;
  const totalDr = lines.filter((l) => l.lineType === 'Dr').reduce((s, l) => s + l.amount, 0);
  const totalCr = lines.filter((l) => l.lineType === 'Cr').reduce((s, l) => s + l.amount, 0);
  return {
    groupId,
    narration,
    lines,
    totalDr,
    totalCr,
    isBalanced: Math.abs(totalDr - totalCr) <= 1,
  };
}

function buildSystemGroups(systemAdjustments: {
  depreciation: number;
  staffBonus: number;
  incomeTax: number;
  dividendDeclared: number;
  tdsOnDividend: number;
  investmentFVGainLoss: number;
}): JournalEntryGroup[] {
  const groups: JournalEntryGroup[] = [];

  if (systemAdjustments.depreciation > 0) {
    const g = buildSystemGroup('SYS-1', 'Depreciation for the year', [
      makeLine('SYS-1', 'Dr', 'Depreciation', systemAdjustments.depreciation, 'System'),
      makeLine('SYS-1', 'Cr', 'Accumulated Depreciation', systemAdjustments.depreciation, 'System'),
    ]);
    if (g) groups.push(g);
  }

  if (systemAdjustments.staffBonus > 0) {
    const g = buildSystemGroup('SYS-2', 'Staff bonus provision', [
      makeLine('SYS-2', 'Dr', 'Staff Bonus', systemAdjustments.staffBonus, 'System'),
      makeLine('SYS-2', 'Cr', 'Staff Bonus Payable', systemAdjustments.staffBonus, 'System'),
    ]);
    if (g) groups.push(g);
  }

  if (systemAdjustments.incomeTax > 0) {
    const g = buildSystemGroup('SYS-3', 'Income tax provision', [
      makeLine('SYS-3', 'Dr', 'Income Tax Expense', systemAdjustments.incomeTax, 'System'),
      makeLine('SYS-3', 'Cr', 'Income Tax Payable', systemAdjustments.incomeTax, 'System'),
    ]);
    if (g) groups.push(g);
  }

  if (systemAdjustments.dividendDeclared > 0) {
    const netDividend = systemAdjustments.dividendDeclared - systemAdjustments.tdsOnDividend;
    const lines: JournalLine[] = [
      makeLine('SYS-4', 'Dr', 'Reserves & Surplus', systemAdjustments.dividendDeclared, 'System'),
      makeLine('SYS-4', 'Cr', 'Dividend Payable', netDividend, 'System'),
    ];
    if (systemAdjustments.tdsOnDividend > 0) {
      lines.push(makeLine('SYS-4', 'Cr', 'TDS - Dividend', systemAdjustments.tdsOnDividend, 'System'));
    }
    const g = buildSystemGroup('SYS-4', 'Dividend declaration', lines);
    if (g) groups.push(g);
  }

  const fv = systemAdjustments.investmentFVGainLoss;
  if (fv !== 0) {
    const gainAccount = 'Gain/(loss) on subsequent measurement of Investment in Listed Shares';
    const invAccount = 'Shares of Listed Company';
    const lines = fv > 0
      ? [
          makeLine('SYS-5', 'Dr', invAccount, fv, 'System'),
          makeLine('SYS-5', 'Cr', gainAccount, fv, 'System'),
        ]
      : [
          makeLine('SYS-5', 'Dr', gainAccount, Math.abs(fv), 'System'),
          makeLine('SYS-5', 'Cr', invAccount, Math.abs(fv), 'System'),
        ];
    const g = buildSystemGroup('SYS-5', 'Investment fair value adjustment', lines);
    if (g) groups.push(g);
  }

  return groups;
}

export function buildAdjustedTrialBalance(params: {
  tb: ParsedTrialBalance;
  manualGroups: JournalEntryGroup[];
  systemAdjustments: {
    depreciation: number;
    staffBonus: number;
    incomeTax: number;
    dividendDeclared: number;
    tdsOnDividend: number;
    investmentFVGainLoss: number;
  };
}): { adjustedTB: ParsedTrialBalance; allGroups: JournalEntryGroup[]; unmatchedAccounts: string[] } {
  const workingRows: MappedTBRow[] = params.tb.rows.map((r) => ({ ...r }));
  const lookup = new Map<string, number>();

  workingRows.forEach((row, idx) => {
    lookup.set(normalize(row.rawLabel), idx);
    if (row.displayLabel) lookup.set(normalize(row.displayLabel), idx);
  });

  const systemGroups = buildSystemGroups(params.systemAdjustments);
  const allGroups = [...systemGroups, ...params.manualGroups];
  const unmatchedAccounts: string[] = [];
  const newRowIndices: number[] = [];

  for (const group of allGroups) {
    for (const line of group.lines) {
      const key = normalize(line.account);
      let rowIdx = lookup.get(key);

      if (rowIdx === undefined) {
        const newRow: MappedTBRow = {
          rowIndex: workingRows.length,
          rawLabel: line.account,
          displayLabel: line.account,
          openingDr: 0,
          openingCr: 0,
          duringDr: 0,
          duringCr: 0,
          adjustmentDr: 0,
          adjustmentCr: 0,
          closingDr: 0,
          closingCr: 0,
          rowLevel: 2,
          isGroupRow: false,
          parentGroup: 'Manual Adjustments',
          rawIndentSpaces: 0,
          nfrsCategory: 'unclassified',
          matchMethod: 'unmatched',
          confidence: 0,
          needsReview: true,
          userOverride: false,
        };
        workingRows.push(newRow);
        rowIdx = workingRows.length - 1;
        lookup.set(key, rowIdx);
        newRowIndices.push(rowIdx);
        unmatchedAccounts.push(line.account);
      }

      const row = workingRows[rowIdx];
      if (line.lineType === 'Dr') {
        row.adjustmentDr = (row.adjustmentDr ?? 0) + line.amount;
      } else {
        row.adjustmentCr = (row.adjustmentCr ?? 0) + line.amount;
      }
    }
  }

  for (let i = 0; i < workingRows.length; i++) {
    workingRows[i] = deriveClosingBalances(workingRows[i]) as MappedTBRow;
  }

  if (newRowIndices.length > 0) {
    const newRows = newRowIndices.map((idx) => workingRows[idx]);
    const classified = classifyAll(newRows);
    newRowIndices.forEach((origIdx, i) => {
      workingRows[origIdx] = classified[i];
    });
  }

  const totals = computeRawTBTotals(workingRows);

  const adjustedTB: ParsedTrialBalance = {
    ...params.tb,
    rows: workingRows,
    totalClosingDr: totals.totalClosingDr,
    totalClosingCr: totals.totalClosingCr,
    isBalanced: totals.isBalanced,
    difference: totals.difference,
  };

  return { adjustedTB, allGroups, unmatchedAccounts };
}
