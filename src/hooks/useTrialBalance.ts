import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { NFRSCategory, ParsedTrialBalance } from '../types';
import { tbApi } from '../api/client';

export function useTrialBalance() {
  const { state, dispatch } = useAppStore();
  const [uploadProgress, setUploadProgress] = useState(0);

  const companyId = state.company?.id;

  const uploadFile = async (
    file: File,
    useAI: boolean = false,
  ): Promise<ParsedTrialBalance> => {
    if (!companyId) throw new Error('Company must be set up before uploading trial balance.');

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    setUploadProgress(0);

    try {
      const result = await tbApi.upload(
        companyId,
        file,
        useAI,
        (pct) => setUploadProgress(pct),
      );
      dispatch({ type: 'SET_TRIAL_BALANCE', payload: result });
      dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_upload' });
      setUploadProgress(100);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Trial balance upload failed.';
      dispatch({ type: 'SET_ERROR', payload: message });
      setUploadProgress(0);
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateMapping = async (
    rowIndex: number,
    nfrsCategory: NFRSCategory,
  ): Promise<void> => {
    if (!companyId) return;
    try {
      await tbApi.updateSingleMapping(companyId, rowIndex, nfrsCategory);
      // Optimistic UI update
      dispatch({
        type: 'UPDATE_TB_ROW_MAPPING',
        payload: { rowIndex, nfrsCategory, matchedLabel: 'Manual Override' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update account mapping.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    }
  };

  const rematchWithAI = async (): Promise<ParsedTrialBalance> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const result = await tbApi.rematchWithAI(companyId);
      dispatch({ type: 'SET_TRIAL_BALANCE', payload: result });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI re-match failed.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const confirmMappings = (): void => {
    dispatch({ type: 'COMPLETE_STEP', payload: 'trial_balance_mapping' });
    dispatch({ type: 'SET_STEP', payload: 'subledger_details' });
  };

  // Computed stats
  const tb = state.trialBalance;
  const totalAccounts = tb?.rows?.length ?? 0;
  const autoMapped = tb?.rows?.filter((r) => r.confidence >= 80 && !r.needsReview).length ?? 0;
  const needsReview = tb?.rows?.filter((r) => r.needsReview || r.confidence < 80).length ?? 0;
  const allMapped = needsReview === 0 && totalAccounts > 0;

  return {
    trialBalance: state.trialBalance,
    uploadProgress,
    isLoading: state.isLoading,
    error: state.error,
    totalAccounts,
    autoMapped,
    needsReview,
    allMapped,
    uploadFile,
    updateMapping,
    rematchWithAI,
    confirmMappings,
  };
}
