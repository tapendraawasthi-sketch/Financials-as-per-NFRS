// src/components/trialBalance/TBUploadZone.tsx
import React, { useRef, useState, useCallback } from 'react';
import Card        from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import Button      from '../ui/Button';

interface UploadResult {
  filename:     string;
  accountCount: number;
  rowCount:     number;
}

interface TBUploadZoneProps {
  companyId:    string;
  onUploadComplete: (tb: any) => void;
  onError:      (msg: string) => void;
  useAI?:       boolean;
  onAIToggle?:  (on: boolean) => void;
  existingTB?:  any;
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
  onUploadComplete,
  onError,
  useAI = true,
  onAIToggle,
  existingTB,
}: TBUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress,    setProgress]    = useState(0);
  const [filename,    setFilename]    = useState('');
  const [result,      setResult]      = useState<UploadResult | null>(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [aiOn,        setAiOn]        = useState(useAI);

  const handleFile = useCallback(async (file: File) => {
    const allowed = ['xlsx', 'xls', 'csv'];
    const ext     = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowed.includes(ext)) {
      onError(`Unsupported file type: .${ext}. Please upload .xlsx, .xls, or .csv`);
      return;
    }

    setFilename(file.name);
    setUploadState('uploading');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    if (aiOn) formData.append('useAI', 'true');

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
    };

    xhr.onload = () => {
      setProgress(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const r: UploadResult = {
            filename:     file.name,
            accountCount: data.data?.rows?.length ?? 0,
            rowCount:     data.data?.rows?.length ?? 0,
          };
          setResult(r);
          setUploadState('success');
          onUploadComplete(data.data);
        } catch {
          setUploadState('error');
          onError('Server returned an unexpected response.');
        }
      } else {
        setUploadState('error');
        try {
          const d = JSON.parse(xhr.responseText);
          onError(d.error ?? 'Upload failed.');
        } catch {
          onError(`Upload failed with status ${xhr.status}.`);
        }
      }
    };

    xhr.onerror = () => {
      setUploadState('error');
      onError('Network error during upload. Please check your connection.');
    };

    xhr.open('POST', `/api/trial-balance/${companyId}/upload`);
    xhr.send(formData);
  }, [companyId, aiOn, onUploadComplete, onError]);

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
    fileRef.current?.click();
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
              aria-label="Upload trial balance file — click or drop file here"
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={[
                'border border-dashed rounded p-8 text-center cursor-pointer transition-colors',
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400',
              ].join(' ')}
            >
              <svg
                className="h-8 w-8 text-slate-300 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-slate-500">
                Drop file here or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Accepts .xlsx, .xls, .csv
              </p>
            </div>
          )}

          {/* Uploading state */}
          {uploadState === 'uploading' && (
            <div className="py-4 space-y-2">
              <p className="text-xs text-slate-600 truncate">Processing {filename}…</p>
              <ProgressBar value={progress} showValue size="md" />
            </div>
          )}

          {/* Success state */}
          {uploadState === 'success' && result && (
            <div className="flex items-center gap-2.5 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-slate-700 truncate flex-1" title={result.filename}>
                {result.filename} — {result.accountCount} accounts detected
              </span>
              <button
                type="button"
                onClick={handleReupload}
                className="text-xs text-blue-600 hover:text-blue-800 underline flex-shrink-0 transition-colors"
              >
                Re-upload
              </button>
            </div>
          )}

          {/* Error state */}
          {uploadState === 'error' && (
            <div className="flex items-center gap-2.5 py-2">
              <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-red-600 flex-1">Upload failed.</span>
              <button
                type="button"
                onClick={handleReupload}
                className="text-xs text-blue-600 hover:text-blue-800 underline flex-shrink-0"
              >
                Try again
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleInputChange}
            aria-hidden="true"
          />

          {/* AI toggle */}
          <div className="flex items-center justify-between py-2.5 border-t border-slate-100 mt-3">
            <div>
              <p className="text-xs text-slate-600 font-medium leading-none">
                Use AI Account Matching
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Claude AI improves classification of unrecognised accounts
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aiOn}
              aria-label="Toggle AI account matching"
              onClick={toggleAI}
              className={[
                'relative w-9 h-5 rounded-full flex-shrink-0 cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600',
                aiOn ? 'bg-blue-600' : 'bg-slate-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                  aiOn ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>
        </Card>
      </div>

      {/* ── Right: Instructions ────────────────────────────────────── */}
      <div className="col-span-2">
        <Card title="Export from Your Software" padding="sm">
          <div className="divide-y divide-slate-100">
            {EXPORT_PATHS.map(sw => (
              <div key={sw.name} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-xs font-medium text-slate-700">{sw.name}</p>
                <p className="text-xs text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded mt-0.5 leading-snug break-words">
                  {sw.path}
                </p>
              </div>
            ))}
          </div>

          <a
            href="/sample-trial-balance.csv"
            download
            className="text-xs text-blue-600 hover:text-blue-800 underline mt-3 block transition-colors"
          >
            Download sample CSV format
          </a>
        </Card>
      </div>
    </div>
  );
}
