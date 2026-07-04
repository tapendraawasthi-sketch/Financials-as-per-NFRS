// src/components/NotFound.tsx
import React from 'react';

interface NotFoundProps { onGoHome?: () => void; }

const NotFound: React.FC<NotFoundProps> = ({ onGoHome }) => {
  const handleGoHome = () => { if (onGoHome) { onGoHome(); } else { window.location.href = '/'; } };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div
          className="text-slate-200 mb-4 select-none"
          style={{ fontFamily: 'var(--font-display)', fontSize: '96px', lineHeight: 1 }}
        >
          404
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-3">This page doesn't exist</h1>
        <p className="text-slate-500 mb-8 leading-relaxed" style={{ fontSize: '13.5px' }}>
          The page you're looking for has moved, been deleted, or never existed.
          Let's get you back to generating financial statements.
        </p>
        <button
          onClick={handleGoHome}
          className="font-semibold px-8 py-3 rounded-xl text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--brand-600), var(--brand-400))',
            boxShadow: 'var(--shadow-md)',
            fontSize: '13px',
          }}
        >
          Go to Dashboard
        </button>
        <p className="text-xs text-slate-400 mt-6">NFRS Financial Reporter</p>
      </div>
    </div>
  );
};

export default NotFound;
