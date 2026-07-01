import React, { useState, useEffect } from 'react';
import { AppStep } from '../../types';
import Sidebar from './Sidebar';
import Header from './Header';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface AppShellProps {
  currentStep: AppStep;
  completedSteps: AppStep[];
  onNavigate: (step: AppStep) => void;
  companyName?: string;
  fiscalYear?: string;
  headerTitle: string;
  headerSubtitle?: string;
  headerActions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({
  currentStep,
  completedSteps,
  onNavigate,
  companyName,
  fiscalYear,
  headerTitle,
  headerSubtitle,
  headerActions,
  breadcrumb,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentStep]);

  // Close sidebar on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto md:transition-none
        flex-shrink-0
      `}>
        <Sidebar
          currentStep={currentStep}
          completedSteps={completedSteps}
          onNavigate={onNavigate}
          companyName={companyName}
          fiscalYear={fiscalYear}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header — with hamburger on mobile */}
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
          breadcrumb={breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Scrollable content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
