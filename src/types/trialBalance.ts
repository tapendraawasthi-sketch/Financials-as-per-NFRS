// RawTBRow — one row straight from the uploaded file, before classification
export interface RawTBRow {
  rowIndex: number;
  rawLabel: string;          // as it appears in file
  openingDr: number;
  openingCr: number;
  duringDr: number;
  duringCr: number;
  adjustmentDr: number;
  adjustmentCr: number;
  closingDr: number;
  closingCr: number;
  rowLevel: number;          // 0=group header, 1=subgroup, 2=leaf ledger
  isGroupRow: boolean;
  parentGroup: string;
  rawIndentSpaces: number;
}

// RawTBParseResult — what tbParser.ts returns
export interface RawTBParseResult {
  rows: RawTBRow[];
  totalOpeningDr: number; totalOpeningCr: number;
  totalDuringDr: number;  totalDuringCr: number;
  totalClosingDr: number; totalClosingCr: number;
  isBalanced: boolean;
  difference: number;
  warnings: string[];
  detectedColumns: Record<string, number>;
  headerRowIndex: number;
  detectedFormat: 'full' | '3col' | '2col' | '1col' | 'tally_prime' | 'tally_grouped' | 'ai_converted' | 'local_intelligent';
  previousYearData?: RawTBRow[] | null;
}

// Intermediate parse result before classification — shown in normalized preview step
export interface NormalizedTrialBalancePreview extends RawTBParseResult {
  companyId?: string;
  uploadedAt?: string;
  uploadedFileName?: string;
  importMode?: 'manual' | 'ai';
  mappingProfileAppliedCount?: number;
  mappingProfileTotalAccounts?: number;
  previousYearData?: RawTBRow[] | null;
}

// NFRSCategory — the complete taxonomy (see chartOfAccounts.ts)
export type NFRSCategory = string;

// MappedTBRow — after classification
export interface MappedTBRow extends RawTBRow {
  nfrsCategory: NFRSCategory | 'unclassified';
  matchMethod: 'exact'|'synonym'|'keyword'|'context'|'fuzzy'|'ai'|'manual'|'unmatched';
  confidence: number;       // 0–100
  needsReview: boolean;     // confidence < 75 or unclassified
  userOverride: boolean;
  displayLabel: string;     // cleaned label for statements
}

// ParsedTrialBalance — after mapping + user review
export interface ParsedTrialBalance {
  rows: MappedTBRow[];
  companyName: string;
  fiscalYear: string;
  isBalanced: boolean;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  warnings: string[];
  detectedFormat?: RawTBParseResult['detectedFormat'];
  detectedColumns?: Record<string, number>;
  headerRowIndex?: number;
  previousYearData?: RawTBRow[] | null;
  leafAccountCount?: number;
  groupRowCount?: number;
  totalClosingDr?: number;
  totalClosingCr?: number;
  difference?: number;
  uploadedAt?: string;
  uploadedFileName?: string;
  mappingProfileAppliedCount?: number;
  mappingProfileTotalAccounts?: number;
  importMode?: 'manual' | 'ai';
  standardFormatWarnings?: Array<{
    severity: 'error' | 'warning';
    category: string;
    message: string;
    sheetName?: string;
    rowNumber?: number;
    columnLetter?: string;
    suggestedFix?: string;
  }>;
}
