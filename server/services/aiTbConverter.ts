// ===== server/services/aiTbConverter.ts =====
import Anthropic from '@anthropic-ai/sdk';
import ExcelJS from 'exceljs';
import { worksheetToMatrix, parseCSVText } from './tbParser.js';
import { finalizeRawTBRows } from './tbHierarchy.js';
import type { RawTBRow, RawTBParseResult } from '../../src/types/trialBalance.js';

const BATCH_SIZE = 100;

const SYSTEM_PROMPT =
  'You are an expert Nepali chartered accountant assistant. You will be ' +
  'given raw rows extracted from a messy, unstructured, or non-standard ' +
  'trial balance export from Nepali accounting software (Tally, Swastik, ' +
  'Busy, or similar). Extract ALL rows in document order, including section ' +
  'and group header rows (e.g. "Property, Plant & Equipment", "Employee Benefit ' +
  'Expenses") even when they have no numeric balance. For group headers set ' +
  'isGroupRow=true, all amount fields to 0, and infer rawIndentSpaces from ' +
  'leading spaces in the label (2 spaces per indent level). For leaf ledger ' +
  'accounts with balances, set isGroupRow=false and populate amounts. Set ' +
  'parentGroup to the nearest group header above each leaf row. IGNORE: company ' +
  'name/address rows, titles, date ranges, blank rows, and any ' +
  "'Total'/'Grand Total'/subtotal rows. Balances are sometimes shown as a " +
  "single combined value like '1,43,51,552.00 Cr' or '9,664.55 Dr' — split " +
  'these correctly into the Dr or Cr field based on the suffix and remove ' +
  'commas. If a row has separate Opening/Debit/Credit/Closing columns, map ' +
  'them precisely. If only a closing balance exists, populate closingDr or ' +
  'closingCr only, leave opening/during at 0. If opening and during-period ' +
  'columns exist but closing is missing, leave closing at 0 (the server will ' +
  'derive closing). Never invent numbers you do not see. Respond with ONLY a ' +
  'raw JSON array, no markdown fences, no commentary, no explanation.';

interface AIExtractedRow {
  rawLabel: string;
  openingDr: number;
  openingCr: number;
  duringDr: number;
  duringCr: number;
  closingDr: number;
  closingCr: number;
  isGroupRow?: boolean;
  parentGroup?: string;
  rawIndentSpaces?: number;
  rowLevel?: number;
}

function parseAIResponse(text: string): AIExtractedRow[] {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as AIExtractedRow[];
  return Array.isArray(parsed) ? parsed : [];
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

function countLeadingSpaces(s: string): number {
  const m = s.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function toRawTBRow(el: AIExtractedRow, idx: number): RawTBRow {
  const rawLabel = String(el.rawLabel ?? '').trim();
  const rawIndentSpaces = el.rawIndentSpaces ?? countLeadingSpaces(String(el.rawLabel ?? ''));
  const isGroupRow = Boolean(el.isGroupRow);
  const rowLevel = el.rowLevel ?? (isGroupRow ? 0 : rawIndentSpaces > 0 ? 1 : 2);

  return {
    rowIndex: idx,
    rawLabel,
    openingDr: isGroupRow ? 0 : Number(el.openingDr) || 0,
    openingCr: isGroupRow ? 0 : Number(el.openingCr) || 0,
    duringDr: isGroupRow ? 0 : Number(el.duringDr) || 0,
    duringCr: isGroupRow ? 0 : Number(el.duringCr) || 0,
    adjustmentDr: 0,
    adjustmentCr: 0,
    closingDr: isGroupRow ? 0 : Number(el.closingDr) || 0,
    closingCr: isGroupRow ? 0 : Number(el.closingCr) || 0,
    rowLevel,
    isGroupRow,
    parentGroup: String(el.parentGroup ?? '').trim(),
    rawIndentSpaces,
  };
}

const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);

function documentMediaType(ext: string): string {
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function convertDocumentTrialBalance(
  buffer: Buffer,
  filename: string,
  ext: string,
  apiKey: string,
): Promise<RawTBParseResult & { detectedFormat: string }> {
  const client = new Anthropic({ apiKey });
  const rowSchema =
    '{"rawLabel": string, "openingDr": number, "openingCr": number, ' +
    '"duringDr": number, "duringCr": number, "closingDr": number, "closingCr": number, ' +
    '"isGroupRow": boolean, "parentGroup": string, "rawIndentSpaces": number, "rowLevel": number}';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          ext === '.pdf'
            ? {
                type: 'document' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'application/pdf',
                  data: buffer.toString('base64'),
                },
              }
            : {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: documentMediaType(ext),
                  data: buffer.toString('base64'),
                },
              },
          {
            type: 'text',
            text:
              `This ${ext === '.pdf' ? 'PDF' : 'image'} contains a trial balance export or scan. ` +
              `Extract all trial balance rows from the document. Return a JSON array where each element is exactly: ${rowSchema}.`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');

  const merged = parseAIResponse(text);
  const rawRows = merged
    .map((el, idx) => toRawTBRow(el, idx))
    .filter((row) => row.isGroupRow || row.closingDr > 0 || row.closingCr > 0 || row.openingDr > 0 || row.openingCr > 0);

  if (rawRows.filter((row) => !row.isGroupRow).length === 0) {
    throw Object.assign(
      new Error(
        `Could not extract trial balance rows from "${filename}". Try exporting to Excel/CSV or use Manual Upload.`,
      ),
      { status: 422 },
    );
  }

  const finalized = finalizeRawTBRows(rawRows);
  return {
    rows: finalized.rows,
    ...finalized.totals,
    warnings: [
      `Trial balance extracted from ${ext === '.pdf' ? 'PDF document' : 'scanned/image upload'} via AI OCR.`,
      ...finalized.warnings,
    ],
    detectedColumns: {},
    headerRowIndex: 0,
    detectedFormat: 'ai_converted' as RawTBParseResult['detectedFormat'],
  };
}

export async function convertRoughTrialBalance(
  buffer: Buffer,
  filename: string,
  apiKey: string,
): Promise<RawTBParseResult & { detectedFormat: string }> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return convertDocumentTrialBalance(buffer, filename, ext, apiKey);
  }

  let matrix: unknown[][];

  if (ext === '.csv') {
    matrix = parseCSVText(buffer.toString('utf-8'));
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const primaryWs =
      workbook.getWorksheet('Trial Balance') ??
      workbook.getWorksheet('TB') ??
      workbook.worksheets[0];
    if (!primaryWs) {
      throw new Error('The uploaded workbook has no worksheets.');
    }
    matrix = worksheetToMatrix(primaryWs);
  }

  const nonEmptyRows = matrix.filter((row) => !isRowEmpty(row as unknown[]));
  const warnings: string[] = [];
  const merged: AIExtractedRow[] = [];
  const client = new Anthropic({ apiKey });

  const rowSchema =
    '{"rawLabel": string, "openingDr": number, "openingCr": number, ' +
    '"duringDr": number, "duringCr": number, "closingDr": number, "closingCr": number, ' +
    '"isGroupRow": boolean, "parentGroup": string, "rawIndentSpaces": number, "rowLevel": number}';

  for (let i = 0; i < nonEmptyRows.length; i += BATCH_SIZE) {
    const chunk = nonEmptyRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content:
              `Extract trial balance rows from this raw data. Return a JSON array where ` +
              `each element is exactly: ${rowSchema}. Preserve document order. Include ` +
              `group header rows with isGroupRow=true. Set parentGroup on every leaf row.\n\n` +
              `Raw rows:\n${JSON.stringify(chunk)}`,
          },
        ],
      });

      const text = response.content
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('');

      const parsed = parseAIResponse(text);
      merged.push(...parsed);
    } catch (err) {
      console.warn(`[aiTbConverter] batch ${batchNum} failed:`, err);
      warnings.push(
        `AI could not process ${chunk.length} raw rows in batch ${batchNum}; skipped.`,
      );
    }
  }

  const rawRows = merged
    .map((el) => ({
      ...el,
      rawLabel: String(el.rawLabel ?? '').trim(),
    }))
    .filter((el) => {
      if (!el.rawLabel) return false;
      if (el.isGroupRow) return true;
      return !(
        el.openingDr === 0 &&
        el.openingCr === 0 &&
        el.duringDr === 0 &&
        el.duringCr === 0 &&
        el.closingDr === 0 &&
        el.closingCr === 0
      );
    })
    .map((el, idx) => toRawTBRow(el, idx));

  if (rawRows.filter((r) => !r.isGroupRow).length === 0) {
    throw Object.assign(
      new Error(
        'AI could not extract any account balances from this file. Please try Manual Upload (Standard Format) instead.',
      ),
      { status: 422 },
    );
  }

  const finalized = finalizeRawTBRows(rawRows);
  warnings.push(...finalized.warnings);

  const parentGroupCount = finalized.rows.filter((r) => !r.isGroupRow && r.parentGroup).length;
  const leafCount = finalized.rows.filter((r) => !r.isGroupRow).length;
  if (leafCount > 0 && parentGroupCount === 0) {
    warnings.push(
      'No parent group context was detected. Account classification may be less accurate for ambiguous accounts.',
    );
  }

  return {
    rows: finalized.rows,
    ...finalized.totals,
    warnings,
    detectedColumns: {},
    headerRowIndex: 0,
    detectedFormat: 'ai_converted' as RawTBParseResult['detectedFormat'],
  };
}
