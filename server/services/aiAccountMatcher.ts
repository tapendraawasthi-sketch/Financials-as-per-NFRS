// ===== server/services/aiAccountMatcher.ts =====
// AI-assisted fallback classifier for account names the deterministic matcher
// could not classify with CONFIDENCE_THRESHOLD confidence.
// Only unresolved rows are sent to Claude; every AI suggestion is validated
// against the closed taxonomy before being accepted.

import Anthropic from '@anthropic-ai/sdk';
import { CHART_OF_ACCOUNTS } from '../../src/data/chartOfAccounts';
import type { NFRSCategory } from '../../src/types';
import type { MatchResult } from './accountMatcher';
import { CONFIDENCE_THRESHOLD } from './accountMatcher';

// ---------------------------------------------------------------------------
// Lazy Anthropic client
// ---------------------------------------------------------------------------
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. ' +
        'AI account matching is unavailable.',
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Build the human-readable category list for the prompt
// ---------------------------------------------------------------------------
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  share_capital:                     'Share Capital (paid-up equity)',
  share_premium:                     'Share Premium (excess over face value)',
  general_reserve:                   'General Reserve / Other Reserves',
  retained_earnings:                 'Retained Earnings / Accumulated Profit',
  borrowings_noncurrent_bank:        'Long-term Bank Loans (non-current borrowings)',
  trade_payables_creditors:          'Sundry Creditors / Trade Payables',
  trade_payables_advance_customers:  'Advance from Customers',
  borrowings_current_od:             'Bank Overdraft (current borrowing)',
  borrowings_current_cc:             'Cash Credit / CC Account (current borrowing)',
  borrowings_current_wc:             'Working Capital / Short-term Loan',
  tds_payable:                       'TDS Payable (Tax Deducted at Source liability)',
  other_payables:                    'VAT Payable / Other Statutory Payables',
  employee_payables_pf:              'Provident Fund / SSF Payable',
  employee_payables_bonus:           'Staff Bonus Payable',
  audit_fee_payable:                 'Audit Fee Payable',
  employee_payables_salary:          'Salary / Wages Payable',
  income_tax_payable:                'Income Tax Payable',
  ppe_land:                          'Property, Plant & Equipment – Land',
  ppe_buildings:                     'Property, Plant & Equipment – Buildings',
  ppe_vehicles:                      'Property, Plant & Equipment – Vehicles',
  ppe_office_equipment:              'Property, Plant & Equipment – Office Equipment',
  ppe_computers:                     'Property, Plant & Equipment – Computers / IT',
  ppe_furniture:                     'Property, Plant & Equipment – Furniture & Fixtures',
  ppe_plant_machinery:               'Property, Plant & Equipment – Plant & Machinery',
  ppe_intangibles:                   'Intangible Assets (Software, Patents, Trademarks)',
  ppe_cwip:                          'Capital Work in Progress (CWIP)',
  accum_depreciation:                'Accumulated Depreciation (contra-PPE)',
  investment_listed_trading:         'Investment in Listed Shares (NEPSE)',
  investment_unlisted:               'Investment in Unlisted Shares / Private Companies',
  investment_fixed_deposit_noncurrent: 'Fixed Deposit (long-term, > 1 year)',
  nca_deposits:                      'Security Deposits (non-current asset)',
  nca_loans_advances:                'Loans & Advances Given (non-current)',
  other_noncurrent_assets:           'Other Non-Current Assets (e.g. Biological Assets)',
  trade_receivables:                 'Sundry Debtors / Trade Receivables',
  provision_impairment_debtors:      'Provision for Bad Debts / Impairment on Receivables',
  other_receivables_advance_supplier:'Advance to Suppliers',
  other_receivables_prepayments:     'Prepaid Expenses / Prepayments',
  other_receivables_staff_advance:   'Staff / Employee Advances',
  other_receivables_tds:             'TDS Receivable / Advance Tax (asset)',
  bank_fixed_deposit_current:        'Fixed Deposit (current, < 1 year)',
  other_receivables_loans:           'Short-term Loans & Advances (current asset)',
  other_current_assets:              'Other Current Assets (e.g. assets held for sale)',
  cash_in_hand:                      'Cash in Hand / Petty Cash',
  bank_current_account:              'Bank Balance (current / savings account)',
  inventory_raw_materials:           'Inventory – Raw Materials & Consumables',
  inventory_wip:                     'Inventory – Work in Progress',
  inventory_finished_goods:          'Inventory – Finished Goods / Stock in Trade',
  revenue_sales:                     'Revenue – Sale of Goods',
  revenue_services:                  'Revenue – Rendering of Services',
  other_income_interest:             'Interest Income',
  other_income_dividend:             'Dividend Income',
  other_income_rental:               'Rental Income',
  other_income_disposal_gain:        'Gain on Sale / Disposal of Fixed Assets',
  other_income_misc:                 'Other Income (commission, insurance claim, etc.)',
  cogs_purchases:                    'Purchases / Cost of Goods Purchased',
  cogs_opening_stock:                'Opening Stock',
  direct_wages:                      'Direct Wages / Factory Labour',
  direct_expenses_other:             'Other Direct / Manufacturing Expenses',
  emp_expense_salaries:              'Salaries & Wages Expense',
  emp_expense_pf:                    'Provident Fund / SSF Contribution Expense',
  emp_expense_gratuity:              'Gratuity Expense',
  emp_expense_welfare:               'Staff Welfare / Allowances / Leave Encashment',
  emp_expense_bonus:                 'Staff Bonus Expense',
  finance_cost_interest:             'Interest Expense / Finance Charges',
  finance_cost_bank_charges:         'Bank Charges / Bank Commission',
  depreciation_expense:              'Depreciation & Amortisation Expense',
  impairment_expense:                'Impairment Loss / Bad Debts Written Off',
  admin_rent:                        'Rent / Office Rent / Lease Expense',
  admin_rates_taxes:                 'Rates & Taxes / Municipal Taxes',
  admin_insurance:                   'Insurance Premium',
  admin_repairs:                     'Repairs & Maintenance / AMC',
  admin_electricity:                 'Electricity & Water Charges',
  admin_communication:               'Telephone / Internet / Communication',
  admin_printing:                    'Printing & Stationery',
  admin_legal_professional:          'Legal & Professional Fees',
  admin_audit_fee:                   'Audit Fees',
  admin_traveling:                   'Travelling & Conveyance / Fuel',
  admin_advertisement:               'Advertisement & Business Promotion',
  admin_other:                       'Other Administrative / Miscellaneous Expenses',
  income_tax_expense:                'Income Tax Expense',
  unclassified:                      'Cannot classify — genuinely unclassifiable',
};

const CATEGORY_LIST = Object.entries(CATEGORY_DESCRIPTIONS)
  .map(([key, desc]) => `  "${key}" — ${desc}`)
  .join('\n');

const MAX_BATCH_SIZE = 30;

// ---------------------------------------------------------------------------
// aiMatchUnresolved — core AI classification function
// ---------------------------------------------------------------------------
export async function aiMatchUnresolved(
  unmatchedRows: MatchResult[],
  _chartLabels: string[],       // reserved for future use
  _nfrsCategories: string[],    // reserved for future use
): Promise<MatchResult[]> {
  if (unmatchedRows.length === 0) return [];

  const client = getClient();
  const updated: MatchResult[] = [...unmatchedRows];

  // Process in batches to stay within token limits
  for (let start = 0; start < unmatchedRows.length; start += MAX_BATCH_SIZE) {
    const batch = unmatchedRows.slice(start, start + MAX_BATCH_SIZE);

    const accountList = batch
      .map((r, i) => `${start + i + 1}. ${r.rawLabel}`)
      .join('\n');

    const prompt =
      `You are an expert Nepal Chartered Accountant helping classify accounting entries ` +
      `from Nepal business trial balances exported from accounting software (Tally, Busy, Marg, or similar).\n\n` +
      `Below are account names from a Nepal company's trial balance. Map each to the correct NFRS/NAS for MEs category.\n\n` +
      `Available NFRS categories:\n${CATEGORY_LIST}\n\n` +
      `Accounts to classify:\n${accountList}\n\n` +
      `Respond ONLY with a valid JSON array, no markdown fences, no explanation:\n` +
      `[\n` +
      `  { "rowIndex": <original rowIndex integer>, "nfrsCategory": "<exact category key>", ` +
      `"confidence": <integer 60-95>, "reasoning": "<one sentence>" }\n` +
      `]\n\n` +
      `Rules:\n` +
      `- Use ONLY the exact category keys listed above (e.g. "cash_in_hand", not "Cash in Hand")\n` +
      `- confidence: 95 if certain, 80-94 if likely, 60-79 if uncertain\n` +
      `- If genuinely unclassifiable, use "unclassified" with confidence 40\n` +
      `- Nepal-specific context: "Nabil", "NIC Asia", "Himalayan", "SBI", "Everest" = bank names → bank_current_account or borrowings_noncurrent_bank\n` +
      `- "VAT", "TDS" = Nepal taxes; "PF"/"SSF"/"CIT" = provident/social security fund\n` +
      `- "NEPSE shares", "listed shares" = investment_listed_trading`;

    let parsed: Array<{
      rowIndex: number;
      nfrsCategory: string;
      confidence: number;
      reasoning: string;
    }> = [];

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      const rawText = content.type === 'text' ? content.text.trim() : '';

      // Strip any accidental markdown fences
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error('[aiAccountMatcher] API call or JSON parse failed:', err);
      // Non-fatal: return originals for this batch unchanged
      continue;
    }

    // Merge AI results back, with hard taxonomy validation
    for (const suggestion of parsed) {
      const origIndex = updated.findIndex(
        (r) => r.rowIndex === suggestion.rowIndex,
      );
      if (origIndex === -1) continue;

      // Validate the suggested category exists in our closed taxonomy
      const isValidCategory =
        suggestion.nfrsCategory === 'unclassified' ||
        CHART_OF_ACCOUNTS.some((e) => e.nfrsCategory === suggestion.nfrsCategory);

      if (!isValidCategory) {
        console.warn(
          `[aiAccountMatcher] Claude returned unknown category "${suggestion.nfrsCategory}" ` +
          `for "${updated[origIndex].rawLabel}" — rejecting and leaving as unmatched.`,
        );
        continue;
      }

      const confidence = Math.min(95, Math.max(40, Math.round(suggestion.confidence)));

      // Find the canonical label for this category
      const entry = CHART_OF_ACCOUNTS.find(
        (e) => e.nfrsCategory === suggestion.nfrsCategory,
      );

      updated[origIndex] = {
        ...updated[origIndex],
        nfrsCategory: suggestion.nfrsCategory as NFRSCategory | 'unclassified',
        matchedLabel: entry?.label ?? null,
        confidence,
        method: 'ai',
        needsReview: confidence < CONFIDENCE_THRESHOLD,
        candidates: entry
          ? [{ label: entry.label, nfrsCategory: entry.nfrsCategory, confidence }]
          : updated[origIndex].candidates,
      };
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// runAIMatching — convenience wrapper: filter, call AI, merge back
// ---------------------------------------------------------------------------
export async function runAIMatching(
  allResults: MatchResult[],
): Promise<MatchResult[]> {
  const unresolved = allResults.filter(
    (r) => r.method === 'unmatched' || r.confidence < CONFIDENCE_THRESHOLD,
  );

  if (unresolved.length === 0) return allResults;

  const allLabels = CHART_OF_ACCOUNTS.map((e) => e.label);
  const allCategories = [...new Set(CHART_OF_ACCOUNTS.map((e) => e.nfrsCategory as string))];

  const aiResults = await aiMatchUnresolved(unresolved, allLabels, allCategories);

  // Merge AI results back into the full results array
  const aiByRowIndex = new Map(aiResults.map((r) => [r.rowIndex, r]));
  return allResults.map((r) => aiByRowIndex.get(r.rowIndex) ?? r);
}
