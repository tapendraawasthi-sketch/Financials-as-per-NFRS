// NFRS category metadata for UI dropdowns — derived from chartOfAccounts.
import { CHART_OF_ACCOUNTS, NFRS_CATEGORIES } from './chartOfAccounts';
import type { NFRSCategory } from '../types/trialBalance';

export interface NFRSCategoryInfo {
  value: NFRSCategory;
  label: string;
  statementLine: string;
}

export const NFRS_CATEGORY_INFO: NFRSCategoryInfo[] = CHART_OF_ACCOUNTS
  .filter((e) => !e.isGroup)
  .map((e) => ({
    value: e.category,
    label: e.displayLabel,
    statementLine: e.statementLine,
  }));

export { NFRS_CATEGORIES };
