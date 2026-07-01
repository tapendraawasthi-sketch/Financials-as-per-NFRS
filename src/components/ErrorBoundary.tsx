import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleStartFresh = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage may be unavailable
    }
    window.location.reload();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;

      const { error, showDetails } = this.state;

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-xl max-w-lg w-full overflow-hidden">
            {/* Red top bar */}
            <div className="h-2 bg-gradient-to-r from-red-500 to-red-600" />

            <div className="p-8 text-center">
              {/* Error icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>

              <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                An unexpected error occurred in the NFRS Reporter. Your session data has not been
                lost — try reloading the page. If the problem persists, start fresh.
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                <button
                  onClick={this.handleReload}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-md"
                >
                  🔄 Try Again
                </button>
                <button
                  onClick={this.handleStartFresh}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-2.5 rounded-xl border border-slate-200 transition-colors"
                >
                  🗑️ Start Fresh
                </button>
              </div>

              {/* Collapsible technical details */}
              <div className="text-left border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  aria-expanded={showDetails}
                >
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Technical Details
                  </span>
                  <span className={`text-slate-400 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {showDetails && (
                  <div className="px-4 py-3 bg-slate-900 text-green-400 font-mono text-xs overflow-x-auto">
                    <p className="text-slate-400 mb-1"># Error:</p>
                    <p className="text-red-400 font-semibold">{error?.name}: {error?.message}</p>
                    {error?.stack && (
                      <>
                        <p className="text-slate-400 mt-2 mb-1"># Stack trace:</p>
                        <pre className="whitespace-pre-wrap text-green-300 text-xs leading-relaxed">
                          {error.stack}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                NFRS Financial Reporter — If this error persists, please contact your system administrator.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
