// Shared trial balance hierarchy and normalization helpers used by tbParser and aiTbConverter.
import type { RawTBRow } from '../../src/types/trialBalance.js';

const round2 = (n: number) => Math.round(n * 100) / 100;
const AGGREGATE_TOLERANCE = 1;

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

/** Build Tally-style child label prefixes, e.g. "Purchase: IMPORT" -> "Purchase IMPORT:". */
export function tallyChildPrefixes(label: string): string[] {
  const trimmed = label.trim();
  const prefixes = [`${trimmed}:`, `${trimmed} `];
  const colonMatch = trimmed.match(/^(.+?):\s*(.+)$/);
  if (colonMatch) {
    prefixes.push(`${colonMatch[1].trim()} ${colonMatch[2].trim()}:`);
  }
  return prefixes;
}

/** True when childLabel is a Tally naming descendant of parentLabel. */
export function isTallyNamingDescendant(parentLabel: string, childLabel: string): boolean {
  const parent = parentLabel.trim();
  const child = childLabel.trim();
  return tallyChildPrefixes(parent).some(
    (prefix) => child.startsWith(prefix) && child.length > parent.length,
  );
}

function closingMatchesAggregate(
  row: RawTBRow,
  childDr: number,
  childCr: number,
  tolerance = AGGREGATE_TOLERANCE,
): boolean {
  if (row.closingDr > 0 && Math.abs(row.closingDr - childDr) < tolerance) return true;
  if (row.closingCr > 0 && Math.abs(row.closingCr - childCr) < tolerance) return true;
  return Math.abs((row.closingDr - row.closingCr) - (childDr - childCr)) < tolerance;
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

/**
 * Mark rows whose descendants follow Tally colon naming conventions
 * (e.g. "Purchase: IMPORT" -> "Purchase IMPORT: Raw Materials").
 */
export function markTallyNamingHierarchy(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;

    for (let j = i + 1; j < rows.length; j++) {
      const other = rows[j];
      if (other.rawIndentSpaces < row.rawIndentSpaces) break;
      if (isTallyNamingDescendant(row.rawLabel, other.rawLabel)) {
        return { ...row, isGroupRow: true, rowLevel: 0 };
      }
      if (
        other.rawIndentSpaces <= row.rawIndentSpaces
        && !isTallyNamingDescendant(row.rawLabel, other.rawLabel)
      ) {
        break;
      }
    }

    return row;
  });
}

/** Mark rows whose closing equals the sum of deeper-indented descendants. */
export function markTallyAggregateGroups(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    if (row.closingDr === 0 && row.closingCr === 0) return row;

    let childDr = 0;
    let childCr = 0;
    let childCount = 0;

    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].rawIndentSpaces <= row.rawIndentSpaces) break;
      childDr += rows[j].closingDr;
      childCr += rows[j].closingCr;
      childCount++;
    }

    if (childCount > 0 && closingMatchesAggregate(row, childDr, childCr)) {
      return { ...row, isGroupRow: true, rowLevel: 0 };
    }

    return row;
  });
}

function isLeafWithinRange(rows: RawTBRow[], idx: number, start: number, end: number): boolean {
  for (let j = idx + 1; j <= end; j++) {
    if (rows[j].rawIndentSpaces > rows[idx].rawIndentSpaces) return false;
  }
  return true;
}

function sumLeafClosingsInRange(
  rows: RawTBRow[],
  start: number,
  end: number,
): { dr: number; cr: number } {
  let dr = 0;
  let cr = 0;
  for (let i = start; i <= end; i++) {
    if (isLeafWithinRange(rows, i, start, end)) {
      dr += rows[i].closingDr;
      cr += rows[i].closingCr;
    }
  }
  return { dr, cr };
}

/**
 * Handle Tally P&L rows where same-indent sub-groups follow a header
 * (e.g. "Interest & Bank Charges" followed by "Bank Interest (Fixed Assits)").
 */
export function markTallySameIndentSubGroups(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    if (row.closingDr === 0 && row.closingCr === 0) return row;
    if (i + 1 >= rows.length) return row;
    if (rows[i + 1].rawIndentSpaces !== row.rawIndentSpaces) return row;

    for (let end = i + 1; end < rows.length; end++) {
      if (rows[end].rawIndentSpaces < row.rawIndentSpaces) break;

      const { dr, cr } = sumLeafClosingsInRange(rows, i + 1, end);
      if (closingMatchesAggregate(row, dr, cr)) {
        return { ...row, isGroupRow: true, rowLevel: 0 };
      }

      if (
        rows[end].rawIndentSpaces === row.rawIndentSpaces
        && !isTallyNamingDescendant(row.rawLabel, rows[end].rawLabel)
        && (dr > row.closingDr + AGGREGATE_TOLERANCE || cr > row.closingCr + AGGREGATE_TOLERANCE)
      ) {
        break;
      }
    }

    return row;
  });
}

/**
 * When a same-indent sibling is already a group with an identical balance,
 * treat the preceding row as a parent group (e.g. Sundry Creditors / Business Payable).
 */
export function markTallyDuplicateBalanceParents(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    if (row.closingDr === 0 && row.closingCr === 0) return row;

    for (let j = i + 1; j < rows.length; j++) {
      const other = rows[j];
      if (other.rawIndentSpaces < row.rawIndentSpaces) break;
      if (other.rawIndentSpaces !== row.rawIndentSpaces) continue;

      const sameBalance =
        (row.closingDr > 0 && Math.abs(row.closingDr - other.closingDr) < AGGREGATE_TOLERANCE)
        || (row.closingCr > 0 && Math.abs(row.closingCr - other.closingCr) < AGGREGATE_TOLERANCE);

      if (sameBalance && other.isGroupRow) {
        return { ...row, isGroupRow: true, rowLevel: 0 };
      }
      break;
    }

    return row;
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

/** Enhanced hierarchy detection for Tally/Busy grouped trial balance exports. */
export function postProcessTallyGroupedHierarchy(rows: RawTBRow[]): RawTBRow[] {
  let processed = markGroupRowsByIndentation(rows);
  processed = markTallyShorthandAggregates(processed);
  processed = markTallyNamingHierarchy(processed);
  processed = markTallyAggregateGroups(processed);
  processed = markTallySameIndentSubGroups(processed);
  processed = markTallyDuplicateBalanceParents(processed);
  return assignParentGroups(processed);
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
  tallyGrouped?: boolean;
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
    processed = options.tallyGrouped
      ? postProcessTallyGroupedHierarchy(processed)
      : postProcessHierarchy(processed);
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
