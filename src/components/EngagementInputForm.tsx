import React, { useState, useMemo } from "react";
import { DependencyGraph, EngagementData, TrialBalanceMovement } from "../types";
import { 
  Building2, 
  FileSpreadsheet, 
  Users, 
  Layers, 
  Plus, 
  Trash2, 
  Check, 
  Download, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  ListTodo,
  Percent,
  Calculator
} from "lucide-react";

interface EngagementInputFormProps {
  graph: DependencyGraph;
  onDownload: (data: EngagementData) => Promise<void>;
  downloading: boolean;
}

export default function EngagementInputForm({
  graph,
  onDownload,
  downloading,
}: EngagementInputFormProps) {
  // Extract all existing Trial Balance accounts from the graph
  const trialBalanceAccounts = useMemo(() => {
    const labels = new Set<string>();
    Object.values(graph).forEach((cell) => {
      if (cell.sheet === "Trial Balance" && cell.row_label) {
        labels.add(cell.row_label);
      }
    });
    return Array.from(labels).sort();
  }, [graph]);

  // Form States
  const [company, setCompany] = useState({
    name_of_entity: "",
    address: "",
    type_of_entity: "Private Limited Company",
    chairperson: "",
    director: "",
    accounts_head: "",
    auditor: "",
    auditor_position: "Engagement Partner",
    audit_firm_name: "",
    audit_firm_type: "Chartered Accountants",
  });

  const [employees, setEmployees] = useState({
    employee_count: "",
    bonus_rate: "",
  });

  const [incomeTaxRate, setIncomeTaxRate] = useState("");

  const [inventory, setInventory] = useState({
    current_year: {
      raw_materials: "",
      work_in_progress: "",
      finished_goods: "",
    },
    previous_year: {
      raw_materials: "",
      work_in_progress: "",
      finished_goods: "",
    }
  });

  const [trialBalanceMovements, setTrialBalanceMovements] = useState<TrialBalanceMovement[]>([
    { account_label: "", during_dr_cy: null, during_cr_cy: null, adjustment_dr_cy: null, adjustment_cr_cy: null, during_dr_py: null }
  ]);

  const [note312Split, setNote312Split] = useState({
    current_portion_cy: "",
    noncurrent_portion_cy: "",
    current_portion_py: "",
    noncurrent_portion_py: "",
  });

  const [note32Split, setNote32Split] = useState({
    enabled: false,
    current_portion_cy: "",
    noncurrent_portion_cy: "",
    current_portion_py: "",
    noncurrent_portion_py: "",
  });

  const [note34Split, setNote34Split] = useState({
    enabled: false,
    current_portion_cy: "",
    noncurrent_portion_cy: "",
    current_portion_py: "",
    noncurrent_portion_py: "",
  });

  const [localError, setLocalError] = useState<string | null>(null);

  // Handlers for Trial Balance Movements list
  const handleAddMovement = () => {
    setTrialBalanceMovements([
      ...trialBalanceMovements,
      { account_label: "", during_dr_cy: null, during_cr_cy: null, adjustment_dr_cy: null, adjustment_cr_cy: null, during_dr_py: null }
    ]);
  };

  const handleRemoveMovement = (index: number) => {
    setTrialBalanceMovements(trialBalanceMovements.filter((_, i) => i !== index));
  };

  const handleUpdateMovement = (index: number, key: keyof TrialBalanceMovement, value: any) => {
    const updated = [...trialBalanceMovements];
    if (key === "account_label") {
      updated[index].account_label = value;
    } else {
      updated[index][key] = value === "" ? null : Number(value);
    }
    setTrialBalanceMovements(updated);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Basic validation
    const hasEmptyAccountLabels = trialBalanceMovements.some(m => !m.account_label);
    if (hasEmptyAccountLabels && trialBalanceMovements.length > 0) {
      setLocalError("Please select or specify account labels for all Trial Balance entries.");
      return;
    }

    // Prepare clean payload matching Python service interface
    const payload: EngagementData = {
      company,
      employees: {
        employee_count: employees.employee_count ? Number(employees.employee_count) : undefined,
        bonus_rate: employees.bonus_rate ? Number(employees.bonus_rate) : undefined,
      },
      income_tax_rate: incomeTaxRate ? Number(incomeTaxRate) : null,
      inventory: {
        current_year: {
          raw_materials: Number(inventory.current_year.raw_materials || 0),
          work_in_progress: Number(inventory.current_year.work_in_progress || 0),
          finished_goods: Number(inventory.current_year.finished_goods || 0),
        },
        previous_year: {
          raw_materials: Number(inventory.previous_year.raw_materials || 0),
          work_in_progress: Number(inventory.previous_year.work_in_progress || 0),
          finished_goods: Number(inventory.previous_year.finished_goods || 0),
        }
      },
      trial_balance_movements: trialBalanceMovements.filter(m => m.account_label),
      note_3_12_split: {
        current_portion_cy: note312Split.current_portion_cy ? Number(note312Split.current_portion_cy) : null,
        noncurrent_portion_cy: note312Split.noncurrent_portion_cy ? Number(note312Split.noncurrent_portion_cy) : null,
        current_portion_py: note312Split.current_portion_py ? Number(note312Split.current_portion_py) : null,
        noncurrent_portion_py: note312Split.noncurrent_portion_py ? Number(note312Split.noncurrent_portion_py) : null,
      },
      unverified_note_splits: [
        ...(note32Split.enabled ? [{
          note_number: "3.2",
          current_portion_cy: note32Split.current_portion_cy ? Number(note32Split.current_portion_cy) : null,
          noncurrent_portion_cy: note32Split.noncurrent_portion_cy ? Number(note32Split.noncurrent_portion_cy) : null,
          current_portion_py: note32Split.current_portion_py ? Number(note32Split.current_portion_py) : null,
          noncurrent_portion_py: note32Split.noncurrent_portion_py ? Number(note32Split.noncurrent_portion_py) : null,
        }] : []),
        ...(note34Split.enabled ? [{
          note_number: "3.4",
          current_portion_cy: note34Split.current_portion_cy ? Number(note34Split.current_portion_cy) : null,
          noncurrent_portion_cy: note34Split.noncurrent_portion_cy ? Number(note34Split.noncurrent_portion_cy) : null,
          current_portion_py: note34Split.current_portion_py ? Number(note34Split.current_portion_py) : null,
          noncurrent_portion_py: note34Split.noncurrent_portion_py ? Number(note34Split.noncurrent_portion_py) : null,
        }] : []),
      ]
    };

    try {
      await onDownload(payload);
    } catch (err: any) {
      setLocalError(err.message || "Failed to compile Excel workbook.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 bg-white overflow-y-auto h-full p-6 text-left border-r border-gray-200">
      {/* Title */}
      <div className="mb-8 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-2 text-indigo-600 font-mono text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Engagement Studio
        </div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight mt-1">
          Compile Engagement Reports
        </h2>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          Input your entity particulars, inventory valuations, trial balance postings, and employee benefit allocations. Values are validated against your workbook's active cell whitelist and written directly back into the template layout.
        </p>
      </div>

      {localError && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-start gap-2 animate-pulse">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{localError}</span>
        </div>
      )}

      {/* 1. Entity Information */}
      <div className="mb-8 bg-gray-50/50 rounded-xl p-5 border border-gray-100">
        <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-200/50">
          <Building2 className="w-4 h-4 text-gray-400" />
          1. Legal & Management Particulars (Details sheet)
        </h3>
        
        <div className="form-grid-2">
          <div>
            <label>Name of Entity</label>
            <input
              type="text"
              
              value={company.name_of_entity}
              onChange={(e) => setCompany({ ...company, name_of_entity: e.target.value })}
              placeholder="e.g. Acme Corp Private Limited"
            />
          </div>
          <div>
            <label>Entity Address</label>
            <input
              type="text"
              
              value={company.address}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
              placeholder="e.g. Kathmandu, Nepal"
            />
          </div>
          <div>
            <label>Type of Entity</label>
            <input
              type="text"
              
              value={company.type_of_entity}
              onChange={(e) => setCompany({ ...company, type_of_entity: e.target.value })}
              placeholder="e.g. Private Limited Company"
            />
          </div>
          <div>
            <label>Chairperson Name</label>
            <input
              type="text"
              
              value={company.chairperson}
              onChange={(e) => setCompany({ ...company, chairperson: e.target.value })}
            />
          </div>
          <div>
            <label>Director Name</label>
            <input
              type="text"
              
              value={company.director}
              onChange={(e) => setCompany({ ...company, director: e.target.value })}
            />
          </div>
          <div>
            <label>Accounts Head Name</label>
            <input
              type="text"
              
              value={company.accounts_head}
              onChange={(e) => setCompany({ ...company, accounts_head: e.target.value })}
            />
          </div>
          <div>
            <label>Auditor Name</label>
            <input
              type="text"
              
              value={company.auditor}
              onChange={(e) => setCompany({ ...company, auditor: e.target.value })}
            />
          </div>
          <div>
            <label>Auditor Position</label>
            <input
              type="text"
              
              value={company.auditor_position}
              onChange={(e) => setCompany({ ...company, auditor_position: e.target.value })}
            />
          </div>
          <div>
            <label>Name of Audit Firm</label>
            <input
              type="text"
              
              value={company.audit_firm_name}
              onChange={(e) => setCompany({ ...company, audit_firm_name: e.target.value })}
            />
          </div>
          <div>
            <label>Type of Audit Firm</label>
            <input
              type="text"
              
              value={company.audit_firm_type}
              onChange={(e) => setCompany({ ...company, audit_firm_type: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* 2. Employee Metrics & Key Parameters */}
      <div className="mb-8 bg-gray-50/50 rounded-xl p-5 border border-gray-100">
        <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-200/50">
          <Users className="w-4 h-4 text-gray-400" />
          2. Employee Metrics & Global Rates
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label>Number of Employees</label>
            <input
              type="number"
              
              value={employees.employee_count}
              onChange={(e) => setEmployees({ ...employees, employee_count: e.target.value })}
              placeholder="e.g. 150"
            />
          </div>
          <div>
            <label>
              Employee Bonus Rate
              <span className="text-[10px] text-gray-400 font-normal">(as decimal)</span>
            </label>
            <input
              type="number"
              step="any"
              
              value={employees.bonus_rate}
              onChange={(e) => setEmployees({ ...employees, bonus_rate: e.target.value })}
              placeholder="e.g. 0.10"
            />
          </div>
          <div>
            <label>
              Income Tax Rate
              <span className="text-[10px] text-gray-400 font-normal">(as decimal)</span>
            </label>
            <input
              type="number"
              step="any"
              
              value={incomeTaxRate}
              onChange={(e) => setIncomeTaxRate(e.target.value)}
              placeholder="e.g. 0.25"
            />
          </div>
        </div>
      </div>

      {/* 3. Inventory Valuations */}
      <div className="mb-8 bg-gray-50/50 rounded-xl p-5 border border-gray-100">
        <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-200/50">
          <Layers className="w-4 h-4 text-gray-400" />
          3. Physical Inventory Valuations (Details sheet)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CY Breakdown */}
          <div className="bg-white p-3 rounded-lg border border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-700 uppercase mb-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Current Year Valuation
            </h4>
            <div className="space-y-2.5">
              <div>
                <label>Raw Materials & Consumables</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50/30 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono"
                  value={inventory.current_year.raw_materials}
                  onChange={(e) => setInventory({
                    ...inventory,
                    current_year: { ...inventory.current_year, raw_materials: e.target.value }
                  })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Work-in-progress</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50/30 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono"
                  value={inventory.current_year.work_in_progress}
                  onChange={(e) => setInventory({
                    ...inventory,
                    current_year: { ...inventory.current_year, work_in_progress: e.target.value }
                  })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Finished goods & goods for resale</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50/30 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono"
                  value={inventory.current_year.finished_goods}
                  onChange={(e) => setInventory({
                    ...inventory,
                    current_year: { ...inventory.current_year, finished_goods: e.target.value }
                  })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* PY Breakdown */}
          <div className="bg-white p-3 rounded-lg border border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Previous Year Valuation
            </h4>
            <div className="space-y-2.5">
              <div>
                <label>Raw Materials & Consumables</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50/30 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono"
                  value={inventory.previous_year.raw_materials}
                  onChange={(e) => setInventory({
                    ...inventory,
                    previous_year: { ...inventory.previous_year, raw_materials: e.target.value }
                  })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Work-in-progress</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50/30 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono"
                  value={inventory.previous_year.work_in_progress}
                  onChange={(e) => setInventory({
                    ...inventory,
                    previous_year: { ...inventory.previous_year, work_in_progress: e.target.value }
                  })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Finished goods & goods for resale</label>
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs bg-gray-50/30 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all font-mono"
                  value={inventory.previous_year.finished_goods}
                  onChange={(e) => setInventory({
                    ...inventory,
                    previous_year: { ...inventory.previous_year, finished_goods: e.target.value }
                  })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Trial Balance Postings */}
      <div className="mb-8 bg-gray-50/50 rounded-xl p-5 border border-gray-100">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200/50 mb-4">
          <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            4. Trial Balance Postings (Movements)
          </h3>
          <button
            type="button"
            onClick={handleAddMovement}
            className="flex items-center gap-1 py-1 px-2 border border-gray-200 hover:bg-gray-100 rounded-md text-[10px] font-bold text-gray-600 transition-all cursor-pointer bg-white"
          >
            <Plus className="w-3 h-3" /> Add Row
          </button>
        </div>

        {trialBalanceMovements.length === 0 ? (
          <div className="text-center p-4 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 bg-white">
            No Trial Balance movements specified. Click "Add Row" to post account adjustments.
          </div>
        ) : (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {trialBalanceMovements.map((movement, idx) => (
              <div key={idx} className="bg-white p-3.5 border border-gray-200/80 rounded-xl flex flex-col gap-3 relative shadow-sm">
                <button
                  type="button"
                  onClick={() => handleRemoveMovement(idx)}
                  className="absolute top-2.5 right-2.5 text-gray-400 hover:text-red-500 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Account select autocomplete dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label>Account Label</label>
                    <select
                      className="w-full px-2.5 py-1 border border-gray-200 rounded text-xs bg-white focus:ring-1 focus:ring-gray-900 outline-none"
                      value={movement.account_label}
                      onChange={(e) => handleUpdateMovement(idx, "account_label", e.target.value)}
                    >
                      <option value="">-- Choose Account Particular --</option>
                      {trialBalanceAccounts.map((act) => (
                        <option key={act} value={act}>{act}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Custom Label (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-gray-900 transition-all"
                      value={movement.account_label}
                      onChange={(e) => handleUpdateMovement(idx, "account_label", e.target.value)}
                      placeholder="Or enter new exact label"
                    />
                  </div>
                </div>

                {/* Posting numeric inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label>During Dr (CY)</label>
                    <input
                      type="number"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                      value={movement.during_dr_cy || ""}
                      onChange={(e) => handleUpdateMovement(idx, "during_dr_cy", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label>During Cr (CY)</label>
                    <input
                      type="number"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                      value={movement.during_cr_cy || ""}
                      onChange={(e) => handleUpdateMovement(idx, "during_cr_cy", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label>Adj Dr (CY)</label>
                    <input
                      type="number"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                      value={movement.adjustment_dr_cy || ""}
                      onChange={(e) => handleUpdateMovement(idx, "adjustment_dr_cy", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label>Adj Cr (CY)</label>
                    <input
                      type="number"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                      value={movement.adjustment_cr_cy || ""}
                      onChange={(e) => handleUpdateMovement(idx, "adjustment_cr_cy", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label>During Dr (PY)</label>
                    <input
                      type="number"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                      value={movement.during_dr_py || ""}
                      onChange={(e) => handleUpdateMovement(idx, "during_dr_py", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Notes splits */}
      <div className="mb-8 bg-gray-50/50 rounded-xl p-5 border border-gray-100">
        <h3 className="text-xs font-bold font-mono uppercase text-gray-500 tracking-wider mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-200/50">
          <ListTodo className="w-4 h-4 text-gray-400" />
          5. Current / Non-Current Splits (Notes sheet)
        </h3>

        {/* Note 3.12 (Mandatory Employee Benefits) */}
        <div className="bg-white p-4 rounded-lg border border-gray-200/80 mb-4 shadow-sm">
          <h4 className="text-[11px] font-bold text-gray-800 uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Note 3.12: Liability for Employee Benefits
          </h4>
          <p className="text-[10px] text-gray-400 mt-1 leading-normal mb-3">
            Confirmed manual write-point. Specify portion of employee benefit liability due within 1 year (Current) vs over 1 year (Non-Current).
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label>Due &lt;1 Year CY</label>
              <input
                type="number"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                value={note312Split.current_portion_cy}
                onChange={(e) => setNote312Split({ ...note312Split, current_portion_cy: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label>Due &gt;1 Year CY</label>
              <input
                type="number"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                value={note312Split.noncurrent_portion_cy}
                onChange={(e) => setNote312Split({ ...note312Split, noncurrent_portion_cy: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label>Due &lt;1 Year PY</label>
              <input
                type="number"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                value={note312Split.current_portion_py}
                onChange={(e) => setNote312Split({ ...note312Split, current_portion_py: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label>Due &gt;1 Year PY</label>
              <input
                type="number"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                value={note312Split.noncurrent_portion_py}
                onChange={(e) => setNote312Split({ ...note312Split, noncurrent_portion_py: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Note 3.2 (Investments - Experimental) */}
        <div className="bg-white p-4 rounded-lg border border-gray-200/80 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="opt-note32"
              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
              checked={note32Split.enabled}
              onChange={(e) => setNote32Split({ ...note32Split, enabled: e.target.checked })}
            />
            <label htmlFor="opt-note32" className="text-[11px] font-bold text-gray-600 uppercase cursor-pointer">
              Note 3.2: Investments (Opt-In Portion Split)
            </label>
          </div>
          
          {note32Split.enabled && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 border-t border-gray-50 pt-3">
              <div>
                <label>Current CY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note32Split.current_portion_cy}
                  onChange={(e) => setNote32Split({ ...note32Split, current_portion_cy: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Non-Current CY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note32Split.noncurrent_portion_cy}
                  onChange={(e) => setNote32Split({ ...note32Split, noncurrent_portion_cy: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Current PY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note32Split.current_portion_py}
                  onChange={(e) => setNote32Split({ ...note32Split, current_portion_py: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Non-Current PY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note32Split.noncurrent_portion_py}
                  onChange={(e) => setNote32Split({ ...note32Split, noncurrent_portion_py: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>

        {/* Note 3.4 (Other Receivables - Experimental) */}
        <div className="bg-white p-4 rounded-lg border border-gray-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="opt-note34"
              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
              checked={note34Split.enabled}
              onChange={(e) => setNote34Split({ ...note34Split, enabled: e.target.checked })}
            />
            <label htmlFor="opt-note34" className="text-[11px] font-bold text-gray-600 uppercase cursor-pointer">
              Note 3.4: Other Receivables (Opt-In Portion Split)
            </label>
          </div>
          
          {note34Split.enabled && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 border-t border-gray-50 pt-3">
              <div>
                <label>Current CY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note34Split.current_portion_cy}
                  onChange={(e) => setNote34Split({ ...note34Split, current_portion_cy: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Non-Current CY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note34Split.noncurrent_portion_cy}
                  onChange={(e) => setNote34Split({ ...note34Split, noncurrent_portion_cy: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Current PY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note34Split.current_portion_py}
                  onChange={(e) => setNote34Split({ ...note34Split, current_portion_py: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label>Non-Current PY</label>
                <input
                  type="number"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
                  value={note34Split.noncurrent_portion_py}
                  onChange={(e) => setNote34Split({ ...note34Split, noncurrent_portion_py: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Write Button */}
      <div className="flex justify-end pt-5 border-t border-gray-100 mb-10">
        <button
          type="submit"
          disabled={downloading}
          className="flex items-center gap-2 px-6 py-3 bg-gray-950 hover:bg-gray-800 text-white font-bold rounded-lg text-xs shadow-md disabled:bg-gray-400 cursor-pointer transition-all active:scale-95"
        >
          {downloading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Compiling Workbook...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-indigo-400" />
              Compile & Export Excel Statement
            </>
          )}
        </button>
      </div>
    </form>
  );
}

