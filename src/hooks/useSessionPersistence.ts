// src/hooks/useSessionPersistence.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore, type AppState } from '../store/appStore';

const SAVE_THROTTLE_MS = 30_000;
const sessionKey = (companyId: string) => `me_session_${companyId}`;

export function formatLastSaved(date: Date | null | undefined): string {
  if (!date) return 'Not saved';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

/** Strip transient UI flags so a mid-request refresh cannot deadlock on the spinner. */
export function sanitizePersistedState(state: AppState): AppState {
  return { ...state, isLoading: false, error: null };
}

export function saveSession(
  state: AppState,
  companyId: string,
  lastSaveRef?: { current: number },
): string | null {
  if (!companyId) return null;
  const now = Date.now();
  const ref = lastSaveRef ?? { current: 0 };
  if (ref.current > 0 && now - ref.current < SAVE_THROTTLE_MS) {
    return null;
  }
  ref.current = now;
  const iso = new Date(now).toISOString();
  try {
    localStorage.setItem(sessionKey(companyId), JSON.stringify(sanitizePersistedState(state)));
  } catch {
    return null;
  }
  return iso;
}

export function loadSession(companyId: string): AppState | null {
  if (!companyId) return null;
  try {
    const raw = localStorage.getItem(sessionKey(companyId));
    if (!raw) return null;
    return sanitizePersistedState(JSON.parse(raw) as AppState);
  } catch {
    return null;
  }
}

export function clearSession(companyId: string): void {
  if (!companyId) return;
  try {
    localStorage.removeItem(sessionKey(companyId));
  } catch {
    // ignore storage errors
  }
}

export interface StoredSessionSummary {
  companyId: string;
  companyName: string;
  fiscalYear?: string;
  currentStep?: string;
}

export function listStoredSessions(): StoredSessionSummary[] {
  const sessions: StoredSessionSummary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('me_session_')) continue;
      const companyId = key.slice('me_session_'.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const state = JSON.parse(raw) as AppState;
      sessions.push({
        companyId,
        companyName: state.company?.companyName?.trim()
          || `Client ${companyId.slice(0, 8)}`,
        fiscalYear: state.company?.fiscalYear?.bsFY,
        currentStep: state.currentStep,
      });
    }
  } catch {
    return sessions;
  }
  return sessions.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export function useSessionPersistence(companyId: string | undefined) {
  const { state, dispatch } = useAppStore();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSaveRef = useRef(0);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!companyId || hydratedRef.current) return;
    hydratedRef.current = true;
    const loaded = loadSession(companyId);
    if (loaded && state.currentStep === 'company_setup' && !state.company && !state.trialBalance) {
      dispatch({ type: 'HYDRATE_STATE', payload: loaded });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const iso = saveSession(state, companyId, lastSaveRef);
    if (iso) setLastSavedAt(new Date(iso));
  }, [state, companyId]);

  const clear = useCallback(() => {
    if (companyId) clearSession(companyId);
    setLastSavedAt(null);
    lastSaveRef.current = 0;
  }, [companyId]);

  return { lastSavedAt, clearSession: clear };
}
