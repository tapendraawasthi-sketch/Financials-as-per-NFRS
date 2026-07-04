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

/**
 * Tally grouped exports are not strict trees: detail may sit at the same indent as
 * its header (Purchase → Purchase: IMPORT) or outdent after a deep block (indent 10 → 6).
 */
export function tallySubtreeEnd(rows: RawTBRow[], index: number): number {
  const baseIndent = rows[index].rawIndentSpaces;
  let maxIndent = baseIndent;
  let seenDeeper = false;

  for (let j = index + 1; j < rows.length; j++) {
    const ind = rows[j].rawIndentSpaces;
    if (ind < baseIndent) return j;

    if (ind === baseIndent) {
      if (seenDeeper && maxIndent > baseIndent) return j;
      continue;
    }

    if (ind > maxIndent) maxIndent = ind;
    seenDeeper = true;
    if (ind < maxIndent) return j;
  }

  return rows.length;
}

function hasImmediateDeeperChild(rows: RawTBRow[], index: number): boolean {
  const baseIndent = rows[index].rawIndentSpaces;
  const end = tallySubtreeEnd(rows, index);
  for (let j = index + 1; j < end; j++) {
    if (rows[j].rawIndentSpaces > baseIndent) return true;
  }
  return false;
}

/** True when childIdx is inside parentIdx's Tally subtree (respects outdent). */
export function isTallyDescendant(
  rows: RawTBRow[],
  parentIdx: number,
  childIdx: number,
): boolean {
  if (childIdx <= parentIdx) return false;
  return childIdx < tallySubtreeEnd(rows, parentIdx);
}

function hasTallyDescendant(rows: RawTBRow[], index: number): boolean {
  return hasImmediateDeeperChild(rows, index);
}

function hasDeeperIndentInRange(
  rows: RawTBRow[],
  start: number,
  end: number,
  baseIndent: number,
): boolean {
  for (let i = start; i <= end; i++) {
    if (rows[i].rawIndentSpaces > baseIndent) return true;
  }
  return false;
}

/** Rows with a deeper-indented descendant are group headers — exclude from TB totals. */
export function markGroupRowsByIndentation(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    const hasDeeperDescendant = hasImmediateDeeperChild(rows, i);
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

    const end = tallySubtreeEnd(rows, i);
    for (let j = i + 1; j < end; j++) {
      if (isTallyNamingDescendant(row.rawLabel, rows[j].rawLabel)) {
        return { ...row, isGroupRow: true, rowLevel: 0 };
      }
    }

    return row;
  });
}

function hasDeeperDescendant(rows: RawTBRow[], index: number): boolean {
  return hasImmediateDeeperChild(rows, index);
}

function hasAggregateEvidence(rows: RawTBRow[], index: number): boolean {
  const row = rows[index];
  if (row.isGroupRow) return false;

  const end = tallySubtreeEnd(rows, index);
  let childClosingDr = 0;
  let childClosingCr = 0;
  let childDuringDr = 0;
  let childDuringCr = 0;
  let childCount = 0;

  for (let j = index + 1; j < end; j++) {
    childClosingDr += rows[j].closingDr;
    childClosingCr += rows[j].closingCr;
    childDuringDr += rows[j].duringDr;
    childDuringCr += rows[j].duringCr;
    childCount++;
  }

  if (childCount === 0) return false;

  const closingMatch = closingMatchesAggregate(row, childClosingDr, childClosingCr);
  const duringMatch =
    (row.duringDr > 0 || row.duringCr > 0)
    && Math.abs(row.duringDr - childDuringDr) < AGGREGATE_TOLERANCE
    && Math.abs(row.duringCr - childDuringCr) < AGGREGATE_TOLERANCE;

  return closingMatch || duringMatch;
}

/** Undo same-indent sibling false positives (e.g. duplicate employee balances). */
export function demoteCoincidentalSameIndentGroups(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (!row.isGroupRow) return row;
    if (hasDeeperDescendant(rows, i)) return row;

    const next = rows[i + 1];
    if (!next || next.rawIndentSpaces !== row.rawIndentSpaces || next.isGroupRow) return row;

    const rowNet = row.closingDr - row.closingCr;
    const nextNet = next.closingDr - next.closingCr;
    if (Math.abs(rowNet) < AGGREGATE_TOLERANCE) return row;
    if (Math.abs(rowNet - nextNet) >= AGGREGATE_TOLERANCE) return row;

    return { ...row, isGroupRow: false, rowLevel: row.rawIndentSpaces > 4 ? 2 : 1 };
  });
}

const PROTECTED_TALLY_GROUP = /^(sundry creditors|business and other payable|stock-in-hand|purchase$|purchase:|capital account|current assets|current liabilities|fixed assets|loans|profit & loss|revenue accounts|sale$|directors advance|share capital)/i;

/**
 * Promote aggregate subtotal rows; demote only coincidental same-indent duplicate balances.
 * Major Tally group headers are protected from demotion.
 */
export function reconcileTallyGroupedBalance(
  rows: RawTBRow[],
  _anchor: TallyTotalAnchor | null = null,
): RawTBRow[] {
  let processed = rows.map((row) => ({ ...row }));

  for (let pass = 0; pass < 8; pass++) {
    processed = processed.map((row, i) => {
      if (!row.isGroupRow) return row;
      if (PROTECTED_TALLY_GROUP.test(row.rawLabel.trim())) return row;
      if (hasDeeperDescendant(processed, i)) return row;

      const next = processed[i + 1];
      if (!next || next.rawIndentSpaces !== row.rawIndentSpaces || next.isGroupRow) return row;

      const rowNet = row.closingDr - row.closingCr;
      const nextNet = next.closingDr - next.closingCr;
      if (Math.abs(rowNet) < AGGREGATE_TOLERANCE) return row;
      if (Math.abs(rowNet - nextNet) >= AGGREGATE_TOLERANCE) return row;

      return { ...row, isGroupRow: false, rowLevel: row.rawIndentSpaces > 4 ? 2 : 1 };
    });

    const before = computeRawTBTotals(processed);
    if (before.isBalanced) return processed;

    let bestIdx = -1;
    let bestDiff = Math.abs(before.difference);

    for (let i = 0; i < processed.length; i++) {
      if (processed[i].isGroupRow) continue;
      if (!hasAggregateEvidence(processed, i)) continue;

      const trial = processed.map((r, idx) =>
        idx === i ? { ...r, isGroupRow: true, rowLevel: 0 } : { ...r },
      );
      const diff = Math.abs(computeRawTBTotals(trial).difference);
      if (diff + 0.01 < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break;
    processed[bestIdx] = { ...processed[bestIdx], isGroupRow: true, rowLevel: 0 };
  }

  return processed;
}

export interface TallyTotalAnchor {
  duringDr: number;
  duringCr: number;
  closingDr: number;
  closingCr: number;
}

/** Parse the Tally/Busy trailing Total row when present. */
export function extractTallyTotalAnchor(matrix: unknown[][]): TallyTotalAnchor | null {
  for (let r = matrix.length - 1; r >= Math.max(0, matrix.length - 5); r--) {
    const label = String(matrix[r]?.[0] ?? '').trim().toLowerCase();
    if (label !== 'total' && !label.startsWith('grand total')) continue;

    const duringDr = parseFloat(String(matrix[r]?.[2] ?? 0)) || 0;
    const duringCr = parseFloat(String(matrix[r]?.[3] ?? 0)) || 0;
    const closing = parseTallyBalanceCell(matrix[r]?.[4]);
    return { duringDr, duringCr, closingDr: closing.dr, closingCr: closing.cr };
  }
  return null;
}

function parseTallyBalanceCell(val: unknown): { dr: number; cr: number } {
  if (val === null || val === undefined || val === '') return { dr: 0, cr: 0 };
  const str = String(val).trim();
  if (!str) return { dr: 0, cr: 0 };
  const num = parseFloat(str.replace(/,/g, '').replace(/\s*(Dr|Cr)\.?$/i, ''));
  if (isNaN(num)) return { dr: 0, cr: 0 };
  if (/cr/i.test(str)) return { dr: 0, cr: Math.abs(num) };
  return { dr: Math.abs(num), cr: 0 };
}

/** Mark rows whose closing equals the sum of deeper-indented descendants. */
export function markTallyAggregateGroups(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (row.isGroupRow) return row;
    if (row.closingDr === 0 && row.closingCr === 0) return row;

    const end = tallySubtreeEnd(rows, i);
    let childDr = 0;
    let childCr = 0;
    let childCount = 0;

    for (let j = i + 1; j < end; j++) {
      if (rows[j].rawIndentSpaces <= row.rawIndentSpaces) continue;
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
 * Demote group headers that have no Tally subtree (false keyword/parent marks).
 * Keeps aggregate groups whose detail lives in deeper-indented rows.
 */
export function demoteOrphanTallyGroups(rows: RawTBRow[]): RawTBRow[] {
  return rows.map((row, i) => {
    if (!row.isGroupRow) return row;
    if (row.rawIndentSpaces === 0) return row;
    if (hasImmediateDeeperChild(rows, i)) return row;
    return { ...row, isGroupRow: false, rowLevel: row.rawIndentSpaces > 4 ? 2 : 1 };
  });
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

    const subtreeEnd = Math.min(tallySubtreeEnd(rows, i), rows.length);
    for (let end = i + 1; end < subtreeEnd; end++) {
      if (rows[end].rawIndentSpaces < row.rawIndentSpaces) break;

      const { dr, cr } = sumLeafClosingsInRange(rows, i + 1, end);
      if (
        closingMatchesAggregate(row, dr, cr)
        && hasDeeperIndentInRange(rows, i + 1, end, row.rawIndentSpaces)
      ) {
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
  const groupStack: Array<{ label: string; indentSpaces: number; level: number; index: number }> = [];

  return rows.map((row, i) => {
    while (groupStack.length > 0) {
      const top = groupStack[groupStack.length - 1];
      if (top.indentSpaces >= row.rawIndentSpaces || !isTallyDescendant(rows, top.index, i)) {
        groupStack.pop();
        continue;
      }
      break;
    }

    if (row.isGroupRow) {
      groupStack.push({
        label: row.rawLabel,
        indentSpaces: row.rawIndentSpaces,
        level: row.rowLevel,
        index: i,
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
  processed = demoteCoincidentalSameIndentGroups(processed);
  processed = demoteOrphanTallyGroups(processed);
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
  tallyTotalAnchor?: TallyTotalAnchor | null;
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

  if (options.tallyTotalAnchor && options.tallyGrouped) {
    const anchor = options.tallyTotalAnchor;
    const duringDiff = Math.abs(round2(totals.totalDuringDr) - round2(anchor.duringDr))
      + Math.abs(round2(totals.totalDuringCr) - round2(anchor.duringCr));
    if (duringDiff > AGGREGATE_TOLERANCE && totals.isBalanced) {
      warnings.push(
        `Closing totals balance, but during movement differs from Tally Total row by ${duringDiff.toLocaleString('en-IN')}.`,
      );
    }
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
