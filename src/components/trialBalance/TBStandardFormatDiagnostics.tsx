import React from 'react';
import Button from '../ui/Button';
import { Download } from 'lucide-react';

export interface TbDiagnosticIssue {
  severity: 'error' | 'warning';
  category: 'structure' | 'headers' | 'sections' | 'accounts' | 'balances' | 'arithmetic';
  message: string;
  sheetName?: string;
  rowNumber?: number;
  columnLetter?: string;
  suggestedFix?: string;
}

export interface TbStandardValidationResult {
  isStandardFormat: boolean;
  issues: TbDiagnosticIssue[];
  matchedAccountCount: number;
  totalExpectedAccounts: number;
  detectedSections: string[];
  missingSections: string[];
  unexpectedSections: string[];
}

const CATEGORY_LABELS: Record<TbDiagnosticIssue['category'], string> = {
  structure: 'Structure',
  headers: 'Headers',
  sections: 'Sections',
  accounts: 'Accounts',
  balances: 'Balances',
  arithmetic: 'Arithmetic',
};

interface TBStandardFormatDiagnosticsProps {
  diagnostics: TbStandardValidationResult;
  onDownloadTemplate: () => void;
  isDownloading?: boolean;
}

export default function TBStandardFormatDiagnostics({
  diagnostics,
  onDownloadTemplate,
  isDownloading = false,
}: TBStandardFormatDiagnosticsProps) {
  const errorCount = diagnostics.issues.filter((i) => i.severity === 'error').length;
  const grouped = diagnostics.issues.reduce<Record<string, TbDiagnosticIssue[]>>((acc, issue) => {
    const key = issue.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{ borderColor: 'var(--danger-200)', background: 'var(--danger-50)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--danger-800)' }}>
            Standard format validation failed
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--danger-700)' }}>
            {diagnostics.matchedAccountCount} of {diagnostics.totalExpectedAccounts} expected accounts found — {errorCount} structural error{errorCount === 1 ? '' : 's'} must be fixed before this file can be imported.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Download className="h-4 w-4" />}
          onClick={onDownloadTemplate}
          loading={isDownloading}
          disabled={isDownloading}
        >
          Download Standard Template
        </Button>
      </div>

      <div className="space-y-3">
        {(Object.keys(CATEGORY_LABELS) as TbDiagnosticIssue['category'][]).map((category) => {
          const issues = grouped[category];
          if (!issues?.length) return null;
          return (
            <div key={category}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-600)' }}>
                {CATEGORY_LABELS[category]}
              </p>
              <ul className="space-y-2">
                {issues.map((issue, idx) => (
                  <li
                    key={`${category}-${idx}`}
                    className="rounded-md px-3 py-2 text-xs"
                    style={{
                      background: issue.severity === 'error' ? 'var(--danger-100)' : 'var(--warning-50)',
                      border: `1px solid ${issue.severity === 'error' ? 'var(--danger-200)' : 'var(--warning-200)'}`,
                      color: issue.severity === 'error' ? 'var(--danger-800)' : 'var(--warning-800)',
                    }}
                  >
                    <p>{issue.message}</p>
                    {(issue.sheetName || issue.rowNumber || issue.columnLetter) && (
                      <p className="mt-1 opacity-80">
                        {[
                          issue.sheetName ? `Sheet: ${issue.sheetName}` : null,
                          issue.rowNumber ? `Row ${issue.rowNumber}` : null,
                          issue.columnLetter ? `Column ${issue.columnLetter}` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {issue.suggestedFix && (
                      <p className="mt-1 font-medium">{issue.suggestedFix}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
