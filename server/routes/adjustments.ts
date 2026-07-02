// ===== server/routes/adjustments.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sessionStore } from '../store/sessionStore';
import { calculateDepreciationSummary, calculateTaxDepreciation } from '../services/depreciationEngine';
import type { AssetItem, ProvisionEntry, InventoryAdjustment, InvestmentAdjustment, YearEndAdjustments } from '../../src/types';

const router = Router();

const emptyAdj = (companyId: string, fiscalYear: string): YearEndAdjustments => ({
  companyId, fiscalYear,
  assets: [], depreciationResults: [], depreciationSummary: [], taxDepreciationPools: [],
  inventoryAdjustments: [], investmentAdjustments: [], provisions: [], journalEntries: [],
  totalDepreciationExpense: 0, totalInventoryImpairment: 0, totalInvestmentFVAdjustment: 0,
  totalProvisions: 0, gainOnDisposals: 0, lossOnDisposals: 0,
});

// POST /:companyId/assets
router.post('/:companyId/assets', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });
  const assets: AssetItem[] = req.body.assets ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? '');
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, assets } });
  return res.json({ message: 'Asset register saved.', count: assets.length });
}));

// POST /:companyId/calculate-depreciation
router.post('/:companyId/calculate-depreciation', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.company) return res.status(404).json({ error: 'Company not found.' });

  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company.fiscalYear ?? '');
  const assetCategories = session.company.accountingPolicies?.assetCategories ?? [];
  const fiscalYear = session.company.fiscalYear ?? '2081/82';

  const { results, summary } = calculateDepreciationSummary(adj.assets, assetCategories, fiscalYear);
  const totalDepreciation = results.reduce((s, r) => s + r.depnForYear, 0);
  const gainOnDisposals = results.filter((r) => (r.gainLossOnDisposal ?? 0) > 0).reduce((s, r) => s + (r.gainLossOnDisposal ?? 0), 0);
  const lossOnDisposals = results.filter((r) => (r.gainLossOnDisposal ?? 0) < 0).reduce((s, r) => s + Math.abs(r.gainLossOnDisposal ?? 0), 0);

  const openingPoolBases: Record<string, number> = req.body.openingPoolBases ?? {};
  const taxPools = calculateTaxDepreciation(adj.assets, assetCategories, openingPoolBases);

  const updatedAdj: YearEndAdjustments = {
    ...adj, depreciationResults: results, depreciationSummary: summary,
    taxDepreciationPools: taxPools, totalDepreciationExpense: totalDepreciation,
    gainOnDisposals, lossOnDisposals,
  };
  sessionStore.set(req.params.companyId, { adjustments: updatedAdj });
  return res.json({ summary, taxPools, totalDepreciationExpense: totalDepreciation, gainOnDisposals, lossOnDisposals });
}));

// POST /:companyId/provisions
router.post('/:companyId/provisions', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });
  const provisions: ProvisionEntry[] = req.body.provisions ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? '');
  const totalProvisions = provisions.reduce((s, p) => s + p.additionForYear, 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, provisions, totalProvisions } });
  return res.json({ message: 'Provisions saved.', count: provisions.length, total: totalProvisions });
}));

// POST /:companyId/inventory
router.post('/:companyId/inventory', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });
  const items: InventoryAdjustment[] = req.body.items ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? '');
  const totalInventoryImpairment = items.reduce((s, i) => s + i.impairmentAmount, 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, inventoryAdjustments: items, totalInventoryImpairment } });
  return res.json({ message: 'Inventory adjustments saved.', totalImpairment: totalInventoryImpairment });
}));

// POST /:companyId/investments
router.post('/:companyId/investments', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });
  const items: InvestmentAdjustment[] = req.body.items ?? [];
  const adj = session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? '');
  const totalFV = items.reduce((s, i) => s + (i.fairValueGainLoss ?? 0), 0);
  sessionStore.set(req.params.companyId, { adjustments: { ...adj, investmentAdjustments: items, totalInvestmentFVAdjustment: totalFV } });
  return res.json({ message: 'Investment adjustments saved.', totalFVAdjustment: totalFV });
}));

// GET /:companyId
router.get('/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session) return res.status(404).json({ error: 'Company not found.' });
  return res.json(session.adjustments ?? emptyAdj(req.params.companyId, session.company?.fiscalYear ?? ''));
}));

// POST /:companyId/calculate-all
router.post('/:companyId/calculate-all', asyncHandler(async (req: Request, res: Response) => {
  const session = sessionStore.get(req.params.companyId);
  if (!session?.adjustments) return res.status(400).json({ error: 'No adjustments data found. Add assets, provisions, and inventory first.' });
  const adj = session.adjustments;
  const journalTotal = adj.journalEntries.reduce((s: number, j: any) => s + j.amount, 0);
  return res.json({ adjustments: adj, journalEntryCount: adj.journalEntries.length, totalDebitCredit: journalTotal });
}));

export default router;
