import { useAppStore } from '../store/appStore';
import {
  AssetItem,
  ProvisionEntry,
  InventoryAdjustment,
  InvestmentAdjustment,
  DepreciationResult,
  DepreciationSummary,
} from '../types';
import { adjustmentsApi } from '../api/client';

export function useAdjustments() {
  const { state, dispatch } = useAppStore();

  const companyId = state.company?.id;

  const saveAssets = async (assets: AssetItem[]): Promise<void> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      await adjustmentsApi.saveAssets(companyId, assets);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save assets.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const calculateDepreciation = async (): Promise<{
    results: DepreciationResult[];
    summary: DepreciationSummary[];
  }> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const result = await adjustmentsApi.calculateDepreciation(companyId);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Depreciation calculation failed.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const saveProvisions = async (provisions: ProvisionEntry[]): Promise<void> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      await adjustmentsApi.saveProvisions(companyId, provisions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save provisions.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const saveInventory = async (items: InventoryAdjustment[]): Promise<void> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await adjustmentsApi.saveInventory(companyId, items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save inventory adjustments.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const saveInvestments = async (items: InvestmentAdjustment[]): Promise<void> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await adjustmentsApi.saveInvestments(companyId, items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save investment adjustments.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const finalizeAdjustments = async (): Promise<void> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const adj = await adjustmentsApi.calculateAll(companyId);
      dispatch({ type: 'SET_ADJUSTMENTS', payload: adj });
      dispatch({ type: 'COMPLETE_STEP', payload: 'year_end_adjustments' });
      dispatch({ type: 'SET_STEP', payload: 'review_statements' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to calculate adjustments.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return {
    adjustments: state.adjustments,
    isLoading: state.isLoading,
    error: state.error,
    saveAssets,
    calculateDepreciation,
    saveProvisions,
    saveInventory,
    saveInvestments,
    finalizeAdjustments,
  };
}
