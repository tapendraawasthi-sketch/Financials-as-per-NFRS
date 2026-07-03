import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { FileSpreadsheet, Sparkles, Download, ArrowRight } from 'lucide-react';

interface TBInputModeSelectorProps {
  onSelectManual: () => void;
  onSelectAI: () => void;
  onDownloadTemplate: () => void;
  isDownloading?: boolean;
}

export default function TBInputModeSelector({
  onSelectManual,
  onSelectAI,
  onDownloadTemplate,
  isDownloading = false,
}: TBInputModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card
        padding="lg"
        className="h-full hover:shadow-lg transition-all"
      >
        <div className="flex flex-col h-full" tabIndex={0}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-4">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Manual Upload — Standard Format
          </h2>
          <p className="text-sm text-slate-600 mb-5 flex-1">
            Download the official NAS for MEs Trial Balance template, fill in your account
            balances exactly as instructed, and upload it back. This is the fastest and most
            accurate path — no AI involved.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={onDownloadTemplate}
              loading={isDownloading}
              disabled={isDownloading}
            >
              {isDownloading ? 'Downloading…' : 'Download Template'}
            </Button>
            <Button
              type="button"
              variant="primary"
              iconRight={<ArrowRight className="h-4 w-4" />}
              onClick={onSelectManual}
            >
              Continue with Standard Upload
            </Button>
          </div>
        </div>
      </Card>

      <Card
        padding="lg"
        className="h-full hover:shadow-lg transition-all"
      >
        <div className="flex flex-col h-full" tabIndex={0}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 mb-4">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-base font-semibold text-slate-900">
              AI-Powered Smart Import
            </h2>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-100">
              Powered by Claude AI
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-5 flex-1">
            Upload your trial balance directly from Tally, Swastik, Busy, or any accounting
            software — in whatever format it already comes in. Our AI reads, restructures, and
            classifies every account automatically.
          </p>
          <Button
            type="button"
            variant="primary"
            iconRight={<ArrowRight className="h-4 w-4" />}
            onClick={onSelectAI}
          >
            Continue with AI Import
          </Button>
        </div>
      </Card>
    </div>
  );
}
