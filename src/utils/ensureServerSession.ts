import type { CompanyProfile } from '../types';
import { hasCompanyName, normalizeCompanyProfile, resolveCompanyName } from './companyProfile';

/**
 * Sync company profile to the server in-memory session store.
 * Required before TB upload on Render where sessions expire on restart.
 */
export async function ensureServerSession(
  company: CompanyProfile | null | undefined,
): Promise<CompanyProfile | null> {
  const normalized = company ? normalizeCompanyProfile(company) : null;
  if (!hasCompanyName(normalized)) return null;

  const response = await fetch('/api/company/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...normalized,
      companyName: resolveCompanyName(normalized),
    }),
  });

  if (!response.ok) {
    let message = 'Could not sync company with server.';
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const saved = await response.json() as CompanyProfile;
  return normalizeCompanyProfile(saved);
}
