// src/pages/SubledgerPage.tsx
import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import Button from '../components/ui/Button';
import SubledgerInputPanel from '../components/adjustments/SubledgerInputPanel';

function sumCategory(rows: Array<{ nfrsCategory?: string; isGroupRow?: boolean; closingDr?: number; closingCr?: number }>, categories: string[]): number {
  return rows
    .filter((r) => !r.isGroupRow && categories.includes(String(r.nfrsCategory ?? '')))
    .reduce((sum, r) => sum + Math.max(0, (r.closingDr ?? 0) - (r.closingCr ?? 0)), 0);
}

export default function SubledgerPage() {
  const { state, dispatch } = useAppStore();
  const companyId = state.company?.id ?? '';
  const tbRows = state.trialBalance?.rows ?? [];

  const tbDebtorTotal = useMemo(
    () => sumCategory(tbRows, ['trade_receivables', 'related_party_receivable', 'other_receivables_advance_supplier']),
    [tbRows],
  );

  const tbCreditorTotal = useMemo(
    () => sumCategory(tbRows, ['trade_payables_creditors', 'trade_payables', 'related_party_payable']),
    [tbRows],
  );

  const handleContinue = () => {
    dispatch({ type: 'COMPLETE_STEP', payload: 'subledger_details' });
    dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' });
  };

  const handleSkip = () => {
    dispatch({ type: 'COMPLETE_STEP', payload: 'subledger_details' });
    dispatch({ type: 'SET_STEP', payload: 'year_end_adjustments' });
  };

  if (!companyId) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-sm text-slate-600">
        Complete company setup before entering subledger details.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <SubledgerInputPanel
        companyId={companyId}
        tbDebtorTotal={tbDebtorTotal}
        tbCreditorTotal={tbCreditorTotal}
      />

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-500">
          Save each tab before continuing. You can also enter these details later in the Excel workbook.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleSkip}>
            Skip — Enter in Excel
          </Button>
          <Button variant="primary" size="sm" onClick={handleContinue}>
            Continue to Adjustments →
          </Button>
        </div>
      </div>
    </div>
  );
}
