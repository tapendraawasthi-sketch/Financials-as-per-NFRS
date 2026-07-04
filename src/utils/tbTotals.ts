import type { RawTBRow } from '../types/trialBalance';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeRawTBTotals(rows: RawTBRow[]) {
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
