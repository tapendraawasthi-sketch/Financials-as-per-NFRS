// src/pages/DashboardPage.tsx
import React, { useState } from 'react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAppStore } from '../store/appStore';
import { outputApi } from '../api/client';
import type { AppStep } from '../types';

interface DashboardPageProps {
  onStart: () => void;
  onContinue: () => void;
  hasSession: boolean;
}

const WIZARD_STEPS: AppStep[] = [
  'company_setup',
  'accounting_policies',
  'trial_balance_upload',
  'trial_balance_mapping',
  'subledger_details',
  'year_end_adjustments',
  'review_statements',
  'generate_output',
];

function isSessionInProgress(currentStep: AppStep, hasSession: boolean): boolean {
  const stepIndex = WIZARD_STEPS.indexOf(currentStep);
  return stepIndex > 0 || hasSession;
}

export default function DashboardPage({ onStart, onContinue, hasSession }: DashboardPageProps) {
  const { state } = useAppStore();
  const [showResetModal, setShowResetModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleStartClick = () => {
    if (!isSessionInProgress(state.currentStep, hasSession)) {
      onStart();
      return;
    }
    setShowResetModal(true);
  };

  const handleCancelReset = () => {
    setShowResetModal(false);
  };

  const handleDiscardAndStart = () => {
    setShowResetModal(false);
    onStart();
  };

  const handleDownloadAndStart = async () => {
    const company = state.company;
    if (!company?.id || !state.balanceSheet) {
      setShowResetModal(false);
      onStart();
      return;
    }
    setIsDownloading(true);
    try {
      const blob = await outputApi.generateExcel(
        company.id,
        company.companyName ?? 'Company',
        company.fiscalYear?.bsFY ?? 'FY',
      );
      const safeName = (company.companyName ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_');
      const fy = (company.fiscalYear?.bsFY ?? 'FY').replace(/\//g, '-');
      outputApi.triggerDownload(blob, `NFRS_Financials_${safeName}_${fy}.xlsx`);
      setShowResetModal(false);
      onStart();
    } catch {
      setShowResetModal(false);
      onStart();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 py-20"
        style={{
          background: 'linear-gradient(135deg, #0a0f1e 0%, #1e293b 50%, #0f172a 100%)',
          minHeight: '70vh',
        }}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.03,
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 40px,#fff 40px,#fff 41px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 40px,#fff 40px,#fff 41px)',
          }}
        />

        {/* Logo */}
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            boxShadow: '0 0 40px rgba(99,102,241,0.5)',
          }}
        >
          <span className="text-white font-black text-3xl leading-none select-none">N</span>
        </div>

        <h1
          className="text-white font-black tracking-tight leading-none mb-3"
          style={{ fontSize: '42px' }}
        >
          NFRS Financial Reporter
        </h1>

        <p
          className="max-w-xl leading-relaxed mb-2"
          style={{ color: '#94a3b8', fontSize: '16px' }}
        >
          Convert your trial balance to ICAN-compliant financial statements in minutes.
        </p>
        <p style={{ color: '#64748b', fontSize: '13px' }} className="mb-8">
          Supporting NAS for Micro Entities 2018 &middot; Nepal Income Tax Act 2058
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button variant="primary" size="lg" onClick={handleStartClick}>
            Start New Report
          </Button>
          {hasSession && (
            <Button variant="secondary" size="lg" onClick={onContinue}>
              Continue Previous Session
            </Button>
          )}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2.5 mt-10 max-w-2xl">
          {[
            'Auto-parse any trial balance format',
            'AI-powered account mapping',
            'All 4 NFRS statements',
            '26 mandatory notes',
            'Nepal IT Act 2058 tax computation',
            'ICAN Excel format output',
          ].map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium"
              style={{
                fontSize: '12px',
                color: '#a5b4fc',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-1 flex items-end justify-center pb-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="compliance-badge">NAS for MEs 2018</span>
            <span className="compliance-badge">ICAN Nepal</span>
          </div>
          <p className="text-xs text-slate-400">
            Accounting Standards Board, Nepal &middot; ICAN Building, Satdobato, Lalitpur
          </p>
        </div>
      </div>

      <Modal
        isOpen={showResetModal}
        onClose={handleCancelReset}
        title="Start a new report?"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleCancelReset} disabled={isDownloading}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDiscardAndStart} disabled={isDownloading}>
              Start New (discard)
            </Button>
            <Button variant="primary" size="sm" onClick={handleDownloadAndStart} loading={isDownloading}>
              Download &amp; Start New
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          Starting a new report will discard your current session. Would you like to download
          the current session data before proceeding?
        </p>
      </Modal>
    </div>
  );
}
