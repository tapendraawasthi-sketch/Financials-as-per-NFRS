// ===== server/services/journalStandardSchema.ts =====

/** Standard column headers for the year-end adjustment journal template. */
export const JOURNAL_HEADERS = [
  'S.No.',
  'Dr/Cr',
  'Particulars',
  'Dr. Amount',
  'Cr. Amount',
  'Linked to',
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
  sNo: 1,
  drCr: 2,
  particulars: 3,
  drAmount: 4,
  crAmount: 5,
  linkedTo: 6,
} as const;

export const JOURNAL_HEADER_ALIASES: Record<string, keyof typeof JOURNAL_COL> = {
  's.no': 'sNo',
  's.no.': 'sNo',
  'sno': 'sNo',
  'sno.': 'sNo',
  'no': 'sNo',
  'no.': 'sNo',
  '#': 'sNo',
  'sr': 'sNo',
  'sr.': 'sNo',
  'dr/cr': 'drCr',
  'dr cr': 'drCr',
  'type': 'drCr',
  'particulars': 'particulars',
  'description': 'particulars',
  'narration': 'particulars',
  'details': 'particulars',
  'account': 'particulars',
  'ledger': 'particulars',
  'dr. amount': 'drAmount',
  'dr amount': 'drAmount',
  'debit amount': 'drAmount',
  'debit': 'drAmount',
  'dr': 'drAmount',
  'cr. amount': 'crAmount',
  'cr amount': 'crAmount',
  'credit amount': 'crAmount',
  'credit': 'crAmount',
  'cr': 'crAmount',
  'amount': 'drAmount',
  'amount (npr)': 'drAmount',
  'linked to': 'linkedTo',
  'linked': 'linkedTo',
  'link': 'linkedTo',
  'note ref': 'linkedTo',
};
