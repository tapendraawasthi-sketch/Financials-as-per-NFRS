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
  BalanceSheet,
  IncomeStatement,
  ChangesInEquity,
  CashFlowStatement,
  NotesData,
} from '../types';
import { ValidationResult } from '../utils/validation';

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
    apiRequest<CompanyProfile>('PUT', `/api/company/${id}/policies`, policies),

  getFiscalYearOptions: (): Promise<{ value: string; label: string }[]> =>
    apiRequest<{ value: string; label: string }[]>('GET', '/api/company/fiscal-years/options'),
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
  ): Promise<ParsedTrialBalance> =>
    new Promise<ParsedTrialBalance>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('trialbalance', file);

      // Progress handler
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 90); // 90% for upload; 10% for server parsing
          onProgress(pct);
        }
      };

      // Load handler
      xhr.onload = () => {
        if (onProgress) onProgress(100);
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data as ParsedTrialBalance);
          } else {
            reject(new Error(data?.error || `Upload failed with status ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Failed to parse server response: ${xhr.responseText.slice(0, 200)}`));
        }
      };

      // Error handlers
      xhr.onerror = () => reject(new Error('Network error during upload. Please check your connection.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again with a smaller file.'));
      xhr.timeout = 120000; // 2-minute timeout

      // Open and send
      const url = `/api/trial-balance/${companyId}/upload${useAI ? '?useAI=true' : ''}`;
      xhr.open('POST', url);
      xhr.send(formData);
    }),

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

  rematchWithAI: (companyId: string): Promise<ParsedTrialBalance> =>
    apiRequest<ParsedTrialBalance>('POST', `/api/trial-balance/${companyId}/rematch`),

  getValidation: (companyId: string): Promise<ValidationResult> =>
    apiRequest<ValidationResult>('GET', `/api/trial-balance/${companyId}/validation`),

  saveSubledgers: (
    companyId: string,
    subledgers: {
      debtors?: unknown[];
      creditors?: unknown[];
      banks?: unknown[];
      relatedParties?: unknown[];
      borrowings?: unknown[];
    },
  ): Promise<{ saved: boolean }> =>
    apiRequest<{ saved: boolean }>('POST', `/api/trial-balance/${companyId}/subledgers`, subledgers),
};

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

  getByCompany: (companyId: string): Promise<YearEndAdjustments> =>
    apiRequest<YearEndAdjustments>('GET', `/api/adjustments/${companyId}`),

  calculateAll: (companyId: string): Promise<YearEndAdjustments> =>
    apiRequest<YearEndAdjustments>('POST', `/api/adjustments/${companyId}/calculate-all`),
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
