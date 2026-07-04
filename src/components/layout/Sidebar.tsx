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
  PanelLeftClose,
  PanelLeftOpen,
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

function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
  const [collapsed, setCollapsed] = useState(false);
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

  const sidebarWidth = collapsed ? 48 : 268;

  return (
    <aside
      className="sidebar chrome-panel no-print flex flex-col flex-shrink-0 h-screen relative overflow-hidden"
      style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, transition: 'width var(--dur-base) var(--ease-premium), min-width var(--dur-base) var(--ease-premium)' }}
      aria-label="Application navigation"
      aria-expanded={!collapsed}
    >
      {/* Brand zone */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: collapsed ? '48px' : '72px',
          padding: collapsed ? 'var(--space-2)' : 'var(--space-5)',
          gap: 'var(--space-3)',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: collapsed ? '32px' : '36px',
            height: collapsed ? '32px' : '36px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--brand-400), var(--brand-700) 60%, var(--gold-500))',
          }}
          title={collapsed ? 'NFRS Reporter' : undefined}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              color: 'white',
              fontSize: collapsed ? '16px' : '18px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            N
          </span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p style={{ color: 'var(--chrome-text)', fontSize: 'var(--text-md)', fontWeight: 700, lineHeight: 1.2 }}>
              NFRS Reporter
            </p>
            <p
              style={{
                color: 'var(--chrome-text-faint)',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: '2px',
              }}
            >
              Enterprise Edition
            </p>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--chrome-text-faint)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--chrome-800)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="flex items-center justify-center mx-auto mb-1 transition-colors"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--chrome-text-faint)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--chrome-800)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {/* Client switcher */}
      {companyName && !collapsed && (
        <div ref={switcherRef} className="relative flex-shrink-0" style={{ margin: 'var(--space-3) var(--space-4)' }}>
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
              padding: 'var(--space-2) var(--space-3)',
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
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--brand-500)',
                  color: 'white',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                {getClientInitials(companyName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p
                    className="truncate"
                    style={{ color: 'var(--chrome-text)', fontSize: 'var(--text-base)', fontWeight: 600 }}
                    title={companyName}
                  >
                    {companyName}
                  </p>
                  {fiscalYear && (
                    <span
                      className="flex-shrink-0"
                      style={{
                        background: 'var(--gold-100)',
                        color: 'var(--gold-700)',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-full)',
                        lineHeight: 1.2,
                      }}
                    >
                      FY {fiscalYear}
                    </span>
                  )}
                </div>
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
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate flex-1">{session.companyName}</p>
                        {session.fiscalYear && (
                          <span
                            style={{
                              background: 'var(--gold-100)',
                              color: 'var(--gold-700)',
                              fontSize: '9px',
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            FY {session.fiscalYear}
                          </span>
                        )}
                      </div>
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
        style={{ padding: collapsed ? 'var(--space-2) var(--space-1)' : 'var(--space-3)' }}
        aria-label="Workflow steps"
      >
        {!collapsed && (
          <p
            style={{
              color: 'var(--chrome-text-faint)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0 var(--space-3)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Workflow
          </p>
        )}

        {NAV_ITEMS.map(item => {
          const isActive = item.step === currentStep;
          const isDone   = completedSteps.includes(item.step);
          const ItemIcon = item.icon;

          return (
            <button
              key={item.step}
              onClick={() => onNavigate(item.step)}
              aria-current={isActive ? 'step' : undefined}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center text-left transition-all ease-premium"
              style={{
                height: collapsed ? '40px' : '44px',
                borderRadius: 'var(--radius-md)',
                padding: collapsed ? '0' : '0 var(--space-3)',
                gap: collapsed ? '0' : 'var(--space-3)',
                marginBottom: '2px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'var(--chrome-800)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--brand-500)' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(18, 26, 52, 0.5)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = isActive ? 'var(--chrome-800)' : 'transparent';
              }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: collapsed ? '28px' : '26px',
                  height: collapsed ? '28px' : '26px',
                  borderRadius: 'var(--radius-full)',
                  ...(isActive
                    ? {
                        background: 'var(--brand-500)',
                        color: 'white',
                      }
                    : {
                        background: 'var(--chrome-800)',
                        border: '1px solid var(--chrome-border)',
                        color: isDone ? 'var(--chrome-text-muted)' : 'var(--chrome-text-faint)',
                      }),
                }}
              >
                <ItemIcon size={14} />
              </span>

              {!collapsed && (
                <>
                  <span
                    className="truncate flex-1 min-w-0"
                    style={{
                      fontSize: isActive ? 'var(--text-base)' : 'var(--text-base)',
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

                  {isDone && (
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--success-600)',
                        color: 'white',
                      }}
                      aria-hidden="true"
                    >
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom zone */}
      {!collapsed && (
        <div
          className="flex-shrink-0"
          style={{
            padding: 'var(--space-4)',
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
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--success-600)',
                }}
              />
              <p style={{ color: 'var(--chrome-text-faint)', fontSize: 'var(--text-xs)' }}>
                Saved {formatLastSaved(lastSavedAt)}
              </p>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} style={{ color: 'var(--gold-500)' }} />
            <p style={{ color: 'var(--gold-500)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              ICAN NAS for MEs Compliant
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
