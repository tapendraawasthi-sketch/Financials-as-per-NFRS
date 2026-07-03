import { useAppStore } from '../store/appStore';
import { financialsApi, outputApi } from '../api/client';
import { BalanceSheet, IncomeStatement, ChangesInEquity, CashFlowStatement } from '../types';

export function useFinancials() {
  const { state, dispatch } = useAppStore();

  const companyId = state.company?.id;

  const generateStatements = async (): Promise<void> => {
    if (!companyId) {
      dispatch({ type: 'SET_ERROR', payload: 'Company not found. Please complete setup first.' });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const result = await financialsApi.generate(companyId);
      dispatch({ type: 'SET_BALANCE_SHEET', payload: result.balanceSheet });
      dispatch({ type: 'SET_INCOME_STATEMENT', payload: result.incomeStatement });
      dispatch({ type: 'SET_CHANGES_IN_EQUITY', payload: result.changesInEquity });
      dispatch({ type: 'SET_CASH_FLOW', payload: result.cashFlow });
      dispatch({ type: 'SET_NOTES', payload: result.notes });
      dispatch({ type: 'COMPLETE_STEP', payload: 'review_statements' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate financial statements.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const downloadExcel = async (): Promise<void> => {
    if (!companyId || !state.company) {
      throw new Error('Company not found.');
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const blob = await outputApi.generateExcel(
        companyId,
        state.company.companyName,
        state.company.fiscalYear.bsFY,
      );
      outputApi.triggerDownload(
        blob,
        `NFRS_${state.company.companyName}_${state.company.fiscalYear.bsFY}.xlsx`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Excel generation failed.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const balanceSheet = state.balanceSheet as BalanceSheet | undefined;
  const incomeStatement = state.incomeStatement as IncomeStatement | undefined;
  const changesInEquity = state.changesInEquity as ChangesInEquity | undefined;
  const cashFlow = state.cashFlow as CashFlowStatement | undefined;

  const isStatementsReady = Boolean(
    balanceSheet && incomeStatement && changesInEquity && cashFlow
  );

  // Balance sheet validation
  const bsBalanced = balanceSheet
    ? Math.abs((balanceSheet.totalAssets ?? 0) - (balanceSheet.totalEquityAndLiabilities ?? 0)) < 2
    : null;

  // Cash flow validation
  const cfReconciled = cashFlow
    ? Math.abs(
        ((cashFlow.openingCash ?? 0) +
          (cashFlow.netCashFromOperating ?? 0) +
          (cashFlow.netCashFromInvesting ?? 0) +
          (cashFlow.netCashFromFinancing ?? 0)) -
          (cashFlow.closingCash ?? 0)
      ) < 2
    : null;

  return {
    balanceSheet,
    incomeStatement,
    changesInEquity,
    cashFlow,
    notes: state.notes,
    isStatementsReady,
    bsBalanced,
    cfReconciled,
    isLoading: state.isLoading,
    error: state.error,
    generateStatements,
    downloadExcel,
  };
}
