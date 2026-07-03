// ===== server/routes/output.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { generateNFRSWorkbook } from '../services/excelWriter';
import { computeAllFinancials } from '../services/financialEngine';

const router = Router();

router.post('/:companyId/generate-excel', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const missing: string[] = [];
  if (!session?.company)      missing.push('company profile');
  if (!session?.trialBalance) missing.push('trial balance');
  if (!session?.adjustments)  missing.push('year-end adjustments');
  if (missing.length > 0) return res.status(400).json({ error: `Missing data: ${missing.join(', ')}.` });

  const financials = (session as any).financials ?? computeAllFinancials(session.trialBalance!, session.adjustments!, session.company!, session.company!.previousYearData);
  const { balanceSheet, incomeStatement, changesInEquity, cashFlow, notes } = financials;

  const buffer = await generateNFRSWorkbook({
    company: session.company!,
    trialBalance: session.trialBalance!,
    balanceSheet, incomeStatement, changesInEquity, cashFlow, notes,
    adjustments: session.adjustments!,
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
