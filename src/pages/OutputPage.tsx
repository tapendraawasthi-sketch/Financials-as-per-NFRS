// src/pages/OutputPage.tsx
import React, { useState } from 'react';
import { useAppStore }   from '../store/appStore';
import DownloadPanel     from '../components/output/DownloadPanel';
import Button            from '../components/ui/Button';

interface FAQItem {
  question: string;
  answer:   string;
}

const faqs: FAQItem[] = [
  {
    question: 'Can I edit the Excel file after downloading?',
    answer:
      'Yes. Green-highlighted cells in the Excel workbook are editable — you can enter corrections or prior-year figures directly. All formulas are live, so changes automatically update linked cells and totals across all sheets.',
  },
  {
    question: 'What if my balance sheet does not balance?',
    answer:
      "Check your trial balance account mapping. Accounts mapped to 'Unclassified' cause the balance sheet to go out of balance. Return to Step 4 (Map Accounts) and ensure every account is correctly classified. Also verify there are no duplicate entries in your trial balance.",
  },
  {
    question: 'Is this compliant with ICAN Nepal standards?',
    answer:
      'The format follows NAS for Micro Entities (NAS for MEs) as issued by ICAN. However this tool automates formatting and calculation only — it does not substitute professional judgment. Always have the final statements reviewed by a qualified Chartered Accountant before submission.',
  },
  {
    question: 'Can I import previous year comparative figures?',
    answer:
      'Prior year (PY) columns in the Excel workbook are green-highlighted for manual entry. Enter your previous year audited figures directly. If you have a previous year output from this tool, copy the closing balances as opening figures for the current year.',
  },
];

// item 127: SVG chevron icon with rotation
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const OutputPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const companyId         = state.company?.id ?? '';
  const isStatementsReady = state.completedSteps.includes('review_statements');

  const toggleFaq = (idx: number) =>
    setOpenFaq(prev => (prev === idx ? null : idx));

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* item 126: "Workflow Complete" banner instead of WizardProgress */}
      {isStatementsReady && (
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-xl p-6 text-white shadow-md">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">All Steps Completed</p>
              <p className="text-emerald-100 text-sm mt-0.5">
                Your financial statements are ready to generate.
              </p>
            </div>
          </div>
        </div>
      )}

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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 text-base">Frequently Asked Questions</h3>
          <p className="text-xs text-slate-500 mt-0.5">About the generated Excel workbook</p>
        </div>

        <div className="divide-y divide-slate-100">
          {faqs.map((faq, idx) => (
            <div key={idx}>
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                aria-expanded={openFaq === idx}
              >
                <span className="text-sm font-medium text-slate-700 pr-4">{faq.question}</span>
                {/* item 127: SVG chevron instead of ▾ text character */}
                <ChevronIcon open={openFaq === idx} />
              </button>

              {/* item 128: smooth height transition via CSS grid trick */}
              <div
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: openFaq === idx ? '300px' : '0px' }}
                aria-hidden={openFaq !== idx}
              >
                <div className="px-6 pb-4">
                  <p className="text-sm text-slate-500 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* item 129: proper Button with left arrow icon */}
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'review_statements' })}
        >
          ← Back to Review Statements
        </Button>
      </div>
    </div>
  );
};

export default OutputPage;
