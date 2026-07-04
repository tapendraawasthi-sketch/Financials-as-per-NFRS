// src/components/output/ExcelPreviewModal.tsx
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../ui/Modal';

interface ExcelPreviewModalProps {
  buffer: ArrayBuffer;
  onClose: () => void;
  onDownload?: () => void;
}

const HIDDEN_SHEETS = new Set(['Workings']);

export default function ExcelPreviewModal({ buffer, onClose, onDownload }: ExcelPreviewModalProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState('');

  useEffect(() => {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true });
    setWorkbook(wb);
    const visible = wb.SheetNames.filter((n) => !HIDDEN_SHEETS.has(n));
    setActiveSheet(visible[0] ?? wb.SheetNames[0] ?? '');
  }, [buffer]);

  const sheetNames = workbook?.SheetNames.filter((n) => !HIDDEN_SHEETS.has(n)) ?? [];
  const html = workbook && activeSheet
    ? XLSX.utils.sheet_to_html(workbook.Sheets[activeSheet], { id: 'xlsx-preview-table' })
    : '';

  return (
    <Modal isOpen onClose={onClose} title="Excel Preview" size="xl">
      <div className="flex flex-col gap-3" style={{ maxWidth: '100%' }}>
        <div
          className="flex gap-1 overflow-x-auto pb-1"
          style={{ borderBottom: '1px solid var(--border-hairline)' }}
        >
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveSheet(name)}
              className="px-3 py-1.5 text-xs whitespace-nowrap rounded-t"
              style={{
                background: activeSheet === name ? '#1E3A8A' : 'var(--surface-raised)',
                color: activeSheet === name ? 'white' : 'var(--ink-600)',
                border: '1px solid var(--border-hairline)',
                fontWeight: activeSheet === name ? 600 : 400,
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          className="overflow-auto rounded border"
          style={{ maxHeight: '70vh', borderColor: 'var(--border-hairline)' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <style>{`
          #xlsx-preview-table {
            font-family: Arial, sans-serif;
            font-size: 11px;
            border-collapse: collapse;
            width: 100%;
          }
          #xlsx-preview-table td {
            border: 1px solid #e2e8f0;
            padding: 4px 8px;
          }
          #xlsx-preview-table tr:first-child td {
            position: sticky;
            top: 0;
            background: #1E3A8A;
            color: white;
            font-weight: 600;
          }
        `}</style>
        {onDownload && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onDownload}
              className="px-4 py-2 text-xs font-semibold rounded"
              style={{ background: 'var(--brand-600)', color: 'white' }}
            >
              Download This File
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
