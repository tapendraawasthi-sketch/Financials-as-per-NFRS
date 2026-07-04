import React from 'react';
import type { AdjustmentRelevance } from '../../utils/adjustmentRelevance';

interface AdjustmentRelevanceBannerProps {
  relevance: AdjustmentRelevance & { aiEnhanced?: boolean; aiNotes?: string[] };
  useAI: boolean;
  onToggleAI: (on: boolean) => void;
  aiAvailable?: boolean;
}

export default function AdjustmentRelevanceBanner({
  relevance,
  useAI,
  onToggleAI,
  aiAvailable = Boolean(typeof window !== 'undefined'),
}: AdjustmentRelevanceBannerProps) {
  const hiddenCount = Object.values(relevance.sectionVisibility).filter((v) => !v).length;

  return (
    <div
      className="rounded-lg px-4 py-3 text-xs"
      style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <p className="font-semibold" style={{ color: 'var(--ink-700)' }}>
          Applicable adjustment sections (from trial balance mapping)
        </p>
        <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--ink-600)' }}>
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => onToggleAI(e.target.checked)}
            disabled={!aiAvailable}
          />
          Enhance with AI
          {relevance.aiEnhanced && useAI && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
              AI active
            </span>
          )}
        </label>
      </div>
      <p style={{ color: 'var(--ink-500)', lineHeight: 1.5 }}>
        {relevance.activeSectionLabels.join(' · ')}
      </p>
      {relevance.aiNotes && relevance.aiNotes.length > 0 && useAI && (
        <ul className="mt-2 list-disc pl-4" style={{ color: 'var(--ink-500)' }}>
          {relevance.aiNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className="mt-2 italic" style={{ color: 'var(--ink-400)' }}>
          Sections with no TB balance are hidden — e.g.
          {!relevance.sectionVisibility.ppe && ' PPE,'}
          {!relevance.sectionVisibility.inventory && ' Inventory,'}
          {!relevance.sectionVisibility.investments && ' Investments,'}
          {!relevance.sectionVisibility.relatedPartyLoan && ' Related-party loan toggle,'}
        </p>
      )}
    </div>
  );
}
