import fs from 'fs';
import path from 'path';

const DEFAULT_ROOT = path.join(process.cwd(), 'data');

export function persistenceEnabled(): boolean {
  return process.env.SESSION_PERSIST !== 'false';
}

export function persistenceRoot(): string {
  return process.env.SESSION_PERSIST_DIR ?? path.join(DEFAULT_ROOT, 'persisted');
}

export function ensurePersistenceDir(subdir: string): string {
  const dir = path.join(persistenceRoot(), subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readPersistedJson<T>(subdir: string, id: string): T | null {
  if (!persistenceEnabled()) return null;
  const filePath = path.join(ensurePersistenceDir(subdir), `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function writePersistedJson(subdir: string, id: string, value: unknown): void {
  if (!persistenceEnabled()) return;
  const filePath = path.join(ensurePersistenceDir(subdir), `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 0), 'utf-8');
}

export function deletePersistedJson(subdir: string, id: string): void {
  if (!persistenceEnabled()) return;
  const filePath = path.join(ensurePersistenceDir(subdir), `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function listPersistedIds(subdir: string): string[] {
  if (!persistenceEnabled()) return [];
  const dir = ensurePersistenceDir(subdir);
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));
}

export function reviveDates<T extends Record<string, unknown>>(value: T, keys: string[]): T {
  const next = { ...value } as Record<string, unknown>;
  for (const key of keys) {
    if (typeof next[key] === 'string') {
      next[key] = new Date(String(next[key]));
    }
  }
  return next as T;
}
