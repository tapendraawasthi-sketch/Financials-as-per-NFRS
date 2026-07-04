// ===== server/store/subledgerStore.ts =====
// In-memory store for subledger-level detail:
//   - Individual debtor/creditor party balances
//   - Bank account details (assets and liabilities)
//   - Related party transactions and balances
// Keyed by sessionId (same as companyId in sessionStore).

import crypto from 'crypto';
import {
  deletePersistedJson,
  listPersistedIds,
  persistenceEnabled,
  readPersistedJson,
  reviveDates,
  writePersistedJson,
} from './persistence.js';
import {
  validateSubledgerTotals,
  type SubledgerValidation,
} from '../../src/utils/subledgerValidation.js';

export type { SubledgerValidation } from '../../src/utils/subledgerValidation.js';

export interface DebtorEntry {
  id: string;
  partyName: string;
  debitBalance: number;         // amount owed by customer (asset Dr)
  creditBalance: number;        // advance received from customer (liability Cr)
  isRelatedParty: boolean;
  relationshipType?: string;    // only if isRelatedParty
  agingDays?: number;           // days outstanding (for aging analysis in Note 3.3)
  provisionRequired?: number;   // specific provision if amount is doubtful
}

export interface CreditorEntry {
  id: string;
  partyName: string;
  creditBalance: number;        // amount owed to supplier (liability Cr)
  debitBalance: number;         // advance paid to supplier (asset Dr)
  isRelatedParty: boolean;
  relationshipType?: string;
}

export interface BankAccountEntry {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType:
    | 'current'
    | 'savings'
    | 'call'
    | 'fixed_deposit'
    | 'loan'
    | 'overdraft'
    | 'cash_credit'
    | 'working_capital';
  balance: number;                     // positive = asset (bank balance), negative = liability (loan/OD)
  interestRate?: number;               // annual interest rate %
  maturityDate?: string;               // ISO date string for FDRs and term loans
  securedBy?: string;                  // collateral description
  currentPortionOfLoan?: number;       // for term loans: amount due within 12 months
}

export interface RelatedPartyTransaction {
  id: string;
  description: string;
  amount: number;
  direction: 'receivable' | 'payable';
}

export interface RelatedPartyEntry {
  id: string;
  partyName: string;
  relationshipType:
    | 'director'
    | 'shareholder_above_5pct'
    | 'key_management'
    | 'group_company'
    | 'associate'
    | 'other';
  transactionsCurrentYear: RelatedPartyTransaction[];
  outstandingBalance: number;
  balanceType: 'receivable' | 'payable';
  isArmLength: boolean;
}

export interface SubledgerData {
  sessionId: string;
  debtors: DebtorEntry[];
  creditors: CreditorEntry[];
  bankAccounts: BankAccountEntry[];
  relatedParties: RelatedPartyEntry[];
  lastUpdatedAt: Date;
}

// ─── Interfaces ────────────────────────────────────────────────────────────────

const store = new Map<string, SubledgerData>();

function persistSubledger(data: SubledgerData): void {
  writePersistedJson('subledgers', data.sessionId, data);
}

function loadPersistedSubledgers(): void {
  if (!persistenceEnabled()) return;
  for (const id of listPersistedIds('subledgers')) {
    const raw = readPersistedJson<SubledgerData>('subledgers', id);
    if (!raw) continue;
    const data = reviveDates(raw, ['lastUpdatedAt']);
    store.set(id, data);
  }
}

loadPersistedSubledgers();

function emptySubledger(sessionId: string): SubledgerData {
  return {
    sessionId,
    debtors: [],
    creditors: [],
    bankAccounts: [],
    relatedParties: [],
    lastUpdatedAt: new Date(),
  };
}

// ─── CRUD functions ────────────────────────────────────────────────────────────

/** Get subledger data for a session. Returns an empty structure if not yet created. */
export function getSubledger(sessionId: string): SubledgerData {
  return store.get(sessionId) ?? emptySubledger(sessionId);
}

/** Replace all debtor entries for a session. */
export function upsertDebtors(sessionId: string, debtors: DebtorEntry[]): SubledgerData {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  // Assign IDs to any entry that doesn't have one
  const normalised = debtors.map((d) => ({
    ...d,
    id: d.id || crypto.randomUUID(),
    debitBalance:  Math.max(0, d.debitBalance  ?? 0),
    creditBalance: Math.max(0, d.creditBalance ?? 0),
  }));
  const updated: SubledgerData = {
    ...existing,
    debtors: normalised,
    lastUpdatedAt: new Date(),
  };
  store.set(sessionId, updated);
  persistSubledger(updated);
  return updated;
}

/** Replace all creditor entries for a session. */
export function upsertCreditors(sessionId: string, creditors: CreditorEntry[]): SubledgerData {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = creditors.map((c) => ({
    ...c,
    id: c.id || crypto.randomUUID(),
    creditBalance: Math.max(0, c.creditBalance ?? 0),
    debitBalance:  Math.max(0, c.debitBalance  ?? 0),
  }));
  const updated: SubledgerData = {
    ...existing,
    creditors: normalised,
    lastUpdatedAt: new Date(),
  };
  store.set(sessionId, updated);
  persistSubledger(updated);
  return updated;
}

/** Replace all bank account entries for a session. */
export function upsertBankAccounts(
  sessionId: string,
  bankAccounts: BankAccountEntry[],
): SubledgerData {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = bankAccounts.map((b) => ({
    ...b,
    id: b.id || crypto.randomUUID(),
  }));
  const updated: SubledgerData = {
    ...existing,
    bankAccounts: normalised,
    lastUpdatedAt: new Date(),
  };
  store.set(sessionId, updated);
  persistSubledger(updated);
  return updated;
}

/** Replace all related party entries for a session. */
export function upsertRelatedParties(
  sessionId: string,
  relatedParties: RelatedPartyEntry[],
): SubledgerData {
  const existing = store.get(sessionId) ?? emptySubledger(sessionId);
  const normalised = relatedParties.map((rp) => ({
    ...rp,
    id: rp.id || crypto.randomUUID(),
    transactionsCurrentYear: (rp.transactionsCurrentYear ?? []).map((t) => ({
      ...t,
      id: t.id || crypto.randomUUID(),
    })),
  }));
  const updated: SubledgerData = {
    ...existing,
    relatedParties: normalised,
    lastUpdatedAt: new Date(),
  };
  store.set(sessionId, updated);
  persistSubledger(updated);
  return updated;
}

/** Delete subledger data for a session. */
export function deleteSubledger(sessionId: string): boolean {
  deletePersistedJson('subledgers', sessionId);
  return store.delete(sessionId);
}

/** Compute totals and cross-validate against trial balance totals. */
export function validateSubledger(
  sessionId: string,
  tbDebtorTotal: number,
  tbCreditorTotal: number,
): SubledgerValidation {
  const data = getSubledger(sessionId);
  return validateSubledgerTotals(data, tbDebtorTotal, tbCreditorTotal);
}

/** Cleanup stale entries (mirrors sessionStore cleanup pattern). */
export function cleanupSubledger(maxAgeHours: number): number {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, data] of store.entries()) {
    if (data.lastUpdatedAt.getTime() < cutoff) {
      store.delete(id);
      removed++;
    }
  }
  return removed;
}

export const subledgerStore = {
  get:                getSubledger,
  upsertDebtors,
  upsertCreditors,
  upsertBankAccounts,
  upsertRelatedParties,
  delete:             deleteSubledger,
  validate:           validateSubledger,
  cleanup:            cleanupSubledger,
  size: () =>         store.size,
};
