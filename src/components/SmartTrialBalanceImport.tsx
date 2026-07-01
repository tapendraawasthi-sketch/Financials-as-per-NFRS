// ===== src/components/SmartTrialBalanceImport.tsx =====
import React, { useState, useRef } from "react";
import { TBImportResponse, TBImportRow } from "../types";
import { CHART_OF_ACCOUNTS_LABELS } from "../chartOfAccountsClient";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, HelpCircle,
  Sparkles, Download, Loader2, ShieldAlert, ListChecks
} from "lucide-react";

interface SmartTrialBalanceImportProps {
  hasActiveTemplate: boolean;
}

function confidenceBadge(confidence: number) {
  if (confidence >= 80) {
    return <span className="text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">{confidence}%</span>;
  }
  if (confidence >= 40) {
    return <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{confidence}%</span>;
  }
  return <span className="text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">{confidence}%</span>;
}

function methodLabel(method: string) {
  const map: Record<string, string> = {
    exact: "Exact Match", synonym: "Synonym", fuzzy: "Fuzzy Match",
    bucket_slot: "Sub-Ledger Slot", ai: "AI Suggested", unmatched: "Unmatched",
  };
  return map[method] || method;
}

export default function SmartTrialBalanceImport({ hasActiveTemplate }: SmartTrialBalanceImportProps) {
  const [importing, setImporting] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TBImportResponse | null>(null);
  const [editedRows, setEditedRows] = useState<TBImportRow[]>([]);
  const [isPreviousYear, setIsPreviousYear] = useState(false);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);
    setWriteSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import/trial-balance", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to import trial balance.");

      setResult(data);
      setEditedRows(data.rows);
    } catch (err: any) {
      setError(err.message || "An error occurred while importing the trial balance.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOverride = (index: number, newLabel: string) => {
    setEditedRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, matchedLabel: newLabel || null, confidence: newLabel ? 100 : 0, method: newLabel ? "unmatched" : "unmatched" } : row))
    );
  };

  const handleConfirmAndWrite = async () => {
    setWriting(true);
    setError(null);
    setWriteSuccess(null);
    try {
      const payload = {
        rows: editedRows.map((r) => ({
          rawLabel: r.rawLabel,
          matchedLabel: r.matchedLabel,
          debit: r.debit,
          credit: r.credit,
        })),
        isPreviousYear,
      };

      const response = await fetch("/api/import/trial-balance/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to write trial balance into workbook.");
      }

      const writtenCount = response.headers.get("X-Import-Written-Count");
      const skippedCount = response.headers.get("X-Import-Skipped-Count");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "TB_Imported_MEs_Financials_Format.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setWriteSuccess(
        `Workbook written and downloaded. ${writtenCount || 0} cell(s) updated` +
        (skippedCount && Number(skippedCount) > 0 ? `, ${skippedCount} row(s) skipped (see console for details).` : ".")
      );
    } catch (err: any) {
      setError(err.message || "An error occurred while writing to the workbook.");
    } finally {
      setWriting(false);
    }
  };

  const unresolvedCount = editedRows.filter((r) => !r.matchedLabel).length;

  return (
    <div className="flex-1 bg-white overflow-y-auto h-full p-6 text-left">
      <div className="mb-6 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-2 text-indigo-600 font-mono text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Smart Trial Balance Import
        </div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight mt-1">
          Upload Any Raw Trial Balance
        </h2>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-2xl">
          Upload a client's trial balance in whatever layout it was exported (CSV or Excel, any column order,
          as long as an account label, debit, and credit column are present). This tool will deterministically
          check that it foots, match every account name against the fixed chart of accounts used in your
          MEs Financials template, and use AI only to suggest matches for names it genuinely cannot resolve on
          its own -- every suggestion, human or AI, is validated against the real template before anything is
          written. Nothing is written to any workbook until you review and confirm the mapping below.
        </p>
      </div>

      {!hasActiveTemplate && (
        <div className="mb-6 p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>Upload the master "MEs Financials Format" workbook first (Lineage Auditor tab) -- the imported trial balance will be written into that active template.</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {writeSuccess && (
        <div className="mb-6 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <span>{writeSuccess}</span>
        </div>
      )}

      {!result && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center bg-gray-50/50">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || !hasActiveTemplate}
            className="px-5 py-2.5 bg-gray-950 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer transition-all"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Parsing & Classifying...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload Raw Trial Balance (.csv / .xlsx)</>
            )}
          </button>
          <p className="text-[11px] text-gray-400 mt-3">Any layout accepted -- account name, debit, credit columns will be auto-detected.</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Footing check */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${result.isBalanced ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2.5">
              {result.isBalanced ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
              <div>
                <p className={`text-xs font-bold ${result.isBalanced ? "text-green-800" : "text-red-800"}`}>
                  {result.isBalanced ? "Trial balance foots correctly" : "Trial balance does NOT foot"}
                </p>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  Debit: {result.totalDebit.toLocaleString()} &nbsp;|&nbsp; Credit: {result.totalCredit.toLocaleString()}
                  {!result.isBalanced && <> &nbsp;|&nbsp; Difference: {result.difference.toLocaleString()}</>}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer">
              <input type="checkbox" checked={isPreviousYear} onChange={(e) => setIsPreviousYear(e.target.checked)} className="rounded cursor-pointer" />
              Import as Previous Year column
            </label>
          </div>

          {result.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1">
              {result.warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{w}</div>)}
            </div>
          )}

          {/* Summary chips */}
          <div className="flex gap-3 text-xs font-mono">
            <span className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">Total: <strong>{result.summary.totalRows}</strong></span>
            <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-green-700">Auto-matched: <strong>{result.summary.autoMatched}</strong></span>
            <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">Needs review: <strong>{result.summary.needsReview}</strong></span>
            <span className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700">Unmatched: <strong>{result.summary.unmatched}</strong></span>
          </div>

          {/* Review table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-mono text-[9px]">
                <tr>
                  <th className="p-3">Uploaded Account Name</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3">Matched Template Row</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editedRows.map((row, idx) => (
                  <tr key={idx} className={!row.matchedLabel ? "bg-red-50/30" : row.confidence < 80 ? "bg-amber-50/30" : ""}>
                    <td className="p-3 font-medium text-gray-800">{row.rawLabel}</td>
                    <td className="p-3 text-right font-mono text-gray-600">{row.debit ? row.debit.toLocaleString() : "-"}</td>
                    <td className="p-3 text-right font-mono text-gray-600">{row.credit ? row.credit.toLocaleString() : "-"}</td>
                    <td className="p-3">
                      <select
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:ring-1 focus:ring-gray-900 outline-none"
                        value={row.matchedLabel || ""}
                        onChange={(e) => handleOverride(idx, e.target.value)}
                      >
                        <option value="">-- Unmatched / Select Manually --</option>
                        {row.candidates.map((c) => (
                          <option key={c.label} value={c.label}>{c.label} ({c.confidence}%)</option>
                        ))}
                        {CHART_OF_ACCOUNTS_LABELS.filter((l) => !row.candidates.some((c) => c.label === l)).map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-[10px] text-gray-500 font-mono">{methodLabel(row.method)}</td>
                    <td className="p-3">{confidenceBadge(row.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unresolvedCount > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 flex items-start gap-2">
              <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {unresolvedCount} row(s) still have no confirmed mapping and will be SKIPPED on write. Select a template row from the dropdown for each, or leave skipped if genuinely not applicable.
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            <button
              onClick={() => { setResult(null); setEditedRows([]); setWriteSuccess(null); }}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              Start Over
            </button>
            <button
              onClick={handleConfirmAndWrite}
              disabled={writing}
              className="flex items-center gap-2 px-6 py-3 bg-gray-950 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold rounded-lg text-xs shadow-md cursor-pointer transition-all"
            >
              {writing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Writing to Workbook...</>
              ) : (
                <><ListChecks className="w-4 h-4 text-indigo-400" /> Confirm Mapping & Write to Trial Balance</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
