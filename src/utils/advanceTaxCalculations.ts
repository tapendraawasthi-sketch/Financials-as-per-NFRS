import { ADVANCE_TAX_CHECKPOINTS } from '../data/advanceTaxCheckpoints.js';

export interface AdvanceTaxInstallment {
  checkpoint: string;
  cumulativePercent: number;
  requiredAmount: number;
  paidAmount: number;
  shortfall: number;
  interestRate: number;
  interestAmount: number;
}

export function computeAdvanceTaxInterest(
  estimatedTaxLiability: number,
  installments: Array<{ checkpoint: string; cumulativePercent: number; paidAmount: number; daysLate: number }>,
  annualRate = 0.15,
): { installments: AdvanceTaxInstallment[]; totalInterest118: number; totalInterest119: number; finalShortfall: number } {
  const results: AdvanceTaxInstallment[] = installments.map((inst) => {
    const required = estimatedTaxLiability * inst.cumulativePercent;
    const shortfall = Math.max(0, required - inst.paidAmount);
    const interestAmount = shortfall > 0
      ? Math.round(shortfall * annualRate * (inst.daysLate / 365) * 100) / 100
      : 0;
    return {
      checkpoint: inst.checkpoint,
      cumulativePercent: inst.cumulativePercent,
      requiredAmount: Math.round(required * 100) / 100,
      paidAmount: inst.paidAmount,
      shortfall: Math.round(shortfall * 100) / 100,
      interestRate: annualRate,
      interestAmount,
    };
  });
  const totalInterest118 = results.reduce((s, r) => s + r.interestAmount, 0);
  const totalPaid = installments.length > 0
    ? installments[installments.length - 1].paidAmount
    : 0;
  const finalShortfall = Math.max(0, estimatedTaxLiability * 0.9 - totalPaid);
  const totalInterest119 = finalShortfall > 0
    ? Math.round(finalShortfall * annualRate * 100) / 100
    : 0;
  return { installments: results, totalInterest118, totalInterest119, finalShortfall };
}

export function defaultAdvanceTaxDaysLate(): number[] {
  return ADVANCE_TAX_CHECKPOINTS.map((cp) => cp.defaultDaysLate);
}
