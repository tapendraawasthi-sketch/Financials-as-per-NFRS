// src/pages/TrialBalancePage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import Tabs from '../components/ui/Tabs';
import Card from '../components/ui/Card';
import TBUploadZone from '../components/trialBalance/TBUploadZone';
import TBInputModeSelector from '../components/trialBalance/TBInputModeSelector';
import TBDataGrid from '../components/trialBalance/TBDataGrid';
import TBRawPreviewGrid from '../components/trialBalance/TBRawPreviewGrid';
import TBAccountMapper from '../components/trialBalance/TBAccountMapper';
import TBValidationPanel from '../components/trialBalance/TBValidationPanel';
import { tbApi, outputApi } from '../api/client';
import { validateTrialBalanceTotals } from '../utils/validation';
import type { NFRSCategory, CompanyProfile, NormalizedTrialBalancePreview, RawTBRow } from '../types';

type TabId = 'upload' | 'normalize' | 'review' | 'mapping';

export default function TrialBalancePage() {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>(
    state.currentStep === 'trial_balance_mapping' && state.trialBalance ? 'mapping' : 'upload',
  );
  const [importMode, setImportMode] = useState<'choice' | 'manual' | 'ai'>(
    state.trialBalance ? 'manual' : 'choice',
  );
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [normalizedPreview, setNormalizedPreview] = useState<NormalizedTrialBalancePreview | null>(null);
  const [previewRows, setPreviewRows] = useState<RawTBRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dismissedStandardWarnings, setDismissedStandardWarnings] = useState(false);

  const tb = state.trialBalance;
  const rows = tb?.rows ?? [];
  const validation = tb ? validateTrialBalanceTotals(rows) : null;

  const leafRows = rows.filter((r) => !r.isGroupRow);
  const autoMapped = leafRows.filter((r) => (r.confidence ?? 0) >= 80).length;
  const needsReview = leafRows.filter((r) => (r.confidence ?? 0) > 0 && (r.confidence ?? 0) < 80).length;
  const unmatched = leafRows.filter(
    (r) => (r.confidence ?? 0) === 0 || !r.nfrsCategory || r.nfrsCategory === 'unclassified',
  ).length;

  const handlePreviewComplete = (data: NormalizedTrialBalancePreview) => {
    setNormalizedPreview(data);
    setPreviewRows(data.rows ?? []);
    setActiveTab('normalize');
  };

  const handleConfirmNormalized = async () => {
    if (!state.company?.id) return;
    setConfirming(true);
    try {
      const classified = await tbApi.confirmNormalized(
        state.company.id,
        previewRows,
        normalizedPreview?.importMode === 'ai',
      );
      dispatch({ type: 'SET_TRIAL_BALANCE', payload: classified });
      dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_upload' });
      dispatch({ type: 'SET_STEP', payload: 'trial_balance_mapping' });
      setNormalizedPreview(null);
      setActiveTab('review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm trial balance.';
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      setConfirming(false);
    }
  };

  const handleExportNormalized = async () => {
    if (!state.company?.id) return;
    setExporting(true);
    try {
      const blob = await tbApi.exportNormalized(state.company.id, previewRows);
      outputApi.triggerDownload(blob, 'Normalized_Trial_Balance.xlsx');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.';
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      setExporting(false);
    }
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
    const updatedRows = tb.rows.map((row) => {
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

    const updates = tb.rows.map((row) => ({
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
    {
      id: 'normalize',
      label: 'Normalize',
      count: previewRows.length,
      disabled: !normalizedPreview,
    },
    { id: 'review', label: 'Review Data', count: rows.length, disabled: !tb },
    { id: 'mapping', label: 'Map Accounts', count: unmatched, disabled: !tb },
  ];

  const mappingProfileMsg = tb?.mappingProfileAppliedCount && tb.mappingProfileTotalAccounts
    ? `${tb.mappingProfileAppliedCount} of ${tb.mappingProfileTotalAccounts} accounts pre-mapped from last year`
    : null;

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
          Import your trial balance, review the normalized structure, then map accounts to NFRS categories.
        </p>
      </div>

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        variant="line"
        className="mb-5"
      />

      {tb && (activeTab === 'review' || activeTab === 'mapping') && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card accent="brand" padding="dense">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Accounts detected
            </p>
            <p className="kpi-number mt-1" style={{ fontSize: 'var(--text-xl)', color: 'var(--ink-950)' }}>
              {leafRows.length}
            </p>
          </Card>
          <Card accent="success" padding="dense">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Auto-mapped
            </p>
            <p className="kpi-number mt-1" style={{ fontSize: 'var(--text-xl)', color: 'var(--success-700)' }}>
              {autoMapped}
            </p>
          </Card>
          <Card accent="gold" padding="dense">
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Need review
            </p>
            <p className="kpi-number mt-1" style={{ fontSize: 'var(--text-xl)', color: 'var(--warning-700)' }}>
              {needsReview + unmatched}
            </p>
          </Card>
        </div>
      )}

      <div className="page-enter">
        {activeTab === 'upload' && (
          <div className="card">
            <div className="card-body">
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
                    onUploadComplete={handlePreviewComplete}
                    onError={handleUploadError}
                    hideAIOption
                    existingTB={tb}
                    uploadingMessage="Parsing trial balance…"
                    onDownloadTemplate={handleDownloadTemplate}
                    isDownloadingTemplate={downloadingTemplate}
                    onUpload={(id, file, onProgress, companySnapshot) =>
                      tbApi.parsePreviewUpload(id, file, 'manual', onProgress, companySnapshot)
                    }
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
                    onUploadComplete={handlePreviewComplete}
                    onError={handleUploadError}
                    hideAIOption
                    uploadingMessage="Reading and structuring your trial balance…"
                    onUpload={(id, file, onProgress, companySnapshot) =>
                      tbApi.parsePreviewUpload(id, file, 'ai', onProgress, companySnapshot)
                    }
                    existingTB={tb}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'normalize' && normalizedPreview && (
          <div className="card">
            <div className="card-body">
              <TBRawPreviewGrid
                rows={previewRows}
                onRowsChange={setPreviewRows}
                mappingProfileAppliedCount={normalizedPreview.mappingProfileAppliedCount}
                mappingProfileTotalAccounts={normalizedPreview.mappingProfileTotalAccounts}
                detectedFormat={normalizedPreview.detectedFormat}
                warnings={normalizedPreview.warnings}
                onConfirm={handleConfirmNormalized}
                onExport={handleExportNormalized}
                confirming={confirming}
                exporting={exporting}
              />
            </div>
          </div>
        )}

        {activeTab === 'review' && tb && validation && (
          <div className="space-y-4">
            {tb.standardFormatWarnings && tb.standardFormatWarnings.length > 0 && !dismissedStandardWarnings && (
              <div
                className="rounded-lg px-4 py-3 text-xs space-y-2"
                style={{ background: 'var(--warning-50)', color: 'var(--warning-800)', border: '1px solid var(--warning-200)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">Standard template warnings (non-blocking)</p>
                  <button
                    type="button"
                    onClick={() => setDismissedStandardWarnings(true)}
                    className="underline flex-shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {tb.standardFormatWarnings.map((issue, idx) => (
                    <li key={idx}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {mappingProfileMsg && (
              <div
                className="rounded-lg px-4 py-2 text-xs"
                style={{ background: 'var(--success-50)', color: 'var(--success-800)', border: '1px solid var(--success-200)' }}
              >
                Returning client recognized — {mappingProfileMsg}.
              </div>
            )}
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
