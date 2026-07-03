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
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { AppStep } from '../../types';

interface NavItem {
  step:  AppStep;
  label: string;
  icon:  React.ComponentType<{ size?: number; className?: string }>;
}

interface SidebarProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  onNavigate:     (step: AppStep) => void;
  companyName?:   string;
  fiscalYear?:    string;
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

function isAccessible(step: AppStep, currentStep: AppStep, completedSteps: AppStep[]): boolean {
  const stepIdx    = STEP_ORDER.indexOf(step);
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  return stepIdx <= currentIdx || completedSteps.includes(step);
}

export default function Sidebar({
  currentStep,
  completedSteps,
  onNavigate,
  companyName,
  fiscalYear,
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

      {/* ── Active company context ─────────────────────────────────── */}
      {companyName && (
        <div
          className="relative mx-3 mt-3 mb-1 rounded-xl px-3 py-2.5 flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.20)' }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-widest leading-none" style={{ color: 'rgba(129,140,248,0.70)' }}>
            Active Client
          </p>
          <p className="text-white text-xs mt-1.5 font-semibold truncate" title={companyName}>
            {companyName}
          </p>
          {fiscalYear && (
            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'rgba(129,140,248,0.60)' }}>
              <Calendar size={10} />
              <span>FY {fiscalYear}</span>
            </p>
          )}
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="relative flex-1 py-2 overflow-y-auto" aria-label="Workflow steps">
        {NAV_ITEMS.map((item, idx) => {
          const isActive   = item.step === currentStep;
          const isDone     = completedSteps.includes(item.step);
          const accessible = isAccessible(item.step, currentStep, completedSteps);
          const ItemIcon   = item.icon;

          return (
            <button
              key={item.step}
              onClick={() => accessible && onNavigate(item.step)}
              disabled={!accessible}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${item.label}${isDone ? ' (completed)' : ''}${!accessible ? ' (not yet available)' : ''}`}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 text-left relative group transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400',
                isActive
                  ? 'text-white'
                  : isDone
                  ? 'text-slate-300 hover:text-white'
                  : accessible
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-700 cursor-not-allowed opacity-40',
              ].filter(Boolean).join(' ')}
              style={isActive ? {
                background: 'linear-gradient(90deg, rgba(99,102,241,0.22) 0%, transparent 100%)',
              } : undefined}
            >
              {/* Active left accent */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #818cf8, #6366f1)' }}
                />
              )}

              {/* Step number / check badge */}
              <span
                className="h-[26px] w-[26px] rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-all"
                style={
                  isActive
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
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        color: '#475569',
                      }
                }
              >
                {isDone && !isActive ? <Check size={11} strokeWidth={3} /> : idx + 1}
              </span>

              {/* Icon */}
              <span
                className={[
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-indigo-300' : isDone ? 'text-teal-400/70' : 'text-slate-600',
                ].join(' ')}
              >
                <ItemIcon size={15} />
              </span>

              {/* Label */}
              <span className="truncate text-[12px] font-medium leading-none">{item.label}</span>
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
