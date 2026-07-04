// src/components/adjustments/AdjustmentJournalUploadPanel.tsx
import React, { useRef, useState, useCallback } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import { adjustmentsApi, outputApi } from '../../api/client';

interface UploadSummary {
  entryCount: number;
  totalDebitCredit: number;
  warnings: string[];
}

interface AdjustmentJournalUploadPanelProps {
  companyId: string;
  companyName?: string;
  skipped: boolean;
  hasEntries: boolean;
  onUploadComplete: (entries: Array<{
    id?: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    type?: string;
    source?: string;
  }>) => void;
  onSkip: () => void;
  onError: (msg: string) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'skipped';

export default function AdjustmentJournalUploadPanel({
  companyId,
  companyName,
  skipped,
  hasEntries,
  onUploadComplete,
  onSkip,
  onError,
}: AdjustmentJournalUploadPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>(skipped ? 'skipped' : 'idle');
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState('');
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const blob = await adjustmentsApi.downloadJournalTemplate(companyName);
      outputApi.triggerDownload(blob, 'Year_End_Adjustment_Journal_Template.xlsx');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to download template.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'xls'].includes(ext)) {
      onError('Please upload an Excel file (.xlsx or .xls). Use the downloaded template.');
      return;
    }

    setFilename(file.name);
    setUploadState('uploading');
    setProgress(0);
    setSummary(null);

    try {
      const result = await adjustmentsApi.uploadJournalEntries(
        companyId,
        file,
        (pct) => setProgress(pct),
      );
      setSummary({
        entryCount: result.entryCount,
        totalDebitCredit: result.totalDebitCredit,
        warnings: result.warnings ?? [],
      });
      setUploadState('success');
      onUploadComplete(result.entries);
    } catch (err: unknown) {
      setUploadState('idle');
      onError(err instanceof Error ? err.message : 'Failed to upload journal entries.');
    }
  }, [companyId, onUploadComplete, onError]);

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await adjustmentsApi.skipJournalEntries(companyId);
      setUploadState('skipped');
      setSummary(null);
      setFilename('');
      onSkip();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to skip journal entries.');
    } finally {
      setIsSkipping(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const canProceed = hasEntries || uploadState === 'skipped' || skipped;

  return (
    <Card title="Upload Adjustment Journal Entries" padding="md">
      <p className="text-sm mb-4" style={{ color: 'var(--ink-500)', lineHeight: 1.6 }}>
        Download the standard journal entry template, fill one entry per row, and upload it here.
        Processing will use these entries together with your uploaded trial balance.
        If you have no year-end adjustments, click the skip button below.
      </p>

      <div className="flex flex-wrap gap-3 mb-5">
        <Button
          variant="secondary"
          size="sm"
          loading={isDownloading}
          onClick={() => void handleDownloadTemplate()}
        >
          Download Excel Template
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={isSkipping}
          onClick={() => void handleSkip()}
        >
          No adjustment entries to upload
        </Button>
      </div>

      {uploadState === 'skipped' || skipped ? (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--success-50)', color: 'var(--success-700)', border: '1px solid var(--success-200)' }}
        >
          No adjustment journal entries will be applied. Processing will continue using trial balance and other inputs only.
        </div>
      ) : (
        <div
          className="rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer"
          style={{
            borderColor: isDragging ? 'var(--brand-500)' : 'var(--border-default)',
            background: isDragging ? 'var(--brand-50)' : 'var(--surface-raised)',
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />

          {uploadState === 'uploading' ? (
            <div className="max-w-xs mx-auto space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--ink-700)' }}>
                Uploading {filename}…
              </p>
              <ProgressBar value={progress} />
            </div>
          ) : uploadState === 'success' && summary ? (
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--success-700)' }}>
                {summary.entryCount} journal {summary.entryCount === 1 ? 'entry' : 'entries'} imported
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                Total amount: NPR {summary.totalDebitCredit.toLocaleString('en-IN')} (Dr = Cr)
              </p>
              {summary.warnings.length > 0 && (
                <ul className="mt-2 text-xs text-left max-w-md mx-auto" style={{ color: 'var(--warning-700)' }}>
                  {summary.warnings.map((w) => <li key={w}>• {w}</li>)}
                </ul>
              )}
              <p className="text-xs mt-3" style={{ color: 'var(--ink-400)' }}>
                Click or drop to replace with a different file
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-700)' }}>
                Drop your filled journal entry Excel here
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                or click to browse — .xlsx / .xls only
              </p>
            </>
          )}
        </div>
      )}

      {!canProceed && uploadState === 'idle' && (
        <p className="text-xs mt-3" style={{ color: 'var(--ink-400)' }}>
          Upload your filled template or click &quot;No adjustment entries to upload&quot; to continue.
        </p>
      )}
    </Card>
  );
}
