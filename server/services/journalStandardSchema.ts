// ===== server/services/journalStandardSchema.ts =====

/** Standard column headers for the year-end adjustment journal template. */
export const JOURNAL_HEADERS = [
  '#',
  'Description',
  'Dr Account',
  'Cr Account',
  'Amount (NPR)',
  'Type',
] as const;

export const JOURNAL_DATA_START_ROW = 6;
export const JOURNAL_HEADER_ROW = 5;
export const JOURNAL_TEMPLATE_ROWS = 25;

export const JOURNAL_TYPE_OPTIONS = [
  'DEPN',
  'PROV',
  'INV',
  'INV-FV',
  'TAX',
  'OTHER',
] as const;

export type JournalEntryType = (typeof JOURNAL_TYPE_OPTIONS)[number];

/** Column index (1-based) for each data field in the standard template. */
export const JOURNAL_COL = {
  rowNum: 1,
  description: 2,
  debitAccount: 3,
  creditAccount: 4,
  amount: 5,
  type: 6,
} as const;

export const JOURNAL_HEADER_ALIASES: Record<string, keyof typeof JOURNAL_COL> = {
  '#': 'rowNum',
  'no': 'rowNum',
  'no.': 'rowNum',
  's.no': 'rowNum',
  's.no.': 'rowNum',
  'sr': 'rowNum',
  'sr.': 'rowNum',
  'description': 'description',
  'particulars': 'description',
  'narration': 'description',
  'details': 'description',
  'dr account': 'debitAccount',
  'debit account': 'debitAccount',
  'debit': 'debitAccount',
  'dr': 'debitAccount',
  'debit a/c': 'debitAccount',
  'cr account': 'creditAccount',
  'credit account': 'creditAccount',
  'credit': 'creditAccount',
  'cr': 'creditAccount',
  'credit a/c': 'creditAccount',
  'amount': 'amount',
  'amount (npr)': 'amount',
  'amount npr': 'amount',
  'npr': 'amount',
  'value': 'amount',
  'type': 'type',
  'entry type': 'type',
  'adj type': 'type',
};
