// ===== src/components/trialBalance/TBUploadZone.tsx =====
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ParsedTrialBalance } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import Alert from '../ui/Alert';

interface TBUploadZoneProps {
  companyId: string;
  onUploadComplete: (result: ParsedTrialBalance) => void;
  onError: (error: string) => void;
  existingTB?: ParsedTrialBalance | null;
  useAI?: boolean;
}

const SOFTWARE_INSTRUCTIONS = [
  { name: 'Tally ERP 9 / Tally Prime', steps: 'Gateway of Tally → Display → Account Books → Trial Balance → Export → Format: Excel (.xlsx)' },
  { name: 'Busy', steps: 'Reports → Account Books → Trial Balance → Export → Excel' },
  { name: 'Marg', steps: 'Accounts → Reports → Trial Balance → Export Excel' },
  { name: 'Zoho Books', steps: 'Reports → Accountant → Trial Balance → Export → Download as Excel' },
  { name: 'Other / Custom', steps: 'Export any tabular file with Account Name, Debit, Credit columns. CSV or Excel both accepted.' },
];

export default function TBUploadZone({ companyId, onUploadComplete, onError, existingTB, useAI = false }: TBUploadZoneProps): React.ReactElement {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [useAIToggle, setUseAIToggle] = useState(useAI);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('trialbalance', file);
    const url = `/api/trial-balance/${companyId}/upload${useAIToggle ? '?useAI=true' : ''}`;

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 90));
      });
      xhr.onload = () => {
        setUploadProgress(100);
        if (xhr.status >= 200 && xhr.status < 300) {
          const result: ParsedTrialBalance = JSON.parse(xhr.responseText);
          setUploadedFile(file.name);
          onUploadComplete(result);
          resolve();
        } else {
          const err = JSON.parse(xhr.responseText)?.error ?? 'Upload failed.';
          onError(err);
          reject(err);
        }
        setIsUploading(false);
      };
      xhr.onerror = () => { onError('Network error during upload.'); setIsUploading(false); reject(); };
      xhr.open('POST', url);
      xhr.send(formData);
    });
  }, [companyId, useAIToggle, onUploadComplete, onError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file).catch(() => {});
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file).catch(() => {});
  };

  const downloadSampleCSV = () => {
    const csv = `Account Name,Opening Dr,Opening Cr,During Dr,During Cr,Closing Dr,Closing Cr\nPaid-up Capital,0,5000000,0,0,0,5000000\nCash in Hand,10000,0,50000,30000,30000,0\nSales Revenue,0,0,0,1000000,0,1000000\nSalaries,0,0,500000,0,500000,0`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Sample_Trial_Balance.csv'; a.click();
  };

  if (existingTB && !isUploading && !uploadedFile) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Trial Balance Loaded</p>
              <p className="text-sm text-slate-500">{existingTB.rows?.length ?? 0} accounts · {existingTB.rows?.filter((r) => !r.needsReview)?.length ?? 0} auto-matched · {existingTB.rows?.filter((r) => r.needsReview)?.length ?? 0} need review</p>
            </div>
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => { setUploadedFile(null); fileInputRef.current?.click(); }}>Re-upload</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload zone */}
      <div className="lg:col-span-2">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
        <div
          className={['border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all', isDragOver ? 'border-blue-500 bg-blue-50' : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'].join(' ')}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          role="button" tabIndex={0} aria-label="Upload trial balance file"
        >
          {isUploading ? (
            <div className="space-y-4">
              <p className="text-blue-700 font-semibold text-lg">Uploading and classifying accounts…</p>
              {useAIToggle && <p className="text-blue-500 text-sm">Claude AI is analysing unmatched accounts…</p>}
              <ProgressBar value={uploadProgress} color="blue" size="md" showPercentage label="Processing" />
            </div>
          ) : (
            <>
              <UploadCloud className="mx-auto mb-4 text-blue-400" size={64} />
              <p className="text-xl font-semibold text-blue-700 mb-1">Drop your Trial Balance file here</p>
              <p className="text-slate-500 mb-3">or click to browse files</p>
              <p className="text-xs text-slate-400">Supported formats: Excel (.xlsx, .xls) · CSV (.csv)</p>
            </>
          )}
        </div>

        {/* AI toggle */}
        <label className="flex items-center gap-3 mt-4 cursor-pointer p-3 bg-purple-50 border border-purple-200 rounded-xl">
          <input type="checkbox" checked={useAIToggle} onChange={(e) => setUseAIToggle(e.target.checked)} className="rounded text-purple-600" />
          <div>
            <p className="text-sm font-semibold text-purple-800">Enable Claude AI for better account recognition</p>
            <p className="text-xs text-purple-600">Uses Anthropic Claude to suggest NFRS categories for accounts that couldn't be automatically matched</p>
          </div>
        </label>

        {uploadedFile && <Alert type="success" title="Upload Complete" message={`"${uploadedFile}" processed successfully. Review account mappings below.`} />}
      </div>

      {/* Instructions */}
      <Card title="How to Export Your Trial Balance" padding="sm">
        <div className="space-y-4">
          {SOFTWARE_INSTRUCTIONS.map((sw) => (
            <div key={sw.name} className="border-b border-slate-100 pb-3 last:border-0">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">{sw.name}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{sw.steps}</p>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={downloadSampleCSV}>
            ↓ Download Sample Format
          </Button>
        </div>
      </Card>
    </div>
  );
}
