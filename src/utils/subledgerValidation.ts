export interface SubledgerPartyTotals {
  debtorDebitTotal: number;
  creditorCreditTotal: number;
  bankAssetTotal: number;
  bankLiabilityTotal: number;
}

export interface SubledgerValidation {
  debtorTotal: number;
  creditorTotal: number;
  bankAssetTotal: number;
  bankLiabilityTotal: number;
  isValid: boolean;
  warnings: string[];
}

export interface ReconciliationCheck {
  subledgerTotal: number;
  tbTotal: number;
  diff: number;
  isBalanced: boolean;
}

const TOLERANCE = 1;

export function sumDebtorDebitTotal(
  debtors: Array<{ debitBalance?: number | null }> = [],
): number {
  return debtors.reduce((sum, row) => sum + Math.max(0, row.debitBalance ?? 0), 0);
}

export function sumCreditorCreditTotal(
  creditors: Array<{ creditBalance?: number | null }> = [],
): number {
  return creditors.reduce((sum, row) => sum + Math.max(0, row.creditBalance ?? 0), 0);
}

export function sumBankTotals(
  bankAccounts: Array<{ balance?: number | null }> = [],
): { bankAssetTotal: number; bankLiabilityTotal: number } {
  const bankAssetTotal = bankAccounts
    .filter((row) => (row.balance ?? 0) > 0)
    .reduce((sum, row) => sum + (row.balance ?? 0), 0);
  const bankLiabilityTotal = bankAccounts
    .filter((row) => (row.balance ?? 0) < 0)
    .reduce((sum, row) => sum + Math.abs(row.balance ?? 0), 0);
  return { bankAssetTotal, bankLiabilityTotal };
}

export function checkDebtorReconciliation(
  subledgerTotal: number,
  tbTotal: number,
  hasRows = true,
): ReconciliationCheck {
  const diff = Math.abs(subledgerTotal - tbTotal);
  const isBalanced = diff <= TOLERANCE || tbTotal === 0 || !hasRows;
  return { subledgerTotal, tbTotal, diff, isBalanced };
}

export function checkCreditorReconciliation(
  subledgerTotal: number,
  tbTotal: number,
  hasRows = true,
): ReconciliationCheck {
  const diff = Math.abs(subledgerTotal - tbTotal);
  const isBalanced = diff <= TOLERANCE || tbTotal === 0 || !hasRows;
  return { subledgerTotal, tbTotal, diff, isBalanced };
}

export function validateSubledgerTotals(
  data: {
    debtors?: Array<{ debitBalance?: number | null }>;
    creditors?: Array<{ creditBalance?: number | null }>;
    bankAccounts?: Array<{ balance?: number | null }>;
  },
  tbDebtorTotal: number,
  tbCreditorTotal: number,
): SubledgerValidation {
  const warnings: string[] = [];
  const debtors = data.debtors ?? [];
  const creditors = data.creditors ?? [];
  const bankAccounts = data.bankAccounts ?? [];

  const debtorTotal = sumDebtorDebitTotal(debtors);
  const creditorTotal = sumCreditorCreditTotal(creditors);
  const { bankAssetTotal, bankLiabilityTotal } = sumBankTotals(bankAccounts);

  const debtorCheck = checkDebtorReconciliation(debtorTotal, tbDebtorTotal, debtors.length > 0);
  if (debtors.length > 0 && !debtorCheck.isBalanced) {
    warnings.push(
      `Debtor subledger total (NPR ${debtorTotal.toLocaleString('en-IN')}) does not match ` +
      `trial balance trade receivables (NPR ${tbDebtorTotal.toLocaleString('en-IN')}). ` +
      `Difference: NPR ${debtorCheck.diff.toLocaleString('en-IN')}.`,
    );
  }

  const creditorCheck = checkCreditorReconciliation(creditorTotal, tbCreditorTotal, creditors.length > 0);
  if (creditors.length > 0 && !creditorCheck.isBalanced) {
    warnings.push(
      `Creditor subledger total (NPR ${creditorTotal.toLocaleString('en-IN')}) does not match ` +
      `trial balance trade payables (NPR ${tbCreditorTotal.toLocaleString('en-IN')}). ` +
      `Difference: NPR ${creditorCheck.diff.toLocaleString('en-IN')}.`,
    );
  }

  return {
    debtorTotal,
    creditorTotal,
    bankAssetTotal,
    bankLiabilityTotal,
    isValid: warnings.length === 0,
    warnings,
  };
}
