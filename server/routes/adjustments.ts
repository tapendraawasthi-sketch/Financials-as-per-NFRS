// ===== server/routes/adjustments.ts =====
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  subledgerStore,
  type DebtorEntry,
  type CreditorEntry,
  type BankAccountEntry,
  type RelatedPartyEntry,
} from '../store/subledgerStore.js';
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

// ─────────────────────────────────────────────────────────────────────────────
// SUBLEDGER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/adjustments/subledger/:companyId  — retrieve all subledger data
router.get('/subledger/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: 'Company session not found.' });

  const data = subledgerStore.get(companyId);
  return res.json(data);
}));

// POST /api/adjustments/subledger/debtors  — upsert all debtor entries
router.post('/subledger/debtors', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, debtors } = req.body as {
    companyId: string;
    debtors:   DebtorEntry[];
  };

  if (!companyId) {
    return res.status(400).json({ error: 'companyId is required.' });
  }
  const session = sessionStore.get(companyId);
  if (!session) {
    return res.status(404).json({ error: 'Company session not found.' });
  }
  if (!Array.isArray(debtors)) {
    return res.status(400).json({ error: 'debtors must be an array.' });
  }

  const updated = subledgerStore.upsertDebtors(companyId, debtors);

  // Cross-validate against TB trade receivables total if available
  const tbRows = session.trialBalance?.rows ?? [];
  const tbDebtorTotal = tbRows
    .filter((r: any) => r.nfrsCategory === 'trade_receivables' && !r.isGroupRow)
    .reduce((s: number, r: any) => s + (r.closingDr ?? 0), 0);

  const validation = subledgerStore.validate(companyId, tbDebtorTotal, 0);

  return res.json({
    message:     'Debtor subledger saved.',
    count:        updated.debtors.length,
    debtorTotal:  updated.debtors.reduce((s, d) => s + d.debitBalance, 0),
    tbDebtorTotal,
    validation,
  });
}));

// POST /api/adjustments/subledger/creditors  — upsert all creditor entries
router.post('/subledger/creditors', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, creditors } = req.body as {
    companyId: string;
    creditors: CreditorEntry[];
  };

  if (!companyId) return res.status(400).json({ error: 'companyId is required.' });
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: 'Company session not found.' });
  if (!Array.isArray(creditors)) return res.status(400).json({ error: 'creditors must be an array.' });

  const updated = subledgerStore.upsertCreditors(companyId, creditors);

  const tbRows = session.trialBalance?.rows ?? [];
  const tbCreditorTotal = tbRows
    .filter((r: any) => r.nfrsCategory === 'trade_payables_creditors' && !r.isGroupRow)
    .reduce((s: number, r: any) => s + (r.closingCr ?? 0), 0);

  const validation = subledgerStore.validate(companyId, 0, tbCreditorTotal);

  return res.json({
    message:       'Creditor subledger saved.',
    count:          updated.creditors.length,
    creditorTotal:  updated.creditors.reduce((s, c) => s + c.creditBalance, 0),
    tbCreditorTotal,
    validation,
  });
}));

// POST /api/adjustments/subledger/bank-accounts  — upsert all bank account entries
router.post('/subledger/bank-accounts', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, bankAccounts } = req.body as {
    companyId:    string;
    bankAccounts: BankAccountEntry[];
  };

  if (!companyId) return res.status(400).json({ error: 'companyId is required.' });
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: 'Company session not found.' });
  if (!Array.isArray(bankAccounts)) {
    return res.status(400).json({ error: 'bankAccounts must be an array.' });
  }

  // Validate: each entry must have a bankName
  const invalid = bankAccounts.filter((b) => !b.bankName?.trim());
  if (invalid.length > 0) {
    return res.status(400).json({
      error: `${invalid.length} bank account row(s) are missing a bank name.`,
    });
  }

  const updated = subledgerStore.upsertBankAccounts(companyId, bankAccounts);
  const assetTotal     = updated.bankAccounts.filter((b) => b.balance >= 0).reduce((s, b) => s + b.balance, 0);
  const liabilityTotal = updated.bankAccounts.filter((b) => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);

  return res.json({
    message:       'Bank accounts saved.',
    count:          updated.bankAccounts.length,
    assetTotal,
    liabilityTotal,
  });
}));

// POST /api/adjustments/subledger/related-parties  — upsert all related party entries
router.post('/subledger/related-parties', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, relatedParties } = req.body as {
    companyId:     string;
    relatedParties:RelatedPartyEntry[];
  };

  if (!companyId) return res.status(400).json({ error: 'companyId is required.' });
  const session = sessionStore.get(companyId);
  if (!session) return res.status(404).json({ error: 'Company session not found.' });
  if (!Array.isArray(relatedParties)) {
    return res.status(400).json({ error: 'relatedParties must be an array.' });
  }

  const updated = subledgerStore.upsertRelatedParties(companyId, relatedParties);

  return res.json({
    message: 'Related parties saved.',
    count:   updated.relatedParties.length,
  });
}));

export default router;
