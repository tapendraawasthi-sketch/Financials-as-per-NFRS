// src/components/output/PrintButton.tsx
import React from 'react';
import { Printer } from 'lucide-react';
import Button from '../ui/Button';

interface PrintButtonProps {
  label?:    string;
  className?: string;
}

export default function PrintButton({
  label     = 'Print / Export PDF',
  className = '',
}: PrintButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={`no-print ${className}`}
      onClick={() => window.print()}
      aria-label={label}
      icon={<Printer size={14} />}
    >
      {label}
    </Button>
  );
}
