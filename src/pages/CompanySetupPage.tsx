// src/pages/CompanySetupPage.tsx
import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { CompanyProfile, AccountingPolicies } from '../types';
import CompanyInfoForm from '../components/company/CompanyInfoForm';
import AccountingPoliciesForm from '../components/company/AccountingPoliciesForm';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Alert from '../components/ui/Alert';

import PreviousYearData from '../components/company/PreviousYearData';

type SubStep = 'company_info' | 'accounting_policies' | 'previous_year_data';

const wizardSteps = [
  { id: 'company_setup' as const, label: 'Company Info', description: 'Basic company details' },
  { id: 'accounting_policies' as const, label: 'Policies', description: 'Depreciation & accounting choices' },
  { id: 'trial_balance_upload' as const, label: 'Upload TB', description: 'Trial balance file' },
  { id: 'trial_balance_mapping' as const, label: 'Map Accounts', description: 'NFRS account mapping' },
  { id: 'subledger_details' as const, label: 'Subledgers', description: 'Debtors & creditors' },
  { id: 'year_end_adjustments' as const, label: 'Adjustments', description: 'Depreciation & provisions' },
  { id: 'review_statements' as const, label: 'Statements', description: 'Review financials' },
  { id: 'generate_output' as const, label: 'Download', description: 'Generate Excel' },
];

const CompanySetupPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [subStep, setSubStep] = useState<SubStep>('company_info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompanySubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const method = state.company?.id ? 'PUT' : 'POST';
      const url = state.company?.id
        ? `/api/company/${state.company.id}`
        : '/api/company';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const company: CompanyProfile = await response.json();
      dispatch({ type: 'SET_COMPANY', payload: company });
      setSubStep('accounting_policies');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save company details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePoliciesSubmit = async (policies: any) => {
    if (!state.company?.id) {
      setError('Company ID not found. Please save company details first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/company/${state.company.id}/policies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policies),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const updatedCompany: CompanyProfile = await response.json();
      dispatch({ type: 'SET_COMPANY', payload: updatedCompany });
      setSubStep('previous_year_data');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save accounting policies.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviousYearSubmit = async (prevData: any) => {
    if (!state.company?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/company/${state.company.id}/previous-year`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prevData),
      });

      if (!response.ok) {
        throw new Error('Failed to save previous year data');
      }

      const updatedCompany: CompanyProfile = await response.json();
      dispatch({ type: 'SET_COMPANY', payload: updatedCompany });
      dispatch({ type: 'COMPLETE_STEP', payload: 'company_setup' });
      dispatch({ type: 'COMPLETE_STEP', payload: 'accounting_policies' });
      dispatch({ type: 'SET_STEP', payload: 'trial_balance_upload' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save previous year data.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingSpinner
        message={subStep === 'company_info' ? 'Saving company details…' : 'Saving accounting policies…'}
        fullPage
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Sub-step stepper */}
      <div className="flex items-center gap-0">
        {[
          { key: 'company_info',        label: 'Company Information', num: 1 },
          { key: 'accounting_policies', label: 'Accounting Policies', num: 2 },
          { key: 'previous_year_data',  label: 'Previous Year Data',  num: 3 },
        ].map((s, i, arr) => {
          const isActive = subStep === s.key;
          const isDone   = (s.key === 'company_info' && (subStep === 'accounting_policies' || subStep === 'previous_year_data'))
                        || (s.key === 'accounting_policies' && subStep === 'previous_year_data');
          const canClick = s.key === 'company_info' || !!state.company?.id;
          return (
            <div key={s.key} className="flex items-center">
              <button
                onClick={() => canClick && setSubStep(s.key as SubStep)}
                disabled={!canClick}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all',
                  isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : isDone ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : canClick ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-300 cursor-not-allowed',
                ].join(' ')}
              >
                <span className={[
                  'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  isActive ? 'bg-white/25 text-white'
                    : isDone ? 'bg-emerald-200 text-emerald-700'
                    : 'bg-slate-200 text-slate-500',
                ].join(' ')}>
                  {isDone ? '✓' : s.num}
                </span>
                {s.label}
              </button>
              {i < arr.length - 1 && (
                <div className={`h-px w-6 flex-shrink-0 mx-1 ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Step Content */}
      {subStep === 'company_info' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">Step 1: Company Information</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your company's basic details. This information will appear on all financial statement headers.
            </p>
          </div>
          <CompanyInfoForm
            initialData={state.company ?? undefined}
            onSave={handleCompanySubmit}
          />
        </div>
      )}

      {subStep === 'accounting_policies' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">Step 2: Accounting Policies</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure depreciation methods, inventory costing, employee benefits, and other
              accounting policies. These settings affect your financial statement computations.
            </p>
          </div>
          <AccountingPoliciesForm
            initialData={state.company?.accountingPolicies}
            onSave={handlePoliciesSubmit}
          />
        </div>
      )}

      {subStep === 'previous_year_data' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">Step 3: Previous Year Data</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter the audited balances from the previous year. These are used as comparative figures in the financial statements.
            </p>
          </div>
          <PreviousYearData
            initialData={state.company?.previousYearData}
            onSave={handlePreviousYearSubmit}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
};

export default CompanySetupPage;
