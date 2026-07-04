// src/pages/TrialBalancePage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import TBUploadZone from '../components/trialBalance/TBUploadZone';
import TBInputModeSelector from '../components/trialBalance/TBInputModeSelector';
import TBDataGrid from '../components/trialBalance/TBDataGrid';
import TBAccountMapper from '../components/trialBalance/TBAccountMapper';
import TBValidationPanel from '../components/trialBalance/TBValidationPanel';
import { tbApi, outputApi } from '../api/client';
import { validateTrialBalanceTotals } from '../utils/validation';
import type { NFRSCategory, CompanyProfile } from '../types';

type TabId = 'upload' | 'review' | 'mapping';

export default function TrialBalancePage() {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>(
    state.currentStep === 'trial_balance_mapping' && state.trialBalance ? 'mapping' : 'upload'
  );
  const [importMode, setImportMode] = useState<'choice' | 'manual' | 'ai'>(
    state.trialBalance ? 'manual' : 'choice',
  );
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const tb = state.trialBalance;
  const rows = tb?.rows ?? [];
  const validation = tb ? validateTrialBalanceTotals(rows) : null;

  const leafRows = rows.filter((r) => !r.isGroupRow);
  const autoMapped = leafRows.filter(r => (r.confidence ?? 0) >= 80).length;
  const needsReview = leafRows.filter(r => (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80).length;
  const unmatched = leafRows.filter(r => (r.confidence ?? 0) === 0 || !r.nfrsCategory || r.nfrsCategory === 'unclassified').length;

  const handleUploadComplete = (data: any) => {
    dispatch({ type: 'SET_TRIAL_BALANCE', payload: data });
    dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_upload' });
    dispatch({ type: 'SET_STEP', payload: 'trial_balance_mapping' });
    setActiveTab('review');
  };

  const handleCompanyResolved = (company: CompanyProfile) => {
    dispatch({ type: 'SET_COMPANY', payload: company });
    localStorage.setItem('me_last_company_id', company.id);
  };

  const handleUploadError = (msg: string) => {
    dispatch({ type: 'SET_ERROR', payload: msg });
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await tbApi.downloadTemplate();
      outputApi.triggerDownload(blob, 'NFRS_Trial_Balance_Template.xlsx');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download template.';
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleMappingChange = (rowIndex: string, category: NFRSCategory) => {
    if (!tb) return;
    const updatedRows = tb.rows.map(row => {
      if (String(row.rowIndex) === rowIndex) {
        return {
          ...row,
          nfrsCategory: category,
          confidence: 100,
          matchMethod: 'manual' as const,
          needsReview: false,
          userOverride: true,
        };
      }
      return row;
    });
    dispatch({
      type: 'SET_TRIAL_BALANCE',
      payload: { ...tb, rows: updatedRows },
    });
  };

  const handleConfirmMappings = async () => {
    if (!tb || !state.company?.id) return;

    const updates = tb.rows.map(row => ({
      rowIndex: row.rowIndex,
      nfrsCategory: row.nfrsCategory,
      matchedLabel: row.matchedLabel ?? row.rawLabel,
    }));

    try {
      const response = await fetch(`/api/trial-balance/${state.company.id}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        let message = 'Failed to save mappings.';
        try {
          const body = await response.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_mapping' });
      dispatch({ type: 'SET_STEP', payload: 'subledger_details' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save mappings.';
      dispatch({ type: 'SET_ERROR', payload: message });
    }
  };

  const tabs = [
    { id: 'upload', label: 'Upload' },
    { id: 'review', label: 'Review Data', count: rows.length, disabled: !tb },
    { id: 'mapping', label: 'Map Accounts', count: unmatched, disabled: !tb },
  ];

  return (
    <div>
      <div className="mb-6">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--brand-600)' }}
        >
          STEP 3 OF 8
        </p>
        <h2
          className="font-display text-2xl font-semibold mb-2"
          style={{ color: 'var(--ink-950)' }}
        >
          Upload Trial Balance
        </h2>
        <p className="text-sm max-w-2xl" style={{ color: 'var(--ink-500)', lineHeight: 1.6 }}>
          Import your trial balance from accounting software, review the data, and map accounts to NFRS categories.
        </p>
      </div>

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        variant="line"
        className="mb-5"
      />

      <div className="page-enter">
        {activeTab === 'upload' && (
          <div className="card">
            <div className="card-body">
          <>
            {importMode === 'choice' && (
              <TBInputModeSelector
                onSelectManual={() => setImportMode('manual')}
                onSelectAI={() => setImportMode('ai')}
                onDownloadTemplate={handleDownloadTemplate}
                isDownloading={downloadingTemplate}
              />
            )}
            {importMode === 'manual' && (
              <>
                <button
                  type="button"
                  onClick={() => setImportMode('choice')}
                  className="text-xs text-blue-600 hover:text-blue-800 underline mb-3 transition-colors"
                >
                  ← Change import method
                </button>
                <TBUploadZone
                  companyId={state.company?.id ?? ''}
                  company={state.company}
                  onCompanyResolved={handleCompanyResolved}
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                  useAI={false}
                  hideAIOption
                  existingTB={tb}
                />
              </>
            )}
            {importMode === 'ai' && (
              <>
                <button
                  type="button"
                  onClick={() => setImportMode('choice')}
                  className="text-xs text-blue-600 hover:text-blue-800 underline mb-3 transition-colors"
                >
                  ← Change import method
                </button>
                <TBUploadZone
                  companyId={state.company?.id ?? ''}
                  company={state.company}
                  onCompanyResolved={handleCompanyResolved}
                  onUploadComplete={handleUploadComplete}
                  onError={handleUploadError}
                  hideAIOption
                  uploadingMessage="AI is reading and restructuring your trial balance — large files may take up to a minute…"
                  onUpload={(id, file, onProgress, companySnapshot) =>
                    tbApi.aiConvertUpload(id, file, onProgress, companySnapshot)
                  }
                  existingTB={tb}
                />
              </>
            )}
          </>
            </div>
          </div>
        )}

        {activeTab === 'review' && tb && validation && (
          <div className="space-y-4">
            <div className="card">
              <div className="card-body">
                <TBValidationPanel
                  validation={{
                    isBalanced: validation.isBalanced,
                    totalDebitBalance: validation.totalClosingDr,
                    totalCreditBalance: validation.totalClosingCr,
                    openingDebitTotal: validation.openingDebitTotal ?? 0,
                    openingCreditTotal: validation.openingCreditTotal ?? 0,
                    closingDebitTotal: validation.closingDebitTotal ?? 0,
                    closingCreditTotal: validation.closingCreditTotal ?? 0,
                    warnings: validation.warnings,
                    errors: validation.errors,
                  }}
                  totalRows={rows.length}
                  autoMappedCount={autoMapped}
                  needsReviewCount={needsReview}
                  unmatchedCount={unmatched}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h3
                  className="font-bold leading-none"
                  style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-700)' }}
                >
                  Trial Balance Data
                </h3>
              </div>
              <div className="card-body">
                <TBDataGrid
                  rows={rows}
                  validation={validation}
                  roundingLevel={state.company?.accountingPolicies?.roundingLevel ?? 100}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mapping' && tb && (
          <div className="card">
            <div className="card-body">
              <TBAccountMapper
                rows={rows}
                companyId={state.company?.id ?? ''}
                onMappingChange={handleMappingChange}
                onConfirm={handleConfirmMappings}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
