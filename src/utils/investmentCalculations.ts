export interface ListedShareDraft {
  openingUnits: number;
  unitsPurchased: number;
  unitsSold: number;
  openingLtp: number;
  closingLtp: number;
  soldUnitGainLoss?: number;
}

export function computeListedShareMetrics(draft: ListedShareDraft) {
  const closingUnits = Math.max(0, draft.openingUnits + draft.unitsPurchased - draft.unitsSold);
  const openingFv = draft.openingUnits * draft.openingLtp;
  const closingFv = closingUnits * draft.closingLtp;
  const fvGainLoss = closingFv - openingFv;
  return {
    closingUnits,
    openingFv,
    closingFv,
    fvGainLoss,
    soldUnitGainLoss: draft.soldUnitGainLoss ?? 0,
  };
}
