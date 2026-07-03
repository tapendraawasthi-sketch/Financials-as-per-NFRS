import { useAppStore } from '../store/appStore';
import {
  AssetItem,
  ProvisionEntry,
  InventoryAdjustment,
  InvestmentAdjustment,
  DepreciationResult,
  DepreciationSummary,
  YearEndAdjustments,
} from '../types';
import { adjustmentsApi } from '../api/client';
import {
  computeStaffBonus,
  computeTax,
  computeDividendTDS,
} from '../../server/services/taxEngine';

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
      dispatch({
        type: 'SET_ADJUSTMENTS',
        payload: {
          ...(state.adjustments ?? {}),
          depreciationResults: result.results,
          depreciationSummary: result.summary,
          totalDepreciationExpense: result.summary.reduce((sum, row) => sum + row.depnForYear, 0),
        } as YearEndAdjustments,
      });
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

  const deriveProfitBeforeTax = (adj: YearEndAdjustments | null): number => {
    if (adj?.profitBeforeTax != null) return adj.profitBeforeTax;
    if (state.incomeStatement?.profitBeforeTax != null) return state.incomeStatement.profitBeforeTax;

    const rows = state.trialBalance?.rows ?? [];
    const isIncome = (cat: string) => cat.startsWith('revenue_') || cat.startsWith('other_income_');
    const isExpense = (cat: string) =>
      cat.startsWith('cogs_') || cat.startsWith('emp_expense_') || cat.startsWith('direct_')
      || cat.startsWith('finance_cost_') || cat === 'impairment_expense' || cat.startsWith('admin_');

    const totalIncome = rows
      .filter((r) => !r.isGroupRow && isIncome(String(r.nfrsCategory)))
      .reduce((s, r) => s + (r.closingCr ?? 0), 0);
    const totalExpensesBeforeTax = rows
      .filter((r) => !r.isGroupRow && isExpense(String(r.nfrsCategory)))
      .reduce((s, r) => s + (r.closingDr ?? 0), 0)
      + (adj?.totalDepreciationExpense ?? 0);

    return Math.round((totalIncome - totalExpensesBeforeTax) * 100) / 100;
  };

  const mapEntityType = (companyType?: string): 'Company' | 'Partnership' | 'Sole Proprietorship' | 'Cooperative' | 'Other' => {
    if (companyType === 'Partnership') return 'Partnership';
    if (companyType === 'Proprietorship') return 'Sole Proprietorship';
    if (companyType === 'Cooperative') return 'Cooperative';
    if (companyType === 'PrivateLimited' || companyType === 'PublicLimited') return 'Company';
    return 'Other';
  };

  const recalculateProvisions = (
    overrides: Partial<YearEndAdjustments> = {},
  ): Pick<YearEndAdjustments, 'profitBeforeTax' | 'staffBonusProvision' | 'incomeTaxProvision' | 'currentTaxExpense' | 'taxableProfit' | 'dividendPayable'> & { dividendTDSProvision?: number } => {
    const adj = { ...(state.adjustments ?? {}), ...overrides } as YearEndAdjustments;
    const profitBeforeTax = deriveProfitBeforeTax(adj);
    const bonusRate = (adj as YearEndAdjustments & { bonusRate?: number }).bonusRate
      ?? (state.company?.accountingPolicies?.bonusRatePercent ?? 10) / 100;
    const staffBonusProvision = computeStaffBonus(profitBeforeTax, bonusRate);

    const accountingDepreciation = adj.totalDepreciationExpense ?? 0;
    const taxDepreciation = adj.taxDepreciation
      ?? adj.taxDepPool?.reduce((s, p) => s + (p.absorbed ?? 0), 0)
      ?? adj.taxDepreciationPools?.reduce((s, p) => s + (p.taxDepreciation ?? 0), 0)
      ?? 0;
    const advanceTaxPaid = (adj.advanceTax1 ?? 0) + (adj.advanceTax2 ?? 0) + (adj.advanceTax3 ?? 0) + (adj.tdsCredit ?? 0);
    const incomeTaxRate = (state.company?.accountingPolicies?.incomeTaxRatePercent ?? 25) / 100;

    const taxResult = computeTax({
      accountingProfit: profitBeforeTax,
      accountingDepreciation,
      taxDepreciation,
      disallowedForTax: adj.disallowedForTax ?? [],
      staffBonus: staffBonusProvision,
      profitBeforeBonus: profitBeforeTax,
      advanceTaxPaid,
      incomeTaxRate,
      entityType: mapEntityType(state.company?.companyType),
    });

    const shareCapital = state.trialBalance?.rows
      ?.filter((r) => r.nfrsCategory === 'share_capital' && !r.isGroupRow)
      .reduce((s, r) => s + (r.closingCr ?? 0), 0) ?? 0;
    const dividendDeclaredPercent = state.company?.dividendDeclaredPercent ?? 0;
    const dividendDeclared = dividendDeclaredPercent > 0
      ? Math.round(shareCapital * (dividendDeclaredPercent / 100) * 100) / 100
      : (adj.dividendPayable ?? 0);
    const dividendTDSProvision = dividendDeclared > 0 ? computeDividendTDS(dividendDeclared) : 0;

    const computed = {
      profitBeforeTax,
      staffBonusProvision,
      incomeTaxProvision: taxResult.currentTaxExpense,
      currentTaxExpense: taxResult.currentTaxExpense,
      taxableProfit: taxResult.taxableIncome,
      dividendPayable: dividendDeclared,
      dividendTDSProvision,
    };

    dispatch({
      type: 'SET_ADJUSTMENTS',
      payload: { ...adj, ...computed } as YearEndAdjustments,
    });

    return computed;
  };

  const finalizeAdjustments = async (): Promise<void> => {
    if (!companyId) throw new Error('No company found.');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    try {
      const provisionValues = recalculateProvisions();
      const adjResponse = await adjustmentsApi.calculateAll(companyId);
      const merged = {
        ...(typeof adjResponse === 'object' && adjResponse && 'adjustments' in adjResponse
          ? (adjResponse as { adjustments: YearEndAdjustments }).adjustments
          : adjResponse),
        ...provisionValues,
      } as YearEndAdjustments;
      dispatch({ type: 'SET_ADJUSTMENTS', payload: merged });
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
    recalculateProvisions,
  };
}
