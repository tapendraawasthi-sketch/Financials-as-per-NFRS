// server/store/sessionStore.ts
export interface SessionData {
  createdAt:    Date;
  lastAccessAt: Date;
  company?:     any;
  trialBalance?: any;
  adjustments?:  any;
  financials?:   any;
}

class SessionStore {
  private store = new Map<string, SessionData>();

  get(id: string): SessionData | undefined {
    const session = this.store.get(id);
    if (session) session.lastAccessAt = new Date();
    return session;
  }

  set(id: string, data: Partial<SessionData>): SessionData {
    const existing = this.store.get(id);
    const session: SessionData = {
      createdAt:    existing?.createdAt    ?? new Date(),
      lastAccessAt: new Date(),
      ...existing,
      ...data,
    };
    this.store.set(id, session);
    return session;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  /** Removes sessions older than maxAgeHours. Returns count removed. */
  cleanup(maxAgeHours: number): number {
    const cutoff  = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let   removed = 0;
    for (const [id, session] of this.store.entries()) {
      if (session.lastAccessAt.getTime() < cutoff) {
        this.store.delete(id);
        removed++;
      }
    }
    return removed;
  }

  size(): number { return this.store.size; }

  all(): Map<string, SessionData> { return this.store; }
}

export const sessionStore = new SessionStore();
