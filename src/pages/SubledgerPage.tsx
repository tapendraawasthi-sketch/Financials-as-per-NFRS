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
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <p
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--brand-600)' }}
          >
            STEP 5 OF 8
          </p>
          <h2
            className="font-display text-2xl font-semibold mb-2"
            style={{ color: 'var(--ink-950)' }}
          >
            Sub-ledger Details
          </h2>
          <p className="text-sm max-w-2xl" style={{ color: 'var(--ink-500)', lineHeight: 1.6 }}>
            Review debtors, creditors, bank balances, and related-party transactions.
          </p>
        </div>
        <div className="card">
          <div className="card-body text-sm text-slate-600">
            Complete company setup before entering subledger details.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="mb-6">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--brand-600)' }}
        >
          STEP 5 OF 8
        </p>
        <h2
          className="font-display text-2xl font-semibold mb-2"
          style={{ color: 'var(--ink-950)' }}
        >
          Sub-ledger Details
        </h2>
        <p className="text-sm max-w-2xl" style={{ color: 'var(--ink-500)', lineHeight: 1.6 }}>
          Review debtors, creditors, bank balances, and related-party transactions.
        </p>
      </div>

      <div className="card">
        <div className="card-body">
          <SubledgerInputPanel
            companyId={companyId}
            tbDebtorTotal={tbDebtorTotal}
            tbCreditorTotal={tbCreditorTotal}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-footer flex items-center justify-between">
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
    </div>
  );
}
