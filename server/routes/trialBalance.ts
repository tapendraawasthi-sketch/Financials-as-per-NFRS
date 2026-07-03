// ===== server/routes/trialBalance.ts =====
import { Router, Request, Response } from 'express';
import { tbUploadMiddleware } from '../middleware/upload';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { parseTrialBalance } from '../services/tbParser';
import { classifyAll } from '../services/accountMatcher';
import { classifyWithAI, aiMatchUnresolved } from '../services/aiAccountMatcher';
import { applyMappingProfile, upsertMappingProfile } from '../services/mappingProfile';
import { validateTrialBalanceTotals } from '../../src/utils/validation';
import type { CompanyProfile, ParsedTrialBalance, NFRSCategory } from '../../src/types';
import { getFiscalYear } from '../../src/data/fiscalYears';

const router = Router();

// POST /:companyId/upload
router.post('/:companyId/upload', tbUploadMiddleware, async (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Please select a file and try again.' });
    }

    // ── File size check (50 MB)
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: 'File size exceeds the 50 MB limit. Please reduce the file size by removing unnecessary sheets or rows.',
      });
    }

    // ── Format check
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    const ext = (req.file.originalname ?? '').split('.').pop()?.toLowerCase();
    if (!allowed.includes(req.file.mimetype) && !['xlsx','xls','csv'].includes(ext ?? '')) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported file format. Please upload .xlsx, .xls, or .csv files exported from your accounting software.',
      });
    }

    let session = sessionStore.get(req.params.companyId);
    if (!session) {
      const companyRaw = req.body?.company;
      if (typeof companyRaw === 'string') {
        try {
          const company = JSON.parse(companyRaw) as CompanyProfile;
          sessionStore.set(req.params.companyId, { company: { ...company, id: req.params.companyId } });
          session = sessionStore.get(req.params.companyId);
        } catch {
          // ignore malformed company snapshot
        }
      }
    }
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Company session not found on server. Save company details first, then upload again.',
        code: 'SESSION_NOT_FOUND',
      });
    }

    const parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);

    if (parsed.workbookMetadata?.format === 'mes_template') {
      const meta = parsed.workbookMetadata;
      const current = (session.company ?? {}) as CompanyProfile;
      const fiscalYear = meta.fiscalYear
        ? (getFiscalYear(meta.fiscalYear) ?? current.fiscalYear)
        : current.fiscalYear;
      const enrichedCompany: CompanyProfile = {
        ...current,
        companyName: meta.companyName || current.companyName,
        fullAddress: meta.fullAddress || current.fullAddress,
        chairperson: meta.chairperson || current.chairperson,
        director: meta.director || current.director,
        accountsHead: meta.accountsHead || current.accountsHead,
        fiscalYear,
        auditorInfo: {
          ...(current.auditorInfo ?? { auditorName: '', auditorFirmName: '', position: '', icanRegNumber: '' }),
          auditorName: meta.auditorName || current.auditorInfo?.auditorName || '',
          auditorFirmName: meta.auditFirmName || current.auditorInfo?.auditorFirmName || '',
        },
      };
      sessionStore.set(req.params.companyId, { company: enrichedCompany });
      session = sessionStore.get(req.params.companyId);
    }
    
    // ── No data rows check
    if (!parsed.rows || parsed.rows.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No data rows found in the uploaded file. Please check your export settings and ensure the file contains account entries.',
      });
    }

    let rows = classifyAll(parsed.rows);
    rows = applyMappingProfile(rows, session.mappingProfile);

    if (req.query.useAI === 'true' && process.env.ANTHROPIC_API_KEY) {
      try {
        rows = await classifyWithAI(rows, process.env.ANTHROPIC_API_KEY);
      } catch (aiErr) {
        console.warn('[trialBalance.upload] AI matching failed:', aiErr);
      }
    }

    const tb: ParsedTrialBalance & Record<string, unknown> = {
      rows,
      companyName: session.company?.name ?? session.company?.companyName ?? '',
      fiscalYear: session.company?.fiscalYearCurrent ?? session.company?.fiscalYear?.bsFY ?? '',
      isBalanced: parsed.isBalanced,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      warnings: parsed.warnings,
      companyId: req.params.companyId,
      uploadedAt: new Date().toISOString(),
      uploadedFileName: req.file.originalname,
      totalClosingDr: parsed.totalClosingDr,
      totalClosingCr: parsed.totalClosingCr,
      difference: parsed.difference,
      detectedFormat: parsed.detectedFormat,
      detectedColumns: parsed.detectedColumns,
      headerRowIndex: parsed.headerRowIndex,
      previousYearData: parsed.previousYearData ?? null,
      leafAccountCount: rows.filter((r) => !r.isGroupRow).length,
      groupRowCount: rows.filter((r) => r.isGroupRow).length,
    };

    const validation = validateTrialBalanceTotals(rows);
    (tb as any).validation = validation;

    // ── Significant imbalance check
    const diff = Math.abs(validation.totalClosingDr - validation.totalClosingCr);
    if (diff > 1000) {
      return res.status(422).json({
        success: false,
        error: `Trial balance has a significant imbalance of NPR ${diff.toLocaleString('en-IN')}. Please check your accounting export before proceeding. Rounding differences up to NPR 1,000 are auto-adjusted.`,
        data: tb, // still return data so user can review
      });
    }

    sessionStore.set(req.params.companyId, { trialBalance: tb as any });
    res.json({ success: true, data: tb });
  } catch (err: any) {
    next(err); // passes to errorMiddleware
  }
});

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
  const mappingProfile = upsertMappingProfile(session.mappingProfile ?? {}, updatedRows);
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB, mappingProfile });
  return res.json(updatedTB);
}));

// PUT /:companyId/mapping/:rowIndex
router.put('/:companyId/mapping/:rowIndex', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded.' });

  const { nfrsCategory } = req.body;
  if (!nfrsCategory) return res.status(400).json({ error: 'nfrsCategory is required.' });

  const updatedRows = [...session.trialBalance.rows];
  const idx = updatedRows.findIndex((r) => String(r.rowIndex) === req.params.rowIndex);
  if (idx === -1) return res.status(404).json({ error: 'Row not found.' });

  updatedRows[idx] = {
    ...updatedRows[idx],
    nfrsCategory,
    confidence: 100,
    matchMethod: 'manual',
    needsReview: false,
    userOverride: true,
  };

  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  (updatedTB as any).validation = validation;
  const mappingProfile = upsertMappingProfile(session.mappingProfile ?? {}, updatedRows);
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB, mappingProfile });
  return res.json({ updated: true, row: updatedRows[idx] });
}));

// POST /:companyId/rematch-ai
router.post('/:companyId/rematch-ai', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI matching is not configured. Set ANTHROPIC_API_KEY on the server.' });
  }

  const lowConfRows = session.trialBalance.rows.filter(
    (r: any) => !r.isGroupRow && !r.userOverride && (r.confidence ?? 0) < 80,
  );
  if (lowConfRows.length === 0) {
    return res.json({ message: 'All accounts already matched with high confidence.', updatedCount: 0, trialBalance: session.trialBalance });
  }

  const aiInput = lowConfRows.map((r: any) => ({
    rowIndex: r.rowIndex,
    rawLabel: r.rawLabel,
    parentGroup: r.parentGroup ?? '',
    closingDr: r.closingDr ?? 0,
    closingCr: r.closingCr ?? 0,
  }));

  const aiResults = await aiMatchUnresolved(aiInput, session.company, apiKey);
  const aiByRowIndex = new Map(aiResults.map((r) => [r.rowIndex, r]));
  let updatedCount = 0;

  const updatedRows = session.trialBalance.rows.map((row: any) => {
    if (row.isGroupRow || row.userOverride) return row;
    const ai = aiByRowIndex.get(row.rowIndex);
    if (!ai) return row;
    updatedCount += 1;
    return {
      ...row,
      nfrsCategory: ai.nfrsCategory as NFRSCategory,
      matchedLabel: null,
      confidence: ai.confidence,
      matchMethod: 'ai' as const,
      needsReview: ai.confidence < 80,
      displayLabel: row.displayLabel ?? row.rawLabel,
    };
  });

  const updatedTB = { ...session.trialBalance, rows: updatedRows };
  const validation = validateTrialBalanceTotals(updatedRows);
  (updatedTB as any).validation = validation;
  sessionStore.set(req.params.companyId, { trialBalance: updatedTB });
  return res.json({ updatedCount, trialBalance: updatedTB });
}));

// GET /:companyId/validation
router.get('/:companyId/validation', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.trialBalance) return res.status(404).json({ error: 'No trial balance loaded.' });
  const validation = validateTrialBalanceTotals(session.trialBalance.rows);
  return res.json(validation);
}));

export default router;
