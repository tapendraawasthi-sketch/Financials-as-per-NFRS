// src/hooks/useSessionPersistence.ts
// item 178 + 179: session auto-save with "last saved" timestamp
import { useEffect, useState, useCallback } from 'react';
import { AppState } from '../types';

const SESSION_KEY = 'nfrs_session_v2';

export function useSessionPersistence(state: AppState) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveTimer,   setSaveTimer]   = useState<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((s: AppState) => {
    try {
      const sanitized = {
        ...s,
        // Don't persist binary buffers
        trialBalance: s.trialBalance ? { ...s.trialBalance } : null,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
      setLastSavedAt(new Date());
    } catch (err) {
      console.warn('[SessionPersistence] Failed to save:', err);
    }
  }, []);

  // Debounced auto-save on every state change
  useEffect(() => {
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(() => save(state), 1500);
    setSaveTimer(t);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { lastSavedAt };
}

export function loadSession(): AppState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
      ?? sessionStorage.getItem('nfrs_session'); // legacy key fallback
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed?.currentStep) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Human-readable "X min ago" label */
export function formatLastSaved(date: Date | null): string {
  if (!date) return 'Not saved';
  const diffMs  = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10)  return 'Just saved';
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin} min ago`;
  return date.toLocaleTimeString();
}
