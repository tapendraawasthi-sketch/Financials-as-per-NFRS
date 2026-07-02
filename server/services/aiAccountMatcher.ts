// server/services/aiAccountMatcher.ts
import { MappedTBRow, NFRSCategory } from '../../src/types/trialBalance.js';
import { CompanyProfile } from '../../src/types/company.js';
import { NFRS_CATEGORY_INFO } from '../../src/data/nfrsCategories.js';

interface AIMatchResult {
  rowIndex:    number;
  nfrsCategory: NFRSCategory;
  confidence:  number;
  reasoning:   string;
}

// ── In-memory request deduplication cache (per process lifetime) ──────────
const aiCache = new Map<string, AIMatchResult[]>();

function buildCacheKey(accounts: Pick<MappedTBRow, 'rawLabel' | 'closingBalance'>[]): string {
  return accounts.map(a => `${a.rawLabel}:${Math.sign(a.closingBalance)}`).join('|');
}

// ── System prompt ─────────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `You are an expert Nepal Chartered Accountant with deep knowledge of:
1. Nepal Accounting Standards for Micro Entities (NAS for MEs) issued by ICAN
2. Nepal Income Tax Act 2058 and its amendments
3. Common accounting software used in Nepal: Tally ERP9, Tally Prime, Busy Accounting, Marg ERP
4. Nepal business terminology: NPR, BS calendar, PAN/VAT, TDS, PF/SSF/CIT, NEPSE, NRB, IRD
5. Double-entry bookkeeping: Dr-balance accounts are typically assets/expenses; Cr-balance accounts are liabilities/equity/income

Your task is to classify trial balance account names into NFRS financial statement categories.
Respond ONLY with a valid JSON array — no markdown, no explanation, no preamble.`;
}

// ── User prompt ───────────────────────────────────────────────────────────
function buildUserPrompt(
  accounts: Pick<MappedTBRow, 'rawLabel' | 'closingBalance'>[],
  company: CompanyProfile
): string {
  const accountLines = accounts
    .map((a, i) => {
      const side   = a.closingBalance >= 0 ? 'Dr' : 'Cr';
      const amount = Math.abs(a.closingBalance).toLocaleString('en-IN');
      return `${i + 1}. "${a.rawLabel}" [Closing: ${side} NPR ${amount}]`;
    })
    .join('\n');

  return `CONTEXT: Company type is ${company.companyType}, Fiscal Year ${company.fiscalYear.bsYear}

These account names are from a Nepal business trial balance exported from accounting software.
Each name may be in English or a mixture of English and Nepali transliteration.

IMPORTANT Nepal-specific classification rules:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVIDENT / RETIREMENT FUNDS:
- "CIT" = Citizens Investment Trust (provident fund type) → employee_payables_pf
- "SSF" = Social Security Fund → employee_payables_pf
- "EPF" = Employees Provident Fund → employee_payables_pf
- "PF" alone or "Provident Fund" → employee_payables_pf

INVESTMENTS & CAPITAL MARKET:
- "NEPSE" related accounts → investment_listed_trading
- Share investment, listed shares, demat account → investment_listed_trading
- Mutual fund, unit trust → investment_listed_trading
- Fixed deposit (> 1 year) → investment_fixed_deposit_noncurrent
- Fixed deposit (< 1 year / short term) → cash_equivalents_fixed_deposit

REGULATORY / GOVERNMENT:
- "NRB" = Nepal Rastra Bank → admin_rates_taxes (if expense) or bank_current_account (if balance)
- "IRD" = Inland Revenue Department → income_tax_payable (if payable) or advance_tax (if receivable)
- "OCR" = Office of Company Registrar → admin_rates_taxes
- "DDR" = Department of Drug Registration → admin_rates_taxes
- "Municipality fee/renewal" → admin_rates_taxes

TAX ENTRIES:
- "TDS payable" / "TDS on salary payable" → tds_payable
- "TDS on rent payable" → tds_payable
- "TDS on service payable" → tds_payable
- "Input VAT" / "VAT receivable" → other_receivables_other (Dr balance)
- "Output VAT payable" / "VAT payable" → other_payables (Cr balance)
- "Advance income tax" / "Advance tax paid" → advance_tax_paid
- "Tax payable" / "Income tax payable" → income_tax_payable

BANK ACCOUNTS:
- Any Nepal bank name (Nabil, NIC Asia, Himalayan, Everest, NIBL, HBL, EBL, Citizens, Kumari, 
  Bank of Kathmandu, NMB, Siddhartha, Global IME, Sunrise, Prabhu, Sanima, Laxmi, Janata, 
  Mega, Century, ADBN, RBB, NBL, Civil, Prime, Standard Chartered, Citibank) with "Current / CA / 
  Savings / OD / CC / Account" → bank_current_account (Dr balance) or bank_overdraft (Cr balance)
- IMPORTANT: If the account is a Nepal bank name with Cr balance and labeled "OD" or "Overdraft" or "CC" 
  or "Cash Credit" → bank_overdraft (current liability)
- If the account is a Nepal bank name with Cr balance and labeled "Loan" or "Term Loan" → 
  borrowings_bank_noncurrent (if long-term) else borrowings_bank_current

INVENTORY:
- "Closing Stock" / "Stock in Hand" → inventory_finished_goods (Dr balance asset)
- "Opening Stock" / "Opening Inventory" → cogs_opening_stock (expense/COGS)
- "Work in Progress" / "WIP" → inventory_wip
- "Raw Material" stock → inventory_raw_material

TRADE ACCOUNTS:
- "Sundry Debtors" / "Trade Debtors" / "Accounts Receivable" → trade_receivables
- "Sundry Creditors" / "Trade Creditors" / "Accounts Payable" → trade_payables
- "Purchase" / "Purchases" by itself → cogs_purchases
- "Sales" / "Revenue" / "Income from [anything]" → revenue_operations (unless clearly other income)
- "Other Income" / "Miscellaneous Income" / "Sundry Income" → other_income

EMPLOYEE-RELATED:
- "Staff Bonus" / "Bonus expense" → emp_expense_bonus (if Dr / expense)
- "Bonus payable" / "Staff bonus payable" → employee_payables_bonus (if Cr / liability)
- "Dashain Allowance" / "Tihar Allowance" / "Festival bonus" → emp_expense_welfare
- "Gratuity expense" / "Gratuity provision" → emp_expense_gratuity
- "Gratuity payable" / "Gratuity fund" → employee_payables_gratuity
- "Leave encashment" → emp_expense_leave
- "Salary" / "Wages" / "Remuneration" → emp_expense_salary
  (A fiscal year suffix like "Salary 2081" does NOT change the category)

ADVANCES & LOANS:
- "Advance to [party name]" / "Staff advance" → other_receivables_loans (Dr balance = asset)
- "Advance from [party name]" → advance_from_customers (Cr balance = liability)
- "Loan from director" / "Loan from [director name]" → related_party_payable
- "Loan from [bank name]" → borrowings_bank_noncurrent or borrowings_bank_current (based on term)
- "Loan to staff" / "Loan to employee" → other_receivables_loans

BALANCE-SIDE HINTS (use the Dr/Cr balance as strong evidence):
- Large Cr balance (>1M) on an account named like a person/party → likely related_party_payable or trade_payables
- Large Cr balance on "Capital" or "Equity" related names → share_capital or retained_earnings
- Dr balance on "Depreciation" → this is the accumulated depreciation contra account → ppe_accumulated_depreciation
- Dr balance on "Prepaid" → prepaid_expenses
- Cr balance on "Deferred" or "Advance receipt" → deferred_income

ACCOUNTS TO CLASSIFY:
${accountLines}

Respond ONLY with a valid JSON array (no markdown, no \`\`\`, no text before or after):
[{"rowIndex": 1, "nfrsCategory": "exact_category_value", "confidence": 85, "reasoning": "brief one-line reason"}]

Available categories (use EXACTLY one of these strings):
${NFRS_CATEGORY_INFO.map(i => i.value).join(', ')}`;
}

// ── Main export ───────────────────────────────────────────────────────────
export async function aiMatchUnresolved(
  accounts:  Pick<MappedTBRow, 'rawLabel' | 'closingBalance'>[],
  company:   CompanyProfile,
  apiKey:    string
): Promise<AIMatchResult[]> {
  if (!accounts.length) return [];

  // Check cache
  const cacheKey = buildCacheKey(accounts);
  if (aiCache.has(cacheKey)) {
    console.log('[AI Matcher] Cache hit — skipping API call');
    return aiCache.get(cacheKey)!;
  }

  if (!apiKey) {
    console.warn('[AI Matcher] No API key — returning empty results');
    return [];
  }

  const BATCH_SIZE = 30; // Claude handles up to 30 accounts cleanly per request
  const allResults: AIMatchResult[] = [];

  // Process in batches to avoid context overflow
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const batchResults = await callClaudeAPI(batch, company, apiKey, i);
    allResults.push(...batchResults);
  }

  // Store in cache
  aiCache.set(cacheKey, allResults);
  return allResults;
}

async function callClaudeAPI(
  accounts:  Pick<MappedTBRow, 'rawLabel' | 'closingBalance'>[],
  company:   CompanyProfile,
  apiKey:    string,
  indexOffset: number
): Promise<AIMatchResult[]> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(accounts, company);

  let attempts = 0;
  const MAX_RETRIES = 2;

  while (attempts <= MAX_RETRIES) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 4096,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
      }

      const data = await response.json() as {
        content: { type: string; text: string }[];
      };

      const rawText = data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');

      // Strip any accidental markdown fencing
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      // Locate JSON array
      const arrayStart = cleaned.indexOf('[');
      const arrayEnd   = cleaned.lastIndexOf(']');
      if (arrayStart === -1 || arrayEnd === -1) {
        throw new Error('AI response did not contain a JSON array');
      }
      const jsonString = cleaned.slice(arrayStart, arrayEnd + 1);
      const parsed     = JSON.parse(jsonString) as AIMatchResult[];

      // Validate and adjust row indices for batching offset
      return parsed
        .filter(r =>
          typeof r.rowIndex === 'number' &&
          typeof r.nfrsCategory === 'string' &&
          typeof r.confidence === 'number'
        )
        .map(r => ({
          ...r,
          rowIndex:   r.rowIndex + indexOffset - 1, // convert 1-based → 0-based + offset
          confidence: Math.min(100, Math.max(0, r.confidence)),
          reasoning:  r.reasoning?.slice(0, 200) ?? '',
        }));
    } catch (err: any) {
      attempts++;
      console.error(`[AI Matcher] Attempt ${attempts} failed:`, err.message);
      if (attempts > MAX_RETRIES) {
        console.error('[AI Matcher] All retries exhausted — returning empty for this batch');
        return [];
      }
      // Exponential back-off: 1s, 2s
      await new Promise(r => setTimeout(r, attempts * 1000));
    }
  }

  return [];
}

// ── Utility: clear AI cache (useful between test runs) ────────────────────
export function clearAIMatcherCache(): void {
  aiCache.clear();
}
