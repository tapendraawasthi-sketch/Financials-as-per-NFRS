const fs = require('fs');

let content = fs.readFileSync('server/services/excelWriter.ts', 'utf-8');

// 1. Fix fy.split
content = content.replace(/const fy = company\.fiscalYear \?\? '';/g, "const fy = company.fiscalYear?.bsYear ?? '';");

// 2. Call appendComplianceStatement
content = content.replace(
  /writeSignatureLine\(ws, row \+ 1, company\);\s+ws\.pageSetup = \{ paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 \};/g,
  `writeSignatureLine(ws, row + 1, company);
  appendComplianceStatement(ws, {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsYear ?? '',
    roundingLevel: 100,
  }, row + 2);
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 };`
);

// 3. Insert Note 1 and Note 2
content = content.replace(
  /writeCashFlowStatement\(addSheet\('Cash Flow', COLORS\.BRAND_BLUE\), cashFlow, company\);/g,
  `writeCashFlowStatement(addSheet('Cash Flow', COLORS.BRAND_BLUE), cashFlow, company);
  writeNote1_AccountingPolicies(addSheet('Note 1 - Policies', '16A34A'), {
    ...(company.accountingPolicies ?? {}),
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsYear ?? ''
  });
  writeNote2_CriticalJudgments(addSheet('Note 2 - Judgments', '16A34A'), {
    companyName: company.companyName ?? '',
    fiscalYear: company.fiscalYear?.bsYear ?? ''
  });`
);

// 4. Insert cross ref calls
const crossRefCode = `
  applyBalanceSheetCrossReferences(wb, 'Balance Sheet', {
    ppe: 'Note 3.1 - PPE',
    receivables: 'Note 3.3 - Receivables',
    otherReceivables: 'Note 3.4 - Other Recv',
    cash: 'Note 3.8 - Cash',
    shareCapital: 'Note 3.9 - Share Capital',
    borrowings: 'Note 3.11 - Borrowings',
    tax: 'Note 3.23 - Tax',
  }, {
    ppeRow: 8,
    receivablesRow: 16,
    cashRow: 17,
    shareCapitalRow: 22,
    ncBorrowingsRow: 27,
    cBorrowingsRow: 32,
    taxPayableRow: 34,
    totalAssetsRow: 20,
    totalLiabilitiesEquityRow: 38,
  });

  applyIncomeStatementCrossReferences(wb, 'Income Statement', {
    revenue: 'Note 3.17 - Revenue',
    empExpense: 'Note 3.20 - Emp Expense',
    adminExpense: 'Note 3.22 - Admin Exp',
    ppe: 'Note 3.1 - PPE',
    tax: 'Note 3.23 - Tax',
  }, {
    revenueRow: 8,
    empExpenseRow: 15,
    adminExpenseRow: 19,
    depreciationRow: 17,
    taxRow: 24,
  });

  applyCashFlowReconciliation(wb, 'Cash Flow', 'Balance Sheet', {
    openingCashRow: 42,
    closingCashRow: 43,
    netOperatingRow: 26,
    netInvestingRow: 32,
    netFinancingRow: 40,
  });
`;
content = content.replace(
  /const buffer = await wb\.xlsx\.writeBuffer\(\);/g,
  `${crossRefCode}\n  const buffer = await wb.xlsx.writeBuffer();`
);

// 5. Append new code
const additionsPart1 = fs.readFileSync('additions1.ts', 'utf-8');
const additionsPart2 = fs.readFileSync('additions2.ts', 'utf-8');

content = content + '\\n' + additionsPart1 + '\\n' + additionsPart2;

// Clean up exports at bottom to avoid TS errors
content = content.replace(/export \{\n  cellRef,\n  sumRange,\n  sumCrossSheet,\n  SHEET_ROW_REGISTRY,\n  applyBalanceSheetCrossReferences,\n  applyIncomeStatementCrossReferences,\n  applyCashFlowReconciliation,\n\};\n/g, '');
content = content + `
export {
  cellRef,
  sumRange,
  sumCrossSheet,
  SHEET_ROW_REGISTRY,
  applyBalanceSheetCrossReferences,
  applyIncomeStatementCrossReferences,
  applyCashFlowReconciliation,
};
`;

fs.writeFileSync('server/services/excelWriter.ts', content, 'utf-8');
console.log('Successfully patched excelWriter.ts');
