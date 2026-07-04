// src/components/layout/Sidebar.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Settings2,
  Upload,
  GitBranch,
  Layers,
  Calculator,
  FileText,
  Download,
  Check,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { AppStep } from '../../types';
import { listStoredSessions, type StoredSessionSummary, formatLastSaved } from '../../hooks/useSessionPersistence';

interface NavItem {
  step:  AppStep;
  label: string;
  icon:  React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

interface SidebarProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  onNavigate:     (step: AppStep) => void;
  companyId?:     string;
  companyName?:   string;
  fiscalYear?:    string;
  onSwitchClient?: (companyId: string) => void;
  lastSavedAt?:   Date | null;
}

const NAV_ITEMS: NavItem[] = [
  { step: 'company_setup',         label: 'Company Setup',        icon: Building2  },
  { step: 'accounting_policies',   label: 'Accounting Policies',  icon: Settings2  },
  { step: 'trial_balance_upload',  label: 'Upload Trial Balance', icon: Upload     },
  { step: 'trial_balance_mapping', label: 'Map Accounts',         icon: GitBranch  },
  { step: 'subledger_details',     label: 'Sub-ledger Detail',    icon: Layers     },
  { step: 'year_end_adjustments',  label: 'Year-End Adjustments', icon: Calculator },
  { step: 'review_statements',     label: 'Review Statements',    icon: FileText   },
  { step: 'generate_output',       label: 'Generate Excel',       icon: Download   },
];

export default function Sidebar({
  currentStep,
  completedSteps,
  onNavigate,
  companyId,
  companyName,
  fiscalYear,
  onSwitchClient,
  lastSavedAt,
}: SidebarProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [sessions, setSessions] = useState<StoredSessionSummary[]>([]);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessions(listStoredSessions());
  }, [companyId, companyName]);

  useEffect(() => {
    if (!switcherOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [switcherOpen]);

  return (
    <aside
      className="sidebar chrome-panel flex flex-col flex-shrink-0 h-screen relative overflow-hidden"
      style={{ width: '268px', minWidth: '268px' }}
      aria-label="Application navigation"
    >
      {/* Brand zone */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ height: '72px', padding: '20px', gap: '12px' }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--brand-400), var(--brand-700) 60%, var(--gold-500))',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              color: 'white',
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            N
          </span>
        </div>
        <div className="min-w-0">
          <p style={{ color: 'var(--chrome-text)', fontSize: '14.5px', fontWeight: 700, lineHeight: 1.2 }}>
            NFRS Reporter
          </p>
          <p
            style={{
              color: 'var(--chrome-text-faint)',
              fontSize: '10.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: '2px',
            }}
          >
            Enterprise Edition
          </p>
        </div>
      </div>

      {/* Client switcher */}
      {companyName && (
        <div ref={switcherRef} className="relative flex-shrink-0" style={{ margin: '12px 16px' }}>
          <button
            type="button"
            onClick={() => {
              if (sessions.length > 1) setSwitcherOpen(prev => !prev);
            }}
            className="w-full text-left transition-colors"
            style={{
              background: 'var(--chrome-800)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
            }}
            aria-expanded={switcherOpen}
            aria-haspopup="listbox"
            aria-label="Switch client"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '9999px',
                  background: 'var(--brand-500)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {companyName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{ color: 'var(--chrome-text)', fontSize: '13px', fontWeight: 600 }}
                  title={companyName}
                >
                  {companyName}
                </p>
                {fiscalYear && (
                  <p style={{ color: 'var(--chrome-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                    FY {fiscalYear}
                  </p>
                )}
              </div>
              {sessions.length > 1 && (
                <ChevronDown size={14} style={{ color: 'var(--chrome-text-faint)', flexShrink: 0 }} />
              )}
            </div>
          </button>

          {switcherOpen && sessions.length > 1 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto py-1"
              style={{
                background: 'var(--chrome-850)',
                border: '1px solid var(--chrome-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {sessions.map(session => {
                const isActive = session.companyId === companyId;
                return (
                  <li key={session.companyId} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => {
                        setSwitcherOpen(false);
                        if (!isActive && onSwitchClient) onSwitchClient(session.companyId);
                      }}
                      className="w-full px-3 py-2 text-left transition-colors"
                      style={{ color: 'var(--chrome-text)' }}
                    >
                      <p className="text-xs font-medium truncate">{session.companyName}</p>
                      {session.fiscalYear && (
                        <p style={{ color: 'var(--chrome-text-muted)', fontSize: '10px', marginTop: '2px' }}>
                          FY {session.fiscalYear}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Wizard navigation */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: '12px' }}
        aria-label="Workflow steps"
      >
        {NAV_ITEMS.map(item => {
          const isActive = item.step === currentStep;
          const isDone   = completedSteps.includes(item.step);
          const ItemIcon = item.icon;

          return (
            <button
              key={item.step}
              onClick={() => onNavigate(item.step)}
              aria-current={isActive ? 'step' : undefined}
              className="w-full flex items-center text-left transition-all ease-premium"
              style={{
                height: '44px',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px',
                gap: '12px',
                marginBottom: '2px',
                background: isActive ? 'var(--chrome-800)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--gold-500)' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(18, 26, 52, 0.5)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '9999px',
                  ...(isDone
                    ? { background: 'var(--success-600)', color: 'white' }
                    : isActive
                    ? {
                        background: 'var(--gold-500)',
                        color: 'var(--chrome-950)',
                        boxShadow: 'var(--glow-gold)',
                      }
                    : {
                        background: 'var(--chrome-800)',
                        border: '1px solid var(--chrome-border)',
                        color: 'var(--chrome-text-faint)',
                      }),
                }}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : <ItemIcon size={14} />}
              </span>

              <span
                className="truncate"
                style={{
                  fontSize: isActive ? '13.5px' : '13px',
                  fontWeight: isActive ? 600 : isDone ? 500 : 400,
                  color: isActive
                    ? 'var(--chrome-text)'
                    : isDone
                    ? 'var(--chrome-text-muted)'
                    : 'var(--chrome-text-faint)',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom zone */}
      <div
        className="flex-shrink-0"
        style={{
          padding: '16px',
          borderTop: '1px solid var(--chrome-border)',
        }}
      >
        {lastSavedAt && (
          <div className="flex items-center gap-2 mb-2">
            <span
              className="flex-shrink-0"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '9999px',
                background: 'var(--success-600)',
              }}
            />
            <p style={{ color: 'var(--chrome-text-faint)', fontSize: '11px' }}>
              Saved {formatLastSaved(lastSavedAt)}
            </p>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} style={{ color: 'var(--gold-500)' }} />
          <p style={{ color: 'var(--gold-500)', fontSize: '10.5px', fontWeight: 600 }}>
            ICAN NAS for MEs Compliant
          </p>
        </div>
      </div>
    </aside>
  );
}
