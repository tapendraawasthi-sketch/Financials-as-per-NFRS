// Shared trial balance hierarchy and normalization helpers used by tbParser and aiTbConverter.
import type { RawTBRow } from '../../src/types/trialBalance.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RawTBTotals {
  totalOpeningDr: number;
  totalOpeningCr: number;
  totalDuringDr: number;
  totalDuringCr: number;
  totalClosingDr: number;
  totalClosingCr: number;
  isBalanced: boolean;
  difference: number;
}

/** Derive closing Dr/Cr from opening + during + adjustment when closing columns are absent. */
export function deriveClosingBalances(row: RawTBRow): RawTBRow {
  if (row.isGroupRow) return row;

  let { closingDr, closingCr, openingDr, openingCr, duringDr, duringCr, adjustmentDr, adjustmentCr } = row;

  if (closingDr === 0 && closingCr === 0) {
    const netDr = openingDr + duringDr + adjustmentDr;
    const netCr = openingCr + duringCr + adjustmentCr;
    const net = netDr - netCr;
    if (net >= 0) {
      closingDr = round2(net);
      closingCr = 0;
    } else {
      closingDr = 0;
      closingCr = round2(Math.abs(net));
    }
  }

  return { ...row, closingDr, closingCr };
}

/** Rows with a deeper-indented descendant are group headers — exclude from TB totals. */
export function markGroupRowsByIndentation(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    let hasDeeperDescendant = false;
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces <= row.rawIndentSpaces) break;
      hasDeeperDescendant = true;
      break;
    }
    return {
      ...row,
      isGroupRow: row.isGroupRow || hasDeeperDescendant,
      rowLevel: hasDeeperDescendant ? 0 : (row.rawIndentSpaces > 4 ? 2 : row.rowLevel ?? 1),
    };
  });
}

/** Exclude Tally shorthand aggregate labels when detailed sibling accounts exist. */
export function markTallyShorthandAggregates(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    const peers: string[] = [];
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces < row.rawIndentSpaces) break;
      if (rows[j].rawIndentSpaces === row.rawIndentSpaces) {
        peers.push(rows[j].rawLabel.trim());
      }
    }
    const isShorthandAggregate = peers.some(
      (peer) =>
        (peer.startsWith(`${row.rawLabel.trim()}:`)
          || peer.startsWith(`${row.rawLabel.trim()} `))
        && peer.length > row.rawLabel.trim().length,
    );
    return { ...row, isGroupRow: isShorthandAggregate };
  });
}

/** Assign parentGroup to each leaf row using a stack of group headers. */
export function assignParentGroups(rows: RawTBRow[]): RawTBRow[] {
  const groupStack: Array<{ label: string; indentSpaces: number; level: number }> = [];

  return rows.map((row) => {
    if (row.isGroupRow) {
      while (
        groupStack.length > 0 &&
        groupStack[groupStack.length - 1].indentSpaces >= row.rawIndentSpaces
      ) {
        groupStack.pop();
      }
      groupStack.push({
        label: row.rawLabel,
        indentSpaces: row.rawIndentSpaces,
        level: row.rowLevel,
      });
      return {
        ...row,
        parentGroup: groupStack.length > 1 ? groupStack[groupStack.length - 2].label : '',
      };
    }

    const parentGroup = groupStack.length > 0 ? groupStack[groupStack.length - 1].label : '';
    return { ...row, parentGroup: row.parentGroup || parentGroup };
  });
}

export function postProcessHierarchy(rows: RawTBRow[]): RawTBRow[] {
  return assignParentGroups(markTallyShorthandAggregates(markGroupRowsByIndentation(rows)));
}

export function computeRawTBTotals(rows: RawTBRow[]): RawTBTotals {
  const leafRows = rows.filter((r) => !r.isGroupRow);
  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalDuringDr = 0;
  let totalDuringCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;

  for (const row of leafRows) {
    totalOpeningDr += row.openingDr;
    totalOpeningCr += row.openingCr;
    totalDuringDr += row.duringDr;
    totalDuringCr += row.duringCr;
    totalClosingDr += row.closingDr;
    totalClosingCr += row.closingCr;
  }

  totalClosingDr = round2(totalClosingDr);
  totalClosingCr = round2(totalClosingCr);
  const difference = round2(totalClosingDr - totalClosingCr);

  return {
    totalOpeningDr: round2(totalOpeningDr),
    totalOpeningCr: round2(totalOpeningCr),
    totalDuringDr: round2(totalDuringDr),
    totalDuringCr: round2(totalDuringCr),
    totalClosingDr,
    totalClosingCr,
    isBalanced: Math.abs(difference) < 1.0,
    difference,
  };
}

export interface FinalizeOptions {
  deriveClosing?: boolean;
  postProcessHierarchy?: boolean;
}

/** Normalize raw rows: derive closing balances, assign hierarchy, compute totals. */
export function finalizeRawTBRows(
  rows: RawTBRow[],
  options: FinalizeOptions = {},
): { rows: RawTBRow[]; totals: RawTBTotals; warnings: string[] } {
  const deriveClosing = options.deriveClosing !== false;
  const runHierarchy = options.postProcessHierarchy !== false;

  let processed = rows.map((row, idx) => ({ ...row, rowIndex: idx }));

  if (deriveClosing) {
    processed = processed.map(deriveClosingBalances);
  }

  if (runHierarchy) {
    processed = postProcessHierarchy(processed);
  } else {
    processed = assignParentGroups(processed);
  }

  processed = processed.map((row, idx) => ({ ...row, rowIndex: idx }));

  const totals = computeRawTBTotals(processed);
  const warnings: string[] = [];
  if (!totals.isBalanced) {
    warnings.push(
      `Trial Balance not balanced. Difference: ${Math.abs(totals.difference).toLocaleString('en-IN')}.`,
    );
  }

  const derivedCount = rows.filter(
    (r, i) => !r.isGroupRow && r.closingDr === 0 && r.closingCr === 0
      && processed[i] && (processed[i].closingDr > 0 || processed[i].closingCr > 0),
  ).length;
  if (derivedCount > 0) {
    warnings.push(
      `Closing balances derived for ${derivedCount} account${derivedCount === 1 ? '' : 's'} from opening + movement columns.`,
    );
  }

  return { rows: processed, totals, warnings };
}
