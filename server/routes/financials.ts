// ===== server/routes/financials.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { computeAllFinancials } from '../services/financialEngine';
import { buildAdjustedTrialBalance } from '../services/adjustmentSync.js';
import type { YearEndAdjustments } from '../../src/types/adjustments.js';

const router = Router();

function getSessionId(req: Request): string {
  return (req.params.companyId || req.cookies?.sessionId || '') as string;
}

function requireSession(req: Request, res: Response) {
  const sessionId = getSessionId(req);
  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return null;
  }
  return { session, sessionId };
}

function getSystemAdjustments(adj: YearEndAdjustments) {
  return {
    depreciation: adj.totalDepreciationExpense ?? 0,
    staffBonus: adj.staffBonusProvision ?? 0,
    incomeTax: adj.incomeTaxProvision ?? 0,
    dividendDeclared: adj.dividendPayable ?? 0,
    tdsOnDividend: (adj.dividendPayable ?? 0) * 0.05,
    investmentFVGainLoss: (adj.investmentAdjustments ?? [])
      .reduce((s, i) => s + (i.gainLossOnFV ?? 0), 0),
  };
}

function computeWithAdjustedTB(session: NonNullable<ReturnType<typeof sessionStore.get>>, sessionId: string) {
  const adj = session.adjustments as YearEndAdjustments;
  const manualGroups = adj.journalEntriesSkipped ? [] : (adj.manualJournalGroups ?? []);
  const { adjustedTB, allGroups } = buildAdjustedTrialBalance({
    tb: session.trialBalance as any,
    manualGroups,
    systemAdjustments: getSystemAdjustments(adj),
  });

  const result = computeAllFinancials(
    adjustedTB as any,
    adj as any,
    session.company as any,
    (session.company as any)?.previousYearData,
  );

  sessionStore.set(sessionId, {
    financials: result,
    statements: result,
    notes: result.notes,
    adjustments: {
      ...adj,
      adjustedTrialBalance: adjustedTB,
      manualJournalGroups: manualGroups,
      allComputedGroups: allGroups,
    },
  });

  return result;
}

router.post('/compute', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const { session, sessionId } = ctx;
  const missing: string[] = [];
  if (!session.company) missing.push('company profile');
  if (!session.trialBalance) missing.push('trial balance');
  if (!session.adjustments) missing.push('year-end adjustments');
  if (missing.length > 0) {
    return res.status(400).json({ success: false, error: `Missing data: ${missing.join(', ')}.` });
  }

  const result = computeWithAdjustedTB(session, sessionId);
  return res.json({ success: true, data: result });
}));

router.post('/:companyId/generate', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const { session, sessionId } = ctx;
  const missing: string[] = [];
  if (!session.company) missing.push('company profile');
  if (!session.trialBalance) missing.push('trial balance');
  if (!session.adjustments) missing.push('year-end adjustments');
  if (missing.length > 0) return res.status(400).json({ success: false, error: `Missing data: ${missing.join(', ')}.` });

  const result = computeWithAdjustedTB(session, sessionId);
  return res.json({ success: true, data: result });
}));

router.get('/validation', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const financials = (ctx.session as any).financials;
  if (!financials?.balanceSheet) {
    return res.status(404).json({ success: false, error: 'Financial statements not computed yet.' });
  }
  const bs = financials.balanceSheet;
  const cf = financials.cashFlow;
  const errors: string[] = [];
  if (Math.abs(bs.checkDifference ?? 0) > 1) errors.push(`Balance sheet difference: NPR ${bs.checkDifference}`);
  if (Math.abs(cf.reconciliationDifference ?? 0) > 1) errors.push(`Cash flow reconciliation difference: NPR ${cf.reconciliationDifference}`);
  return res.json({ success: true, data: { isValid: errors.length === 0, errors, warnings: [] } });
}));

router.get('/:companyId/balance-sheet', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const bs = (ctx.session as any).financials?.balanceSheet;
  if (!bs) return res.status(404).json({ success: false, error: 'Not generated yet.' });
  return res.json({ success: true, data: bs });
}));

router.get('/:companyId/income-statement', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const is = (ctx.session as any).financials?.incomeStatement;
  if (!is) return res.status(404).json({ success: false, error: 'Not generated yet.' });
  return res.json({ success: true, data: is });
}));

router.get('/:companyId/cash-flow', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const cf = (ctx.session as any).financials?.cashFlow;
  if (!cf) return res.status(404).json({ success: false, error: 'Not generated yet.' });
  return res.json({ success: true, data: cf });
}));

router.get('/:companyId/changes-in-equity', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const cie = (ctx.session as any).financials?.changesInEquity;
  if (!cie) return res.status(404).json({ success: false, error: 'Not generated yet.' });
  return res.json({ success: true, data: cie });
}));

router.get('/:companyId/notes', asyncHandler(async (req: Request, res: Response) => {
  const ctx = requireSession(req, res);
  if (!ctx) return;
  const notes = (ctx.session as any).financials?.notes;
  if (!notes) return res.status(404).json({ success: false, error: 'Not generated yet.' });
  return res.json({ success: true, data: notes });
}));

export default router;
