// ===== server/routes/company.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import crypto from 'crypto';
import { validateCompanyProfile, validateAccountingPolicies } from '../../src/utils/validation';
import { getFiscalYearOptions } from '../../src/data/fiscalYears';
import type { CompanyProfile } from '../../src/types';

const router = Router();

// POST / — Create company profile
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Partial<CompanyProfile>;
  const validation = validateCompanyProfile(body);
  if (!validation.isValid) {
    return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const company: CompanyProfile = {
    ...body,
    id,
    createdAt: now,
    updatedAt: now,
  } as CompanyProfile;

  sessionStore.set(id, { company });

  return res.status(201).json(company);
}));

// GET /:companyId — Get company profile
router.get('/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.company) return res.status(404).json({ error: 'Company not found.' });
  return res.json(session.company);
}));

// PUT /:companyId — Update company profile
router.put('/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });

  const body = req.body as Partial<CompanyProfile>;
  const validation = validateCompanyProfile(body);
  if (!validation.isValid) {
    return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
  }

  const updated = sessionStore.set(req.params.companyId, {
    company: { ...session.company, ...body, updatedAt: new Date().toISOString() } as CompanyProfile,
  });
  return res.json(updated?.company);
}));

// POST /:companyId/policies — Save accounting policies
router.post('/:companyId/policies', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });

  const validation = validateAccountingPolicies(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
  }

  const updatedCompany = { ...session.company!, accountingPolicies: req.body };
  sessionStore.set(req.params.companyId, { company: updatedCompany as CompanyProfile });
  return res.json({ message: 'Accounting policies saved.', policies: req.body });
}));

// PUT /:companyId/previous-year — Update previous year balances
router.put('/:companyId/previous-year', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });

  const updatedCompany = { ...session.company!, previousYearData: req.body, updatedAt: new Date() };
  sessionStore.set(req.params.companyId, { company: updatedCompany as CompanyProfile });
  return res.json(updatedCompany);
}));

// GET /fiscal-years/options
router.get('/fiscal-years/options', asyncHandler(async (_req: Request, res: Response) => {
  return res.json(getFiscalYearOptions());
}));

export default router;
