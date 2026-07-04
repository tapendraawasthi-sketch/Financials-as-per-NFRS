import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface RelatedPartyLoanPanelProps {
  isCurrent: boolean;
  onSave: (relatedPartyLoanCurrent: boolean) => Promise<void> | void;
}

export default function RelatedPartyLoanPanel({ isCurrent, onSave }: RelatedPartyLoanPanelProps) {
  const [current, setCurrent] = useState(isCurrent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Related-Party Loan Classification (Note 3.11)" padding="md">
      <p className="text-xs mb-3" style={{ color: 'var(--ink-500)' }}>
        MEs format defaults related-party borrowings to <strong>non-current</strong> unless the loan
        is repayable within 12 months. This setting flows to Note 3.11 and the Borrowings note in the workbook.
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={current}
          onChange={(e) => setCurrent(e.target.checked)}
          className="rounded border-[var(--border-strong)]"
        />
        <span style={{ color: 'var(--ink-700)' }}>
          Classify related-party loan as <strong>current</strong> (unchecked = non-current)
        </span>
      </label>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Classification
        </Button>
      </div>
    </Card>
  );
}
