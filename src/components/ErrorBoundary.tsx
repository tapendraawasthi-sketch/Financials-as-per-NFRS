// src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './ui/Button';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReload = () => window.location.reload();

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--canvas)', padding: 'var(--space-6)' }}
        >
          <div className="text-center" style={{ maxWidth: '420px' }}>
            <AlertCircle size={40} style={{ color: 'var(--danger-600)', margin: '0 auto var(--space-4)' }} />
            <h1
              className="font-display"
              style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink-950)', marginBottom: 'var(--space-2)' }}
            >
              Something went wrong
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              An unexpected error occurred. Your saved session data should still be intact — try reloading the page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="md" onClick={this.handleReload}>
                Reload
              </Button>
              <Button variant="secondary" size="md" onClick={() => { window.location.href = '/'; }}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
