import { useAppStore } from '../store/appStore';
import { CompanyProfile, AccountingPolicies } from '../types';
import { companyApi } from '../api/client';

export function useCompany() {
  const { state, dispatch } = useAppStore();

  const saveCompany = async (data: Partial<CompanyProfile>): Promise<CompanyProfile> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const company = state.company?.id
        ? await companyApi.update(state.company.id, data)
        : await companyApi.create(data);
      dispatch({ type: 'SET_COMPANY', payload: company });
      dispatch({ type: 'COMPLETE_STEP', payload: 'company_setup' });
      return company;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save company details.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const savePolicies = async (policies: AccountingPolicies): Promise<CompanyProfile> => {
    if (!state.company?.id) {
      const msg = 'Company must be saved before accounting policies can be stored.';
      dispatch({ type: 'SET_ERROR', payload: msg });
      throw new Error(msg);
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const updated = await companyApi.savePolicies(state.company.id, policies);
      dispatch({ type: 'SET_COMPANY', payload: updated });
      dispatch({ type: 'COMPLETE_STEP', payload: 'accounting_policies' });
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save accounting policies.';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const advanceToTrialBalance = () => {
    dispatch({ type: 'SET_STEP', payload: 'trial_balance_upload' });
  };

  return {
    company: state.company,
    isLoading: state.isLoading,
    error: state.error,
    saveCompany,
    savePolicies,
    advanceToTrialBalance,
  };
}
