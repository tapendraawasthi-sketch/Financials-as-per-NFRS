// src/components/trialBalance/TBUploadZone.tsx
import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, X, FileSpreadsheet } from 'lucide-react';
import Card        from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import LoadingSpinner from '../ui/LoadingSpinner';
import Button      from '../ui/Button';
import TBStandardFormatDiagnostics, { type TbStandardValidationResult } from './TBStandardFormatDiagnostics';
import { SAMPLE_TRIAL_BALANCE_CSV } from '../../data/sampleData';
import { tbApi } from '../../api/client';
import { ensureServerSession } from '../../utils/ensureServerSession';
import { hasCompanyName, normalizeCompanyProfile } from '../../utils/companyProfile';
import { loadSession } from '../../hooks/useSessionPersistence';
import type { CompanyProfile, ParsedTrialBalance } from '../../types';

interface UploadResult {
  filename:       string;
  accountCount:   number;
  leafCount:      number;
  groupCount:     number;
  detectedFormat: string;
  isBalanced:     boolean;
  warnings:       string[];
}

interface TBUploadZoneProps {
  companyId:    string;
  company?:     CompanyProfile | null;
  onCompanyResolved?: (company: CompanyProfile) => void;
  onUploadComplete: (tb: any) => void;
  onError:      (msg: string) => void;
  useAI?:       boolean;
  onAIToggle?:  (on: boolean) => void;
  existingTB?:  any;
  hideAIOption?: boolean;
  uploadingMessage?: string;
  onDownloadTemplate?: () => void;
  isDownloadingTemplate?: boolean;
  onUpload?: (
    companyId: string,
    file: File,
    onProgress?: (pct: number) => void,
    companySnapshot?: CompanyProfile,
  ) => Promise<ParsedTrialBalance>;
}

const EXPORT_PATHS = [
  {
    name: 'Tally Prime',
    path: 'Gateway of Tally → Display More Reports → Account Books → Trial Balance → Export → Excel',
  },
  {
    name: 'Busy',
    path: 'Reports → Financial Reports → Trial Balance → Print / Export → Excel',
  },
  {
    name: 'Marg',
    path: 'Reports → Financial Reports → Trial Balance → Export to Excel',
  },
  {
    name: 'Zoho Books',
    path: 'Reports → Accountant → Trial Balance → Export → XLSX',
  },
  {
    name: 'General CSV',
    path: 'Export a CSV with columns: Account Name, Opening Dr, Opening Cr, Transactions Dr, Transactions Cr',
  },
];

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function TBUploadZone({
  companyId,
  company,
  onCompanyResolved,
  onUploadComplete,
  onError,
  useAI = true,
  onAIToggle,
  existingTB,
  hideAIOption = false,
  uploadingMessage,
  onDownloadTemplate,
  isDownloadingTemplate = false,
  onUpload,
}: TBUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress,    setProgress]    = useState(0);
  const [filename,    setFilename]    = useState('');
  const [fileSize,    setFileSize]    = useState(0);
  const [result,      setResult]      = useState<UploadResult | null>(null);
  const [processingPhase, setProcessingPhase] = useState('');
  const [isDragging,  setIsDragging]  = useState(false);
  const [aiOn,        setAiOn]        = useState(useAI);
  const [formatDiagnostics, setFormatDiagnostics] = useState<TbStandardValidationResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const spreadsheetExts = ['xlsx', 'xls', 'csv'];
    const documentExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isDocument = documentExts.includes(ext);
    if (!spreadsheetExts.includes(ext) && !isDocument) {
      onError(`Unsupported file type: .${ext}. Please upload Excel/CSV exports or PDF/image scans.`);
      return;
    }

    let activeCompany = company ? normalizeCompanyProfile(company) : null;
    if (!hasCompanyName(activeCompany) && companyId) {
      const stored = loadSession(companyId);
      if (stored?.company && hasCompanyName(stored.company)) {
        activeCompany = normalizeCompanyProfile(stored.company);
        onCompanyResolved?.(activeCompany);
      }
    }

    if (!hasCompanyName(activeCompany)) {
      onError('Complete Company Setup first — a company name is required before uploading a trial balance.');
      return;
    }

    setFilename(file.name);
    setFileSize(file.size);
    setUploadState('uploading');
    setProgress(0);
    setProcessingPhase('Syncing company session…');
    setFormatDiagnostics(null);

    try {
      const serverCompany = await ensureServerSession(activeCompany);
      if (!serverCompany?.id) {
        throw new Error('Could not create a server session for this company.');
      }
      if (serverCompany.id !== companyId) {
        onCompanyResolved?.(serverCompany);
      }

      setProcessingPhase(
        isDocument
          ? 'Extracting and structuring trial balance…'
          : (uploadingMessage ?? 'Uploading and parsing trial balance…'),
      );
      const uploadFn = onUpload ?? ((id, f, prog, snap) => {
        if (isDocument || aiOn) return tbApi.aiConvertUpload(id, f, prog, snap);
        return tbApi.upload(id, f, false, prog, snap);
      });
      const payload = await uploadFn(
        serverCompany.id,
        file,
        (pct) => {
          setProgress(Math.max(pct, onUpload ? 45 : 75));
          if (pct >= (onUpload ? 45 : 75)) {
            setProcessingPhase(uploadingMessage ?? 'Classifying accounts…');
          }
        },
        serverCompany,
      );

      const imbalanceWarning = !payload.isBalanced
        ? `Trial balance imbalance of NPR ${Math.abs(payload.difference ?? 0).toLocaleString('en-IN')}. Review before proceeding.`
        : undefined;

      const r: UploadResult = {
        filename:       file.name,
        accountCount:   payload?.rows?.length ?? 0,
        leafCount:      payload?.leafAccountCount ?? payload?.rows?.filter((row: any) => !row.isGroupRow).length ?? 0,
        groupCount:     payload?.groupRowCount ?? payload?.rows?.filter((row: any) => row.isGroupRow).length ?? 0,
        detectedFormat: payload?.detectedFormat ?? 'unknown',
        isBalanced:     payload?.isBalanced ?? true,
        warnings:       [
          ...(payload?.warnings ?? []),
          ...(imbalanceWarning ? [imbalanceWarning] : []),
        ],
      };
      setResult(r);
      setUploadState('success');
      setProgress(100);
      setProcessingPhase('');
      onUploadComplete(payload);
    } catch (err: unknown) {
      setUploadState('error');
      setProcessingPhase('');
      const error = err as Error & { code?: string; diagnostics?: TbStandardValidationResult };
      if (error.code === 'NOT_STANDARD_FORMAT' && error.diagnostics) {
        setFormatDiagnostics(error.diagnostics);
        onError(error.message);
        return;
      }
      const message = err instanceof Error ? err.message : 'Upload failed.';
      onError(message);
    }
  }, [company, companyId, aiOn, onUpload, uploadingMessage, onUploadComplete, onCompanyResolved, onError]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const toggleAI = () => {
    const next = !aiOn;
    setAiOn(next);
    onAIToggle?.(next);
  };

  const handleReupload = () => {
    setUploadState('idle');
    setResult(null);
    setProgress(0);
    setFilename('');
    setFileSize(0);
    setFormatDiagnostics(null);
    fileRef.current?.click();
  };

  const clearFile = () => {
    setUploadState('idle');
    setResult(null);
    setProgress(0);
    setFilename('');
    setFileSize(0);
    setFormatDiagnostics(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const FileChip = ({ onRemove }: { onRemove: () => void }) => (
    <div
      className="inline-flex items-center gap-2 mb-3"
      style={{
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-full)',
        padding: 'var(--space-1) var(--space-2) var(--space-1) var(--space-3)',
      }}
    >
      <FileSpreadsheet size={14} style={{ color: 'var(--brand-500)', flexShrink: 0 }} />
      <span className="truncate max-w-[200px]" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-700)' }} title={filename}>
        {filename}
      </span>
      {fileSize > 0 && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-400)' }}>{formatFileSize(fileSize)}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove file"
        className="flex items-center justify-center rounded-full transition-colors"
        style={{ width: '20px', height: '20px', color: 'var(--ink-400)' }}
      >
        <X size={12} />
      </button>
    </div>
  );

  const loadDummyData = () => {
    const file = new File([SAMPLE_TRIAL_BALANCE_CSV], "dummy_trial_balance.csv", { type: "text/csv" });
    handleFile(file);
  };

  return (
    <div className="grid grid-cols-5 gap-5">
      {/* ── Left: Upload area ─────────────────────────────────────── */}
      <div className="col-span-3">
        <Card title="Upload Trial Balance File" padding="md">
          {/* Drop zone */}
          {uploadState === 'idle' && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload trial balance file — drag and drop or click to browse"
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="cursor-pointer transition-all ease-premium"
              style={{
                borderRadius: 'var(--radius-lg)',
                border: `2px dashed ${isDragging ? 'var(--brand-500)' : 'var(--border-strong)'}`,
                background: isDragging ? 'var(--brand-50)' : 'transparent',
                padding: 'var(--space-10) var(--space-6)',
                textAlign: 'center',
              }}
            >
              <UploadCloud
                size={40}
                strokeWidth={1.5}
                className="mx-auto mb-3"
                style={{ color: isDragging ? 'var(--brand-500)' : 'var(--ink-300)' }}
                aria-hidden="true"
              />
              <p className="font-medium" style={{ fontSize: 'var(--text-md)', color: 'var(--ink-700)' }}>
                Drag & drop your trial balance, or click to browse
              </p>
              <p className="mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-400)' }}>
                Accepts .xlsx, .xls, .csv, plus PDF with text layer
              </p>
              <div className="mt-4 flex justify-center" onClick={(e) => e.stopPropagation()}>
                <Button type="button" variant="secondary" size="sm" onClick={loadDummyData}>
                  Load Dummy Trial Balance
                </Button>
              </div>
            </div>
          )}

          {/* Uploading state */}
          {uploadState === 'uploading' && (
            <div className="py-2 space-y-3">
              <FileChip onRemove={clearFile} />
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <p className="truncate" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-600)' }}>
                  {processingPhase || `Parsing ${filename}…`}
                </p>
              </div>
              <ProgressBar value={progress} showValue size="md" color="blue" />
            </div>
          )}

          {/* Success state */}
          {uploadState === 'success' && result && (
            <div className="py-2 space-y-3">
              <FileChip onRemove={clearFile} />
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ background: 'var(--success-600)' }}
                  aria-hidden="true"
                />
                <span className="text-xs truncate flex-1" style={{ color: 'var(--ink-700)' }} title={result.filename}>
                  {result.filename} — {result.leafCount} ledger accounts
                  {result.groupCount > 0 ? ` (${result.groupCount} group headers)` : ''}
                </span>
                <button
                  type="button"
                  onClick={handleReupload}
                  className="text-xs underline flex-shrink-0 transition-colors"
                  style={{ color: 'var(--brand-600)' }}
                >
                  Re-upload
                </button>
              </div>
              <div className="text-xs space-y-1 pl-4" style={{ color: 'var(--ink-500)' }}>
                <p>Detected format: <span className="font-medium" style={{ color: 'var(--ink-700)' }}>{result.detectedFormat}</span></p>
                <p>Balance check: <span style={{ color: result.isBalanced ? 'var(--success-700)' : 'var(--warning-700)' }}>
                  {result.isBalanced ? 'Balanced' : 'Imbalanced — review required'}
                </span></p>
                {result.warnings.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer" style={{ color: 'var(--warning-700)' }}>
                      {result.warnings.length} parser notice{result.warnings.length === 1 ? '' : 's'}
                    </summary>
                    <ul className="mt-1 list-disc list-inside text-slate-500 max-h-24 overflow-y-auto">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {uploadState === 'error' && (
            <div className="py-2 space-y-3">
              {!formatDiagnostics && (
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: 'var(--danger-600)' }}
                    aria-hidden="true"
                  />
                  <span className="text-xs flex-1" style={{ color: 'var(--danger-600)' }}>Upload failed.</span>
                  <button
                    type="button"
                    onClick={handleReupload}
                    className="text-xs underline flex-shrink-0"
                    style={{ color: 'var(--brand-600)' }}
                  >
                    Try again
                  </button>
                </div>
              )}
              {formatDiagnostics && onDownloadTemplate && (
                <TBStandardFormatDiagnostics
                  diagnostics={formatDiagnostics}
                  onDownloadTemplate={onDownloadTemplate}
                  isDownloading={isDownloadingTemplate}
                />
              )}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleInputChange}
            aria-hidden="true"
          />

          {/* AI toggle */}
          {!hideAIOption && (
          <div
            className="flex items-center justify-between py-2.5 mt-3"
            style={{ borderTop: '1px solid var(--border-hairline)' }}
          >
            <div>
              <p className="text-xs font-medium leading-none" style={{ color: 'var(--ink-600)' }}>
                Use AI Account Matching
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                Claude AI improves classification of unrecognised accounts
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aiOn}
              aria-label="Toggle AI account matching"
              onClick={toggleAI}
              className="relative w-9 h-5 rounded-full flex-shrink-0 cursor-pointer transition-colors duration-200 focus-visible:outline-none"
              style={{
                background: aiOn ? 'var(--brand-500)' : 'var(--ink-200)',
                boxShadow: 'none',
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = 'var(--glow-brand)'; }}
              onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span
                className={[
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                  aiOn ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>
          )}
        </Card>
      </div>

      {/* ── Right: Instructions ────────────────────────────────────── */}
      <div className="col-span-2">
        <Card title="Export from Your Software" padding="sm">
          <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
            {EXPORT_PATHS.map(sw => (
              <div key={sw.name} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-xs font-medium" style={{ color: 'var(--ink-700)' }}>{sw.name}</p>
                <p
                  className="text-xs font-mono px-1.5 py-0.5 rounded mt-0.5 leading-snug break-words"
                  style={{ color: 'var(--ink-500)', background: 'var(--surface-sunken)' }}
                >
                  {sw.path}
                </p>
              </div>
            ))}
          </div>

          <a
            href="/sample-trial-balance.csv"
            download
            className="text-xs underline mt-3 block transition-colors"
            style={{ color: 'var(--brand-600)' }}
          >
            Download sample CSV format
          </a>
        </Card>
      </div>
    </div>
  );
}
