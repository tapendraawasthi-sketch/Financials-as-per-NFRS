// ===== server/routes/trialBalance.ts =====
import { Router, Request, Response } from 'express';
import { tbUploadMiddleware } from '../middleware/upload';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { parseTrialBalance } from '../services/tbParser';
import { matchAllAccounts } from '../services/accountMatcher';
import { runAIMatching } from '../services/aiAccountMatcher';
import { validateTrialBalanceTotals } from '../../src/utils/validation';
import type { ParsedTrialBalance, NFRSCategory } from '../../src/types';

const router = Router();

// POST /:companyId/upload
router.post('/:companyId/upload', tbUploadMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. POST a file under the field name "trialbalance".' });

  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company session not found. Create a company first.' });

  const parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
  let matchResults = matchAllAccounts(parsed.rows);

  if (req.query.useAI === 'true' && process.env.ANTHROPIC_API_KEY) {
    try {
      matchResults = await runAIMatching(matchResults);
    } catch (aiErr) {
      console.warn('[trialBalance.upload] AI matching failed, proceeding with deterministic results:', aiErr);
    }
  }

  const rows: ParsedTrialBalance['rows'] = parsed.rows.map((raw, i) => {
    const match = matchResults[i];
    return {
      ...raw,
      nfrsCategory: (match?.nfrsCategory ?? 'unclassified') as NFRSCategory,
      matchedLabel: match?.matchedLabel ?? null,
      confidence: match?.confidence ?? 0,
      matchMethod: match?.method ?? 'unmatched',
      needsReview: match?.needsReview ?? true,
      candidates: match?.candidates ?? [],
      userOverride: false,
    };
  });

  const tb: ParsedTrialBalance = {
    ...parsed,
    rows,
    companyId: req.params.companyId,
    uploadedAt: new Date(),
    filename: req.file.originalname,
  };

  const validation = validateTrialBalanceTotals(rows);
  (tb as any).validation = validation;

  sessionStore.update(req.params.companyId, { trialBalance: tb });
  return res.json(tb);
}));

// GET /:companyId
router.get('/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded for this company.' });
  return res.json(session.trialBalance);
}));

// PUT /:companyId/mapping
router.put('/:companyId/mapping', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded.' });

  const updates: Array<{ rowIndex: number; nfrsCategory: NFRSCategory; matchedLabel: string }> = req.body.updates ?? [];
  const updatedRows = [...session.trialBalance.rows];

  for (const update of updates) {
    const idx = updatedRows.findIndex((r) => r.rowIndex === update.rowIndex);
    if (idx !== -1) {
      updatedRows[idx] = {
        ...updatedRows[idx],
        nfrsCategory: update.nfrsCategory,
        matchedLabel: update.matchedLabel,
        confidence: 100,
        matchMethod: 'manual',
        needsReview: false,
        userOverride: true,
      };
    }
  }

  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  (updatedTB as any).validation = validation;
  sessionStore.update(req.params.companyId, { trialBalance: updatedTB });
  return res.json(updatedTB);
}));

// POST /:companyId/rematch-ai
router.post('/:companyId/rematch-ai', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded.' });

  const lowConfRows = session.trialBalance.rows.filter((r) => !r.userOverride && (r.confidence ?? 0) < 80);
  if (lowConfRows.length === 0) return res.json({ message: 'All accounts already matched with high confidence.', updatedCount: 0 });

  const aiInput = lowConfRows.map((r, i) => ({
    rowIndex: r.rowIndex, rawLabel: r.rawLabel,
    matchedLabel: r.matchedLabel ?? null,
    nfrsCategory: (r.nfrsCategory ?? 'unclassified') as NFRSCategory | 'unclassified',
    confidence: r.confidence ?? 0,
    method: (r.matchMethod ?? 'unmatched') as any,
    candidates: r.candidates ?? [],
    needsReview: r.needsReview ?? true,
  }));

  const aiResults = await runAIMatching(aiInput);
  const aiByRowIndex = new Map(aiResults.map((r) => [r.rowIndex, r]));
  const updatedRows = session.trialBalance.rows.map((row) => {
    const ai = aiByRowIndex.get(row.rowIndex);
    if (!ai || row.userOverride) return row;
    return { ...row, nfrsCategory: ai.nfrsCategory as NFRSCategory, matchedLabel: ai.matchedLabel ?? row.matchedLabel, confidence: ai.confidence, matchMethod: ai.method, needsReview: ai.needsReview };
  });

  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  sessionStore.update(req.params.companyId, { trialBalance: updatedTB });
  return res.json({ updatedCount: aiResults.length, trialBalance: updatedTB });
}));

// GET /:companyId/validation
router.get('/:companyId/validation', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded.' });
  const validation = validateTrialBalanceTotals(session.trialBalance.rows);
  return res.json(validation);
}));

export default router;
