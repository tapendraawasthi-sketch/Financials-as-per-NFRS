import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { listStoredSessions, type StoredSessionSummary } from '../../hooks/useSessionPersistence';

interface ClientSwitcherProps {
  activeCompanyId?: string;
  activeCompanyName?: string;
  onSwitch: (companyId: string) => void;
}

export default function ClientSwitcher({
  activeCompanyId,
  activeCompanyName,
  onSwitch,
}: ClientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<StoredSessionSummary[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessions(listStoredSessions());
  }, [activeCompanyId, activeCompanyName]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (sessions.length <= 1 && !activeCompanyName) return null;

  return (
    <div ref={containerRef} className="relative mx-3 mt-3 mb-1 flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-xl px-3 py-2.5 text-left transition-colors"
        style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.20)',
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch client"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] font-semibold uppercase tracking-widest leading-none"
              style={{ color: 'rgba(129,140,248,0.70)' }}
            >
              Active Client
            </p>
            <p className="text-white text-xs mt-1.5 font-semibold truncate" title={activeCompanyName}>
              {activeCompanyName ?? 'Select client'}
            </p>
          </div>
          {sessions.length > 1 && (
            <ChevronDown
              size={14}
              className="flex-shrink-0 transition-transform"
              style={{
                color: 'rgba(129,140,248,0.70)',
                transform: open ? 'rotate(180deg)' : undefined,
              }}
            />
          )}
        </div>
      </button>

      {open && sessions.length > 1 && (
        <ul
          role="listbox"
          aria-label="Saved clients"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl py-1 shadow-xl"
          style={{
            background: 'var(--chrome-900)',
            border: '1px solid var(--chrome-border)',
          }}
        >
          {sessions.map((session) => {
            const isActive = session.companyId === activeCompanyId;
            return (
              <li key={session.companyId} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) onSwitch(session.companyId);
                  }}
                  className="w-full px-3 py-2 text-left transition-colors hover:bg-indigo-500/10"
                >
                  <p className="text-xs font-medium text-white truncate">{session.companyName}</p>
                  <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'rgba(129,140,248,0.60)' }}>
                    <Users size={9} />
                    {session.fiscalYear ? `FY ${session.fiscalYear}` : 'No fiscal year'}
                    {isActive && <span className="ml-1 text-emerald-400">· Active</span>}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
