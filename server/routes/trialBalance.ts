// ===== server/routes/trialBalance.ts =====
import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
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
import { generateTrialBalanceTemplate } from '../services/tbTemplateWriter.js';
import { convertRoughTrialBalance } from '../services/aiTbConverter.js';
import { convertTrialBalanceLocally, heuristicFallbackClassify } from '../services/localTbConverter.js';
import { validateStandardTemplate, type TbDiagnosticIssue } from '../services/tbStandardValidator.js';
import { writeNormalizedTrialBalance } from '../services/normalizedTbWriter.js';
import { finalizeRawTBRows } from '../services/tbHierarchy.js';
import { mappingProfileKey } from '../services/mappingProfile.js';
import type { RawTBParseResult, RawTBRow } from '../../src/types/trialBalance.js';

const router = Router();

function ensureSession(req: Request): { companyId: string; session: NonNullable<ReturnType<typeof sessionStore.get>> } | null {
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
  if (!session) return null;
  return { companyId: req.params.companyId, session };
}

function countMappingProfileHits(rows: RawTBRow[], profile?: Record<string, unknown> | null): number {
  if (!profile || Object.keys(profile).length === 0) return 0;
  return rows.filter(
    (r) => !r.isGroupRow && profile[mappingProfileKey(r.rawLabel, r.parentGroup)],
  ).length;
}

async function classifyAndBuildTB(
  companyId: string,
  parsed: RawTBParseResult,
  options: {
    useAI?: boolean;
    uploadedFileName?: string;
    importMode?: 'manual' | 'ai';
    apiKey?: string;
  },
): Promise<ParsedTrialBalance & Record<string, unknown>> {
  const session = sessionStore.get(companyId);
  if (!session) throw Object.assign(new Error('Company session not found.'), { status: 404 });

  const leafRows = parsed.rows.filter((r) => !r.isGroupRow);
  const profileHitCount = countMappingProfileHits(parsed.rows, session.mappingProfile);

  let rows = classifyAll(parsed.rows);
  if (parsed.detectedFormat === 'local_intelligent') {
    rows = heuristicFallbackClassify(rows);
  }
  rows = applyMappingProfile(rows, session.mappingProfile);

  if (options.useAI && options.apiKey) {
    try {
      rows = await classifyWithAI(rows, options.apiKey);
    } catch (aiErr) {
      console.warn('[trialBalance] AI matching failed:', aiErr);
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
    companyId,
    uploadedAt: new Date().toISOString(),
    uploadedFileName: options.uploadedFileName,
    totalClosingDr: parsed.totalClosingDr,
    totalClosingCr: parsed.totalClosingCr,
    difference: parsed.difference,
    detectedFormat: parsed.detectedFormat,
    detectedColumns: parsed.detectedColumns,
    headerRowIndex: parsed.headerRowIndex,
    previousYearData: parsed.previousYearData ?? null,
    leafAccountCount: leafRows.length,
    groupRowCount: parsed.rows.filter((r) => r.isGroupRow).length,
    mappingProfileAppliedCount: profileHitCount,
    mappingProfileTotalAccounts: leafRows.length,
    importMode: options.importMode,
  };

  const validation = validateTrialBalanceTotals(rows);
  tb.validation = validation;
  return tb;
}

router.get('/template/download', asyncHandler(async (req: Request, res: Response) => {
  const buffer = await generateTrialBalanceTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="NFRS_Trial_Balance_Template.xlsx"');
  return res.send(buffer);
}));

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
    const ext = (req.file.originalname ?? '').split('.').pop()?.toLowerCase();
    const documentExts = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);
    const spreadsheetExts = new Set(['xlsx', 'xls', 'csv']);
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    const isDocument = documentExts.has(ext ?? '');
    const isSpreadsheet = spreadsheetExts.has(ext ?? '') || allowedMimes.includes(req.file.mimetype);

    if (!isDocument && !isSpreadsheet) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported file format. Upload Excel/CSV exports, or PDF/image scans for AI OCR import.',
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

    let parsed;
    let standardFormatWarnings: import('../services/tbStandardValidator.js').TbDiagnosticIssue[] | undefined;

    if (isDocument) {
      const imageExts = new Set(['png', 'jpg', 'jpeg', 'webp']);
      if (ext === 'pdf') {
        parsed = await convertTrialBalanceLocally(req.file.buffer, req.file.originalname);
      } else if (imageExts.has(ext ?? '')) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(503).json({
            success: false,
            error: 'Image-based scans require AI OCR (not configured on this server). Please upload a PDF with a text layer instead, or export to Excel/CSV — both are supported without any API key.',
          });
        }
        parsed = await convertRoughTrialBalance(req.file.buffer, req.file.originalname, apiKey);
      } else {
        parsed = await convertTrialBalanceLocally(req.file.buffer, req.file.originalname);
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      const validationWorkbook = new ExcelJS.Workbook();
      await validationWorkbook.xlsx.load(req.file.buffer);
      const validationResult = validateStandardTemplate(validationWorkbook);
      if (!validationResult.isStandardFormat) {
        return res.status(422).json({
          success: false,
          code: 'NOT_STANDARD_FORMAT',
          error: 'This file does not match the standard trial balance template.',
          diagnostics: validationResult,
        });
      }
      if (validationResult.issues.some((i) => i.severity === 'warning')) {
        standardFormatWarnings = validationResult.issues.filter((i) => i.severity === 'warning');
      }
      parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
    } else {
      parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
    }

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

    const tb = await classifyAndBuildTB(req.params.companyId, parsed, {
      useAI: (isDocument && ext !== 'pdf') || req.query.useAI === 'true',
      uploadedFileName: req.file.originalname,
      importMode: isDocument ? 'ai' : 'manual',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (standardFormatWarnings?.length) {
      (tb as Record<string, unknown>).standardFormatWarnings = standardFormatWarnings;
    }

    const validation = tb.validation as ReturnType<typeof validateTrialBalanceTotals>;

    // ── Significant imbalance check
    const diff = Math.abs(validation.totalClosingDr - validation.totalClosingCr);
    if (diff > 1000) {
      return res.status(422).json({
        success: false,
        error: `Trial balance has a significant imbalance of NPR ${diff.toLocaleString('en-IN')}. Please check your accounting export before proceeding. Rounding differences up to NPR 1,000 are auto-adjusted.`,
        data: tb,
      });
    }

    sessionStore.set(req.params.companyId, { trialBalance: tb as any });
    res.json({ success: true, data: tb });
  } catch (err: any) {
    next(err); // passes to errorMiddleware
  }
});

router.post('/:companyId/ai-convert', tbUploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Please select a file and try again.' });
    }

    let session = sessionStore.get(req.params.companyId);
    if (!session) {
      const companyRaw = req.body?.company;
      if (typeof companyRaw === 'string') {
        try {
          const company = JSON.parse(companyRaw) as CompanyProfile;
          sessionStore.set(req.params.companyId, { company: { ...company, id: req.params.companyId } });
          session = sessionStore.get(req.params.companyId);
        } catch { /* ignore malformed company snapshot */ }
      }
    }
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Company session not found on server. Save company details first, then try again.',
        code: 'SESSION_NOT_FOUND',
      });
    }

    const ext = (req.file.originalname ?? '').split('.').pop()?.toLowerCase() ?? '';
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'webp']);
    const localExts = new Set(['xlsx', 'xls', 'csv', 'pdf']);
    let parsed: RawTBParseResult;

    if (localExts.has(ext)) {
      parsed = await convertTrialBalanceLocally(req.file.buffer, req.file.originalname);
    } else if (imageExts.has(ext)) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(415).json({
          success: false,
          error: 'Image-based scans require AI OCR (not configured on this server). Supported formats: .xlsx, .xls, .csv, .pdf.',
        });
      }
      parsed = await convertRoughTrialBalance(req.file.buffer, req.file.originalname, apiKey);
    } else {
      return res.status(415).json({
        success: false,
        error: 'Unsupported format. Supported formats: .xlsx, .xls, .csv, .pdf (and images when AI OCR is configured).',
      });
    }

    const tb = await classifyAndBuildTB(req.params.companyId, parsed, {
      useAI: imageExts.has(ext),
      uploadedFileName: req.file.originalname,
      importMode: 'ai',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    sessionStore.set(req.params.companyId, { trialBalance: tb as any });
    res.json({ success: true, data: tb });
  } catch (err: any) {
    next(err);
  }
});

// POST /:companyId/parse-preview — parse only, no classification (normalized TB checkpoint)
router.post('/:companyId/parse-preview', tbUploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const ensured = ensureSession(req);
    if (!ensured) {
      return res.status(404).json({
        success: false,
        error: 'Company session not found on server. Save company details first.',
        code: 'SESSION_NOT_FOUND',
      });
    }

    const mode = req.query.mode === 'ai' ? 'ai' : 'manual';
    let parsed: RawTBParseResult;

    let standardFormatWarnings: TbDiagnosticIssue[] | undefined;

    if (mode === 'ai') {
      const ext = (req.file.originalname ?? '').split('.').pop()?.toLowerCase() ?? '';
      const imageExts = new Set(['png', 'jpg', 'jpeg', 'webp']);
      if (imageExts.has(ext)) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(415).json({
            success: false,
            error: 'Image-based scans require AI OCR (not configured on this server). Please upload a PDF with a text layer instead, or export to Excel/CSV.',
          });
        }
        parsed = await convertRoughTrialBalance(req.file.buffer, req.file.originalname, apiKey);
      } else {
        parsed = await convertTrialBalanceLocally(req.file.buffer, req.file.originalname);
      }
    } else {
      const ext = (req.file.originalname ?? '').split('.').pop()?.toLowerCase() ?? '';
      if (ext === 'xlsx' || ext === 'xls') {
        const validationWorkbook = new ExcelJS.Workbook();
        await validationWorkbook.xlsx.load(req.file.buffer);
        const validationResult = validateStandardTemplate(validationWorkbook);
        if (!validationResult.isStandardFormat) {
          return res.status(422).json({
            success: false,
            code: 'NOT_STANDARD_FORMAT',
            error: 'This file does not match the standard trial balance template.',
            diagnostics: validationResult,
          });
        }
        if (validationResult.issues.some((i) => i.severity === 'warning')) {
          standardFormatWarnings = validationResult.issues.filter((i) => i.severity === 'warning');
        }
      }
      parsed = await parseTrialBalance(req.file.buffer, req.file.originalname);
      if (!parsed.rows?.length) {
        return res.status(422).json({ success: false, error: 'No data rows found in the uploaded file.' });
      }
    }

    const profileHitCount = countMappingProfileHits(parsed.rows, ensured.session.mappingProfile);
    const preview = {
      ...parsed,
      companyId: req.params.companyId,
      uploadedAt: new Date().toISOString(),
      uploadedFileName: req.file.originalname,
      importMode: mode,
      mappingProfileAppliedCount: profileHitCount,
      mappingProfileTotalAccounts: parsed.rows.filter((r) => !r.isGroupRow).length,
      ...(standardFormatWarnings?.length ? { standardFormatWarnings } : {}),
    };

    sessionStore.set(req.params.companyId, { rawTrialBalance: preview });
    res.json({ success: true, data: preview });
  } catch (err: any) {
    next(err);
  }
});

// POST /:companyId/confirm-normalized — accept edited raw rows, then classify
router.post('/:companyId/confirm-normalized', asyncHandler(async (req: Request, res: Response) => {
  const ensured = ensureSession(req);
  if (!ensured) {
    return res.status(404).json({ success: false, error: 'Company session not found.', code: 'SESSION_NOT_FOUND' });
  }

  const inputRows: RawTBRow[] = req.body.rows ?? [];
  if (!inputRows.length) {
    return res.status(400).json({ success: false, error: 'No trial balance rows provided.' });
  }

  const stored = ensured.session.rawTrialBalance as Record<string, unknown> | undefined;
  const importMode = (stored?.importMode as 'manual' | 'ai') ?? 'manual';
  const useAI = req.body.useAI === true || importMode === 'ai';

  const finalized = finalizeRawTBRows(inputRows);
  const parsed: RawTBParseResult = {
    rows: finalized.rows,
    ...finalized.totals,
    warnings: [
      ...((stored?.warnings as string[]) ?? []),
      ...finalized.warnings,
    ],
    detectedColumns: (stored?.detectedColumns as Record<string, number>) ?? {},
    headerRowIndex: (stored?.headerRowIndex as number) ?? 0,
    detectedFormat: (stored?.detectedFormat as RawTBParseResult['detectedFormat']) ?? 'full',
    previousYearData: (stored?.previousYearData as RawTBRow[] | null) ?? null,
  };

  const tb = await classifyAndBuildTB(req.params.companyId, parsed, {
    useAI,
    uploadedFileName: stored?.uploadedFileName as string | undefined,
    importMode,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const storedStandardWarnings = stored?.standardFormatWarnings as TbDiagnosticIssue[] | undefined;
  if (storedStandardWarnings?.length) {
    (tb as Record<string, unknown>).standardFormatWarnings = storedStandardWarnings;
  }

  const validation = tb.validation as ReturnType<typeof validateTrialBalanceTotals>;
  const diff = Math.abs(validation.totalClosingDr - validation.totalClosingCr);
  if (importMode === 'manual' && diff > 1000) {
    return res.status(422).json({
      success: false,
      error: `Trial balance has a significant imbalance of NPR ${diff.toLocaleString('en-IN')}.`,
      data: tb,
    });
  }

  sessionStore.set(req.params.companyId, { trialBalance: tb as any, rawTrialBalance: undefined });
  res.json({ success: true, data: tb });
}));

// POST /:companyId/normalized/save — persist edited preview rows without classifying
router.post('/:companyId/normalized/save', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.rawTrialBalance) {
    return res.status(404).json({ error: 'No normalized preview in session.' });
  }

  const inputRows: RawTBRow[] = req.body.rows ?? [];
  if (!inputRows.length) {
    return res.status(400).json({ error: 'No rows provided.' });
  }

  const finalized = finalizeRawTBRows(inputRows);
  const existing = session.rawTrialBalance as Record<string, unknown>;
  const updated = {
    ...existing,
    rows: finalized.rows,
    ...finalized.totals,
    warnings: [...((existing.warnings as string[]) ?? []), ...finalized.warnings],
  };

  sessionStore.set(req.params.companyId, { rawTrialBalance: updated });
  res.json({ success: true, data: updated });
}));

// GET /:companyId/normalized/export — download normalized TB as Excel
router.get('/:companyId/normalized/export', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  const raw = session?.rawTrialBalance as Record<string, unknown> | undefined;
  const rows = (raw?.rows ?? session?.trialBalance?.rows) as RawTBRow[] | undefined;

  if (!rows?.length) {
    return res.status(404).json({ error: 'No normalized trial balance available to export.' });
  }

  const company = session?.company as CompanyProfile | undefined;
  const buffer = await writeNormalizedTrialBalance(rows, {
    companyName: company?.companyName,
    fiscalYear: company?.fiscalYear?.bsFY,
    filename: raw?.uploadedFileName as string | undefined,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Normalized_Trial_Balance.xlsx"');
  return res.send(buffer);
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
