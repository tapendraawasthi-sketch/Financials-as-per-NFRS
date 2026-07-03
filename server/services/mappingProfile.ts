import type { MappedTBRow, NFRSCategory } from '../../src/types/trialBalance.js';

export type MappingProfile = Record<string, {
  nfrsCategory: NFRSCategory;
  matchedLabel?: string;
}>;

export function mappingProfileKey(rawLabel: string, parentGroup = ''): string {
  const label = rawLabel.toLowerCase().trim().replace(/\s+/g, ' ');
  const group = parentGroup.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${group}|${label}`;
}

export function applyMappingProfile(
  rows: MappedTBRow[],
  profile?: MappingProfile | null,
): MappedTBRow[] {
  if (!profile || Object.keys(profile).length === 0) return rows;

  return rows.map((row) => {
    if (row.isGroupRow) return row;
    const saved = profile[mappingProfileKey(row.rawLabel, row.parentGroup)];
    if (!saved?.nfrsCategory) return row;

    return {
      ...row,
      nfrsCategory: saved.nfrsCategory,
      matchedLabel: saved.matchedLabel ?? row.displayLabel ?? row.rawLabel,
      confidence: 100,
      matchMethod: 'manual' as const,
      needsReview: false,
      userOverride: true,
      displayLabel: saved.matchedLabel ?? row.displayLabel ?? row.rawLabel,
    };
  });
}

export function upsertMappingProfile(
  profile: MappingProfile,
  rows: MappedTBRow[],
): MappingProfile {
  const next: MappingProfile = { ...profile };

  for (const row of rows) {
    if (row.isGroupRow) continue;
    if (!row.nfrsCategory || row.nfrsCategory === 'unclassified') continue;
    if (!row.userOverride && row.matchMethod !== 'manual' && (row.confidence ?? 0) < 100) continue;

    next[mappingProfileKey(row.rawLabel, row.parentGroup)] = {
      nfrsCategory: row.nfrsCategory,
      matchedLabel: row.displayLabel ?? row.matchedLabel ?? row.rawLabel,
    };
  }

  return next;
}
