// ===== server/services/aiTbConverter.ts =====
import Anthropic from '@anthropic-ai/sdk';
import ExcelJS from 'exceljs';
import { worksheetToMatrix, parseCSVText } from './tbParser.js';
import type { RawTBRow, RawTBParseResult } from '../../src/types/trialBalance.js';

const BATCH_SIZE = 100;

const SYSTEM_PROMPT =
  'You are an expert Nepali chartered accountant assistant. You will be ' +
  'given raw rows extracted from a messy, unstructured, or non-standard ' +
  'trial balance export from Nepali accounting software (Tally, Swastik, ' +
  'Busy, or similar). Identify every genuine LEAF ledger account line that ' +
  'has a numeric balance. IGNORE: company name/address rows, titles, date ' +
  'ranges, blank rows, section/group header rows with no amount, and any ' +
  "'Total'/'Grand Total'/subtotal rows. Balances are sometimes shown as a " +
  "single combined value like '1,43,51,552.00 Cr' or '9,664.55 Dr' — split " +
  'these correctly into the Dr or Cr field based on the suffix and remove ' +
  'commas. If a row has separate Opening/Debit/Credit/Closing columns, map ' +
  'them precisely. If only a closing balance exists, populate closingDr or ' +
  'closingCr only, leave all other fields 0. Never invent numbers you ' +
  'do not see. Respond with ONLY a raw JSON array, no markdown fences, no ' +
  'commentary, no explanation.';

interface AIExtractedRow {
  rawLabel: string;
  openingDr: number;
  openingCr: number;
  duringDr: number;
  duringCr: number;
  closingDr: number;
  closingCr: number;
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

export async function convertRoughTrialBalance(
  buffer: Buffer,
  filename: string,
  apiKey: string,
): Promise<RawTBParseResult & { detectedFormat: string }> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
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
              `Extract ledger rows from this raw data. Return a JSON array where ` +
              `each element is exactly: {"rawLabel": string, "openingDr": number, ` +
              `"openingCr": number, "duringDr": number, "duringCr": number, ` +
              `"closingDr": number, "closingCr": number}.\n\nRaw rows:\n` +
              JSON.stringify(chunk),
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

  const elements = merged
    .map((el) => ({
      rawLabel: String(el.rawLabel ?? '').trim(),
      openingDr: Number(el.openingDr) || 0,
      openingCr: Number(el.openingCr) || 0,
      duringDr: Number(el.duringDr) || 0,
      duringCr: Number(el.duringCr) || 0,
      closingDr: Number(el.closingDr) || 0,
      closingCr: Number(el.closingCr) || 0,
    }))
    .filter(
      (el) =>
        el.rawLabel &&
        !(
          el.openingDr === 0 &&
          el.openingCr === 0 &&
          el.duringDr === 0 &&
          el.duringCr === 0 &&
          el.closingDr === 0 &&
          el.closingCr === 0
        ),
    );

  const rows: RawTBRow[] = elements.map((el, idx) => ({
    rowIndex: idx,
    rawLabel: el.rawLabel,
    openingDr: el.openingDr,
    openingCr: el.openingCr,
    duringDr: el.duringDr,
    duringCr: el.duringCr,
    adjustmentDr: 0,
    adjustmentCr: 0,
    closingDr: el.closingDr,
    closingCr: el.closingCr,
    rowLevel: 2,
    isGroupRow: false,
    parentGroup: '',
    rawIndentSpaces: 0,
  }));

  if (rows.length === 0) {
    throw Object.assign(
      new Error(
        'AI could not extract any account balances from this file. Please try Manual Upload (Standard Format) instead.',
      ),
      { status: 422 },
    );
  }

  let totalOpeningDr = 0,
    totalOpeningCr = 0,
    totalDuringDr = 0,
    totalDuringCr = 0;
  let totalClosingDr = 0,
    totalClosingCr = 0;
  for (const row of rows) {
    totalOpeningDr += row.openingDr;
    totalOpeningCr += row.openingCr;
    totalDuringDr += row.duringDr;
    totalDuringCr += row.duringCr;
    totalClosingDr += row.closingDr;
    totalClosingCr += row.closingCr;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  totalClosingDr = round2(totalClosingDr);
  totalClosingCr = round2(totalClosingCr);
  const difference = round2(totalClosingDr - totalClosingCr);
  const isBalanced = Math.abs(difference) < 1.0;

  if (!isBalanced) {
    warnings.push(
      `Trial Balance not balanced. Difference: ${Math.abs(difference).toLocaleString('en-IN')}.`,
    );
  }

  return {
    rows,
    totalOpeningDr: round2(totalOpeningDr),
    totalOpeningCr: round2(totalOpeningCr),
    totalDuringDr: round2(totalDuringDr),
    totalDuringCr: round2(totalDuringCr),
    totalClosingDr,
    totalClosingCr,
    isBalanced,
    difference,
    warnings,
    detectedColumns: {},
    headerRowIndex: 0,
    detectedFormat: 'ai_converted' as any,
  };
}
