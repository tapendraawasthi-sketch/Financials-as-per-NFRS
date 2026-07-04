// Automatic subledger reclassification rules matching MEs Financials Format.xlsx.

export interface DebtorLike {
  name?: string;
  balanceCY?: number;
  balancePY?: number;
  debitBalance?: number;
  creditBalance?: number;
  isAdvanceFromCustomer?: boolean;
}

export interface DebtorClassification {
  tradeReceivablesCY: number;
  tradeReceivablesPY: number;
  advanceFromCustomersCY: number;
  advanceFromCustomersPY: number;
  classifiedDebtors: Array<DebtorLike & { isAdvanceFromCustomer: boolean }>;
}

function netBalance(d: DebtorLike, field: 'CY' | 'PY'): number {
  if (field === 'CY') {
    const dr = Number(d.debitBalance ?? d.balanceCY ?? 0);
    const cr = Number(d.creditBalance ?? 0);
    if (cr > 0 && dr === 0) return -cr;
    return dr - cr;
  }
  const dr = Number(d.balancePY ?? 0);
  return dr;
}

/** Credit-balance debtors auto-flow to Advance from Customers (Note 3.16), not Trade Receivables. */
export function classifyDebtors(debtors: DebtorLike[]): DebtorClassification {
  let tradeReceivablesCY = 0;
  let tradeReceivablesPY = 0;
  let advanceFromCustomersCY = 0;
  let advanceFromCustomersPY = 0;

  const classifiedDebtors = debtors.map((d) => {
    const netCY = netBalance(d, 'CY');
    const netPY = netBalance(d, 'PY');
    const isAdvance = Boolean(d.isAdvanceFromCustomer) || netCY < 0;

    if (isAdvance) {
      advanceFromCustomersCY += Math.abs(netCY);
      if (netPY < 0) advanceFromCustomersPY += Math.abs(netPY);
    } else {
      tradeReceivablesCY += netCY;
      tradeReceivablesPY += Math.max(0, netPY);
    }

    return { ...d, isAdvanceFromCustomer: isAdvance };
  });

  return {
    tradeReceivablesCY,
    tradeReceivablesPY,
    advanceFromCustomersCY,
    advanceFromCustomersPY,
    classifiedDebtors,
  };
}

export interface BankAccountLike {
  accountType?: string;
  balance?: number;
  securedBy?: string;
}

/** Term loans: secured vs unsecured placement for Note 3.11 / Bank Acc. sheet. */
export function classifyBankLoan(account: BankAccountLike): 'secured_term' | 'unsecured_term' | 'short_term' | 'current_account' {
  const type = account.accountType ?? 'current';
  if (['overdraft', 'cash_credit', 'working_capital'].includes(type)) return 'short_term';
  if (type === 'current' || type === 'savings' || type === 'call') return 'current_account';
  if (type === 'loan' || type === 'fixed_deposit') {
    return account.securedBy ? 'secured_term' : 'unsecured_term';
  }
  return 'current_account';
}
