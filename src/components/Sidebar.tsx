import React, { useState, useMemo } from "react";
import { DependencyGraph, CellEntry } from "../types";
import { Search, Sheet, Filter, Info, Eye } from "lucide-react";

interface SidebarProps {
  graph: DependencyGraph;
  selectedSheet: string | null;
  setSelectedSheet: (sheet: string | null) => void;
  selectedCellKey: string | null;
  onSelectCell: (key: string) => void;
}

export default function Sidebar({
  graph,
  selectedSheet,
  setSelectedSheet,
  selectedCellKey,
  onSelectCell,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "formulas" | "sources" | "green" | "cycles">("all");

  // Get list of unique sheets
  const sheets = useMemo(() => {
    const list = new Set<string>();
    Object.keys(graph).forEach((key) => {
      list.add(graph[key].sheet);
    });
    return Array.from(list).sort();
  }, [graph]);

  // Set initial selected sheet if not set
  React.useEffect(() => {
    if (!selectedSheet && sheets.length > 0) {
      setSelectedSheet(sheets[0]);
    }
  }, [sheets, selectedSheet, setSelectedSheet]);

  // Filter and search keys
  const filteredCells = useMemo(() => {
    return Object.entries(graph)
      .map(([key, value]) => ({ key, ...value }))
      .filter((cell) => {
        // Sheet filter
        if (selectedSheet && cell.sheet !== selectedSheet) {
          return false;
        }

        // Type filter
        if (filterType === "formulas" && !cell.is_formula) return false;
        if (filterType === "sources" && cell.is_formula) return false;
        if (filterType === "green" && !cell.is_green_input_candidate) return false;
        if (filterType === "cycles") {
          const hasCycle = cell.resolved_source_cells.some(
            (c) => c.includes("CYCLE") || (cell.direct_refs.includes(cell.key))
          );
          if (!hasCycle) return false;
        }

        // Search query filter
        if (searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase();
          const coord = cell.key.split("!")[1]?.toLowerCase() || "";
          const label = cell.row_label?.toLowerCase() || "";
          const formula = cell.raw_formula?.toLowerCase() || "";
          return coord.includes(query) || label.includes(query) || formula.includes(query);
        }

        return true;
      })
      .sort((a, b) => {
        // Natural sort of cell coordinates (e.g. A1, A2, B10)
        const aCoord = a.key.split("!")[1] || "";
        const bCoord = b.key.split("!")[1] || "";
        return aCoord.localeCompare(bCoord, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [graph, selectedSheet, filterType, searchQuery]);

  return (
    <div id="model-sidebar" className="w-80 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      {/* Sheet Tabs */}
      <div className="p-4 border-b border-gray-100">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
          Sheets
        </label>
        <div className="flex flex-wrap gap-1.5">
          {sheets.map((sheet) => (
            <button
              id={`sheet-tab-${sheet}`}
              key={sheet}
              onClick={() => setSelectedSheet(sheet)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedSheet === sheet
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Sheet className="w-3.5 h-3.5" />
              {sheet}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-100 flex flex-col gap-2 bg-gray-50/50">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            id="cell-search"
            type="text"
            placeholder="Search cell coordinate or label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-gray-200 focus:border-gray-400 bg-white transition-all outline-none"
          />
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap gap-1 mt-1">
          <button
            onClick={() => setFilterType("all")}
            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
              filterType === "all"
                ? "bg-gray-100 text-gray-800 border-gray-200"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            All Cells
          </button>
          <button
            onClick={() => setFilterType("formulas")}
            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
              filterType === "formulas"
                ? "bg-blue-50 text-blue-700 border-blue-100"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            Formulas
          </button>
          <button
            onClick={() => setFilterType("sources")}
            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
              filterType === "sources"
                ? "bg-amber-50 text-amber-700 border-amber-100"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            Inputs
          </button>
          <button
            onClick={() => setFilterType("green")}
            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
              filterType === "green"
                ? "bg-green-50 text-green-700 border-green-100"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            Green Candidates
          </button>
          <button
            onClick={() => setFilterType("cycles")}
            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
              filterType === "cycles"
                ? "bg-rose-50 text-rose-700 border-rose-100"
                : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
            }`}
          >
            Cycles 🔄
          </button>
        </div>
      </div>

      {/* Cell List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filteredCells.length === 0 ? (
          <div className="p-6 text-center">
            <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No matching cells found on this sheet.</p>
          </div>
        ) : (
          filteredCells.map((cell) => {
            const coord = cell.key.split("!")[1] || "";
            const isSelected = selectedCellKey === cell.key;
            const hasCycle = cell.resolved_source_cells.some((c) => c.includes("CYCLE"));

            return (
              <button
                id={`cell-item-${cell.key}`}
                key={cell.key}
                onClick={() => onSelectCell(cell.key)}
                className={`w-full text-left p-3 flex items-start gap-2.5 transition-all outline-none ${
                  isSelected
                    ? "bg-gray-50 border-l-2 border-gray-900"
                    : "hover:bg-gray-50/50 border-l-2 border-transparent"
                }`}
              >
                {/* Visual cell indicator */}
                <span
                  style={{
                    backgroundColor: cell.fill_rgb
                      ? `#${cell.fill_rgb.substring(2)}`
                      : cell.is_formula
                      ? "#EFF6FF"
                      : "#FAFAFA",
                    borderColor: cell.is_green_input_candidate
                      ? "#86EFAC"
                      : cell.is_formula
                      ? "#BFDBFE"
                      : "#E5E7EB",
                  }}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-bold rounded border uppercase shadow-sm"
                >
                  {coord}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold text-gray-900 truncate">
                      {cell.row_label || "No Label"}
                    </span>
                    {cell.is_formula ? (
                      <span className="text-[9px] font-mono bg-blue-50 text-blue-600 px-1 py-0.5 rounded uppercase font-bold border border-blue-100/50">
                        Formula
                      </span>
                    ) : cell.is_green_input_candidate ? (
                      <span className="text-[9px] font-mono bg-green-50 text-green-600 px-1 py-0.5 rounded uppercase font-bold border border-green-100/50">
                        Input
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono bg-gray-50 text-gray-500 px-1 py-0.5 rounded uppercase font-bold border border-gray-100/50">
                        Const
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-gray-500 truncate font-mono mt-0.5">
                    {cell.is_formula ? cell.raw_formula : String(cell.raw_value ?? "empty")}
                  </p>

                  {hasCycle && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-medium border border-red-100">
                      🔄 Circular Reference
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500 flex justify-between font-mono">
        <span>Showing {filteredCells.length} cells</span>
        <span>Total: {Object.keys(graph).length}</span>
      </div>
    </div>
  );
}
