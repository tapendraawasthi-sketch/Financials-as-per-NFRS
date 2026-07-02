import React, { useState } from 'react';
import { Save } from 'lucide-react';
import type { PreviousYearBalances } from '../../types';

interface PreviousYearDataProps {
  initialData?: PreviousYearBalances;
  onSave: (data: PreviousYearBalances) => void;
  isLoading?: boolean;
}

const DEFAULT_DATA: PreviousYearBalances = {
  revenue: 0, costOfSales: 0, otherIncome: 0, adminExpenses: 0, financeCosts: 0, depreciation: 0, incomeTaxExpense: 0,
  ppe: 0, investments: 0, currentAssets: 0, cashAndEquivalents: 0,
  shareCapital: 0, reserves: 0, borrowingsNonCurrent: 0, borrowingsCurrent: 0, tradePayables: 0, provisions: 0,
};

export default function PreviousYearData({ initialData, onSave, isLoading }: PreviousYearDataProps) {
  const [data, setData] = useState<PreviousYearBalances>(initialData || DEFAULT_DATA);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(data);
  };

  const renderField = (label: string, name: keyof PreviousYearBalances) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="number"
        name={name}
        value={data[name] || ''}
        onChange={handleChange}
        className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-brand focus:border-brand"
        placeholder="0.00"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        Enter the final audited balances from the previous fiscal year. These will be used as comparative figures in the financial statements.
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Income Statement</h3>
          {renderField('Revenue', 'revenue')}
          {renderField('Cost of Sales', 'costOfSales')}
          {renderField('Other Income', 'otherIncome')}
          {renderField('Administrative Expenses', 'adminExpenses')}
          {renderField('Finance Costs', 'financeCosts')}
          {renderField('Depreciation', 'depreciation')}
          {renderField('Income Tax Expense', 'incomeTaxExpense')}
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Balance Sheet</h3>
          {renderField('Property, Plant & Equipment', 'ppe')}
          {renderField('Investments', 'investments')}
          {renderField('Current Assets', 'currentAssets')}
          {renderField('Cash & Equivalents', 'cashAndEquivalents')}
          
          <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mt-6">Equity & Liabilities</h3>
          {renderField('Share Capital', 'shareCapital')}
          {renderField('Reserves', 'reserves')}
          {renderField('Non-Current Borrowings', 'borrowingsNonCurrent')}
          {renderField('Current Borrowings', 'borrowingsCurrent')}
          {renderField('Trade Payables', 'tradePayables')}
          {renderField('Provisions', 'provisions')}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-brand text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-dark transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={18} />
          {isLoading ? 'Saving...' : 'Save Previous Year Data'}
        </button>
      </div>
    </form>
  );
}
