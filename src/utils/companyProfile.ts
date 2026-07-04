import type { CompanyProfile } from '../types';

/** Resolve the display/save name from either legacy or current field names. */
export function resolveCompanyName(
  company?: Partial<CompanyProfile> | null,
): string {
  return (company?.companyName ?? company?.name ?? '').trim();
}

export function hasCompanyName(
  company?: Partial<CompanyProfile> | null,
): boolean {
  return resolveCompanyName(company).length > 0;
}

/** Keep companyName/name in sync so upload and output checks stay consistent. */
export function normalizeCompanyProfile(
  company: CompanyProfile,
): CompanyProfile {
  const companyName = resolveCompanyName(company);
  if (!companyName) return company;
  return {
    ...company,
    companyName,
    name: company.name?.trim() || companyName,
  };
}
