// ===== src/App.tsx =====
import React, { useState, useRef } from "react";
import Sidebar from "./components/Sidebar";
import GraphView from "./components/GraphView";
import CellDetails from "./components/CellDetails";
import EngagementInputForm from "./components/EngagementInputForm";
import NotesSchemaMapper from "./components/NotesSchemaMapper";
import SmartTrialBalanceImport from "./components/SmartTrialBalanceImport";
import { DependencyGraph, MergedRanges, EngagementData } from "./types";
import { SAMPLE_GRAPH, SAMPLE_MERGES } from "./sampleData";
import { Upload, FileSpreadsheet, RotateCcw, AlertTriangle, Cpu, Sparkles, LayoutGrid, Hammer, Binary, Map, UploadCloud } from "lucide-react";

export default function App() {
  const [graph, setGraph] = useState<DependencyGraph>(SAMPLE_GRAPH);
  const [mergedRanges, setMergedRanges] = useState<MergedRanges>(SAMPLE_MERGES);
  const [selectedSheet, setSelectedSheet] = useState<string | null>("Calculations");
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>("Calculations!C5");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeMode, setActiveMode] = useState<"trace" | "form" | "mapper" | "import">("trace");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("MEs Financials Format (Sample)");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to process Excel workbook.");
      }

      setGraph(data.dependency_graph);
      setMergedRanges(data.merged_cell_ranges);

      // Auto-select first sheet and cell in the uploaded sheet
      const keys = Object.keys(data.dependency_graph);
      if (keys.length > 0) {
        // Look for the first formula cell if possible
        const formulaCellKey = keys.find((k) => data.dependency_graph[k].is_formula);
        const activeKey = formulaCellKey || keys[0];
        
        setSelectedCellKey(activeKey);
        setSelectedSheet(data.dependency_graph[activeKey].sheet);
      } else {
        setSelectedCellKey(null);
        setSelectedSheet(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during file upload.");
    } finally {
      setLoading(false);
    }
  };

  // Reset to Sample Data
  const handleResetSample = () => {
    setGraph(SAMPLE_GRAPH);
    setMergedRanges(SAMPLE_MERGES);
    setSelectedSheet("Calculations");
    setSelectedCellKey("Calculations!C5");
    setFileName("MEs Financials Format (Sample)");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Trigger file click
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Compile & download generated Excel statement workbook
  const handleDownloadStatement = async (data: EngagementData) => {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate Excel statement.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Compiled_Statement_${fileName.endsWith(".xlsx") ? fileName : fileName + ".xlsx"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during workbook generation.");
    } finally {
      setDownloading(false);
    }
  };

  const hasActiveTemplate = fileName !== "MEs Financials Format (Sample)";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      {/* Premium Swiss Header */}
      <header className="bg-white border-b border-gray-200/80 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-sm font-mono font-extrabold text-lg">
            
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-950 tracking-tight flex items-center gap-1.5 uppercase">
              Excel Formula Dependency Visualizer
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Lineage Tracing, Input Discovery, & Gemini AI Audits
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50 flex-wrap">
          <button
            onClick={() => setActiveMode("trace")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeMode === "trace" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Binary className="w-3.5 h-3.5 text-blue-500" />
            Lineage Auditor
          </button>
          <button
            onClick={() => setActiveMode("import")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeMode === "import" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-500" />
            Smart TB Import
          </button>
          <button
            onClick={() => setActiveMode("form")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeMode === "form" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Hammer className="w-3.5 h-3.5 text-indigo-500" />
            Input Studio
          </button>
          <button
            onClick={() => setActiveMode("mapper")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeMode === "mapper" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Map className="w-3.5 h-3.5 text-purple-500" />
            Notes Mapper
          </button>
        </div>

        {/* File actions */}
        <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto">
          {/* Active File Label */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-medium text-gray-600">
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
            <span className="truncate max-w-[150px]">{fileName}</span>
          </div>

          {/* Reset button */}
          {hasActiveTemplate && (
            <button
              onClick={handleResetSample}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-800 rounded-lg text-xs font-medium cursor-pointer transition-all shadow-sm"
              title="Reset to Sample"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={triggerFileSelect}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-950 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Workbook
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Error Notification Toast */}
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 rounded-xl p-4 shadow-lg z-50 max-w-md flex items-start gap-3 animate-bounce">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <h3 className="text-xs font-bold text-red-800 uppercase tracking-wide">Processing Error</h3>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-[10px] font-bold text-red-800 underline mt-2 hover:text-red-950 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay for workbook parsing */}
        {loading && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="text-center max-w-sm">
              <Cpu className="w-12 h-12 text-gray-900 animate-spin mx-auto mb-4" />
              <h3 className="text-sm font-bold text-gray-900 uppercase">Extracting Formulas</h3>
              <p className="text-xs text-gray-500 mt-1">
                Parsing worksheets, resolving cell dependency coordinates, and building calculation chain lineage graphs...
              </p>
            </div>
          </div>
        )}

        {activeMode === "trace" && (
          <>
            {/* Sidebar Selector */}
            <Sidebar
              graph={graph}
              selectedSheet={selectedSheet}
              setSelectedSheet={setSelectedSheet}
              selectedCellKey={selectedCellKey}
              onSelectCell={(key) => {
                setSelectedCellKey(key);
                const sheetName = key.split("!")[0];
                setSelectedSheet(sheetName);
              }}
            />

            {/* Center Canvas / Trace Graph */}
            <GraphView
              graph={graph}
              selectedCellKey={selectedCellKey}
              onSelectCell={(key) => {
                setSelectedCellKey(key);
                const sheetName = key.split("!")[0];
                setSelectedSheet(sheetName);
              }}
            />

            {/* Right Details Panel / AI Audit */}
            <CellDetails
              graph={graph}
              selectedCellKey={selectedCellKey}
            />
          </>
        )}

        {activeMode === "import" && (
          <SmartTrialBalanceImport hasActiveTemplate={hasActiveTemplate} />
        )}

        {activeMode === "form" && (
          /* Input Studio / Statement Generator */
          <div className="flex-1 flex overflow-hidden">
            {!hasActiveTemplate ? (
              <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto my-12 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-gray-900 uppercase">Upload Template File First</h3>
                <p className="text-xs text-gray-500 mt-2 max-w-md leading-relaxed">
                  To write details and compile statements safely, you must first upload the authentic <strong>MEs Financials Format (.xlsx)</strong> workbook. The system will then scan its layout and enable precise, whitelisted data inputs.
                </p>
                <button
                  onClick={triggerFileSelect}
                  className="mt-6 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  Upload Template Workbook
                </button>
              </div>
            ) : (
              <>
                <EngagementInputForm
                  graph={graph}
                  onDownload={handleDownloadStatement}
                  downloading={downloading}
                />
                
                {/* Visual Whitelist Reference Sidebar */}
                <div className="w-80 bg-gray-50 border-l border-gray-200 p-5 overflow-y-auto hidden lg:block text-left">
                  <h4 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-3">
                    Active Input Targets
                  </h4>
                  <p className="text-[11px] text-gray-400 mb-4 leading-normal">
                    The following sheets and cells have been scanned and whitelisted as safe, green-filled manual input positions.
                  </p>

                  <div className="space-y-4">
                    {/* Enter Details section */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-800 uppercase flex items-center gap-1 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Enter Details
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200/80 p-2.5 text-[11px] space-y-1.5 font-mono text-gray-600">
                        <div> Legal Details: Col C (Rows 2-15)</div>
                        <div> Employees: Col C (Row 18-19)</div>
                        <div> Inventory: Cols C/D (Row 22-24)</div>
                        <div> Income Tax: Col C (Row 27)</div>
                      </div>
                    </div>

                    {/* Trial Balance section */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-800 uppercase flex items-center gap-1 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Trial Balance Postings
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200/80 p-2.5 text-[11px] space-y-1.5 font-mono text-gray-600">
                        <div> CY Dr/Cr: Cols D & E</div>
                        <div> CY Adj Dr/Cr: Cols F & G</div>
                        <div> PY Dr/Cr: Cols N & O</div>
                      </div>
                    </div>

                    {/* Notes splits */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-800 uppercase flex items-center gap-1 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Notes Manual Splits
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200/80 p-2.5 text-[11px] space-y-1.5 font-mono text-gray-600">
                        <div> Note 3.12 (Liability Split)</div>
                        <div> Note 3.2 (Investment Portion)</div>
                        <div> Note 3.4 (Receivable Portion)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeMode === "mapper" && (
          <NotesSchemaMapper graph={graph} fileName={fileName} />
        )}
      </div>
    </div>
  );
}
