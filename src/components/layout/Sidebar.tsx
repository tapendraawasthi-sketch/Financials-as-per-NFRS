// src/components/layout/Sidebar.tsx
import React from 'react';
import { AppStep } from '../../types';

interface NavItem {
  step:  AppStep;
  label: string;
  icon:  React.ReactNode;
}

interface SidebarProps {
  currentStep:    AppStep;
  completedSteps: AppStep[];
  onNavigate:     (step: AppStep) => void;
  companyName?:   string;
  fiscalYear?:    string;
}

const Icons = {
  building: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" d="M3 21h18M6 21V7l6-4 6 4v14M9 21V12h6v9" />
    </svg>
  ),
  sliders: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <line x1="4"  y1="21" x2="4"  y2="14" /><line x1="4"  y1="10" x2="4"  y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8"  x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1"  y1="14" x2="7"  y2="14" /><line x1="9"  y1="8"  x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  upload: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
    </svg>
  ),
  list: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <line x1="8"  y1="6"  x2="21" y2="6"  /><line x1="8"  y1="12" x2="21" y2="12" />
      <line x1="8"  y1="18" x2="21" y2="18" /><line x1="3"  y1="6"  x2="3.01" y2="6" />
      <line x1="3"  y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  git: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 012 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  ),
  calc: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8.01" y2="10" /><line x1="12" y1="10" x2="12.01" y2="10" />
      <line x1="16" y1="10" x2="16.01" y2="10" /><line x1="8" y1="14" x2="8.01" y2="14" />
      <line x1="12" y1="14" x2="12.01" y2="14" /><line x1="16" y1="14" x2="16.01" y2="14" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  ),
  file: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  download: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  check: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  calendar: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  shield: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

const NAV_ITEMS: NavItem[] = [
  { step: 'company_setup',         label: 'Company Setup',        icon: Icons.building  },
  { step: 'accounting_policies',   label: 'Accounting Policies',  icon: Icons.sliders   },
  { step: 'trial_balance_upload',  label: 'Upload Trial Balance', icon: Icons.upload    },
  { step: 'trial_balance_mapping', label: 'Map Accounts',         icon: Icons.git       },
  { step: 'subledger_details',     label: 'Sub-ledger Detail',    icon: Icons.list      },
  { step: 'year_end_adjustments',  label: 'Year-End Adjustments', icon: Icons.calc      },
  { step: 'review_statements',     label: 'Review Statements',    icon: Icons.file      },
  { step: 'generate_output',       label: 'Generate Excel',       icon: Icons.download  },
];

const STEP_ORDER = NAV_ITEMS.map(n => n.step);

function isAccessible(
  step:           AppStep,
  currentStep:    AppStep,
  completedSteps: AppStep[]
): boolean {
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
  const totalSteps     = NAV_ITEMS.length;
  const currentIdx     = STEP_ORDER.indexOf(currentStep);
  const progressPct    = Math.round(((Math.max(completedSteps.length, currentIdx)) / (totalSteps - 1)) * 100);

  return (
    <aside
      className="w-[220px] min-w-[220px] flex flex-col flex-shrink-0 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
        boxShadow: '4px 0 24px -4px rgba(0,0,0,0.5)',
      }}
      aria-label="Application navigation"
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, #fff 24px, #fff 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, #fff 24px, #fff 25px)',
        }}
      />

      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div className="relative px-4 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo mark with glow */}
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: '0 0 20px rgba(59,130,246,0.5)',
            }}
          >
            <span className="text-white font-black text-base leading-none select-none tracking-tight">N</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-[0.06em] uppercase leading-none">
              NFRS
            </p>
            <p className="text-[11px] text-blue-300/80 mt-0.5 leading-none font-medium">
              Reporter
            </p>
          </div>
        </div>

        {/* Progress arc */}
        <div className="mt-3.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #3b82f6, #22d3ee)',
                boxShadow: '0 0 8px rgba(59,130,246,0.8)',
              }}
            />
          </div>
          <span className="text-[10px] text-blue-300/70 font-mono flex-shrink-0">{progressPct}%</span>
        </div>
      </div>

      {/* ── Active company context ─────────────────────────────────── */}
      {companyName && (
        <div className="relative mx-3 mt-3 mb-1 rounded-lg px-3 py-2.5 border border-blue-500/20 flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.08)' }}>
          <p className="text-[10px] text-blue-400/70 uppercase tracking-widest leading-none font-semibold">
            Active Client
          </p>
          <p className="text-xs text-white mt-1.5 font-semibold truncate" title={companyName}>
            {companyName}
          </p>
          {fiscalYear && (
            <p className="text-[11px] text-blue-300/60 mt-1 flex items-center gap-1">
              {Icons.calendar}
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

          return (
            <button
              key={item.step}
              onClick={() => accessible && onNavigate(item.step)}
              disabled={!accessible}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${item.label}${isDone ? ' (completed)' : ''}${!accessible ? ' (not yet available)' : ''}`}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left relative group',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400',
                isActive
                  ? 'text-white'
                  : isDone
                  ? 'text-slate-300 hover:text-white'
                  : accessible
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-700 cursor-not-allowed',
              ].filter(Boolean).join(' ')}
              style={isActive ? {
                background: 'linear-gradient(90deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.05) 100%)',
              } : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #60a5fa, #3b82f6)' }}
                />
              )}

              {/* Step number / check badge */}
              <span
                className={[
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-all',
                  isActive
                    ? 'text-white'
                    : isDone
                    ? 'text-emerald-300'
                    : 'text-slate-600',
                ].join(' ')}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  boxShadow: '0 0 10px rgba(59,130,246,0.6)',
                } : isDone ? {
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                } : {
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {isDone && !isActive ? Icons.check : idx + 1}
              </span>

              {/* Icon */}
              <span className={[
                'flex-shrink-0 transition-colors',
                isActive ? 'text-blue-300' : isDone ? 'text-emerald-400/70' : 'text-slate-600',
              ].join(' ')}>
                {item.icon}
              </span>

              {/* Label */}
              <span className="truncate text-[12px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="relative px-3 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)' }}>
          <span className="text-emerald-400/60">{Icons.shield}</span>
          <p className="text-[10px] text-slate-500 leading-snug">
            NAS for MEs · ICAN Nepal
          </p>
        </div>
      </div>
    </aside>
  );
}
