import ExcelJS from 'exceljs';
import {
  worksheetToMatrix,
  parseCSVText,
  parseMatrix,
  parseDualYearMatrix,
} from './tbParser.js';
import { extractTableMatrixFromPdf } from './pdfTableExtractor.js';
import { finalizeRawTBRows } from './tbHierarchy.js';
import { classifyAll } from './accountMatcher.js';
import type { MappedTBRow, RawTBParseResult, RawTBRow } from '../../src/types/trialBalance.js';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

export function heuristicFallbackClassify(rows: MappedTBRow[]): MappedTBRow[] {
  return rows.map((row) => {
    if (row.isGroupRow || row.nfrsCategory !== 'unclassified') return row;
    const netDr = row.closingDr - row.closingCr;
    const category = netDr >= 0 ? 'other_current_assets' : 'other_current_liabilities';
    return {
      ...row,
      nfrsCategory: category,
      confidence: 20,
      needsReview: true,
      matchMethod: 'unmatched',
    };
  });
}

async function loadMatrixFromBuffer(buffer: Buffer, filename: string): Promise<{
  matrix: unknown[][];
  pdfMeta?: { pageCount: number; warnings: string[] };
}> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  if (ext === '.csv') {
    return { matrix: parseCSVText(buffer.toString('utf-8')) };
  }

  if (ext === '.pdf') {
    const pdfResult = await extractTableMatrixFromPdf(buffer);
    if (!pdfResult.hasExtractableText) {
      throw Object.assign(new Error(pdfResult.warnings[0] ?? 'PDF has no extractable text.'), { status: 422 });
    }
    return {
      matrix: pdfResult.matrix,
      pdfMeta: { pageCount: pdfResult.pageCount, warnings: pdfResult.warnings },
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const primaryWs =
    workbook.getWorksheet('Trial Balance') ??
    workbook.getWorksheet('TB') ??
    workbook.worksheets[0];
  if (!primaryWs) {
    throw new Error('The uploaded workbook has no worksheets.');
  }
  return { matrix: worksheetToMatrix(primaryWs) };
}

export async function convertTrialBalanceLocally(
  buffer: Buffer,
  filename: string,
): Promise<RawTBParseResult & { detectedFormat: string }> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (IMAGE_EXTENSIONS.has(ext)) {
    throw Object.assign(
      new Error('Image-based scans require AI OCR. Please upload a PDF with a text layer, or export to Excel/CSV.'),
      { status: 415 },
    );
  }

  const { matrix, pdfMeta } = await loadMatrixFromBuffer(buffer, filename);
  const nonEmptyRows = matrix.filter((row) => !isRowEmpty(row as unknown[]));

  if (nonEmptyRows.length === 0) {
    throw Object.assign(new Error('No data rows found in the uploaded file.'), { status: 422 });
  }

  const dualYear = parseDualYearMatrix(matrix);
  let parsed: RawTBParseResult;
  let previousYearData: RawTBRow[] | null = null;

  if (dualYear) {
    parsed = dualYear.currentYear;
    previousYearData = dualYear.previousYear;
  } else {
    parsed = parseMatrix(matrix);
  }

  const finalized = finalizeRawTBRows(parsed.rows, {
    format: parsed.detectedFormat,
    grandTotalDuring: parsed.grandTotalDuring,
  });
  const classified = heuristicFallbackClassify(classifyAll(finalized.rows));

  const leafRows = classified.filter((r) => !r.isGroupRow);
  const highConfidence = leafRows.filter((r) => (r.confidence ?? 0) >= 80).length;
  const needsReview = leafRows.filter((r) => r.needsReview).length;

  const warnings = [
    ...parsed.warnings,
    ...finalized.warnings,
    `${highConfidence} of ${leafRows.length} accounts auto-classified with high confidence (≥80%).`,
    `${needsReview} account(s) flagged for review.`,
  ];

  if (pdfMeta) {
    warnings.push(`PDF text extracted from ${pdfMeta.pageCount} page(s).`);
    warnings.push(...pdfMeta.warnings);
  }

  return {
    rows: finalized.rows,
    ...finalized.totals,
    warnings,
    detectedColumns: parsed.detectedColumns,
    headerRowIndex: parsed.headerRowIndex,
    detectedFormat: 'local_intelligent',
    previousYearData,
  };
}
