import React from 'react';

interface NotFoundProps {
  onGoHome?: () => void;
}

const NotFound: React.FC<NotFoundProps> = ({ onGoHome }) => {
  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Large 404 */}
        <div className="text-8xl font-black text-blue-600 mb-4 select-none">404</div>

        <h1 className="text-2xl font-bold text-slate-800 mb-3">This page doesn't exist</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          The page you're looking for has moved, been deleted, or never existed.
          Let's get you back to generating financial statements.
        </p>

        <button
          onClick={handleGoHome}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          Go to Dashboard
        </button>

        <p className="text-xs text-slate-400 mt-6">NFRS Financial Reporter</p>
      </div>
    </div>
  );
};

export default NotFound;
