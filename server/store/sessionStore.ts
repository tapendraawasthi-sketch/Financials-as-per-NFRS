// ===== server/store/sessionStore.ts =====
// In-memory server-side session store for Phase 1 (single-user).
// In Phase 2 this would be replaced with a PostgreSQL/Redis backend.

import { randomUUID } from 'crypto';
import type {
  CompanyProfile,
  ParsedTrialBalance,
  YearEndAdjustments,
} from '../../src/types';

// ---------------------------------------------------------------------------
// SessionData
// ---------------------------------------------------------------------------
export interface SessionData {
  sessionId: string;
  company: CompanyProfile | null;
  trialBalance: ParsedTrialBalance | null;
  adjustments: YearEndAdjustments | null;
  uploadedFileBuffer?: Buffer;
  uploadedFileName?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// SessionStore
// ---------------------------------------------------------------------------
export class SessionStore {
  private readonly store: Map<string, SessionData>;

  constructor() {
    this.store = new Map();
  }

  /** Creates and persists a new session. */
  create(companyId: string): SessionData {
    const now = new Date();
    const session: SessionData = {
      sessionId: companyId,
      company: null,
      trialBalance: null,
      adjustments: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(companyId, session);
    return session;
  }

  /** Retrieves a session by ID, or undefined if not found. */
  get(sessionId: string): SessionData | undefined {
    return this.store.get(sessionId);
  }

  /**
   * Merges partial updates into an existing session and stamps updatedAt.
   * Returns the updated session, or undefined if the session does not exist.
   */
  update(
    sessionId: string,
    updates: Partial<SessionData>,
  ): SessionData | undefined {
    const existing = this.store.get(sessionId);
    if (!existing) return undefined;

    const updated: SessionData = {
      ...existing,
      ...updates,
      sessionId,         // immutable — never overwrite the key
      createdAt: existing.createdAt, // immutable
      updatedAt: new Date(),
    };
    this.store.set(sessionId, updated);
    return updated;
  }

  /** Removes a session from the store. No-op if not found. */
  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  /** Returns a snapshot of all sessions as an array. */
  getAll(): SessionData[] {
    return Array.from(this.store.values());
  }

  /**
   * Removes sessions that were created more than `maxAgeHours` hours ago.
   * Call periodically (e.g. via setInterval) to prevent memory leaks.
   */
  cleanup(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    for (const [id, session] of this.store.entries()) {
      if (session.createdAt < cutoff) {
        this.store.delete(id);
      }
    }
  }

  /** Returns the number of active sessions. */
  size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------
export const sessionStore = new SessionStore();

// ---------------------------------------------------------------------------
// generateSessionId
// ---------------------------------------------------------------------------
/**
 * Generates a random UUID v4 string using Node.js built-in crypto.
 * Suitable for use as a session identifier.
 */
export function generateSessionId(): string {
  return randomUUID();
}
