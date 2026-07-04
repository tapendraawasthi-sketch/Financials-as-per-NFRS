// src/components/NotFound.tsx
import React from 'react';
import { FileText } from 'lucide-react';
import Button from './ui/Button';

interface NotFoundProps { onGoHome?: () => void; }

const NotFound: React.FC<NotFoundProps> = ({ onGoHome }) => {
  const handleGoHome = () => {
    if (onGoHome) onGoHome();
    else window.location.href = '/';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--canvas)', padding: 'var(--space-6)' }}
    >
      <div className="text-center" style={{ maxWidth: '420px' }}>
        <FileText size={40} style={{ color: 'var(--ink-300)', margin: '0 auto var(--space-4)' }} />
        <h1
          className="font-display"
          style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink-950)', marginBottom: 'var(--space-2)' }}
        >
          Page not found
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
          The page you requested does not exist or has been moved.
        </p>
        <Button variant="primary" size="md" onClick={handleGoHome}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
