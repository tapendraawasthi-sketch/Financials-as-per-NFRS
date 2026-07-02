// src/pages/OutputPage.tsx
import React from 'react';
import { useAppStore } from '../store/appStore';
import DownloadPanel from '../components/output/DownloadPanel';
import WizardProgress from '../components/layout/WizardProgress';

const wizardSteps = [
  { id: 'company_setup' as const, label: 'Company', description: 'Company details' },
  { id: 'accounting_policies' as const, label: 'Policies', description: 'Accounting policies' },
  { id: 'trial_balance_upload' as const, label: 'Upload TB', description: 'Trial balance file' },
  { id: 'trial_balance_mapping' as const, label: 'Map Accounts', description: 'NFRS mapping' },
  { id: 'subledger_details' as const, label: 'Subledgers', description: 'Debtors & creditors' },
  { id: 'year_end_adjustments' as const, label: 'Adjustments', description: 'Year-end entries' },
  { id: 'review_statements' as const, label: 'Statements', description: 'Review financials' },
  { id: 'generate_output' as const, label: 'Download', description: 'Generate Excel' },
];

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Can I edit the Excel file after downloading?',
    answer:
      'Yes. Green-highlighted cells in the Excel workbook are editable — you can enter corrections or prior-year figures directly. All formulas are live, so any changes you make will automatically update linked cells and totals across all sheets.',
  },
  {
    question: 'What if my balance sheet does not balance?',
    answer:
      "Check your trial balance account mapping. Accounts mapped to the wrong NFRS category (especially 'Unclassified') will cause the balance sheet to be out of balance. Go back to Step 4 (Map Accounts) and ensure every account is correctly classified. Also verify that there are no duplicate entries in your trial balance.",
  },
  {
    question: 'Is this compliant with ICAN Nepal standards?',
    answer:
      'The format and structure of the financial statements follows NAS for Micro Entities (NAS for MEs) as issued by the Institute of Chartered Accountants of Nepal (ICAN). However, this tool automates formatting and calculation only — it does not substitute professional judgment. Always have the final statements reviewed and signed off by a qualified Chartered Accountant before submission to tax authorities or regulatory bodies.',
  },
  {
    question: 'Can I import previous year comparative figures?',
    answer:
      'In the downloaded Excel workbook, prior year (PY) columns are designated for manual entry — they appear in green-highlighted cells. Enter your previous year audited figures directly in those cells. If you have a previous year output from this tool, you can copy-paste the closing balances as the opening figures for the current year.',
  },
];

const OutputPage: React.FC = () => {
  const { state, dispatch } = useAppStore();

  const companyId = state.company?.id ?? '';
  const isStatementsReady = state.completedSteps.includes('review_statements');

  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {/* Wizard Progress — all steps */}
      <WizardProgress
        currentStep="generate_output"
        completedSteps={[
          ...state.completedSteps,
          'generate_output', // Show current as complete too
        ]}
      />

      {/* Download Panel */}
      {state.company && companyId ? (
        <DownloadPanel />
      ) : (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Company data not found. Please start from the beginning.</p>
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'company_setup' })}
            className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
          >
            Go to Company Setup
          </button>
        </div>
      )}

      {/* FAQ Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 text-base">Frequently Asked Questions</h3>
          <p className="text-xs text-slate-500 mt-0.5">Common questions about the generated Excel workbook</p>
        </div>
        <div className="divide-y divide-slate-100">
          {faqs.map((faq, idx) => (
            <div key={idx} className="px-6">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between py-4 text-left"
              >
                <span className="text-sm font-medium text-slate-700 pr-4">{faq.question}</span>
                <span className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
              {openFaq === idx && (
                <div className="pb-4">
                  <p className="text-sm text-slate-500 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Back navigation */}
      <div className="text-center">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'review_statements' })}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          ← Back to Review Statements
        </button>
      </div>
    </div>
  );
};

export default OutputPage;
