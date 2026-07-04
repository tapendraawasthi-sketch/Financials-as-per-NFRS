/** Nepal Income Tax Act Section 118 cumulative advance-tax checkpoints. */
export const ADVANCE_TAX_CHECKPOINTS = [
  { checkpoint: 'End of Poush', cumulativePercent: 0.40, defaultDaysLate: 150 },
  { checkpoint: 'End of Chaitra', cumulativePercent: 0.70, defaultDaysLate: 90 },
  { checkpoint: 'End of Ashadh', cumulativePercent: 0.90, defaultDaysLate: 0 },
] as const;

export type AdvanceTaxCheckpoint = (typeof ADVANCE_TAX_CHECKPOINTS)[number];
