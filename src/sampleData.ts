import { DependencyGraph, MergedRanges } from "./types";

export const SAMPLE_GRAPH: DependencyGraph = {
  // Inputs Sheet
  "Inputs!B3": {
    sheet: "Inputs",
    raw_value: 0.12,
    raw_formula: null,
    is_formula: false,
    direct_refs: [],
    resolved_source_cells: ["Inputs!B3"],
    row_label: "Revenue Growth Rate",
    fill_rgb: "FFC6E0B4", // Greenish
    is_green_input_candidate: true,
  },
  "Inputs!B4": {
    sheet: "Inputs",
    raw_value: 1000000,
    raw_formula: null,
    is_formula: false,
    direct_refs: [],
    resolved_source_cells: ["Inputs!B4"],
    row_label: "Base Year Revenue",
    fill_rgb: "FFC6E0B4", // Greenish
    is_green_input_candidate: true,
  },
  "Inputs!B5": {
    sheet: "Inputs",
    raw_value: 0.45,
    raw_formula: null,
    is_formula: false,
    direct_refs: [],
    resolved_source_cells: ["Inputs!B5"],
    row_label: "COGS % of Revenue",
    fill_rgb: "FFC6E0B4", // Greenish
    is_green_input_candidate: true,
  },
  "Inputs!B6": {
    sheet: "Inputs",
    raw_value: 0.21,
    raw_formula: null,
    is_formula: false,
    direct_refs: [],
    resolved_source_cells: ["Inputs!B6"],
    row_label: "Corporate Tax Rate",
    fill_rgb: "FFC6E0B4", // Greenish
    is_green_input_candidate: true,
  },
  "Inputs!B7": {
    sheet: "Inputs",
    raw_value: 150000,
    raw_formula: null,
    is_formula: false,
    direct_refs: [],
    resolved_source_cells: ["Inputs!B7"],
    row_label: "Fixed Operating Expenses",
    fill_rgb: "FFC6E0B4", // Greenish
    is_green_input_candidate: true,
  },

  // Calculations Sheet
  "Calculations!C3": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Inputs!B4 * (1 + Inputs!B3)",
    is_formula: true,
    direct_refs: ["Inputs!B4", "Inputs!B3"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3"],
    row_label: "Projected Revenue",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Calculations!C4": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!C3 * Inputs!B5",
    is_formula: true,
    direct_refs: ["Calculations!C3", "Inputs!B5"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5"],
    row_label: "Projected COGS",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Calculations!C5": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!C3 - Calculations!C4",
    is_formula: true,
    direct_refs: ["Calculations!C3", "Calculations!C4"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5"],
    row_label: "Gross Profit margin",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Calculations!C6": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!C5 - Inputs!B7",
    is_formula: true,
    direct_refs: ["Calculations!C5", "Inputs!B7"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5", "Inputs!B7"],
    row_label: "Operating Income (EBIT)",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Calculations!C7": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!C6 * Inputs!B6",
    is_formula: true,
    direct_refs: ["Calculations!C6", "Inputs!B6"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5", "Inputs!B7", "Inputs!B6"],
    row_label: "Tax Expense Provision",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Calculations!C8": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!C6 - Calculations!C7",
    is_formula: true,
    direct_refs: ["Calculations!C6", "Calculations!C7"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5", "Inputs!B7", "Inputs!B6"],
    row_label: "Net Operating Profit After Tax",
    fill_rgb: null,
    is_green_input_candidate: false,
  },

  // Financial Statements Sheet
  "Financials!D3": {
    sheet: "Financials",
    raw_value: null,
    raw_formula: "=Calculations!C3",
    is_formula: true,
    direct_refs: ["Calculations!C3"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3"],
    row_label: "Revenue",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Financials!D4": {
    sheet: "Financials",
    raw_value: null,
    raw_formula: "=Calculations!C5",
    is_formula: true,
    direct_refs: ["Calculations!C5"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5"],
    row_label: "Gross Profit",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Financials!D5": {
    sheet: "Financials",
    raw_value: null,
    raw_formula: "=Calculations!C8",
    is_formula: true,
    direct_refs: ["Calculations!C8"],
    resolved_source_cells: ["Inputs!B4", "Inputs!B3", "Inputs!B5", "Inputs!B7", "Inputs!B6"],
    row_label: "Net Income",
    fill_rgb: "FF92D050", // Bold green
    is_green_input_candidate: true,
  },

  // A sheet with a deliberate circular reference cycle for demonstration
  "Calculations!X10": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!X11 * 1.05",
    is_formula: true,
    direct_refs: ["Calculations!X11"],
    resolved_source_cells: ["Calculations!X11!CYCLE"],
    row_label: "Circular Revenue Adjustment",
    fill_rgb: null,
    is_green_input_candidate: false,
  },
  "Calculations!X11": {
    sheet: "Calculations",
    raw_value: null,
    raw_formula: "=Calculations!X10 - 200",
    is_formula: true,
    direct_refs: ["Calculations!X10"],
    resolved_source_cells: ["Calculations!X10!CYCLE"],
    row_label: "Circular Feed Value",
    fill_rgb: null,
    is_green_input_candidate: false,
  }
};

export const SAMPLE_MERGES: MergedRanges = {
  "Inputs": [],
  "Calculations": [],
  "Financials": []
};
