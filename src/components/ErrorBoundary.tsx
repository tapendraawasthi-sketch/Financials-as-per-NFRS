// src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; showDetails: boolean; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: undefined, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReload   = () => window.location.reload();
  handleFresh    = () => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    window.location.reload();
  };
  toggleDetails  = () => this.setState(prev => ({ showDetails: !prev.showDetails }));

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      const { error, showDetails } = this.state;
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div
            className="bg-white w-full overflow-hidden"
            style={{ maxWidth: '480px', borderRadius: '20px', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' }}
          >
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #dc2626, #ef4444)' }} />
            <div className="p-8 text-center">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
                style={{ background: '#fef2f2' }}
              >
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                An unexpected error occurred in the NFRS Reporter. Your session data has not been
                lost — try reloading the page.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                <button
                  onClick={this.handleReload}
                  className="font-semibold px-6 py-2.5 rounded-xl text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#4338ca,#6366f1)', boxShadow: '0 2px 8px rgba(79,70,229,0.35)', fontSize: '13px' }}
                >
                  🔄 Try Again
                </button>
                <button
                  onClick={this.handleFresh}
                  className="font-semibold px-6 py-2.5 rounded-xl transition-colors text-slate-700 bg-white hover:bg-slate-50"
                  style={{ border: '1px solid #e2e8f0', fontSize: '13px' }}
                >
                  🗑️ Start Fresh
                </button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-left">
                <button
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  aria-expanded={showDetails}
                >
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Technical Details</span>
                  <span className={`text-slate-400 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {showDetails && (
                  <div className="px-4 py-3 bg-slate-900 font-mono text-xs overflow-x-auto">
                    <p className="text-slate-400 mb-1"># Error:</p>
                    <p className="text-red-400 font-semibold">{error?.name}: {error?.message}</p>
                    {error?.stack && (
                      <>
                        <p className="text-slate-400 mt-2 mb-1"># Stack trace:</p>
                        <pre className="whitespace-pre-wrap text-green-300 text-xs leading-relaxed">{error.stack}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                NFRS Financial Reporter — If this persists, contact your system administrator.
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
