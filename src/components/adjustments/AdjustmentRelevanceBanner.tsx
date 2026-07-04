import React from 'react';
import type { AdjustmentRelevance } from '../../utils/adjustmentRelevance';

interface AdjustmentRelevanceBannerProps {
  relevance: AdjustmentRelevance;
}

export default function AdjustmentRelevanceBanner({ relevance }: AdjustmentRelevanceBannerProps) {
  const hiddenCount = Object.values(relevance.sectionVisibility).filter((v) => !v).length;

  return (
    <div
      className="rounded-lg px-4 py-3 text-xs"
      style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="font-semibold mb-1" style={{ color: 'var(--ink-700)' }}>
        Applicable adjustment sections (from trial balance mapping)
      </p>
      <p style={{ color: 'var(--ink-500)', lineHeight: 1.5 }}>
        {relevance.activeSectionLabels.join(' · ')}
      </p>
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
