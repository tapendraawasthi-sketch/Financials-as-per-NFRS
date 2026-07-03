// src/components/layout/Sidebar.tsx
import React from 'react';
import {
  Building2,
  SlidersHorizontal,
  Upload,
  GitBranch,
  List,
  Calculator,
  FileText,
  Download,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { AppStep } from '../../types';
import ClientSwitcher from './ClientSwitcher';

interface NavItem {
  step:  AppStep;
  label: string;
  icon:  React.ComponentType<{ size?: number; className?: string }>;
}

interface SidebarProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  onNavigate:     (step: AppStep) => void;
  companyId?:     string;
  companyName?:   string;
  fiscalYear?:    string;
  onSwitchClient?: (companyId: string) => void;
}

const NAV_ITEMS: NavItem[] = [
  { step: 'company_setup',         label: 'Company Setup',        icon: Building2          },
  { step: 'accounting_policies',   label: 'Accounting Policies',  icon: SlidersHorizontal  },
  { step: 'trial_balance_upload',  label: 'Upload Trial Balance', icon: Upload             },
  { step: 'trial_balance_mapping', label: 'Map Accounts',         icon: GitBranch          },
  { step: 'subledger_details',     label: 'Sub-ledger Detail',    icon: List               },
  { step: 'year_end_adjustments',  label: 'Year-End Adjustments', icon: Calculator         },
  { step: 'review_statements',     label: 'Review Statements',    icon: FileText           },
  { step: 'generate_output',       label: 'Generate Excel',       icon: Download           },
];

const STEP_ORDER = NAV_ITEMS.map(n => n.step);

// All steps are always visible and clickable.
// Visual state (done / active / pending) is shown, but nothing is locked.
function isAccessible(_step: AppStep, _currentStep: AppStep, _completedSteps: AppStep[]): boolean {
  return true;
}

export default function Sidebar({
  currentStep,
  completedSteps,
  onNavigate,
  companyId,
  companyName,
  fiscalYear,
  onSwitchClient,
}: SidebarProps) {
  const totalSteps  = NAV_ITEMS.length;
  const currentIdx  = STEP_ORDER.indexOf(currentStep);
  const progressPct = Math.round(((Math.max(completedSteps.length, currentIdx)) / (totalSteps - 1)) * 100);

  return (
    <aside
      className="sidebar flex flex-col flex-shrink-0 relative overflow-hidden"
      style={{
        width: '240px',
        minWidth: '240px',
        background: 'linear-gradient(160deg, #0a0f1e 0%, #0f172a 60%, #0a0f1e 100%)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.35)',
      }}
      aria-label="Application navigation"
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 24px,#fff 24px,#fff 25px),repeating-linear-gradient(90deg,transparent,transparent 24px,#fff 24px,#fff 25px)',
        }}
      />

      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div
        className="relative px-4 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              boxShadow: '0 0 24px rgba(99,102,241,0.6)',
            }}
          >
            <span className="text-white font-black text-xl leading-none select-none">N</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-[13px] tracking-[0.1em] uppercase leading-none">
              NFRS
            </p>
            <p className="text-indigo-400 text-[11px] mt-0.5 leading-none font-medium">
              Reporter
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #6366f1, #14b8a6)',
                boxShadow: '0 0 8px rgba(99,102,241,0.8)',
              }}
            />
          </div>
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'rgba(129,140,248,0.7)' }}>
            {progressPct}%
          </span>
        </div>
      </div>

      {/* ── Active company / client switcher ───────────────────────── */}
      {(companyName || onSwitchClient) && (
        <ClientSwitcher
          activeCompanyId={companyId}
          activeCompanyName={companyName}
          onSwitch={onSwitchClient ?? (() => {})}
        />
      )}

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="relative flex-1 py-2 overflow-y-auto" aria-label="Workflow steps">
        {NAV_ITEMS.map((item, idx) => {
          const isActive   = item.step === currentStep;
          const isDone     = completedSteps.includes(item.step);
          const accessible = isAccessible(item.step, currentStep, completedSteps);
          const ItemIcon   = item.icon;

          // All steps always visible — only color changes by state
          const labelColor = isActive
            ? '#ffffff'
            : '#94a3b8';  // same visible grey for ALL non-active steps

          const iconColor = isActive
            ? '#a5b4fc'   // indigo-300
            : isDone
            ? 'rgba(45,212,191,0.8)'
            : '#64748b';  // slate-500 — visible on dark bg

          return (
            <button
              key={item.step}
              onClick={() => onNavigate(item.step)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${item.label}${isDone ? ' (completed)' : ''}${!accessible ? ' (not yet available)' : ''}`}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left relative transition-all duration-150"
              style={{
                color: labelColor,
                cursor: 'pointer',
                opacity: 1,
                background: isActive
                  ? 'linear-gradient(90deg, rgba(99,102,241,0.22) 0%, transparent 100%)'
                  : 'transparent',
              }}
            >
              {/* Active left accent */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 w-[3px] h-5 rounded-r-full"
                  style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'linear-gradient(180deg, #818cf8, #6366f1)',
                  }}
                />
              )}

              {/* Step number / check badge */}
              <span
                style={{
                  height: '26px',
                  width: '26px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '11px',
                  fontWeight: 700,
                  ...(isActive
                    ? {
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        boxShadow: '0 0 12px rgba(99,102,241,0.7)',
                        color: 'white',
                      }
                    : isDone
                    ? {
                        background: 'rgba(20,184,166,0.15)',
                        border: '1px solid rgba(20,184,166,0.35)',
                        color: '#2dd4bf',
                      }
                    : {
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#94a3b8',
                      }),
                }}
              >
                {isDone && !isActive ? <Check size={11} strokeWidth={3} /> : idx + 1}
              </span>

              {/* Icon */}
              <span style={{ color: iconColor, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <ItemIcon size={15} />
              </span>

              {/* Label */}
              <span style={{ fontSize: '12px', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div
        className="relative px-3 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <ShieldCheck size={12} className="text-emerald-400/60" />
          <p className="text-[10px] text-slate-500 leading-snug">
            NAS for MEs · ICAN Nepal
          </p>
        </div>
      </div>
    </aside>
  );
}
