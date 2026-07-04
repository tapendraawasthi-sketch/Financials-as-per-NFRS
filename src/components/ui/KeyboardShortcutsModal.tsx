// src/components/ui/KeyboardShortcutsModal.tsx
import React, { useEffect, useState } from 'react';
import Modal from './Modal';

interface Shortcut {
  keys:        string[];
  description: string;
  category:    string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'S'],  description: 'Save current step',          category: 'General'     },
  { keys: ['Ctrl', '/'],  description: 'Show keyboard shortcuts',     category: 'General'     },
  { keys: ['Ctrl', '→'],  description: 'Go to next step',            category: 'Navigation'  },
  { keys: ['Ctrl', '←'],  description: 'Go to previous step',        category: 'Navigation'  },
  { keys: ['Ctrl', 'P'],  description: 'Print current statement',     category: 'Statements'  },
  { keys: ['Escape'],     description: 'Close modal / dismiss alert',  category: 'General'     },
];

const GROUPED = SHORTCUTS.reduce((acc, s) => {
  if (!acc[s.category]) acc[s.category] = [];
  acc[s.category].push(s);
  return acc;
}, {} as Record<string, Shortcut[]>);

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center h-6 rounded font-mono font-semibold"
      style={{
        minWidth: '1.5rem',
        padding: '0 6px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--ink-600)',
      }}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title="Keyboard Shortcuts"
      size="sm"
    >
      <div className="space-y-4">
        {Object.entries(GROUPED).map(([category, shortcuts]) => (
          <div key={category}>
            <p className="section-label">{category}</p>
            <div className="space-y-0 divide-y divide-slate-100">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-600">{s.description}</span>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                    {s.keys.map((k, ki) => (
                      <React.Fragment key={k}>
                        <Kbd>{k}</Kbd>
                        {ki < s.keys.length - 1 && (
                          <span className="text-slate-400 text-xs">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
        Press <Kbd>Ctrl</Kbd> + <Kbd>/</Kbd> to toggle this panel at any time.
      </p>
    </Modal>
  );
}
