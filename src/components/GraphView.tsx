import React, { useMemo, useState, useEffect, useRef } from "react";
import { DependencyGraph, CellEntry } from "../types";
import { ArrowRight, CornerRightDown, HelpCircle, AlertTriangle, Play } from "lucide-react";

interface GraphViewProps {
  graph: DependencyGraph;
  selectedCellKey: string | null;
  onSelectCell: (key: string) => void;
}

export default function GraphView({
  graph,
  selectedCellKey,
  onSelectCell,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Record<string, { x: number; y: number }>>({});
  const [, forceUpdate] = useState(0);

  // Derive dependents (downstream cells referencing this cell)
  const dependents = useMemo(() => {
    if (!selectedCellKey) return [];
    const deps: string[] = [];
    Object.entries(graph).forEach(([key, value]) => {
      if (value.direct_refs.includes(selectedCellKey)) {
        deps.push(key);
      }
    });
    return deps;
  }, [graph, selectedCellKey]);

  // Retrieve current active cell details
  const activeCell = selectedCellKey ? graph[selectedCellKey] : null;

  // Precedents (upstream cells referenced by this cell)
  const precedents = useMemo(() => {
    if (!activeCell) return [];
    return activeCell.direct_refs;
  }, [activeCell]);

  // Traced ultimate inputs (leaves)
  const leaves = useMemo(() => {
    if (!activeCell) return [];
    // filter out cycles or invalid entries
    return activeCell.resolved_source_cells.filter((c) => !c.includes("CYCLE") && !c.includes("SHEET NOT FOUND"));
  }, [activeCell]);

  // Measure positions of node connector dots to draw linking SVG lines
  const updateConnectorPositions = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newCoords: Record<string, { x: number; y: number }> = {};

    // Find all anchor elements
    const anchors = containerRef.current.querySelectorAll("[data-anchor-id]");
    anchors.forEach((elem) => {
      const anchorId = elem.getAttribute("data-anchor-id");
      if (anchorId) {
        const rect = elem.getBoundingClientRect();
        newCoords[anchorId] = {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top,
        };
      }
    });

    setCoords(newCoords);
  };

  // Run measuring logic on render/selection changes
  useEffect(() => {
    // Small timeout to allow browser layout to complete before taking measurements
    const timer = setTimeout(() => {
      updateConnectorPositions();
    }, 60);

    // Watch resize events
    const resizeObserver = new ResizeObserver(() => {
      updateConnectorPositions();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [selectedCellKey, precedents, dependents, graph]);

  // Helper to render cell nodes
  const renderNode = (key: string, isCenter = false) => {
    const data = graph[key];
    const sheet = key.split("!")[0];
    const coord = key.split("!")[1];

    if (!data) {
      // Cell exists in formula but is empty or uninitialized
      return (
        <div
          id={`node-${key}`}
          key={key}
          className="p-3.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-left w-64 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold font-mono text-gray-400 uppercase bg-gray-200/50 px-1.5 py-0.5 rounded border border-gray-300/30">
              {coord}
            </span>
            <span className="text-[9px] bg-gray-200 text-gray-500 font-bold uppercase px-1 rounded">
              Unused
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-400 mt-1.5">Uninitialized cell</p>
          <p className="text-[10px] text-gray-400 italic mt-0.5 font-mono">{sheet}</p>
        </div>
      );
    }

    const hasCycle = data.resolved_source_cells.some((c) => c.includes("CYCLE"));

    let cardBorder = "border-gray-200 hover:border-gray-400";
    let cardBg = "bg-white";
    let typeTag = null;

    if (isCenter) {
      cardBorder = "border-gray-900 ring-2 ring-gray-900/10";
      cardBg = "bg-gray-50/50";
    }

    if (data.is_formula) {
      typeTag = (
        <span className="text-[9px] font-mono font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100 px-1 rounded">
          Formula
        </span>
      );
    } else if (data.is_green_input_candidate) {
      typeTag = (
        <span className="text-[9px] font-mono font-bold uppercase bg-green-50 text-green-600 border border-green-100 px-1 rounded">
          Input
        </span>
      );
    } else {
      typeTag = (
        <span className="text-[9px] font-mono font-bold uppercase bg-gray-50 text-gray-500 border border-gray-100 px-1 rounded">
          Const
        </span>
      );
    }

    return (
      <button
        id={`node-${key}`}
        key={key}
        onClick={() => !isCenter && onSelectCell(key)}
        className={`p-3.5 border rounded-xl text-left w-64 shadow-sm transition-all relative flex flex-col gap-1.5 ${cardBg} ${cardBorder} ${
          !isCenter ? "cursor-pointer transform hover:-translate-y-0.5" : "cursor-default"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase">
            {coord}
          </span>
          <div className="flex items-center gap-1">
            {hasCycle && (
              <span className="text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-100 px-1 rounded flex items-center gap-0.5">
                Cycle
              </span>
            )}
            {typeTag}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-900 truncate">
            {data.row_label || "No Label Context"}
          </p>
          <p className="text-[10px] text-gray-400 font-medium font-mono mt-0.5">{sheet}</p>
        </div>

        <div className="pt-2 border-t border-gray-100 mt-0.5">
          <p className="text-[10px] font-mono text-gray-600 truncate bg-gray-50 p-1.5 rounded border border-gray-100">
            {data.is_formula ? data.raw_formula : String(data.raw_value ?? "empty")}
          </p>
        </div>

        {/* Input Connector dots */}
        {!isCenter && precedents.length === 0 && (
          <div
            data-anchor-id={`in-${key}`}
            className="absolute right-0 top-1/2 -mr-1.5 w-3 h-3 bg-gray-400 border-2 border-white rounded-full z-10"
          />
        )}
        {!isCenter && precedents.length > 0 && (
          <div
            data-anchor-id={`in-out-${key}`}
            className="absolute right-0 top-1/2 -mr-1.5 w-3 h-3 bg-blue-500 border-2 border-white rounded-full z-10"
          />
        )}
        {isCenter && (
          <>
            <div
              data-anchor-id="center-in"
              className="absolute left-0 top-1/2 -ml-1.5 w-3.5 h-3.5 bg-gray-900 border-2 border-white rounded-full z-10 shadow-sm"
            />
            <div
              data-anchor-id="center-out"
              className="absolute right-0 top-1/2 -mr-1.5 w-3.5 h-3.5 bg-gray-900 border-2 border-white rounded-full z-10 shadow-sm"
            />
          </>
        )}
        {!isCenter && dependents.length > 0 && (
          <div
            data-anchor-id={`out-${key}`}
            className="absolute left-0 top-1/2 -ml-1.5 w-3 h-3 bg-purple-500 border-2 border-white rounded-full z-10"
          />
        )}
      </button>
    );
  };

  if (!selectedCellKey || !activeCell) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No cell selected</p>
          <p className="text-xs text-gray-500 mt-1">
            Please choose a cell coordinate from the left list or upload a spreadsheet to build the formula dependency tree.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50/70 p-6 flex flex-col overflow-hidden relative" ref={containerRef}>
      {/* Visual Workspace Headers */}
      <div className="mb-6 flex justify-between items-center bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            Formula Lineage Graph
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Active Focus: <span className="font-mono font-semibold text-gray-800">{selectedCellKey}</span>
            {activeCell.row_label ? ` (${activeCell.row_label})` : ""}
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-[10px] text-gray-500 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /> Formula
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-sm" /> Input Candidate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-gray-400 rounded-sm" /> Constant
          </span>
        </div>
      </div>

      {/* SVG Canvas for Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
          </marker>
        </defs>

        {/* Render lines from precedents to active node */}
        {precedents.map((precKey) => {
          const start = coords[`in-out-${precKey}`] || coords[`in-${precKey}`];
          const end = coords["center-in"];

          if (start && end) {
            const dx = Math.abs(end.x - start.x) * 0.5;
            const path = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
            return (
              <path
                key={`line-${precKey}-center`}
                d={path}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="1.5"
                strokeDasharray={graph[precKey] ? undefined : "4"}
                markerEnd="url(#arrow)"
                className="opacity-75"
              />
            );
          }
          return null;
        })}

        {/* Render lines from active node to dependents */}
        {dependents.map((depKey) => {
          const start = coords["center-out"];
          const end = coords[`out-${depKey}`] || coords[`in-out-${depKey}`];

          if (start && end) {
            const dx = Math.abs(end.x - start.x) * 0.5;
            const path = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
            return (
              <path
                key={`line-center-${depKey}`}
                d={path}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="1.5"
                markerEnd="url(#arrow)"
                className="opacity-75"
              />
            );
          }
          return null;
        })}
      </svg>

      {/* Multi-tier columns layout */}
      <div className="flex-1 grid grid-cols-3 gap-8 items-center overflow-y-auto relative z-10 pr-2">
        {/* Tier 1: Precedent calculations */}
        <div className="flex flex-col gap-4 items-center h-full justify-center">
          <div className="text-center mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
              Precedents ({precedents.length})
            </span>
            <p className="text-[9px] text-gray-500 mt-0.5">Cells direct formula calls</p>
          </div>
          <div className="flex flex-col gap-4 max-h-[80%] overflow-y-auto p-1.5 bg-gray-100/40 rounded-2xl border border-gray-200/50 w-full items-center">
            {precedents.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">
                No precedent links. This is an input cell.
              </div>
            ) : (
              precedents.map((pKey) => renderNode(pKey))
            )}
          </div>
        </div>

        {/* Tier 2: Selected Cell focus */}
        <div className="flex flex-col gap-4 items-center justify-center">
          <div className="text-center mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-800">
              Focused Cell
            </span>
            <p className="text-[9px] text-gray-500 mt-0.5">Active calculation focus</p>
          </div>
          <div className="flex justify-center w-full">
            {renderNode(selectedCellKey, true)}
          </div>
        </div>

        {/* Tier 3: Downstream Dependents */}
        <div className="flex flex-col gap-4 items-center h-full justify-center">
          <div className="text-center mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
              Dependents ({dependents.length})
            </span>
            <p className="text-[9px] text-gray-500 mt-0.5">Calculations reading this cell</p>
          </div>
          <div className="flex flex-col gap-4 max-h-[80%] overflow-y-auto p-1.5 bg-gray-100/40 rounded-2xl border border-gray-200/50 w-full items-center">
            {dependents.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">
                No downstream calculations read this cell directly.
              </div>
            ) : (
              dependents.map((dKey) => renderNode(dKey))
            )}
          </div>
        </div>
      </div>

      {/* Trace Leaf Inputs Bar */}
      {leaves.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 p-4 rounded-xl shadow-sm z-10">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-2">
            Ultimate Inputs Traced ({leaves.length})
          </span>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {leaves.map((leafKey) => {
              const sheet = leafKey.split("!")[0];
              const coord = leafKey.split("!")[1];
              const data = graph[leafKey];
              return (
                <button
                  id={`leaf-${leafKey}`}
                  key={leafKey}
                  onClick={() => onSelectCell(leafKey)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-200 text-xs text-gray-700 transition-all font-medium text-left"
                >
                  <span className="font-mono font-bold text-[9px] text-gray-500 bg-white border border-gray-200 px-1 py-0.5 rounded">
                    {coord}
                  </span>
                  <span className="truncate max-w-[120px]">
                    {data?.row_label || "No Label"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
