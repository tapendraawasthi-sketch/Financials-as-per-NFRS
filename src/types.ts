export interface CellEntry {
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

export type DependencyGraph = Record<string, CellEntry>;

export interface SelectedCellDetails {
  key: string; // "Sheet!Coord"
  sheet: string;
  coordinate: string;
  entry: CellEntry;
}

export interface MergedRanges {
  [sheetName: string]: string[];
}

export interface ParseResult {
  dependency_graph: DependencyGraph;
  merged_cell_ranges: MergedRanges;
}

export interface CompanyDetails {
  name_of_entity?: string;
  address?: string;
  type_of_entity?: string;
  chairperson?: string;
  director?: string;
  accounts_head?: string;
  auditor?: string;
  auditor_position?: string;
  audit_firm_name?: string;
  audit_firm_type?: string;
}

export interface InventoryYearBreakdown {
  raw_materials: number;
  work_in_progress: number;
  finished_goods: number;
}

export interface InventoryDetails {
  current_year: InventoryYearBreakdown;
  previous_year: InventoryYearBreakdown;
}

export interface EmployeeDetails {
  employee_count?: number;
  bonus_rate?: number;
}

export interface TrialBalanceMovement {
  account_label: string;
  during_dr_cy?: number | null;
  during_cr_cy?: number | null;
  adjustment_dr_cy?: number | null;
  adjustment_cr_cy?: number | null;
  during_dr_py?: number | null;
  during_cr_py?: number | null;
}

export interface Note312Split {
  current_portion_cy?: number | null;
  noncurrent_portion_cy?: number | null;
  current_portion_py?: number | null;
  noncurrent_portion_py?: number | null;
}

export interface UnverifiedNoteSplit {
  note_number: string; // "3.2" or "3.4"
  current_portion_cy?: number | null;
  noncurrent_portion_cy?: number | null;
  current_portion_py?: number | null;
  noncurrent_portion_py?: number | null;
}

export interface EngagementData {
  company?: CompanyDetails;
  inventory?: InventoryDetails;
  employees?: EmployeeDetails;
  income_tax_rate?: number | null;
  trial_balance_movements: TrialBalanceMovement[];
  note_3_12_split?: Note312Split;
  unverified_note_splits?: UnverifiedNoteSplit[];
}

export interface NoteMetadata {
  title: string;
  sub_sections?: string[];
  sub_blocks?: Record<string, { rows: number[]; total_row: number }>;
  rows?: number[] | { header: number; listed_shares_block: number[]; other_investments_block: number[] };
  total_row?: number;
  key_rows?: Record<string, number>;
  current_year_col?: string;
  prev_year_col?: string;
  feeds_from_tb_rows?: Record<string, string>;
  feeds_into?: string | Record<string, string>;
  confidence?: string;
  warning?: string;
  manual_split_confirmed?: string;
  note?: string;
  secondary_block?: any;
}

export type NotesMapping = Record<string, NoteMetadata>;

