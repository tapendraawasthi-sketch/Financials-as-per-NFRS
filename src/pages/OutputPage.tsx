// src/pages/OutputPage.tsx
import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft } from 'lucide-react';
import { useAppStore }   from '../store/appStore';
import DownloadPanel     from '../components/output/DownloadPanel';
import Button            from '../components/ui/Button';

interface FAQItem { question: string; answer: string; }

const faqs: FAQItem[] = [
  {
    question: 'Can I edit the Excel file after downloading?',
    answer: 'Yes. Green-highlighted cells in the Excel workbook are editable — you can enter corrections or prior-year figures directly. All formulas are live, so changes automatically update linked cells and totals across all sheets.',
  },
  {
    question: 'What if my balance sheet does not balance?',
    answer: "Check your trial balance account mapping. Accounts mapped to 'Unclassified' cause the balance sheet to go out of balance. Return to Step 4 (Map Accounts) and ensure every account is correctly classified.",
  },
  {
    question: 'Is this compliant with ICAN Nepal standards?',
    answer: 'The format follows NAS for Micro Entities (NAS for MEs) as issued by ICAN. However this tool automates formatting and calculation only — it does not substitute professional judgment.',
  },
  {
    question: 'Can I import previous year comparative figures?',
    answer: 'Prior year (PY) columns in the Excel workbook are green-highlighted for manual entry. Enter your previous year audited figures directly.',
  },
];

const OutputPage: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const companyId         = state.company?.id ?? '';
  const isStatementsReady = state.completedSteps.includes('review_statements');
  const toggleFaq         = (idx: number) => setOpenFaq(prev => (prev === idx ? null : idx));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {isStatementsReady && (
        <div
          className="rounded-2xl p-6 text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.20)' }}>
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">All Steps Completed</p>
              <p className="text-teal-100 text-sm mt-0.5">Your financial statements are ready to generate.</p>
            </div>
          </div>
        </div>
      )}

      {state.company && companyId ? (
        <DownloadPanel />
      ) : (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Company data not found. Please start from the beginning.</p>
          <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'company_setup' })}
            className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm underline">
            Go to Company Setup
          </button>
        </div>
      )}

      {/* FAQ Section */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
          <h3 className="font-semibold text-slate-900" style={{ fontSize: '15px' }}>Frequently Asked Questions</h3>
          <p className="text-xs text-slate-500 mt-0.5">About the generated Excel workbook</p>
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          {faqs.map((faq, idx) => (
            <div key={idx} style={{ borderBottom: idx < faqs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                aria-expanded={openFaq === idx}
              >
                <span className="font-medium text-slate-800 pr-4" style={{ fontSize: '13.5px' }}>{faq.question}</span>
                <ChevronDown
                  size={16}
                  className="flex-shrink-0 text-slate-400 transition-transform duration-200"
                  style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-250"
                style={{ maxHeight: openFaq === idx ? '400px' : '0px' }}
                aria-hidden={openFaq !== idx}
              >
                <div className="px-6 pb-5">
                  <p className="text-slate-500 leading-relaxed" style={{ fontSize: '13px' }}>{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft size={14} />}
          onClick={() => dispatch({ type: 'SET_STEP', payload: 'review_statements' })}
        >
          Back to Review Statements
        </Button>
      </div>
    </div>
  );
};

export default OutputPage;
