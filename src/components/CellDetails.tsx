import React, { useState, useEffect } from "react";
import { DependencyGraph } from "../types";
import { Sparkles, Terminal, ShieldAlert, Cpu, Eye, CheckCircle2, ChevronRight, Copy } from "lucide-react";

interface CellDetailsProps {
  graph: DependencyGraph;
  selectedCellKey: string | null;
}

// Light custom markdown renderer to format Gemini's audit in beautiful styling
function formatMarkdown(text: string) {
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeContent: string[] = [];

  return lines.map((line, idx) => {
    // Code blocks
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        const code = codeContent.join("\n");
        codeContent = [];
        return (
          <pre key={`code-${idx}`} className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs overflow-x-auto my-3 border border-gray-800 shadow-sm leading-relaxed">
            <code>{code}</code>
          </pre>
        );
      } else {
        inCodeBlock = true;
        return null;
      }
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return null;
    }

    // Section Headers
    if (line.trim().startsWith("###")) {
      const headerText = line.replace(/^###\s*/, "");
      return (
        <h4 key={`h3-${idx}`} className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mt-5 mb-2.5 flex items-center gap-1.5 border-b border-gray-100 pb-1">
          <Terminal className="w-3.5 h-3.5 text-gray-400" />
          {headerText}
        </h4>
      );
    }
    if (line.trim().startsWith("##")) {
      const headerText = line.replace(/^##\s*/, "");
      return (
        <h3 key={`h2-${idx}`} className="text-sm font-bold text-gray-900 mt-6 mb-3 flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
          <ChevronRight className="w-4 h-4 text-gray-500" />
          {headerText}
        </h3>
      );
    }
    if (line.trim().startsWith("#")) {
      const headerText = line.replace(/^#\s*/, "");
      return (
        <h2 key={`h1-${idx}`} className="text-base font-bold text-gray-900 mt-6 mb-3">
          {headerText}
        </h2>
      );
    }

    // Bullet points
    if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
      const bulletText = line.replace(/^[-*]\s*/, "");
      return (
        <li key={`bullet-${idx}`} className="text-xs text-gray-700 ml-4 mb-2 list-disc leading-relaxed pl-1">
          {parseInlineFormatting(bulletText)}
        </li>
      );
    }

    // Standard paragraph
    if (line.trim() === "") return <div key={`empty-${idx}`} className="h-2" />;

    return (
      <p key={`p-${idx}`} className="text-xs text-gray-700 leading-relaxed mb-3">
        {parseInlineFormatting(line)}
      </p>
    );
  });
}

// Support bold (`**text**`) and inline code (`code`) in custom markdown renderer
function parseInlineFormatting(text: string) {
  const parts = [];
  let currentText = text;

  // Regex to match **bold** or `code`
  const inlineRegex = /(\*\*.*?\*\*|`.*?`)/;

  while (currentText) {
    const match = inlineRegex.exec(currentText);
    if (!match) {
      parts.push(currentText);
      break;
    }

    const index = match.index;
    if (index > 0) {
      parts.push(currentText.substring(0, index));
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith("**") && matchedStr.endsWith("**")) {
      parts.push(
        <strong key={parts.length} className="font-semibold text-gray-950">
          {matchedStr.substring(2, matchedStr.length - 2)}
        </strong>
      );
    } else if (matchedStr.startsWith("`") && matchedStr.endsWith("`")) {
      parts.push(
        <code key={parts.length} className="bg-gray-100 text-red-600 font-mono text-[11px] px-1 py-0.5 rounded border border-gray-200">
          {matchedStr.substring(1, matchedStr.length - 1)}
        </code>
      );
    }

    currentText = currentText.substring(index + matchedStr.length);
  }

  return parts;
}

export default function CellDetails({ graph, selectedCellKey }: CellDetailsProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "audit">("profile");
  const [auditReports, setAuditReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Clear states when key changes
  useEffect(() => {
    setActiveTab("profile");
    setError(null);
  }, [selectedCellKey]);

  if (!selectedCellKey || !graph[selectedCellKey]) {
    return (
      <div id="cell-details-panel" className="w-96 border-l border-gray-200 bg-white flex flex-col items-center justify-center p-6 text-center h-full">
        <Sparkles className="w-10 h-10 text-gray-300 mb-2" />
        <p className="text-xs font-semibold text-gray-500">Active Audit Panel</p>
        <p className="text-[11px] text-gray-400 mt-1">Select any cell from the workspace list to view coordinates, precedents, and run Gemini AI audits.</p>
      </div>
    );
  }

  const cell = graph[selectedCellKey];
  const coord = selectedCellKey.split("!")[1];
  const sheet = selectedCellKey.split("!")[0];

  const precedents = cell.direct_refs;
  const leaves = cell.resolved_source_cells.filter((c) => !c.includes("CYCLE") && !c.includes("SHEET NOT FOUND"));

  // Fetch AI audit from server
  const handleGenerateAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet,
          coordinate: coord,
          formula: cell.raw_formula,
          value: cell.raw_value,
          row_label: cell.row_label,
          direct_refs: precedents,
          resolved_source_cells: cell.resolved_source_cells,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to audit formula.");
      }

      setAuditReports((prev) => ({
        ...prev,
        [selectedCellKey]: data.audit,
      }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const currentReport = auditReports[selectedCellKey];

  const handleCopyFormula = () => {
    if (cell.raw_formula) {
      navigator.clipboard.writeText(cell.raw_formula);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div id="cell-details-panel" className="w-96 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      {/* Header Profile */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-bold text-gray-500 uppercase bg-gray-50 border border-gray-200 px-2 py-0.5 rounded shadow-sm">
            {selectedCellKey}
          </span>
          <h2 className="text-xs font-semibold text-gray-900 truncate max-w-[200px] mt-1.5">
            {cell.row_label || "No Label Context"}
          </h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              activeTab === "profile" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1 ${
              activeTab === "audit" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 text-blue-500 fill-blue-500/20" />
            AI Audit
          </button>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {activeTab === "profile" ? (
          <>
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl shadow-sm text-left">
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">
                  Cell Value
                </span>
                <p className="text-sm font-semibold text-gray-800 mt-1 truncate">
                  {cell.raw_value !== null && cell.raw_value !== undefined
                    ? typeof cell.raw_value === "number"
                      ? cell.raw_value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : String(cell.raw_value)
                    : "No raw value"}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl shadow-sm text-left">
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">
                  Merged Cell
                </span>
                <p className="text-xs font-semibold text-gray-600 mt-1 flex items-center gap-1">
                  {cell.fill_rgb ? (
                    <span className="flex items-center gap-1">
                      <span
                        style={{ backgroundColor: `#${cell.fill_rgb.substring(2)}` }}
                        className="w-3 h-3 rounded-sm border border-gray-300"
                      />
                      #{cell.fill_rgb}
                    </span>
                  ) : (
                    "None"
                  )}
                </p>
              </div>
            </div>

            {/* Formula Block */}
            <div className="bg-gray-900 text-gray-100 p-4 rounded-xl border border-gray-800 shadow-inner text-left relative group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold font-mono uppercase text-gray-400 tracking-wider">
                  Spreadsheet Formula
                </span>
                {cell.is_formula && (
                  <button
                    onClick={handleCopyFormula}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-all cursor-pointer"
                    title="Copy Formula"
                  >
                    {copied ? (
                      <span className="text-[9px] text-green-400 font-bold px-1 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Copied!
                      </span>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              <p className="font-mono text-xs break-all leading-relaxed whitespace-pre-wrap select-all">
                {cell.raw_formula || "This is a raw constant value cell."}
              </p>
            </div>

            {/* Direct Links (Precedents) */}
            <div className="text-left">
              <label>
                Direct Precedent Links ({precedents.length})
              </label>
              {precedents.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No direct cell references. This cell is self-contained.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {precedents.map((pKey) => {
                    const parts = pKey.split("!");
                    return (
                      <div
                        key={pKey}
                        className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs"
                      >
                        <span className="font-mono font-bold text-gray-600 bg-white border border-gray-100 px-1 rounded shadow-sm">
                          {parts[1]}
                        </span>
                        <span className="text-gray-400 font-mono text-[10px] truncate max-w-[150px]">
                          {parts[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Traced Source Cells (Inputs) */}
            <div className="text-left">
              <label>
                Ultimate Leaves / Inputs ({leaves.length})
              </label>
              {leaves.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No calculated leaves traced.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {leaves.map((lKey) => {
                    const parts = lKey.split("!");
                    return (
                      <div
                        key={lKey}
                        className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50 text-xs"
                      >
                        <span className="font-mono font-bold text-gray-600 bg-white border border-gray-100 px-1 rounded shadow-sm">
                          {parts[1]}
                        </span>
                        <span className="text-gray-400 font-mono text-[10px] truncate max-w-[150px]">
                          {parts[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col text-left">
            {!cell.is_formula ? (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-8 h-8 text-amber-500 mb-2" />
                <p className="text-xs font-semibold text-gray-700">Audit Not Applicable</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  AI audits are optimized for calculated formula cells. This cell holds a raw constant value.
                </p>
              </div>
            ) : currentReport ? (
              <div className="flex flex-col gap-2">
                {/* Audit Content Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm prose prose-sm max-w-none">
                  <div className="flex items-center gap-1.5 text-blue-600 text-[10px] font-bold font-mono uppercase mb-4 pb-2 border-b border-gray-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    Gemini AI Report Generated
                  </div>
                  {formatMarkdown(currentReport)}
                </div>

                <button
                  onClick={handleGenerateAudit}
                  disabled={loading}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-2 shadow-sm border border-gray-200"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Re-audit Formula
                </button>
              </div>
            ) : (
              <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center justify-center text-center flex-1">
                {loading ? (
                  <div className="flex flex-col items-center">
                    <Cpu className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                    <p className="text-xs font-semibold text-gray-700">Analysing Calculation Chain...</p>
                    <div className="flex flex-col gap-1 mt-2.5 text-[10px] text-gray-400">
                      <span>• Checking precedence structures...</span>
                      <span>• Evaluating nesting complexities...</span>
                      <span>• Formulating safety improvements...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-10 h-10 text-blue-500 fill-blue-500/20 mb-3" />
                    <p className="text-xs font-semibold text-gray-700">Verify Formula Integrity</p>
                    <p className="text-[11px] text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                      Let Gemini analyze this formula. We will check it for hardcoded constants, nested checks, cycle risks, and generate optimized suggestions.
                    </p>

                    {error && (
                      <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-medium text-left mt-4 flex items-start gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleGenerateAudit}
                      className="w-full mt-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
                      Generate AI Formula Audit
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


