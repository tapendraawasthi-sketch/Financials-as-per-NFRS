import { randomUUID } from 'crypto';
import {
  deletePersistedJson,
  listPersistedIds,
  persistenceEnabled,
  readPersistedJson,
  reviveDates,
  writePersistedJson,
} from './persistence.js';

export interface SessionData {
  createdAt: Date;
  lastAccessAt: Date;
  company?: unknown;
  trialBalance?: unknown;
  rawTrialBalance?: unknown;
  adjustments?: unknown;
  policies?: unknown;
  statements?: unknown;
  notes?: unknown;
  financials?: unknown;
  mappingProfile?: Record<string, { nfrsCategory: string; matchedLabel?: string }>;
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

class SessionStore {
  private store = new Map<string, SessionData>();

  constructor() {
    this.loadPersistedSessions();
  }

  private loadPersistedSessions(): void {
    if (!persistenceEnabled()) return;
    for (const id of listPersistedIds('sessions')) {
      const raw = readPersistedJson<SessionData>('sessions', id);
      if (!raw) continue;
      const session = reviveDates(raw, ['createdAt', 'lastAccessAt']);
      if (Date.now() - session.lastAccessAt.getTime() > SESSION_TTL_MS) {
        deletePersistedJson('sessions', id);
        continue;
      }
      this.store.set(id, session);
    }
  }

  private persist(id: string, session: SessionData): void {
    writePersistedJson('sessions', id, session);
  }

  generateSessionId(): string {
    return randomUUID();
  }

  get(id: string): SessionData | undefined {
    const session = this.store.get(id);
    if (!session) return undefined;
    if (Date.now() - session.lastAccessAt.getTime() > SESSION_TTL_MS) {
      this.store.delete(id);
      deletePersistedJson('sessions', id);
      return undefined;
    }
    session.lastAccessAt = new Date();
    return session;
  }

  set(id: string, data: Partial<SessionData>): SessionData {
    const existing = this.store.get(id);
    const session: SessionData = {
      createdAt: existing?.createdAt ?? new Date(),
      lastAccessAt: new Date(),
      ...existing,
      ...data,
    };
    this.store.set(id, session);
    this.persist(id, session);
    return session;
  }

  updateSession(id: string, updater: (current: SessionData) => Partial<SessionData>): SessionData | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    return this.set(id, updater(current));
  }

  clearSession(id: string): boolean {
    deletePersistedJson('sessions', id);
    return this.store.delete(id);
  }

  delete(id: string): boolean {
    return this.clearSession(id);
  }

  has(id: string): boolean {
    return this.get(id) !== undefined;
  }

  /** Removes sessions older than maxAgeHours. Returns count removed. */
  cleanup(maxAgeHours: number = 4): number {
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let removed = 0;
    for (const [id, session] of this.store.entries()) {
      if (session.lastAccessAt.getTime() < cutoff) {
        this.store.delete(id);
        deletePersistedJson('sessions', id);
        removed++;
      }
    }
    return removed;
  }

  size(): number { return this.store.size; }

  all(): Map<string, SessionData> { return this.store; }
}

export const sessionStore = new SessionStore();
