import type { CompanyProfile } from '../types';

/**
 * Sync company profile to the server in-memory session store.
 * Required before TB upload on Render where sessions expire on restart.
 */
export async function ensureServerSession(
  company: CompanyProfile | null | undefined,
): Promise<CompanyProfile | null> {
  if (!company?.companyName?.trim()) return null;

  const response = await fetch('/api/company/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(company),
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

  return response.json() as Promise<CompanyProfile>;
}
