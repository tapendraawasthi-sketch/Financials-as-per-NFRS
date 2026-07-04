export interface PdfExtractionResult {
  matrix: unknown[][];
  pageCount: number;
  hasExtractableText: boolean;
  warnings: string[];
}

const ROW_Y_TOLERANCE = 3;
const COLUMN_GAP_THRESHOLD = 15;
const MIN_TEXT_CHARS = 20;

interface TextItem {
  str: string;
  x: number;
  y: number;
}

function clusterColumnBoundaries(items: TextItem[]): number[] {
  const xStarts = [...new Set(items.map((i) => Math.round(i.x)))].sort((a, b) => a - b);
  if (xStarts.length === 0) return [];
  const boundaries: number[] = [xStarts[0]];
  for (let i = 1; i < xStarts.length; i++) {
    if (xStarts[i] - xStarts[i - 1] > COLUMN_GAP_THRESHOLD) {
      boundaries.push(xStarts[i]);
    }
  }
  return boundaries;
}

function columnIndexForX(x: number, boundaries: number[]): number {
  let col = 0;
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (x >= boundaries[i] - ROW_Y_TOLERANCE) {
      col = i;
      break;
    }
  }
  return col;
}

function groupItemsIntoRows(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= ROW_Y_TOLERANCE) {
      currentRow.push(item);
    } else {
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }
  rows.push(currentRow);
  return rows;
}

function buildPageMatrix(items: TextItem[]): unknown[][] {
  if (items.length === 0) return [];
  const boundaries = clusterColumnBoundaries(items);
  const colCount = Math.max(boundaries.length, 1);
  const rowGroups = groupItemsIntoRows(items);

  return rowGroups.map((rowItems) => {
    const row: unknown[] = new Array(colCount).fill('');
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    for (const item of sorted) {
      const col = columnIndexForX(item.x, boundaries);
      const existing = String(row[col] ?? '').trim();
      row[col] = existing ? `${existing} ${item.str}`.trim() : item.str;
    }
    return row;
  });
}

export async function extractTableMatrixFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  const warnings: string[] = [];
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  let totalChars = 0;
  const pageMatrices: unknown[][][] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items: TextItem[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || typeof item.str !== 'string') continue;
      const transform = item.transform;
      const x = transform[4];
      const y = transform[5];
      items.push({ str: item.str, x, y });
      totalChars += item.str.trim().length;
    }

    pageMatrices.push(buildPageMatrix(items));
  }

  if (totalChars < MIN_TEXT_CHARS) {
    return {
      matrix: [],
      pageCount,
      hasExtractableText: false,
      warnings: [
        'This PDF appears to be a scanned image with no embedded text layer. Extractable-text PDFs only are supported — please export a text-based trial balance instead.',
      ],
    };
  }

  const matrix = pageMatrices.flat();
  const colCounts = pageMatrices.map((m) => Math.max(0, ...m.map((r) => r.length)));
  const majorityColCount = colCounts.length
    ? colCounts.sort((a, b) =>
        colCounts.filter((c) => c === b).length - colCounts.filter((c) => c === a).length,
      )[0]
    : 0;

  pageMatrices.forEach((pageMatrix, idx) => {
    const pageCols = Math.max(0, ...pageMatrix.map((r) => r.length));
    if (majorityColCount > 0 && Math.abs(pageCols - majorityColCount) >= 3) {
      warnings.push(
        `Page ${idx + 1} reconstructed ${pageCols} columns vs ${majorityColCount} on most pages — column alignment on this page may be incorrect.`,
      );
    }
  });

  return {
    matrix,
    pageCount,
    hasExtractableText: true,
    warnings,
  };
}
