// ===== server/routes/financials.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { computeAllFinancials } from '../services/financialEngine';

const router = Router();

router.post('/:companyId/generate', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  const missing: string[] = [];
  if (!session?.company)      missing.push('company profile');
  if (!session?.trialBalance) missing.push('trial balance');
  if (!session?.adjustments)  missing.push('year-end adjustments');
  if (missing.length > 0) return res.status(400).json({ error: `Missing data: ${missing.join(', ')}.` });

  const result = computeAllFinancials(session.trialBalance!, session.adjustments!, session.company!);
  sessionStore.update(req.params.companyId, {
    adjustments: { ...session.adjustments!, taxableProfit: result.incomeStatement.profitBeforeTax, currentTaxExpense: result.incomeStatement.incomeTaxExpense },
  } as any);
  (session as any).financials = result;
  return res.json(result);
}));

router.get('/:companyId/balance-sheet',      asyncHandler(async (req: Request, res: Response) => { const s = sessionStore.get(req.params.companyId); if (!(s as any)?.financials?.balanceSheet) return res.status(404).json({ error: 'Not generated yet.' }); return res.json((s as any).financials.balanceSheet); }));
router.get('/:companyId/income-statement',   asyncHandler(async (req: Request, res: Response) => { const s = sessionStore.get(req.params.companyId); if (!(s as any)?.financials?.incomeStatement) return res.status(404).json({ error: 'Not generated yet.' }); return res.json((s as any).financials.incomeStatement); }));
router.get('/:companyId/cash-flow',          asyncHandler(async (req: Request, res: Response) => { const s = sessionStore.get(req.params.companyId); if (!(s as any)?.financials?.cashFlow) return res.status(404).json({ error: 'Not generated yet.' }); return res.json((s as any).financials.cashFlow); }));
router.get('/:companyId/changes-in-equity',  asyncHandler(async (req: Request, res: Response) => { const s = sessionStore.get(req.params.companyId); if (!(s as any)?.financials?.changesInEquity) return res.status(404).json({ error: 'Not generated yet.' }); return res.json((s as any).financials.changesInEquity); }));
router.get('/:companyId/notes',              asyncHandler(async (req: Request, res: Response) => { const s = sessionStore.get(req.params.companyId); if (!(s as any)?.financials?.notes) return res.status(404).json({ error: 'Not generated yet.' }); return res.json((s as any).financials.notes); }));

export default router;
