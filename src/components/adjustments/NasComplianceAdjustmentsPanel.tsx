import React from 'react';
import type { AdjustmentRelevance } from '../../utils/adjustmentRelevance';

interface NasComplianceAdjustmentsPanelProps {
  nasFlags: AdjustmentRelevance['nasFlags'];
}

const FLAG_COPY: Array<{
  key: keyof AdjustmentRelevance['nasFlags'];
  title: string;
  detail: string;
  noteRef: string;
}> = [
  {
    key: 'leaseArrangements',
    title: 'Lease arrangements',
    detail: 'Disclosed in Note 3.25 (Contingent Liabilities). No separate capitalization worksheet is required unless you have finance leases — confirm operating lease commitments separately if material.',
    noteRef: 'Note 3.25',
  },
  {
    key: 'governmentGrants',
    title: 'Government grants',
    detail: 'Grant income and deferred grant balances from the trial balance will flow to notes. Confirm any unrecognised grant conditions before generating statements.',
    noteRef: 'Notes 3.17 / 3.19',
  },
  {
    key: 'foreignCurrency',
    title: 'Foreign currency transactions',
    detail: 'Monetary items in foreign currency should already be translated at closing rate in your books. Review exchange differences in finance costs before finalising.',
    noteRef: 'Note 3.1 / Accounting Policies',
  },
  {
    key: 'contingentLiabilities',
    title: 'Contingent liabilities',
    detail: 'Confirm amounts for legal cases, guarantees, and other contingencies — these feed Note 3.25 disclosure text.',
    noteRef: 'Note 3.25',
  },
  {
    key: 'eventsAfterDate',
    title: 'Events after reporting date',
    detail: 'Material post year-end events require adjustment or disclosure in Note 3.26.',
    noteRef: 'Note 3.26',
  },
];

export default function NasComplianceAdjustmentsPanel({ nasFlags }: NasComplianceAdjustmentsPanelProps) {
  const active = FLAG_COPY.filter(({ key }) => nasFlags[key]);
  if (active.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ink-700)' }}>
          NAS compliance items flagged at company setup
        </h3>
      </div>
      <div className="card-body space-y-3">
        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
          You flagged these at company setup. We only surface follow-up prompts that cannot be derived from your trial balance.
        </p>
        {active.map(({ key, title, detail, noteRef }) => (
          <div
            key={key}
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--brand-800)' }}>{title}</p>
            <p className="mt-1" style={{ color: 'var(--brand-700)' }}>{detail}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-400)' }}>
              Appears in {noteRef}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
