// ===== server.ts =====
import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { GoogleGenAI } from "@google/genai";
import { parseRawTrialBalance } from "./tbImportParser";
import { matchAllAccounts, MatchResult } from "./accountMatcher";
import { aiMatchUnresolved } from "./aiMatcher";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Set up in-memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Helper for lazy loading Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in AI Studio Secrets.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// ---------------------------------------------------------------------------
// Excel Parsing Engine (TypeScript translation of extract_full_formula_chain.py)
// ---------------------------------------------------------------------------

const CELL_REF_RE = /(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?[A-Za-z]{1,3})(\$?\d+)(?::(\$?[A-Za-z]{1,3})(\$?\d+))?/g;

const GREEN_FILL_HINTS = new Set([
  "FF92D050", "FFC6E0B4", "FF00B050", "FFA9D08E", "FFE2EFDA", "FF375623"
]);

function isGreenish(rgb: string | undefined): boolean {
  if (!rgb || typeof rgb !== "string" || rgb.length !== 8) {
    return false;
  }
  if (GREEN_FILL_HINTS.has(rgb.toUpperCase())) {
    return true;
  }
  try {
    const r = parseInt(rgb.substring(2, 4), 16);
    const g = parseInt(rgb.substring(4, 6), 16);
    const b = parseInt(rgb.substring(6, 8), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    return g > r + 15 && g > b + 15 && g > 100;
  } catch (e) {
    return false;
  }
}

function columnLetterToIndex(col: string): number {
  let index = 0;
  const cleaned = col.replace(/\$/g, "").toUpperCase();
  for (let i = 0; i < cleaned.length; i++) {
    index = index * 26 + (cleaned.charCodeAt(i) - 64);
  }
  return index;
}

function indexToColumnLetter(index: number): string {
  let letter = "";
  while (index > 0) {
    const temp = (index - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    index = Math.floor((index - temp - 1) / 26);
  }
  return letter;
}

function expandRangeIfSmall(sheetName: string, coord: string, maxCells = 200): string[] {
  if (!coord.includes(":")) {
    return [coord];
  }
  const parts = coord.split(":");
  if (parts.length !== 2) return [coord];

  const cell1 = parts[0];
  const cell2 = parts[1];

  const match1 = cell1.match(/^([A-Za-z]+)(\d+)$/);
  const match2 = cell2.match(/^([A-Za-z]+)(\d+)$/);

  if (!match1 || !match2) return [coord];

  const col1 = columnLetterToIndex(match1[1]);
  const row1 = parseInt(match1[2], 10);
  const col2 = columnLetterToIndex(match2[1]);
  const row2 = parseInt(match2[2], 10);

  const minCol = Math.min(col1, col2);
  const maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2);
  const maxRow = Math.max(row1, row2);

  const totalCells = (maxCol - minCol + 1) * (maxRow - minRow + 1);
  if (totalCells > maxCells) {
    return [coord];
  }

  const cells: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push(`${indexToColumnLetter(c)}${r}`);
    }
  }
  return cells;
}

function findRefsInFormula(formula: string, currentSheet: string): { sheet: string; coord: string }[] {
  const refs: { sheet: string; coord: string }[] = [];
  CELL_REF_RE.lastIndex = 0;

  let match;
  while ((match = CELL_REF_RE.exec(formula)) !== null) {
    const col1 = match[3];
    const row1 = match[4];
    if (!col1 || !row1) continue;

    const quotedSheet = match[1];
    const bareSheet = match[2];
    let sheetName = quotedSheet || bareSheet || currentSheet;

    if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
      sheetName = sheetName.substring(1, sheetName.length - 1).replace(/''/g, "'");
    }

    const col2 = match[5];
    const row2 = match[6];

    let coord = "";
    if (col2 && row2) {
      coord = `${col1.replace(/\$/g, "")}${row1.replace(/\$/g, "")}:${col2.replace(/\$/g, "")}${row2.replace(/\$/g, "")}`;
    } else {
      coord = `${col1.replace(/\$/g, "")}${row1.replace(/\$/g, "")}`;
    }

    refs.push({ sheet: sheetName, coord });
  }
  return refs;
}

function getRowLabel(ws: ExcelJS.Worksheet, rowIndex: number): string | null {
  const cols = [1, 2];
  for (const col of cols) {
    const cell = ws.getRow(rowIndex).getCell(col);
    if (cell && cell.value !== null && cell.value !== undefined && cell.value !== "") {
      const val = cell.value;
      if (typeof val === "object" && val !== null) {
        if ("richText" in val) {
          return (val as any).richText.map((t: any) => t.text).join("");
        }
        if ("result" in val) {
          return String((val as any).result || "");
        }
        if ("formula" in val) {
          return String((val as any).result || "");
        }
      }
      return String(val);
    }
  }
  return null;
}

function getRawFormula(cell: ExcelJS.Cell): string | null {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  const val = cell.value;
  if (typeof val === "string" && val.startsWith("=")) {
    return val;
  }
  if (typeof val === "object" && val !== null && "formula" in val) {
    const f = (val as any).formula;
    return f.startsWith("=") ? f : `=${f}`;
  }
  return null;
}

function resolveToSource(
  sheetsData: Map<string, Map<string, { formula: string | null; isFormula: boolean }>>,
  sheet: string,
  cell: string,
  visited: Set<string> = new Set()
): string[] {
  const key = `${sheet}!${cell}`;
  if (visited.has(key)) {
    return [`${sheet}!${cell} (CYCLE)`];
  }

  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const sheetCells = sheetsData.get(sheet);
  if (!sheetCells) {
    return [`${sheet}!${cell} (SHEET NOT FOUND)`];
  }

  const singleCell = cell.split(":")[0];
  const cellData = sheetCells.get(singleCell);

  if (!cellData) {
    return [`${sheet}!${cell}`];
  }

  if (!cellData.isFormula || !cellData.formula) {
    return [`${sheet}!${cell}`];
  }

  const refs = findRefsInFormula(cellData.formula, sheet);
  if (refs.length === 0) {
    return [`${sheet}!${cell} (FORMULA WITH NO RESOLVABLE REFS: ${cellData.formula})`];
  }

  const leaves: string[] = [];
  for (const ref of refs) {
    const expanded = expandRangeIfSmall(ref.sheet, ref.coord);
    for (const singleRefCell of expanded) {
      leaves.push(...resolveToSource(sheetsData, ref.sheet, singleRefCell, nextVisited));
    }
  }
  return leaves;
}

interface CellEntry {
  sheet: string;
  raw_value: any;
  raw_formula: string | null;
  is_formula: boolean;
  direct_refs: string[];
  resolved_source_cells: string[];
  row_label: string | null;
  fill_rgb: string | null;
  is_green_input_candidate: boolean;
}

async function parseExcelWorkbook(buffer: Buffer): Promise<{
  dependency_graph: Record<string, CellEntry>;
  merged_cell_ranges: Record<string, string[]>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetsData = new Map<string, Map<string, { formula: string | null; isFormula: boolean }>>();
  const merged_cell_ranges: Record<string, string[]> = {};

  workbook.eachSheet((ws) => {
    const sheetName = ws.name;
    const cellMap = new Map<string, { formula: string | null; isFormula: boolean }>();
    sheetsData.set(sheetName, cellMap);

    const mergedRanges: string[] = [];
    if (ws.model && ws.model.merges) {
      ws.model.merges.forEach((m: string) => {
        mergedRanges.push(m);
      });
    }
    merged_cell_ranges[sheetName] = mergedRanges;

    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const formula = getRawFormula(cell);
        cellMap.set(cell.address, {
          formula,
          isFormula: formula !== null,
        });
      });
    });
  });

  const dependency_graph: Record<string, CellEntry> = {};

  workbook.eachSheet((ws) => {
    const sheetName = ws.name;

    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const addr = cell.address;
        const entryKey = `${sheetName}!${addr}`;
        const formula = getRawFormula(cell);
        const isFormula = formula !== null;

        let fillRgb: string | null = null;
        if (cell.fill && cell.fill.type === "pattern" && cell.fill.fgColor && cell.fill.fgColor.argb) {
          fillRgb = cell.fill.fgColor.argb;
        }

        const rowLabel = getRowLabel(ws, cell.row as any);

        let directRefs: string[] = [];
        let sourceRefs: string[] = [];

        if (isFormula && formula) {
          directRefs = findRefsInFormula(formula, sheetName).map(
            (ref) => `${ref.sheet}!${ref.coord}`
          );
          try {
            sourceRefs = resolveToSource(sheetsData, sheetName, addr);
          } catch (e) {
            sourceRefs = ["UNRESOLVED (recursion or processing limit)"];
          }
        }

        let rawValue: any = null;
        if (!isFormula) {
          const val = cell.value;
          if (val !== null && val !== undefined) {
            if (typeof val === "object" && "richText" in val) {
              rawValue = (val as any).richText.map((t: any) => t.text).join("");
            } else if (typeof val === "object" && "result" in val) {
              rawValue = (val as any).result;
            } else {
              rawValue = val;
            }
          }
        }

        dependency_graph[entryKey] = {
          sheet: sheetName,
          raw_value: rawValue,
          raw_formula: formula,
          is_formula: isFormula,
          direct_refs: directRefs,
          resolved_source_cells: sourceRefs,
          row_label: rowLabel,
          fill_rgb: fillRgb,
          is_green_input_candidate: isGreenish(fillRgb || undefined),
        };
      });
    });
  });

  return {
    dependency_graph,
    merged_cell_ranges,
  };
}

// ---------------------------------------------------------------------------
// In-Memory Excel State for Editing
// ---------------------------------------------------------------------------
let lastUploadedBuffer: Buffer | null = null;
let lastUploadedFilename = "Sample.xlsx";
let lastDependencyGraph: Record<string, CellEntry> | null = null;

// Cache of the most recent smart trial balance import, so the review step and the
// final "confirm and write" step can be two separate requests without re-uploading.
interface PendingImportState {
  matches: MatchResult[];
  parsedAt: number;
}
let pendingImport: PendingImportState | null = null;

// ---------------------------------------------------------------------------
// Sheet Label Searching Helpers (Survivable row drifts)
// ---------------------------------------------------------------------------
function findRowByLabel(
  ws: ExcelJS.Worksheet,
  labelText: string,
  searchCols: string[] = ["A", "B"],
  startRow = 1,
  endRow?: number,
  exact = true
): number | null {
  const maxRow = endRow || ws.rowCount;
  for (let r = startRow; r <= maxRow; r++) {
    for (const col of searchCols) {
      const cell = ws.getCell(`${col}${r}`);
      if (cell && cell.value !== null && cell.value !== undefined) {
        let valStr = "";
        if (typeof cell.value === "object" && cell.value !== null) {
          if ("richText" in cell.value) {
            valStr = (cell.value as any).richText.map((t: any) => t.text).join("");
          } else if ("result" in cell.value) {
            valStr = String((cell.value as any).result || "");
          } else {
            valStr = String((cell.value as any).formula || "");
          }
        } else {
          valStr = String(cell.value);
        }
        valStr = valStr.trim();
        if (exact && valStr === labelText.trim()) {
          return r;
        }
        if (!exact && valStr.toLowerCase().includes(labelText.trim().toLowerCase())) {
          return r;
        }
      }
    }
  }
  return null;
}

function findRowByLabelAfter(
  ws: ExcelJS.Worksheet,
  labelText: string,
  afterRow: number,
  searchCols: string[] = ["A", "B"],
  windowSize = 40
): number | null {
  return findRowByLabel(ws, labelText, searchCols, afterRow, afterRow + windowSize, true);
}

// ---------------------------------------------------------------------------
// Whitelisted Safe Cell Writing (Prevents formula corruption)
// ---------------------------------------------------------------------------
function safeWriteCell(
  ws: ExcelJS.Worksheet,
  coord: string,
  value: any,
  sheetName: string,
  whitelist: Set<string>
) {
  const key = `${sheetName}!${coord}`;
  // Enforce the whitelist if it is populated
  if (whitelist.size > 0 && !whitelist.has(key)) {
    throw new Error(`Illegal write blocked: '${key}' is not in the input whitelist. Only green input cells can be modified.`);
  }
  ws.getCell(coord).value = value;
}

// Write constants matching Python service
const SHEET_ENTER_DETAILS = "Enter Details";
const SHEET_TRIAL_BALANCE = "Trial Balance";
const SHEET_NOTES_2_23 = "Notes 3.2 to 3.23";

const ENTER_DETAILS_LABEL_COL = "B";
const ENTER_DETAILS_VALUE_COL = "C";

const ENTER_DETAILS_SIMPLE_LABELS: Record<string, string> = {
  name_of_entity: "Name of Entity",
  address: "Address",
  type_of_entity: "Type of Entity",
  chairperson: "Chairperson",
  director: "Director",
  accounts_head: "Accounts Head",
  auditor: "Auditor",
  auditor_position: "Auditor Position",
  audit_firm_name: "Name of Audit Firm",
  audit_firm_type: "Type of Audit Firm",
};

const ENTER_DETAILS_EMPLOYEE_COUNT_LABEL = "No. of Employees";
const ENTER_DETAILS_BONUS_RATE_LABEL = "Employee Bonus Rate";
const ENTER_DETAILS_TAX_RATE_LABEL = "Income Tax Rate";
const ENTER_DETAILS_INVENTORY_HEADER_LABEL = "Inventory Details";

const ENTER_DETAILS_INVENTORY_LINES: Record<string, string> = {
  raw_materials: "Raw materials and consumables",
  work_in_progress: "Work-in-progress",
  finished_goods: "Finished goods and goods for resale",
};

const ENTER_DETAILS_INVENTORY_COL_CY = "C";
const ENTER_DETAILS_INVENTORY_COL_PY = "D";

const NOTE_3_12_LABEL = "Liability for Employee Benefits";
const NOTE_3_12_CURRENT_LABEL = "Due within one year or less";
const NOTE_3_12_NONCURRENT_LABEL = "Due after more than one year";

const NOTE_3_2_CURRENT_LABEL = "Current Portion";
const NOTE_3_2_NONCURRENT_LABEL = "Less: Non-Current portion";
const NOTE_3_4_CURRENT_LABEL = "Current Portion";
const NOTE_3_4_NONCURRENT_LABEL = "Less: Non-Current portion";

const NOTES_VALUE_COL_CY = "E";
const NOTES_VALUE_COL_PY = "F";

const TB_COL_PARTICULARS = "A";
const TB_COL_DURING_DR_CY = "D";
const TB_COL_DURING_CR_CY = "E";
const TB_COL_ADJ_DR_CY = "F";
const TB_COL_ADJ_CR_CY = "G";
const TB_COL_DURING_DR_PY = "N";
const TB_COL_DURING_CR_PY = "O";

function _writeEnterDetails(
  workbook: ExcelJS.Workbook,
  company: any,
  inventory: any,
  employees: any,
  income_tax_rate: any,
  whitelist: Set<string>
) {
  const ws = workbook.getWorksheet(SHEET_ENTER_DETAILS);
  if (!ws) return;

  if (company) {
    for (const [fieldName, label] of Object.entries(ENTER_DETAILS_SIMPLE_LABELS)) {
      const value = company[fieldName];
      if (value === undefined || value === null || value === "") continue;
      const row = findRowByLabel(ws, label, [ENTER_DETAILS_LABEL_COL]);
      if (row === null) continue;
      safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, value, SHEET_ENTER_DETAILS, whitelist);
    }
  }

  if (employees) {
    if (employees.employee_count !== undefined && employees.employee_count !== null && employees.employee_count !== "") {
      const row = findRowByLabel(ws, ENTER_DETAILS_EMPLOYEE_COUNT_LABEL, [ENTER_DETAILS_LABEL_COL]);
      if (row) {
        safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, Number(employees.employee_count), SHEET_ENTER_DETAILS, whitelist);
      }
    }
    if (employees.bonus_rate !== undefined && employees.bonus_rate !== null && employees.bonus_rate !== "") {
      const row = findRowByLabel(ws, ENTER_DETAILS_BONUS_RATE_LABEL, [ENTER_DETAILS_LABEL_COL]);
      if (row) {
        safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, Number(employees.bonus_rate), SHEET_ENTER_DETAILS, whitelist);
      }
    }
  }

  if (income_tax_rate !== undefined && income_tax_rate !== null && income_tax_rate !== "") {
    const row = findRowByLabel(ws, ENTER_DETAILS_TAX_RATE_LABEL, [ENTER_DETAILS_LABEL_COL]);
    if (row) {
      safeWriteCell(ws, `${ENTER_DETAILS_VALUE_COL}${row}`, Number(income_tax_rate), SHEET_ENTER_DETAILS, whitelist);
    }
  }

  if (inventory) {
    const headerRow = findRowByLabel(ws, ENTER_DETAILS_INVENTORY_HEADER_LABEL, [ENTER_DETAILS_LABEL_COL]);
    if (headerRow !== null) {
      for (const [fieldName, label] of Object.entries(ENTER_DETAILS_INVENTORY_LINES)) {
        const row = findRowByLabelAfter(ws, label, headerRow, [ENTER_DETAILS_LABEL_COL]);
        if (row === null) continue;
        const cy_val = inventory.current_year ? inventory.current_year[fieldName] : null;
        const py_val = inventory.previous_year ? inventory.previous_year[fieldName] : null;

        if (cy_val !== null && cy_val !== undefined && cy_val !== "") {
          safeWriteCell(ws, `${ENTER_DETAILS_INVENTORY_COL_CY}${row}`, Number(cy_val), SHEET_ENTER_DETAILS, whitelist);
        }
        if (py_val !== null && py_val !== undefined && py_val !== "") {
          safeWriteCell(ws, `${ENTER_DETAILS_INVENTORY_COL_PY}${row}`, Number(py_val), SHEET_ENTER_DETAILS, whitelist);
        }
      }
    }
  }
}

function _writeTrialBalanceMovements(
  workbook: ExcelJS.Workbook,
  movements: any[],
  whitelist: Set<string>
) {
  const ws = workbook.getWorksheet(SHEET_TRIAL_BALANCE);
  if (!ws) return;

  const fieldToCol: Record<string, string> = {
    during_dr_cy: TB_COL_DURING_DR_CY,
    during_cr_cy: TB_COL_DURING_CR_CY,
    adjustment_dr_cy: TB_COL_ADJ_DR_CY,
    adjustment_cr_cy: TB_COL_ADJ_CR_CY,
    during_dr_py: TB_COL_DURING_DR_PY,
    during_cr_py: TB_COL_DURING_CR_PY,
  };

  for (const mv of movements) {
    if (!mv.account_label) continue;
    const row = findRowByLabel(ws, mv.account_label, [TB_COL_PARTICULARS], 1, undefined, true);
    if (row === null) {
      throw new Error(`Trial Balance account "${mv.account_label}" not found. This writer does not auto-insert new rows. Please ensure the row is present in your uploaded template first.`);
    }

    for (const [fieldName, col] of Object.entries(fieldToCol)) {
      const value = mv[fieldName];
      if (value === undefined || value === null || value === "") continue;
      safeWriteCell(ws, `${col}${row}`, Number(value), SHEET_TRIAL_BALANCE, whitelist);
    }
  }
}

function _writeNote312Split(
  workbook: ExcelJS.Workbook,
  split: any,
  whitelist: Set<string>
) {
  if (!split) return;
  const ws = workbook.getWorksheet(SHEET_NOTES_2_23);
  if (!ws) return;

  const anchorRow = findRowByLabel(ws, NOTE_3_12_LABEL, ["A", "B"], 1, undefined, false);
  if (anchorRow === null) return;

  const currentRow = findRowByLabelAfter(ws, NOTE_3_12_CURRENT_LABEL, anchorRow, ["A", "B"]);
  const noncurrentRow = findRowByLabelAfter(ws, NOTE_3_12_NONCURRENT_LABEL, anchorRow, ["A", "B"]);

  if (currentRow) {
    if (split.current_portion_cy !== undefined && split.current_portion_cy !== null && split.current_portion_cy !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${currentRow}`, Number(split.current_portion_cy), SHEET_NOTES_2_23, whitelist);
    }
    if (split.current_portion_py !== undefined && split.current_portion_py !== null && split.current_portion_py !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${currentRow}`, Number(split.current_portion_py), SHEET_NOTES_2_23, whitelist);
    }
  }

  if (noncurrentRow) {
    if (split.noncurrent_portion_cy !== undefined && split.noncurrent_portion_cy !== null && split.noncurrent_portion_cy !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${noncurrentRow}`, Number(split.noncurrent_portion_cy), SHEET_NOTES_2_23, whitelist);
    }
    if (split.noncurrent_portion_py !== undefined && split.noncurrent_portion_py !== null && split.noncurrent_portion_py !== "") {
      safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${noncurrentRow}`, Number(split.noncurrent_portion_py), SHEET_NOTES_2_23, whitelist);
    }
  }
}

function _writeUnverifiedNoteSplits(
  workbook: ExcelJS.Workbook,
  splits: any[],
  whitelist: Set<string>
) {
  if (!splits || splits.length === 0) return;
  const ws = workbook.getWorksheet(SHEET_NOTES_2_23);
  if (!ws) return;

  for (const split of splits) {
    let headingSearch = "";
    let currentLabel = "";
    let noncurrentLabel = "";

    if (split.note_number === "3.2") {
      headingSearch = "Investments";
      currentLabel = NOTE_3_2_CURRENT_LABEL;
      noncurrentLabel = NOTE_3_2_NONCURRENT_LABEL;
    } else if (split.note_number === "3.4") {
      headingSearch = "Other Receivables";
      currentLabel = NOTE_3_4_CURRENT_LABEL;
      noncurrentLabel = NOTE_3_4_NONCURRENT_LABEL;
    } else {
      continue;
    }

    const anchorRow = findRowByLabel(ws, headingSearch, ["A", "B"], 1, undefined, false);
    if (anchorRow === null) continue;

    const currentRow = findRowByLabelAfter(ws, currentLabel, anchorRow, ["A", "B"]);
    const noncurrentRow = findRowByLabelAfter(ws, noncurrentLabel, anchorRow, ["A", "B"]);

    try {
      if (currentRow) {
        if (split.current_portion_cy !== undefined && split.current_portion_cy !== null && split.current_portion_cy !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${currentRow}`, Number(split.current_portion_cy), SHEET_NOTES_2_23, whitelist);
        }
        if (split.current_portion_py !== undefined && split.current_portion_py !== null && split.current_portion_py !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${currentRow}`, Number(split.current_portion_py), SHEET_NOTES_2_23, whitelist);
        }
      }

      if (noncurrentRow) {
        if (split.noncurrent_portion_cy !== undefined && split.noncurrent_portion_cy !== null && split.noncurrent_portion_cy !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_CY}${noncurrentRow}`, Number(split.noncurrent_portion_cy), SHEET_NOTES_2_23, whitelist);
        }
        if (split.noncurrent_portion_py !== undefined && split.noncurrent_portion_py !== null && split.noncurrent_portion_py !== "") {
          safeWriteCell(ws, `${NOTES_VALUE_COL_PY}${noncurrentRow}`, Number(split.noncurrent_portion_py), SHEET_NOTES_2_23, whitelist);
        }
      }
    } catch (e: any) {
      console.warn(`Unverified Note ${split.note_number} split write rejected: ${e.message}`);
    }
  }
}

function buildWhitelist(): Set<string> {
  const whitelist = new Set<string>();
  if (!lastDependencyGraph) return whitelist;

  for (const [key, cell] of Object.entries(lastDependencyGraph)) {
    if (cell.is_green_input_candidate && !cell.is_formula) {
      whitelist.add(key);
    }
  }
  return whitelist;
}

// ---------------------------------------------------------------------------
// REST API Endpoints
// ---------------------------------------------------------------------------

// Excel Upload Endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No Excel file uploaded." });
    }

    const result = await parseExcelWorkbook(req.file.buffer);
    
    // Store in-memory
    lastUploadedBuffer = req.file.buffer;
    lastUploadedFilename = req.file.originalname;
    lastDependencyGraph = result.dependency_graph;

    return res.json(result);
  } catch (error: any) {
    console.error("Upload parsing error:", error);
    return res.status(500).json({ error: error.message || "Failed to parse Excel file." });
  }
});

// ---------------------------------------------------------------------------
// SMART TRIAL BALANCE IMPORT
// Two-step flow:
//   1. POST /api/import/trial-balance -> parse raw TB, run deterministic matcher,
//      run AI fallback ONLY on unresolved rows, return a full review table.
//      Nothing is written to any workbook yet.
//   2. POST /api/import/trial-balance/confirm -> user has reviewed/corrected the
//      mapping client-side; this endpoint performs the actual whitelisted write
//      into the currently loaded master template ('lastUploadedBuffer'), exactly
//      via the same safeWriteCell/whitelist path used by /api/generate/statement.
// ---------------------------------------------------------------------------

app.post("/api/import/trial-balance", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No trial balance file uploaded." });
    }
    if (!lastUploadedBuffer) {
      return res.status(400).json({
        error: "No active master template loaded. Please upload the MEs Financials Format workbook first (Lineage Auditor tab), then upload the raw trial balance here.",
      });
    }

    const parseResult = await parseRawTrialBalance(req.file.buffer, req.file.originalname);

    if (parseResult.rows.length === 0) {
      return res.status(400).json({
        error: "No usable account rows detected in the uploaded file.",
        warnings: parseResult.warnings,
      });
    }

    const rawLabels = parseResult.rows.map((r) => r.label);
    const deterministicMatches = matchAllAccounts(rawLabels);

    // Only send genuinely unresolved rows to Gemini -- never send confident matches.
    const unresolvedLabels = deterministicMatches
      .filter((m) => m.method === "unmatched" && m.confidence < 60)
      .map((m) => m.rawLabel);

    let finalMatches: MatchResult[] = deterministicMatches;

    if (unresolvedLabels.length > 0) {
      try {
        const aiResults = await aiMatchUnresolved(unresolvedLabels);
        const aiByLabel = new Map(aiResults.map((r) => [r.rawLabel, r]));
        finalMatches = deterministicMatches.map((m) =>
          unresolvedLabels.includes(m.rawLabel) && aiByLabel.has(m.rawLabel)
            ? aiByLabel.get(m.rawLabel)!
            : m
        );
      } catch (aiErr: any) {
        console.warn("AI fallback matching failed, leaving those rows for manual review:", aiErr.message);
        // Non-fatal: deterministic results still stand, AI is a bonus layer only.
      }
    }

    // Combine matches with their original raw debit/credit for the review UI
    const reviewRows = parseResult.rows.map((row, idx) => ({
      ...finalMatches[idx],
      debit: row.debit,
      credit: row.credit,
    }));

    pendingImport = { matches: finalMatches, parsedAt: Date.now() };

    return res.json({
      totalDebit: parseResult.totalDebit,
      totalCredit: parseResult.totalCredit,
      isBalanced: parseResult.isBalanced,
      difference: parseResult.difference,
      warnings: parseResult.warnings,
      rows: reviewRows,
      summary: {
        totalRows: reviewRows.length,
        autoMatched: reviewRows.filter((r) => r.confidence >= 80).length,
        needsReview: reviewRows.filter((r) => r.confidence < 80 && r.confidence >= 40).length,
        unmatched: reviewRows.filter((r) => r.confidence < 40).length,
      },
    });
  } catch (error: any) {
    console.error("Trial balance import error:", error);
    return res.status(500).json({ error: error.message || "Failed to import trial balance." });
  }
});

interface ConfirmedRow {
  rawLabel: string;
  matchedLabel: string; // final label user confirmed/corrected to, MUST exist in chart of accounts
  debit: number;
  credit: number;
}

app.post("/api/import/trial-balance/confirm", async (req, res) => {
  try {
    if (!lastUploadedBuffer) {
      return res.status(400).json({ error: "No active master template loaded." });
    }

    const { rows, isPreviousYear } = req.body as { rows: ConfirmedRow[]; isPreviousYear?: boolean };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No confirmed rows supplied." });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(lastUploadedBuffer);
    const whitelist = buildWhitelist();

    const ws = workbook.getWorksheet(SHEET_TRIAL_BALANCE);
    if (!ws) {
      return res.status(500).json({ error: `Master template has no '${SHEET_TRIAL_BALANCE}' sheet.` });
    }

    const skipped: { rawLabel: string; reason: string }[] = [];
    let written = 0;

    // Aggregate by matchedLabel in case multiple raw rows map to the same template row
    // (e.g. several bookkeeping "Cash" sub-lines all mapping to the single "Petty Cash" row)
    const aggregated = new Map<string, { debit: number; credit: number; sources: string[] }>();
    for (const row of rows) {
      if (!row.matchedLabel) {
        skipped.push({ rawLabel: row.rawLabel, reason: "No confirmed mapping supplied." });
        continue;
      }
      const existing = aggregated.get(row.matchedLabel) || { debit: 0, credit: 0, sources: [] };
      existing.debit += Number(row.debit) || 0;
      existing.credit += Number(row.credit) || 0;
      existing.sources.push(row.rawLabel);
      aggregated.set(row.matchedLabel, existing);
    }

    const duringDrCol = isPreviousYear ? TB_COL_DURING_DR_PY : TB_COL_DURING_DR_CY;
    const duringCrCol = isPreviousYear ? TB_COL_DURING_CR_PY : TB_COL_DURING_CR_CY;

    for (const [matchedLabel, agg] of aggregated.entries()) {
      const rowIndex = findRowByLabel(ws, matchedLabel, [TB_COL_PARTICULARS], 1, undefined, true);
      if (rowIndex === null) {
        skipped.push({
          rawLabel: agg.sources.join(", "),
          reason: `Template row for "${matchedLabel}" not found in Trial Balance sheet column A. This writer never inserts new rows.`,
        });
        continue;
      }

      try {
        if (agg.debit !== 0) {
          safeWriteCell(ws, `${duringDrCol}${rowIndex}`, agg.debit, SHEET_TRIAL_BALANCE, whitelist);
          written++;
        }
        if (agg.credit !== 0) {
          safeWriteCell(ws, `${duringCrCol}${rowIndex}`, agg.credit, SHEET_TRIAL_BALANCE, whitelist);
          written++;
        }
      } catch (writeErr: any) {
        skipped.push({ rawLabel: agg.sources.join(", "), reason: writeErr.message });
      }
    }

    const outputBuffer = await workbook.xlsx.writeBuffer();

    // Keep the freshly-written buffer as the new "active" workbook so subsequent
    // Input Studio actions (Enter Details, Note splits, etc.) build on top of this import.
    lastUploadedBuffer = Buffer.from(outputBuffer);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=TB_Imported_${lastUploadedFilename}`);
    res.setHeader("X-Import-Written-Count", String(written));
    res.setHeader("X-Import-Skipped-Count", String(skipped.length));
    if (skipped.length > 0) {
      res.setHeader("X-Import-Skipped-Detail", encodeURIComponent(JSON.stringify(skipped.slice(0, 20))));
    }
    return res.send(outputBuffer);
  } catch (error: any) {
    console.error("Trial balance confirm-write error:", error);
    return res.status(500).json({ error: error.message || "Failed to write trial balance into workbook." });
  }
});

// Gemini AI Formula Auditor Endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    const { sheet, coordinate, formula, value, row_label, direct_refs, resolved_source_cells } = req.body;

    if (!coordinate || !formula) {
      return res.status(400).json({ error: "Missing required cell parameters: coordinate and formula." });
    }

    const ai = getGeminiClient();

    const prompt = `You are an expert financial model auditor and Excel formula developer. Analyze the following cell from a complex financial workbook:
Sheet: ${sheet}
Cell coordinate: ${coordinate}
Formula: ${formula}
Current cell value: ${value || "N/A"}
Row label context: ${row_label || "None"}
Direct precedent references (direct cell links): ${JSON.stringify(direct_refs || [])}
Resolved source cells (ultimate leaves / input cells): ${JSON.stringify(resolved_source_cells || [])}

Please provide a structured, professional review of this formula in beautiful markdown with the following clear sections:
1. **Formula Explanation**: Explain what this cell is calculating, what its input components represent, and why they are being computed this way, described in clear financial/business terms.
2. **Formula Quality & Risk Assessment**: Audit the formula carefully. Highlight any risks, inefficiencies, or bad practices like:
   - Hardcoded magic numbers inside the formula (e.g. \`* 0.12\` instead of linking to a Tax Rate input cell).
   - Complex nested \`IF\` loops that could be simplified using \`IFS\`, \`CHOOSE\`, or a lookup table (\`INDEX/MATCH\`, \`XLOOKUP\`).
   - Risk of errors like \`#DIV/0!\`, \`#N/A\`, or \`#VALUE!\`, and how to prevent them (e.g., using \`IFERROR\` or safe checks).
3. **Optimized Recommendations**: Provide a rewritten or optimized version of the formula to make it cleaner, safer, more dynamic, or more audit-friendly.

Be highly professional, concrete, actionable, and succinct. No conversational fluff or meta-announcements. Go straight to the review.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const markdownText = response.text || "No response generated from Gemini.";
    return res.json({ audit: markdownText });
  } catch (error: any) {
    console.error("AI Analysis error:", error);
    return res.status(500).json({ error: error.message || "Failed to perform AI analysis. Please make sure GEMINI_API_KEY is configured." });
  }
});

// Excel Financial Statement Generation Endpoint
app.post("/api/generate/statement", async (req, res) => {
  try {
    if (!lastUploadedBuffer) {
      return res.status(400).json({
        error: "No active Excel workbook. Please upload a valid Excel workbook (.xlsx) first so that inputs can be written to it.",
      });
    }

    const { company, inventory, employees, income_tax_rate, trial_balance_movements, note_3_12_split, unverified_note_splits } = req.body;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(lastUploadedBuffer);

    // Build the whitelist dynamically from the parsed structure
    const whitelist = buildWhitelist();

    // Perform writes
    _writeEnterDetails(workbook, company, inventory, employees, income_tax_rate, whitelist);
    _writeTrialBalanceMovements(workbook, trial_balance_movements || [], whitelist);
    _writeNote312Split(workbook, note_3_12_split, whitelist);
    _writeUnverifiedNoteSplits(workbook, unverified_note_splits || [], whitelist);

    // Write workbook to buffer
    const outputBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Generated_${lastUploadedFilename}`);
    return res.send(outputBuffer);
  } catch (error: any) {
    console.error("Statement generation error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate Excel statement." });
  }
});


// ---------------------------------------------------------------------------
// Serve Frontend Assets (Vite Middleware Setup)
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
