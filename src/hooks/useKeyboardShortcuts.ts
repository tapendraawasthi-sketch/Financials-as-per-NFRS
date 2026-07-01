import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  handler: () => void;
  enabled?: boolean;
}

/**
 * useKeyboardShortcuts — registers keyboard shortcuts and cleans up on unmount.
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { key: 's', ctrl: true, description: 'Save', handler: handleSave },
 *   ]);
 */
function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const metaMatch = shortcut.meta ? e.metaKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          // Don't fire shortcuts when user is typing in inputs
          const target = e.target as HTMLElement;
          const isEditable =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable;

          // Allow Escape regardless of focus
          const isEscape = shortcut.key === 'Escape';

          if (!isEditable || isEscape) {
            e.preventDefault();
            shortcut.handler();
            break;
          }
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;

// ── Table keyboard navigation hook ───────────────────────────────────────────
export function useTableNavigation(tableRef: React.RefObject<HTMLTableElement | null>): void {
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      if (!cell) return;

      const row = cell.parentElement as HTMLTableRowElement;
      const cellIndex = cell.cellIndex;
      const rowIndex = row.rowIndex;
      const rows = Array.from(table.querySelectorAll('tr'));

      let nextCell: HTMLTableCellElement | null = null;

      switch (e.key) {
        case 'ArrowRight':
          nextCell = (row.cells[cellIndex + 1] as HTMLTableCellElement) ?? null;
          break;
        case 'ArrowLeft':
          nextCell = (row.cells[cellIndex - 1] as HTMLTableCellElement) ?? null;
          break;
        case 'ArrowDown': {
          const nextRow = rows[rowIndex + 1] as HTMLTableRowElement | undefined;
          nextCell = nextRow ? (nextRow.cells[cellIndex] as HTMLTableCellElement) ?? null : null;
          break;
        }
        case 'ArrowUp': {
          const prevRow = rows[rowIndex - 1] as HTMLTableRowElement | undefined;
          nextCell = prevRow ? (prevRow.cells[cellIndex] as HTMLTableCellElement) ?? null : null;
          break;
        }
        default:
          return;
      }

      if (nextCell) {
        e.preventDefault();
        const focusable = nextCell.querySelector<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          nextCell.setAttribute('tabindex', '-1');
          nextCell.focus();
        }
      }
    };

    table.addEventListener('keydown', handleKeyDown);
    return () => table.removeEventListener('keydown', handleKeyDown);
  }, [tableRef]);
}
