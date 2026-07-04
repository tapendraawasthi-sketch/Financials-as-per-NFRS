import { CHART_OF_ACCOUNTS } from '../../src/data/chartOfAccounts.js';

export const SECTION_MAP: { prefixes: string[]; header: string }[] = [
  { prefixes: ['BS Equity'], header: 'CAPITAL ACCOUNT & RESERVES' },
  { prefixes: ['BS NCL Borrowings'], header: 'NON-CURRENT LIABILITIES - LOANS & BORROWINGS' },
  { prefixes: ['BS NCL Employee Benefits'], header: 'NON-CURRENT LIABILITIES - EMPLOYEE BENEFITS' },
  { prefixes: ['BS NCL Provisions'], header: 'NON-CURRENT LIABILITIES - PROVISIONS' },
  { prefixes: ['BS NCL'], header: 'NON-CURRENT LIABILITIES - OTHER' },
  { prefixes: ['BS CL Trade Payables'], header: 'CURRENT LIABILITIES - TRADE PAYABLES' },
  { prefixes: ['BS CL Borrowings'], header: 'CURRENT LIABILITIES - LOANS & BORROWINGS' },
  { prefixes: ['BS CL Tax'], header: 'CURRENT LIABILITIES - TAX PAYABLE' },
  { prefixes: ['BS CL Employee'], header: 'CURRENT LIABILITIES - EMPLOYEE PAYABLES' },
  { prefixes: ['BS CL Provisions'], header: 'CURRENT LIABILITIES - PROVISIONS' },
  { prefixes: ['BS CL Other'], header: 'CURRENT LIABILITIES - OTHER' },
  { prefixes: ['BS CA Tax'], header: 'CURRENT ASSETS - ADVANCE TAX' },
  { prefixes: ['BS NCA PPE'], header: 'PROPERTY, PLANT & EQUIPMENT' },
  { prefixes: ['BS NCA/CA Investments', 'BS NCA Investments'], header: 'INVESTMENTS' },
  { prefixes: ['BS NCA'], header: 'OTHER NON-CURRENT ASSETS' },
  { prefixes: ['BS CA Inventory'], header: 'CURRENT ASSETS - INVENTORY' },
  { prefixes: ['BS CA Receivables'], header: 'CURRENT ASSETS - TRADE RECEIVABLES' },
  { prefixes: ['BS CA Other Receivables'], header: 'CURRENT ASSETS - OTHER RECEIVABLES' },
  { prefixes: ['BS CA Cash'], header: 'CURRENT ASSETS - CASH & BANK' },
  { prefixes: ['BS CA'], header: 'CURRENT ASSETS - OTHER' },
  { prefixes: ['IS Revenue'], header: 'DIRECT INCOME' },
  { prefixes: ['IS Other Income'], header: 'INDIRECT INCOME' },
  { prefixes: ['IS COGS'], header: 'DIRECT EXPENSES' },
  { prefixes: ['IS Employee Benefits'], header: 'EMPLOYEE BENEFIT EXPENSES' },
  { prefixes: ['IS Finance Costs'], header: 'FINANCE COSTS' },
  { prefixes: ['IS Depreciation'], header: 'DEPRECIATION' },
  { prefixes: ['IS Impairment'], header: 'IMPAIRMENT EXPENSES' },
  { prefixes: ['IS Admin'], header: 'ADMINISTRATIVE EXPENSES' },
  { prefixes: ['IS Tax'], header: 'INCOME TAX EXPENSE' },
];

const AMOUNT_HEADERS = [
  'Opening Dr.',
  'Opening Cr.',
  'During Dr.',
  'During Cr.',
  'Adjustment Dr.',
  'Adjustment Cr.',
  'Adjusted Balance',
  'Closing Dr.',
  'Closing Cr.',
] as const;

export const STANDARD_TB_COLUMNS = [
  { col: 1, header: 'Particulars', block: 'cy' as const },
  ...AMOUNT_HEADERS.map((header, i) => ({ col: i + 2, header, block: 'cy' as const })),
  { col: 11, header: '', block: 'spacer' as const },
  { col: 12, header: 'Particulars', block: 'py' as const },
  ...AMOUNT_HEADERS.map((header, i) => ({ col: i + 13, header, block: 'py' as const })),
] as const;

export const TOTAL_COLS = STANDARD_TB_COLUMNS.length;
export const HEADER_ROW_INDEX = 5;

export const CY_AMOUNT_COLS = STANDARD_TB_COLUMNS
  .filter((c) => c.block === 'cy' && c.col !== 1)
  .map((c) => c.col);

export const PY_AMOUNT_COLS = STANDARD_TB_COLUMNS
  .filter((c) => c.block === 'py' && c.col !== 12)
  .map((c) => c.col);

function resolveSectionHeader(statementLine: string): string | null {
  for (const { prefixes, header } of SECTION_MAP) {
    for (const prefix of prefixes) {
      if (statementLine.startsWith(prefix)) return header;
    }
  }
  return null;
}

export function buildSectionAccounts(): {
  header: string;
  accounts: { displayLabel: string; category: string }[];
}[] {
  const sectionAccounts = new Map<string, { displayLabel: string; category: string }[]>();

  for (const entry of CHART_OF_ACCOUNTS) {
    if (entry.isGroup || entry.statementLine === 'N/A') continue;
    const header = resolveSectionHeader(entry.statementLine);
    if (!header) continue;
    if (!sectionAccounts.has(header)) sectionAccounts.set(header, []);
    sectionAccounts.get(header)!.push({ displayLabel: entry.displayLabel, category: entry.category });
  }

  return SECTION_MAP
    .map(({ header }) => header)
    .filter((header) => sectionAccounts.has(header))
    .map((header) => ({ header, accounts: sectionAccounts.get(header)! }));
}

export function getExpectedSectionOrder(): string[] {
  return buildSectionAccounts().map(({ header }) => header);
}
