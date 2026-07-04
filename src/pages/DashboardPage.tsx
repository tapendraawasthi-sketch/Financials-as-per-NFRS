// src/pages/DashboardPage.tsx
import React, { useState } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  Lock,
  Zap,
  Sparkles,
  Layers,
  FileText,
  BarChart3,
  Link2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useAppStore } from '../store/appStore';
import { listStoredSessions } from '../hooks/useSessionPersistence';
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

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--brand-400), var(--brand-700) 60%, var(--gold-500))',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '18px', fontWeight: 700 }}>
          N
        </span>
      </div>
      <div>
        <p style={{ color: 'var(--ink-950)', fontSize: '14.5px', fontWeight: 700, lineHeight: 1.2 }}>
          NFRS Reporter
        </p>
        <p
          style={{
            color: 'var(--ink-500)',
            fontSize: '10.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Enterprise Edition
        </p>
      </div>
    </div>
  );
}

const FEATURE_CARDS = [
  { icon: Layers, figure: '6-Step Wizard', caption: 'From Trial Balance to Statements' },
  { icon: FileText, figure: '26 Notes', caption: 'Full NAS for MEs Disclosure Set' },
  { icon: BarChart3, figure: '4 Statements', caption: 'BS · IS · CF · Equity, Auto-Linked' },
  { icon: Link2, figure: '100% Formula-Linked', caption: 'Fully Auditable Excel Output' },
];

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'NAS for MEs Compliant' },
  { icon: FileCheck2, label: 'ICAN Reference Format' },
  { icon: Lock, label: 'Bank-Grade Data Security' },
  { icon: Zap, label: 'Under 15 Minutes per Client' },
];

export default function DashboardPage({ onStart, onContinue, hasSession }: DashboardPageProps) {
  const { state } = useAppStore();
  const [showResetModal, setShowResetModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const storedSessions = listStoredSessions();
  const pendingReviews = storedSessions.filter(
    (s) => s.currentStep && s.currentStep !== 'generate_output',
  ).length;

  const handleStartClick = () => {
    if (!isSessionInProgress(state.currentStep, hasSession)) {
      onStart();
      return;
    }
    setShowResetModal(true);
  };

  const handleCancelReset = () => setShowResetModal(false);

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
    <div
      className="min-h-screen flex flex-col gradient-mesh"
      style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ height: '72px', padding: '0 40px' }}
      >
        <BrandMark />
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="transition-colors"
            style={{
              background: 'transparent',
              color: 'var(--brand-600)',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Documentation
          </button>
          {hasSession && (
            <Button variant="secondary" size="md" onClick={onContinue}>
              Continue Session
            </Button>
          )}
        </div>
      </div>

      {/* Hero */}
      <section
        className="text-center"
        style={{ maxWidth: '780px', margin: '64px auto 48px', padding: '0 24px' }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full"
          style={{
            background: 'var(--gold-100)',
            border: '1px solid var(--gold-400)',
            color: 'var(--gold-700)',
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '6px 16px',
            marginBottom: '24px',
          }}
        >
          <Sparkles size={12} />
          Trusted by Chartered Accountants across Nepal
        </div>

        <h1
          className="font-display"
          style={{
            fontSize: '44px',
            fontWeight: 600,
            color: 'var(--ink-950)',
            lineHeight: 1.15,
            marginBottom: '20px',
          }}
        >
          Financial Statements.
          <br />
          <span style={{ color: 'var(--brand-500)' }}>Fully Automated.</span>
        </h1>

        <p
          style={{
            color: 'var(--ink-500)',
            fontSize: '16px',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Generate ICAN-compliant NAS for MEs financial statements from any trial balance format in minutes — not days.
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center"
          style={{ gap: '14px', marginTop: '32px' }}
        >
          <Button variant="primary" size="lg" onClick={handleStartClick}>
            Start New Engagement
          </Button>
          {hasSession && (
            <Button variant="secondary" size="lg" onClick={onContinue}>
              Resume Draft
            </Button>
          )}
        </div>
      </section>

      {hasSession && storedSessions.length > 0 && (
        <section style={{ maxWidth: '1080px', margin: '0 auto 40px', padding: '0 24px' }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card accent="brand" padding="dense">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active clients</p>
              <p className="kpi-number mt-1" style={{ fontSize: 'var(--text-xl)', color: 'var(--ink-950)' }}>{storedSessions.length}</p>
            </Card>
            <Card accent="success" padding="dense">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed exports</p>
              <p className="kpi-number mt-1" style={{ fontSize: 'var(--text-xl)', color: 'var(--success-700)' }}>
                {storedSessions.filter((s) => s.currentStep === 'generate_output').length}
              </p>
            </Card>
            <Card accent="gold" padding="dense">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending reviews</p>
              <p className="kpi-number mt-1" style={{ fontSize: 'var(--text-xl)', color: 'var(--warning-700)' }}>{pendingReviews}</p>
            </Card>
            <Card padding="dense">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current step</p>
              <p className="mt-1 truncate" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-700)', fontWeight: 600 }}>
                {state.currentStep.replace(/_/g, ' ')}
              </p>
            </Card>
          </div>
        </section>
      )}

      {!hasSession && (
        <section
          className="text-center"
          style={{ maxWidth: '480px', margin: '0 auto 48px', padding: '0 24px' }}
        >
          <FileText size={40} style={{ color: 'var(--ink-400)', margin: '0 auto 16px' }} />
          <h2 className="font-display" style={{ fontSize: 'var(--text-lg)', color: 'var(--ink-950)', marginBottom: '8px' }}>
            No engagements yet
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)', marginBottom: '20px' }}>
            Start a new company setup to generate your first NFRS-compliant statements.
          </p>
          <Button variant="primary" size="md" onClick={onStart}>
            Start Company Setup
          </Button>
        </section>
      )}

      {/* Trust badges */}
      <div
        className="flex flex-wrap justify-center"
        style={{ gap: '32px', marginBottom: '56px', padding: '0 24px' }}
      >
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={16} style={{ color: 'var(--brand-500)' }} />
            <span style={{ color: 'var(--ink-600)', fontSize: '13px', fontWeight: 500 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ maxWidth: '1080px', margin: '0 auto', gap: '20px', padding: '0 24px' }}
      >
        {FEATURE_CARDS.map(({ icon: Icon, figure, caption }) => (
          <div key={figure} className="card card-interactive" style={{ padding: '24px' }}>
            <div
              className="flex items-center justify-center mb-4"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-50)',
              }}
            >
              <Icon size={20} style={{ color: 'var(--brand-600)' }} />
            </div>
            <p className="kpi-number" style={{ fontSize: '28px', color: 'var(--ink-950)', marginBottom: '6px' }}>
              {figure}
            </p>
            <p style={{ color: 'var(--ink-500)', fontSize: '12.5px' }}>{caption}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer
        className="text-center mt-auto"
        style={{
          padding: '32px',
          borderTop: '1px solid var(--border-hairline)',
          marginTop: '40px',
          color: 'var(--ink-400)',
          fontSize: '12px',
        }}
      >
        NFRS Financial Reporter — Nepal Financial Reporting Automation
      </footer>

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
