// ===== server/routes/output.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { generateNFRSWorkbook } from '../services/excelWriter';
import { computeAllFinancials } from '../services/financialEngine';
import { buildAdjustedTrialBalance } from '../services/adjustmentSync.js';
import type { YearEndAdjustments } from '../../src/types/adjustments.js';

const router = Router();

function getSystemAdjustments(adj: YearEndAdjustments) {
  return {
    depreciation: adj.totalDepreciationExpense ?? 0,
    staffBonus: adj.staffBonusProvision ?? 0,
    incomeTax: adj.incomeTaxProvision ?? 0,
    dividendDeclared: adj.dividendPayable ?? 0,
    tdsOnDividend: (adj.dividendPayable ?? 0) * 0.05,
    investmentFVGainLoss: (adj.investmentAdjustments ?? [])
      .reduce((s, i) => s + (i.fairValueGainLoss ?? i.gainLossOnFV ?? 0), 0),
  };
}

router.post('/:companyId/generate-excel', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const missing: string[] = [];
  if (!session?.company)      missing.push('company profile');
  if (!session?.trialBalance) missing.push('trial balance');
  if (!session?.adjustments)  missing.push('year-end adjustments');
  if (missing.length > 0) return res.status(400).json({ error: `Missing data: ${missing.join(', ')}.` });

  const adj = session.adjustments as YearEndAdjustments;
  let trialBalance = adj.adjustedTrialBalance ?? session.trialBalance!;
  let allGroups = adj.allComputedGroups;

  if (!adj.adjustedTrialBalance) {
    const manualGroups = adj.journalEntriesSkipped ? [] : (adj.manualJournalGroups ?? []);
    const built = buildAdjustedTrialBalance({
      tb: session.trialBalance as any,
      manualGroups,
      systemAdjustments: getSystemAdjustments(adj),
    });
    trialBalance = built.adjustedTB;
    allGroups = built.allGroups;
    sessionStore.set(req.params.companyId, {
      adjustments: {
        ...adj,
        adjustedTrialBalance: built.adjustedTB,
        allComputedGroups: built.allGroups,
      },
    });
  }

  const financials = (session as any).financials ?? computeAllFinancials(
    trialBalance as any,
    adj as any,
    session.company!,
    session.company!.previousYearData,
  );
  const { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes } = financials;

  const adjustmentsForExcel: YearEndAdjustments = {
    ...adj,
    allComputedGroups: allGroups ?? adj.allComputedGroups,
  };

  const buffer = await generateNFRSWorkbook({
    company: session.company!,
    trialBalance: trialBalance as any,
    balanceSheet, incomeStatement, changesInEquity, cashFlow, notes,
    adjustments: adjustmentsForExcel,
  });

  const companyName = (session.company!.companyName ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_');
  const fiscalYear  = session.company!.fiscalYear?.bsFY?.replace('/', '-') ?? 'financials';
  const filename    = `NFRS_Financials_${companyName}_${fiscalYear}.xlsx`;

  console.log('[Excel Generated]', companyName, fiscalYear, buffer.length, 'bytes');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
}));

export default router;
