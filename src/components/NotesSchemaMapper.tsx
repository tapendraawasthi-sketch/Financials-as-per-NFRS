import React, { useState, useMemo } from "react";
import { DependencyGraph, NoteMetadata } from "../types";
import { NOTES_MAPPING } from "../notesMappingData";
import { 
  BookOpen, 
  Search, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Info, 
  Layers, 
  ListTodo, 
  GitFork,
  Database,
  Calculator,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";

interface NotesSchemaMapperProps {
  graph: DependencyGraph;
  fileName: string;
}

export default function NotesSchemaMapper({ graph, fileName }: NotesSchemaMapperProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string>("3.2");

  // Filter notes by search
  const filteredNoteIds = useMemo(() => {
    return Object.keys(NOTES_MAPPING).filter((id) => {
      const note = NOTES_MAPPING[id];
      return (
        id.includes(searchTerm) ||
        note.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [searchTerm]);

  const activeNote = NOTES_MAPPING[selectedNoteId];

  // Helper to determine badge color for confidence
  const getConfidenceBadgeColor = (confidence?: string) => {
    if (!confidence) return "bg-gray-100 text-gray-700 border-gray-200";
    const lower = confidence.toLowerCase();
    if (lower.startsWith("high")) {
      return "bg-green-50 text-green-700 border-green-200";
    }
    if (lower.startsWith("medium")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    return "bg-red-50 text-red-700 border-red-200";
  };

  // Extract live cell data for the selected note from the parsed dependency graph
  const liveCells = useMemo(() => {
    const cells: { row: number; col: string; val: any; formula: string | null; label: string | null }[] = [];
    if (!activeNote || !graph) return cells;

    const sheetName = "Notes 3.2 to 3.23";
    
    // Rows can be defined as [start, end] or an object
    let startRow = 1;
    let endRow = 240;

    if (Array.isArray(activeNote.rows)) {
      startRow = activeNote.rows[0];
      endRow = activeNote.rows[1];
    } else if (typeof activeNote.rows === "object" && activeNote.rows !== null) {
      // Find overall min/max row
      const vals = Object.values(activeNote.rows).flat().filter((v): v is number => typeof v === "number");
      if (vals.length > 0) {
        startRow = Math.min(...vals);
        endRow = Math.max(...vals);
      }
    }

    const cols = ["A", "B", "C", "D", "E", "F"];

    for (let r = startRow; r <= endRow; r++) {
      // Check column E (CY) and F (PY) primarily
      cols.forEach(c => {
        const key = `${sheetName}!${c}${r}`;
        if (graph[key]) {
          const entry = graph[key];
          // Avoid duplicates by row & col
          if (!cells.some(item => item.row === r && item.col === c)) {
            cells.push({
              row: r,
              col: c,
              val: entry.raw_value,
              formula: entry.raw_formula,
              label: entry.row_label
            });
          }
        }
      });
    }

    return cells.sort((a, b) => a.row - b.row || a.col.localeCompare(b.col));
  }, [activeNote, graph]);

  // Check if live data is actually populated from a custom workbook
  const isLiveLoaded = fileName !== "MEs Financials Format (Sample)" && liveCells.length > 0;

  return (
    <div className="flex-1 flex overflow-hidden bg-white text-left">
      {/* 1. Left Sidebar: Notes List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 text-indigo-600 font-mono text-[10px] font-bold uppercase tracking-wider mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            Accounting Notes (3.2 - 3.23)
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Note No. or Title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all"
            />
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNoteIds.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 italic">
              No matching notes found.
            </div>
          ) : (
            filteredNoteIds.map((id) => {
              const note = NOTES_MAPPING[id];
              const isSelected = selectedNoteId === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedNoteId(id)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? "bg-gray-900 text-white font-medium shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    isSelected ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
                  }`}>
                    {id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{note.title}</p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                      {Array.isArray(note.rows) 
                        ? `Rows ${note.rows[0]} - ${note.rows[1]}` 
                        : "Complex Blocks"
                      }
                    </p>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 self-center ${isSelected ? "text-white" : "text-gray-400"}`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Content Area */}
      {activeNote ? (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Header Banner */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <div className="flex items-center flex-wrap justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-bold font-mono rounded">
                    Note {selectedNoteId}
                  </span>
                  <span className={`px-2.5 py-1 text-[11px] font-mono border rounded-full font-semibold ${getConfidenceBadgeColor(activeNote.confidence)}`}>
                    Confidence: {activeNote.confidence?.split(" — ")[0] || "Unknown"}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-2 tracking-tight">
                  {activeNote.title}
                </h2>
              </div>

              {/* Sheet Reference Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-600">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                <span className="font-medium">Sheet: Notes 3.2 to 3.23</span>
              </div>
            </div>

            {/* Warn/Note Block */}
            {activeNote.warning && (
              <div className="mt-4 p-3 bg-red-50 text-red-800 border border-red-100 rounded-xl text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  <strong>Structural Warning:</strong> {activeNote.warning}
                </div>
              </div>
            )}

            {activeNote.confidence && activeNote.confidence.includes("—") && (
              <p className="text-[11px] text-gray-500 italic mt-3 leading-relaxed">
                * {activeNote.confidence.substring(activeNote.confidence.indexOf("—") + 2)}
              </p>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Quick Metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Row boundaries card */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-gray-400" />
                  Physical Excel Rows
                </div>
                {Array.isArray(activeNote.rows) ? (
                  <div className="mt-1">
                    <span className="text-lg font-bold font-mono text-gray-900">
                      Row {activeNote.rows[0]} - {activeNote.rows[1]}
                    </span>
                    <span className="text-xs text-gray-400 ml-1.5">
                      ({activeNote.rows[1] - activeNote.rows[0] + 1} rows)
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 font-mono text-xs font-bold text-indigo-600">
                    Multi-Block Layout
                  </div>
                )}
                {activeNote.total_row && (
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">
                    Total/Sub-total Row Index: <strong className="text-gray-800">{activeNote.total_row}</strong>
                  </p>
                )}
              </div>

              {/* Target Columns card */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider mb-1 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-gray-400" />
                  Target Columns
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-bold font-mono text-indigo-600">
                    Col {activeNote.current_year_col || "E"}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">(CY)</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-lg font-bold font-mono text-gray-500">
                    Col {activeNote.prev_year_col || "F"}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">(PY)</span>
                </div>
                {activeNote.manual_split_confirmed && (
                  <p className="text-[10px] text-green-600 mt-1 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    Interactive Write Point
                  </p>
                )}
              </div>

              {/* Feeds Into card */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider mb-1 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  Feeds Into Statement
                </div>
                <div className="mt-1 text-xs font-bold text-gray-900 leading-normal line-clamp-2">
                  {typeof activeNote.feeds_into === "string" ? (
                    activeNote.feeds_into
                  ) : (
                    <div className="space-y-0.5">
                      {Object.entries(activeNote.feeds_into || {}).map(([key, val]) => (
                        <div key={key} className="text-[11px] font-normal truncate">
                          <strong className="text-gray-800 uppercase font-mono text-[9px] mr-1">{key}:</strong> 
                          {val}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Trial Balance Feeds Workflow Map */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                <GitFork className="w-4 h-4 text-indigo-500" />
                Ledger / Trial Balance Mapping Logic
              </h3>

              {activeNote.feeds_from_tb_rows && Object.keys(activeNote.feeds_from_tb_rows).length > 0 ? (
                <div className="space-y-3">
                  <div className="text-[11px] text-gray-400 leading-normal mb-1">
                    The following Trial Balance account rows are parsed and consolidated into Note {selectedNoteId}:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(activeNote.feeds_from_tb_rows).map(([tbRow, mappingInfo]) => (
                      <div key={tbRow} className="flex items-center gap-3 p-3 bg-indigo-50/25 rounded-xl border border-indigo-100/50">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
                          TB #{tbRow}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-bold text-gray-800 leading-relaxed truncate">
                            {mappingInfo.split(" -> ")[0]}
                          </p>
                          <p className="text-[10px] text-indigo-600 font-mono mt-0.5">
                            → {mappingInfo.split(" -> ")[1] || "Direct mapping"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50/50 text-center rounded-lg text-xs text-gray-400 italic">
                  {activeNote.note || "No direct Trial Balance mapping. Sourced via custom allocations."}
                </div>
              )}
            </div>

            {/* Key row Landmarks */}
            {activeNote.key_rows && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                  <ListTodo className="w-4 h-4 text-indigo-500" />
                  Key Sheet Landmarks & Indexes
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Object.entries(activeNote.key_rows).map(([key, rowIndex]) => (
                    <div key={key} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between">
                      <span className="text-[9px] font-mono text-gray-400 uppercase truncate" title={key}>
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-base font-bold font-mono text-gray-800 mt-1">
                        Row {rowIndex}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Live Excel Spreadsheet Sync */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-4">
                <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-green-500" />
                  Live Spreadsheet Values
                </h3>
                {isLiveLoaded ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                    LIVE WORKBOOK CONNECTED
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Static Reference View (Demo)
                  </span>
                )}
              </div>

              {!isLiveLoaded ? (
                <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center">
                  <p className="text-xs text-gray-500">
                    No active workbook cells loaded or sheet mismatch. Upload a custom <strong>MEs Financials Format (.xlsx)</strong> to display authentic parsed live cell entries, equations, and formulas for Note {selectedNoteId} here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200/80">
                  <table className="w-full text-left text-xs text-gray-600 border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-mono text-[9px]">
                        <th className="p-3 font-semibold w-16">Cell</th>
                        <th className="p-3 font-semibold">Row Label</th>
                        <th className="p-3 font-semibold text-right">Raw Value</th>
                        <th className="p-3 font-semibold">Formula / Source Equation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {liveCells.map((cell) => (
                        <tr key={`${cell.col}${cell.row}`} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-gray-900 bg-gray-50/40">
                            {cell.col}{cell.row}
                          </td>
                          <td className="p-3 font-medium text-gray-700">
                            {cell.label || <span className="text-gray-300 italic">(Unlabeled row)</span>}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">
                            {typeof cell.val === "number" 
                              ? cell.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : cell.val !== null ? String(cell.val) : <span className="text-gray-300">-</span>
                            }
                          </td>
                          <td className="p-3 text-[11px] font-mono text-indigo-600 truncate max-w-xs md:max-w-md" title={cell.formula || ""}>
                            {cell.formula || <span className="text-gray-400 text-[10px] italic">Hardcoded Value</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
          <HelpCircle className="w-12 h-12 text-gray-400 mb-2" />
          <p className="text-xs text-gray-500">Select an accounting note from the sidebar to inspect its rules and landmarks.</p>
        </div>
      )}
    </div>
  );
}
