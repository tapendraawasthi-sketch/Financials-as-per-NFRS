import {
  CompanyProfile,
  AccountingPolicies,
  ParsedTrialBalance,
  NFRSCategory,
  AssetItem,
  DepreciationResult,
  DepreciationSummary,
  ProvisionEntry,
  InventoryAdjustment,
  InvestmentAdjustment,
  YearEndAdjustments,
  JournalEntry,
  BalanceSheet,
  IncomeStatement,
  ChangesInEquity,
  CashFlowStatement,
  NotesData,
} from '../types';
import { ValidationResult } from '../utils/validation';
import type { NormalizedTrialBalancePreview, RawTBRow } from '../types/trialBalance';

// ── Base fetch wrapper ─────────────────────────────────────────────────────────

async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Response may not be JSON — use status text
    }
    throw new Error(errorMessage);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ── Company API ────────────────────────────────────────────────────────────────

export const companyApi = {
  create: (data: Partial<CompanyProfile>): Promise<CompanyProfile> =>
    apiRequest<CompanyProfile>('POST', '/api/company', data),

  getById: (id: string): Promise<CompanyProfile> =>
    apiRequest<CompanyProfile>('GET', `/api/company/${id}`),

  update: (id: string, data: Partial<CompanyProfile>): Promise<CompanyProfile> =>
    apiRequest<CompanyProfile>('PUT', `/api/company/${id}`, data),

  savePolicies: (id: string, policies: AccountingPolicies): Promise<CompanyProfile> =>
    apiRequest<CompanyProfile>('POST', `/api/company/${id}/policies`, policies),

  getFiscalYearOptions: (): Promise<{ value: string; label: string }[]> =>
    apiRequest<{ value: string; label: string }[]>('GET', '/api/company/fiscal-years/options'),

  ensure: (data: Partial<CompanyProfile>): Promise<CompanyProfile> =>
    apiRequest<CompanyProfile>('POST', '/api/company/ensure', data),
};

// ── Trial Balance API ──────────────────────────────────────────────────────────

export const tbApi = {
  /**
   * Upload a trial balance file with progress tracking via XMLHttpRequest.
   * Falls back to standard fetch if XMLHttpRequest is not available.
   */
  upload: (
    companyId: string,
    file: File,
    useAI: boolean = false,
    onProgress?: (pct: number) => void,
    companySnapshot?: Partial<CompanyProfile>,
  ): Promise<ParsedTrialBalance> =>
    new Promise<ParsedTrialBalance>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('trialbalance', file);
      if (companySnapshot) {
        formData.append('company', JSON.stringify(companySnapshot));
      }

      // Progress handler — upload bytes only (0–70%)
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 70);
          onProgress(pct);
        }
      };

      xhr.upload.onloadend = () => {
        if (onProgress) onProgress(75);
      };

      // Load handler
      xhr.onload = () => {
        if (onProgress) onProgress(100);
        try {
          const data = JSON.parse(xhr.responseText) as {
            success?: boolean;
            data?: ParsedTrialBalance;
            error?: string;
            code?: string;
            diagnostics?: unknown;
          };
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data.data ?? (data as unknown as ParsedTrialBalance));
          } else if (xhr.status === 422) {
            if (data.code === 'NOT_STANDARD_FORMAT') {
              const err = new Error(data.error || 'This file does not match the standard trial balance template.') as Error & {
                code?: string;
                diagnostics?: unknown;
              };
              err.code = data.code;
              err.diagnostics = data.diagnostics;
              reject(err);
            } else if (data.data) {
              resolve(data.data);
            } else {
              reject(new Error(data.error || `Upload failed with status ${xhr.status}`));
            }
          } else {
            reject(new Error(data.error || `Upload failed with status ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Failed to parse server response: ${xhr.responseText.slice(0, 200)}`));
        }
      };

      // Error handlers
      xhr.onerror = () => reject(new Error('Network error during upload. Please check your connection.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again with a smaller file.'));
      xhr.timeout = useAI ? 180_000 : 120_000;

      // Open and send
      const url = `/api/trial-balance/${companyId}/upload${useAI ? '?useAI=true' : ''}`;
      xhr.open('POST', url);
      xhr.send(formData);
    }),

  downloadTemplate: async (): Promise<Blob> => {
    const response = await fetch('/api/trial-balance/template/download');
    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Downloaded template is empty.');
    return blob;
  },

  aiConvertUpload: (
    companyId: string,
    file: File,
    onProgress?: (pct: number) => void,
    companySnapshot?: Partial<CompanyProfile>,
  ): Promise<ParsedTrialBalance> =>
    new Promise<ParsedTrialBalance>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('trialbalance', file);
      if (companySnapshot) {
        formData.append('company', JSON.stringify(companySnapshot));
      }

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 40));
        }
      };
      xhr.upload.onloadend = () => { if (onProgress) onProgress(45); };

      xhr.onload = () => {
        if (onProgress) onProgress(100);
        try {
          const data = JSON.parse(xhr.responseText) as {
            success?: boolean;
            data?: ParsedTrialBalance;
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data.data ?? (data as unknown as ParsedTrialBalance));
          } else {
            reject(new Error(data.error || `AI import failed with status ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Failed to parse server response: ${xhr.responseText.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during AI import. Please check your connection.'));
      xhr.ontimeout = () => reject(new Error('AI import timed out. Please try again or use Manual Upload.'));
      xhr.timeout = 300_000;

      xhr.open('POST', `/api/trial-balance/${companyId}/ai-convert`);
      xhr.send(formData);
    }),

  parsePreviewUpload: (
    companyId: string,
    file: File,
    mode: 'manual' | 'ai' = 'manual',
    onProgress?: (pct: number) => void,
    companySnapshot?: Partial<CompanyProfile>,
  ): Promise<NormalizedTrialBalancePreview> =>
    new Promise<NormalizedTrialBalancePreview>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('trialbalance', file);
      if (companySnapshot) {
        formData.append('company', JSON.stringify(companySnapshot));
      }

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * (mode === 'ai' ? 40 : 70)));
        }
      };
      xhr.upload.onloadend = () => { if (onProgress) onProgress(mode === 'ai' ? 45 : 75); };

      xhr.onload = () => {
        if (onProgress) onProgress(100);
        try {
          const data = JSON.parse(xhr.responseText) as {
            success?: boolean;
            data?: NormalizedTrialBalancePreview;
            error?: string;
            code?: string;
            diagnostics?: unknown;
          };
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data.data ?? (data as unknown as NormalizedTrialBalancePreview));
          } else if (xhr.status === 422 && data.code === 'NOT_STANDARD_FORMAT') {
            const err = new Error(data.error || 'This file does not match the standard trial balance template.') as Error & {
              code?: string;
              diagnostics?: unknown;
            };
            err.code = data.code;
            err.diagnostics = data.diagnostics;
            reject(err);
          } else {
            reject(new Error(data.error || `Parse preview failed with status ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Failed to parse server response: ${xhr.responseText.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out.'));
      xhr.timeout = mode === 'ai' ? 300_000 : 120_000;

      xhr.open('POST', `/api/trial-balance/${companyId}/parse-preview?mode=${mode}`);
      xhr.send(formData);
    }),

  confirmNormalized: (
    companyId: string,
    rows: RawTBRow[],
    useAI?: boolean,
  ): Promise<ParsedTrialBalance> =>
    apiRequest<ParsedTrialBalance>('POST', `/api/trial-balance/${companyId}/confirm-normalized`, {
      rows,
      useAI,
    }),

  exportNormalized: async (companyId: string, rows?: RawTBRow[]): Promise<Blob> => {
    if (rows?.length) {
      await apiRequest('POST', `/api/trial-balance/${companyId}/normalized/save`, { rows });
    }
    const response = await fetch(`/api/trial-balance/${companyId}/normalized/export`);
    if (!response.ok) {
      let message = `Export failed: ${response.status}`;
      try {
        const body = await response.json();
        if (body.error) message = body.error;
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return response.blob();
  },

  getByCompany: (companyId: string): Promise<ParsedTrialBalance> =>
    apiRequest<ParsedTrialBalance>('GET', `/api/trial-balance/${companyId}`),

  updateMapping: (
    companyId: string,
    updates: Array<{ rowIndex: number; nfrsCategory: NFRSCategory; matchedLabel: string }>,
  ): Promise<ParsedTrialBalance> =>
    apiRequest<ParsedTrialBalance>('PUT', `/api/trial-balance/${companyId}/mapping`, { updates }),

  updateSingleMapping: (
    companyId: string,
    rowIndex: number,
    nfrsCategory: NFRSCategory,
  ): Promise<{ updated: boolean; row: unknown }> =>
    apiRequest('PUT', `/api/trial-balance/${companyId}/mapping/${rowIndex}`, { nfrsCategory }),

  rematchWithAI: (companyId: string): Promise<{ updatedCount: number; trialBalance: ParsedTrialBalance }> =>
    apiRequest<{ updatedCount: number; trialBalance: ParsedTrialBalance }>(
      'POST',
      `/api/trial-balance/${companyId}/rematch-ai`,
    ),

  getValidation: (companyId: string): Promise<ValidationResult> =>
    apiRequest<ValidationResult>('GET', `/api/trial-balance/${companyId}/validation`),
};

export async function saveDebtorSubledger(
  companyId: string,
  data: { debtors: unknown[] },
): Promise<unknown> {
  try {
    return await apiRequest('POST', '/api/adjustments/subledger/debtors', { companyId, ...data });
  } catch (err: unknown) {
    throw err instanceof Error ? err : new Error('Failed to save debtor subledger.');
  }
}

export async function saveCreditorSubledger(
  companyId: string,
  data: { creditors: unknown[] },
): Promise<unknown> {
  try {
    return await apiRequest('POST', '/api/adjustments/subledger/creditors', { companyId, ...data });
  } catch (err: unknown) {
    throw err instanceof Error ? err : new Error('Failed to save creditor subledger.');
  }
}

export async function saveBankSubledger(
  companyId: string,
  data: { bankAccounts: unknown[] },
): Promise<unknown> {
  try {
    return await apiRequest('POST', '/api/adjustments/subledger/bank-accounts', { companyId, ...data });
  } catch (err: unknown) {
    throw err instanceof Error ? err : new Error('Failed to save bank subledger.');
  }
}

export async function saveRelatedPartySubledger(
  companyId: string,
  data: { relatedParties: unknown[] },
): Promise<unknown> {
  try {
    return await apiRequest('POST', '/api/adjustments/subledger/related-parties', { companyId, ...data });
  } catch (err: unknown) {
    throw err instanceof Error ? err : new Error('Failed to save related party subledger.');
  }
}

// ── Adjustments API ────────────────────────────────────────────────────────────

export const adjustmentsApi = {
  saveAssets: (companyId: string, assets: AssetItem[]): Promise<{ saved: boolean }> =>
    apiRequest<{ saved: boolean }>('POST', `/api/adjustments/${companyId}/assets`, { assets }),

  calculateDepreciation: (
    companyId: string,
  ): Promise<{ results: DepreciationResult[]; summary: DepreciationSummary[] }> =>
    apiRequest<{ results: DepreciationResult[]; summary: DepreciationSummary[] }>(
      'POST', `/api/adjustments/${companyId}/calculate-depreciation`
    ),

  saveProvisions: (
    companyId: string,
    provisions: ProvisionEntry[],
  ): Promise<{ saved: boolean }> =>
    apiRequest<{ saved: boolean }>('POST', `/api/adjustments/${companyId}/provisions`, { provisions }),

  saveInventory: (
    companyId: string,
    items: InventoryAdjustment[],
  ): Promise<{ saved: boolean }> =>
    apiRequest<{ saved: boolean }>('POST', `/api/adjustments/${companyId}/inventory`, { items }),

  saveInvestments: (
    companyId: string,
    items: InvestmentAdjustment[],
  ): Promise<{ saved: boolean }> =>
    apiRequest<{ saved: boolean }>('POST', `/api/adjustments/${companyId}/investments`, { items }),

  saveAdvanceTax: (
    companyId: string,
    data: Pick<
      YearEndAdjustments,
      | 'advanceTax1' | 'advanceTax2' | 'advanceTax3'
      | 'advanceTaxDaysLate1' | 'advanceTaxDaysLate2' | 'advanceTaxDaysLate3'
      | 'tdsCredit' | 'priorYearLosses'
    >,
  ): Promise<{ saved: boolean }> =>
    apiRequest('POST', `/api/adjustments/${companyId}/advance-tax`, data),

  saveDisallowedForTax: (
    companyId: string,
    disallowedForTax: YearEndAdjustments['disallowedForTax'],
  ): Promise<{ saved: boolean }> =>
    apiRequest('POST', `/api/adjustments/${companyId}/disallowed-tax`, { disallowedForTax }),

  getByCompany: (companyId: string): Promise<YearEndAdjustments> =>
    apiRequest<YearEndAdjustments>('GET', `/api/adjustments/${companyId}`),

  calculateAll: (companyId: string): Promise<YearEndAdjustments> =>
    apiRequest<YearEndAdjustments>('POST', `/api/adjustments/${companyId}/calculate-all`),

  downloadJournalTemplate: async (companyName?: string): Promise<Blob> => {
    const qs = companyName ? `?companyName=${encodeURIComponent(companyName)}` : '';
    const response = await fetch(`/api/adjustments/journal-template/download${qs}`);
    if (!response.ok) {
      throw new Error(`Failed to download journal template: ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Downloaded journal template is empty.');
    return blob;
  },

  uploadJournalEntries: (
    companyId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{
    entries: JournalEntry[];
    groups: import('../types/adjustments').JournalEntryGroup[];
    entryCount: number;
    groupCount: number;
    totalDebitCredit: number;
    warnings: string[];
  }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('journalentries', file);

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 90));
        }
      };
      xhr.upload.onloadend = () => { if (onProgress) onProgress(95); };

      xhr.onload = () => {
        if (onProgress) onProgress(100);
        try {
          const data = JSON.parse(xhr.responseText) as {
            success?: boolean;
            entries?: JournalEntry[];
            groups?: import('../types/adjustments').JournalEntryGroup[];
            entryCount?: number;
            groupCount?: number;
            totalDebitCredit?: number;
            warnings?: string[];
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && data.success !== false) {
            resolve({
              entries: data.entries ?? [],
              groups: data.groups ?? [],
              entryCount: data.entryCount ?? data.entries?.length ?? 0,
              groupCount: data.groupCount ?? data.groups?.length ?? data.entryCount ?? 0,
              totalDebitCredit: data.totalDebitCredit ?? 0,
              warnings: data.warnings ?? [],
            });
          } else {
            reject(new Error(data.error || `Upload failed with status ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Failed to parse server response: ${xhr.responseText.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during journal upload.'));
      xhr.open('POST', `/api/adjustments/${companyId}/journals/upload`);
      xhr.send(formData);
    }),

  skipJournalEntries: (companyId: string): Promise<{ journalEntriesSkipped: boolean }> =>
    apiRequest('POST', `/api/adjustments/${companyId}/journals/skip`),

  saveJournals: (companyId: string, entries: JournalEntry[]): Promise<{ count: number }> =>
    apiRequest('POST', `/api/adjustments/${companyId}/journals`, { entries }),
};

// ── Financials API ─────────────────────────────────────────────────────────────

export const financialsApi = {
  generate: (companyId: string): Promise<{
    balanceSheet: BalanceSheet;
    incomeStatement: IncomeStatement;
    changesInEquity: ChangesInEquity;
    cashFlow: CashFlowStatement;
    notes: NotesData;
  }> =>
    apiRequest('POST', `/api/financials/${companyId}/generate`),

  getBalanceSheet: (companyId: string): Promise<BalanceSheet> =>
    apiRequest<BalanceSheet>('GET', `/api/financials/${companyId}/balance-sheet`),

  getIncomeStatement: (companyId: string): Promise<IncomeStatement> =>
    apiRequest<IncomeStatement>('GET', `/api/financials/${companyId}/income-statement`),

  getCashFlow: (companyId: string): Promise<CashFlowStatement> =>
    apiRequest<CashFlowStatement>('GET', `/api/financials/${companyId}/cash-flow`),

  getChangesInEquity: (companyId: string): Promise<ChangesInEquity> =>
    apiRequest<ChangesInEquity>('GET', `/api/financials/${companyId}/equity`),

  getNotes: (companyId: string): Promise<NotesData> =>
    apiRequest<NotesData>('GET', `/api/financials/${companyId}/notes`),
};

// ── Output API ─────────────────────────────────────────────────────────────────

export const outputApi = {
  generateExcel: async (
    companyId: string,
    companyName: string,
    fiscalYear: string,
  ): Promise<Blob> => {
    const response = await fetch(`/api/output/${companyId}/generate-excel`, {
      method: 'POST',
    });

    if (!response.ok) {
      let errorMessage = `Excel generation failed: ${response.status}`;
      try {
        const errData = await response.json();
        errorMessage = errData.error || errorMessage;
      } catch {
        // Non-JSON error response
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Generated Excel file is empty. Please try again.');
    }
    return blob;
  },

  /**
   * Helper: trigger browser download of a Blob.
   */
  triggerDownload: (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Delay revoke to allow download to start
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
