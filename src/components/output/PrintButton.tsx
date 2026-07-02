import React from 'react';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  label?: string;
  className?: string;
}

export default function PrintButton({
  label = 'Print Statement',
  className = '',
}: PrintButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button
      type="button"
      className={`no-print inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg text-slate-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${className}`}
      onClick={handlePrint}
      aria-label={label}
    >
      <Printer size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
