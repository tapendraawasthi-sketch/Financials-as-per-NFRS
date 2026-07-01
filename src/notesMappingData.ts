import { NotesMapping } from "./types";

export const NOTES_MAPPING: NotesMapping = {
  "3.2": {
    "title": "Investments",
    "sub_sections": ["A. In Listed Shares", "B. Other Investments"],
    "rows": {
      "header": 1,
      "listed_shares_block": [2, 11],
      "other_investments_block": [13, 27]
    },
    "key_rows": {
      "listed_opening": 4, "listed_additions": 5, "listed_disposals": 6,
      "listed_closing": 7, "listed_fv_gain_loss": 8, "listed_net_carrying": 9,
      "listed_noncurrent_portion": 10, "listed_current_portion": 11,
      "other_cost_opening": 16, "other_cost_additions": 17, "other_cost_disposals": 18,
      "other_cost_closing": 19, "impairment_opening": 21, "impairment_movement": 22,
      "impairment_closing": 23, "other_carrying_amount": 25,
      "other_noncurrent_portion": 26, "other_current_portion": 27
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "61": "Shares of XYZ Ltd. (Listed Company) -> row 5 (Additions, listed)",
      "62": "Shares of PQR Ltd. (Unlisted Company) -> row 17 (Additions, other)",
      "63": "Provision for Impairment on Investment -> row 22",
      "102": "Gain on FV adjustment of listed share -> row 8 (via Fair Value Change sheet)",
      "141": "Loss on Fair FV adjustment of listed share -> row 8 (via Fair Value Change sheet)"
    },
    "feeds_into": {
      "non_current": "Balance Sheet!C10 = row10 (500,000) + row26 (1,000,000) = 1,500,000",
      "current": "Balance Sheet!C15 = row11 (0) + row27 (0) = 0"
    },
    "confidence": "medium — sub-total values reconcile exactly; the claim that BS!C10 is a SUM of two non-adjacent rows (10 and 26) rather than a single reference is inferred from arithmetic, not observed formula text."
  },

  "3.3": {
    "title": "Trade Receivables",
    "rows": [29, 39],
    "total_row": 39,
    "key_rows": {
      "gross_receivables": 32, "impairment_opening": 34,
      "impairment_provided": 35, "impairment_written_off": 36,
      "impairment_closing": 37, "net_receivables": 39
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "70": "Debtor A -> row 32 (via Sundry Debtors sheet)",
      "71": "Debtor B -> row 32",
      "72": "Debtor C -> row 32 (debit portion only; credit portion routes to Note 3.16)",
      "73": "Provision for Impairment on debtors -> row 35"
    },
    "feeds_into": "Balance Sheet!C17 = Note 3.3 row39 (1,327,000) + Note 3.4 row51 (350,000) = 1,677,000 -- CONFIRMED this BS line sums TWO notes, not one.",
    "confidence": "high"
  },

  "3.4": {
    "title": "Other Receivables",
    "rows": [41, 51],
    "total_row": 49,
    "key_rows": {
      "related_party_receivable": 43, "loans_and_advance": 44, "prepayments": 45,
      "deposits": 46, "staff_advance": 47, "other_receivables": 48,
      "total": 49, "noncurrent_portion": 50, "current_portion": 51
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "75": "Director C -> row 43 (via Related Party sheet)",
      "76": "Director D -> row 43 (via Related Party sheet)",
      "67": "Loans & Advances (Asset) -> row 44",
      "65": "Deposits -> row 46",
      "68": "Staff Advance -> row 47"
    },
    "feeds_into": {
      "non_current": "Balance Sheet!C11 = row50 (100,000) -- confirmed by user's own worked example",
      "current_contribution": "feeds into Balance Sheet!C17 combined with Note 3.3 (see above)"
    },
    "confidence": "high — this note's row50 mapping was independently confirmed against your own stated example."
  },

  "3.5": {
    "title": "Other Non-Current Assets",
    "rows": [53, 59],
    "total_row": 59,
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "57": "Biological Assets -> row 57 (Addition), row 59 (Total)"
    },
    "feeds_into": "Balance Sheet!C12",
    "confidence": "high"
  },

  "3.6": {
    "title": "Other Current Assets",
    "rows": [61, 66],
    "total_row": 66,
    "key_rows": {"lc_bg_margin": 63, "non_current_assets_held_for_sale": 64, "advance_to_suppliers": 65},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "85": "Non Current Assets held for Sale -> row 64 (10,000)"
    },
    "feeds_into": "Balance Sheet!C19",
    "confidence": "LOW — row 65 'Advance to Suppliers' (100,000) has NO matching Trial Balance row or label anywhere in the values I have access to. See needs_manual_review."
  },

  "3.7": {
    "title": "Inventories",
    "rows": [68, 76],
    "total_row": 73,
    "key_rows": {"raw_materials": 70, "wip": 71, "finished_goods": 72},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "note": "NOT sourced from Trial Balance directly -- sourced from the 'Enter Details' sheet Inventory Details block (manual entry per Instructions sheet). TB row 83 'Inventory' is used only as a Check/cross-reference, per the 'Check / As per Balance Sheet' rows visible in Enter Details."
    },
    "feeds_into": "Balance Sheet!C16, and internally into Note 3.18 row 176/178 (opening/closing stock)",
    "confidence": "high"
  },

  "3.8": {
    "title": "Cash and cash equivalents",
    "rows": [77, 81],
    "total_row": 81,
    "key_rows": {"petty_cash": 79, "bank_balance": 80},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "79": "Petty Cash -> row 79",
      "81": "Bank C -> row 80 (via Bank Acc. sheet, Call/Current Acc. section)",
      "82": "Bank D -> row 80 (via Bank Acc. sheet, Call/Current Acc. section)"
    },
    "feeds_into": "Balance Sheet!C18",
    "confidence": "high"
  },

  "3.9": {
    "title": "Share Capital",
    "rows": [83, 93],
    "total_row": 92,
    "key_rows": {
      "authorized_capital": 86, "beginning_of_year": 90,
      "issued_for_cash": 91, "end_of_year": 92, "check_true_false": 93
    },
    "current_year_col": "C",
    "prev_year_col": "E",
    "note": "This note's layout differs from all others -- it has Number/NPR paired columns rather than a simple E/F current/prior pair, plus a 'As per Trial' check block in columns G/H.",
    "feeds_from_tb_rows": {
      "7": "Paid-up Capital -> rows 90-92"
    },
    "feeds_into": "Balance Sheet!C24",
    "confidence": "medium — the check-column purpose (row93 True/True) is inferred, not confirmed."
  },

  "3.10": {
    "title": "Reserves",
    "rows": [94, 99],
    "total_row": 99,
    "key_rows": {"share_premium": 96, "retained_earnings": 97, "other_reserves": 98},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "9": "Reserves & Surplus -- but see needs_manual_review, this is a hybrid case"
    },
    "feeds_into": "Balance Sheet!C25",
    "confidence": "LOW on mechanism, high on values — see needs_manual_review item #2"
  },

  "3.11": {
    "title": "Loans and Borrowings",
    "rows": [101, 114],
    "key_rows": {
      "secured_nc": 104, "unsecured_nc": 105, "total_nc": 106,
      "overdrafts": 108, "cash_credit": 109, "working_capital": 110,
      "total_current": 111, "total_bfi": 112, "related_party_loan": 114
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "12": "Bank A -> row 104 (Secured Loans NC)",
      "13": "Bank B -> row 104 (Secured Loans NC)",
      "21": "Cash Credit -> row 109",
      "22": "Working Capital Loan -> row 110",
      "29": "Director A -> row 114 (via Related Party sheet)",
      "30": "Director B -> row 114 (via Related Party sheet)"
    },
    "feeds_into": {
      "non_current": "Balance Sheet!C29 = row106 (2,500,000) + row114 (140,000) = 2,640,000",
      "current": "Balance Sheet!C34 = row111 (150,000)"
    },
    "confidence": "high on arithmetic; flagged for classification-logic review — see needs_manual_review item #5"
  },

  "3.12": {
    "title": "Liability for Employee Benefits",
    "rows": [116, 124],
    "total_row": 122,
    "key_rows": {
      "salary_payable": 118, "bonus_payable": 119, "pf_ssf_cit_payable": 120,
      "other_benefits_payable": 121, "current_portion": 123, "noncurrent_portion": 124
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "32": "Employee A -> row 118",
      "33": "Employee B -> row 118",
      "24": "Staff Bonus Payable -> row 119",
      "34": "Provident Fund Payable -> row 120"
    },
    "manual_split_confirmed": "Rows 123/124 are MANUAL ENTRY per the Instructions sheet ('Enter the Current portion and Non-Current portion manually') -- this is the confirmed third write-point from the prior turn.",
    "feeds_into": {
      "non_current": "Balance Sheet!C30 = row124",
      "current": "Balance Sheet!C37 = row123"
    },
    "confidence": "high"
  },

  "3.13": {
    "title": "Trade and other payables",
    "rows": [126, 134],
    "total_row": 134,
    "key_rows": {
      "trade_payables": 128, "audit_fee_payable": 129, "tds_payable": 130,
      "tds_dividend": 131, "vat_payable": 132
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "16": "Creditor A -> row 128 (via Sundry Creditors sheet)",
      "17": "Creditor B -> row 128 (via Sundry Creditors sheet)",
      "18": "Creditor C -> row 128 (via Sundry Creditors sheet)",
      "23": "Audit Fee Payable -> row 129",
      "36,37,38,39,40,41,42": "All TDS-* rows sum to 110,000 -> row 130",
      "43": "TDS - Dividend -> row 131",
      "44": "VAT -> row 132"
    },
    "feeds_into": "Balance Sheet!C35",
    "confidence": "high"
  },

  "3.14": {
    "title": "Income Tax Liability",
    "rows": [136, 140],
    "total_row": 140,
    "key_rows": {"income_tax_payable": 138, "advance_tax": 139},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "45": "Income Tax Payable -> row 138 (via Tax Calculation sheet)",
      "84": "Advance Tax -> row 139"
    },
    "feeds_into": "Balance Sheet!C36",
    "confidence": "high"
  },

  "3.15": {
    "title": "Provisions",
    "rows": [142, 146],
    "total_row": 146,
    "key_rows": {"provision_for_expenses": 144, "provision_for_csr": 145},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "26": "Provision for expenses -> row 144",
      "27": "Provision for CSR -> row 145"
    },
    "feeds_into": "Balance Sheet!C38",
    "confidence": "high"
  },

  "3.16": {
    "title": "Other Current Liabilities",
    "rows": [148, 152],
    "total_row": 152,
    "key_rows": {"dividend_payable": 150, "advance_from_customers": 151},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "46": "Dividend Payable -> row 150 (via Change in Equity dividend adjustment)",
      "72": "Debtor C credit balance -> row 151 (via Sundry Debtors sheet)"
    },
    "feeds_into": "Balance Sheet!C39",
    "confidence": "high"
  },

  "3.17": {
    "title": "Income",
    "sub_blocks": {
      "revenue_from_operations": {"rows": [154, 158], "total_row": 158},
      "interest_income": {"rows": [160, 162], "total_row": 162},
      "other_income": {"rows": [164, 172], "total_row": 172}
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "88": "Sales Revenue -> row 156",
      "89": "Service Income -> row 157",
      "95": "Interest Income -> row 161",
      "96": "Commission Income -> row 165",
      "97": "Other Indirect Income -> row 166",
      "98": "Rental Income -> row 167",
      "99": "Dividend Income -> row 168",
      "100": "Gain on Disposal of Assets -> row 169",
      "101": "Insurance Claim Income -> row 170",
      "102": "Gain on FV adjustment of listed share -> row 171"
    },
    "feeds_into": {
      "revenue": "Income Statement!C7", "interest": "Income Statement!C8", "other": "Income Statement!C9"
    },
    "confidence": "high"
  },

  "3.18": {
    "title": "Material consumed expenses",
    "rows": [174, 179],
    "total_row": 179,
    "key_rows": {"opening_stock": 176, "purchases": 177, "closing_stock": 178},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "91": "Purchase -> row 177",
      "note": "Opening/Closing stock (rows 176, 178) come from Note 3.7 / Enter Details, not a direct TB pull."
    },
    "feeds_into": "Income Statement!C11",
    "confidence": "high"
  },

  "3.19": {
    "title": "Direct Expenses",
    "rows": [181, 184],
    "total_row": 184,
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "93": "Other Direct Expenses -> row 183"
    },
    "warning": "TB row 92 'Wages' sits physically under the Trial Balance 'Direct Expenses' header but is EXCLUDED from this note -- it is rerouted entirely into Note 3.20 (row 188). Confirmed by arithmetic: this note's total (100,000) excludes Wages; Note 3.20's 'Wages and salaries' total (1,000,000) = TB row104 Salaries&Wages (500,000) + TB row92 Wages (500,000).",
    "feeds_into": "Income Statement!C12",
    "confidence": "high"
  },

  "3.20": {
    "title": "Employee Benefit expenses",
    "rows": [186, 204],
    "total_row": 194,
    "secondary_block": {"title": "Key management personnel compensation", "rows": [196, 204], "total_row": 204, "note": "disclosure-only, does not feed Income Statement"},
    "key_rows": {
      "wages_and_salaries": 188, "short_term_non_monetary": 189,
      "defined_contribution_pension": 190, "defined_benefit_pension": 191,
      "other_long_term_benefits": 192, "other_expenses": 193
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "104": "Salaries & Wages -> row 188 (combined with row 92)",
      "92": "Wages (from Direct Expenses TB section) -> row 188 (combined with row 104) -- confirmed cross-section merge, see Note 3.19 warning",
      "105": "Allowances -> row 189",
      "106": "PF / SSF / CIT -> row 190",
      "108": "Leave Encashment -> row 192",
      "109": "Other employee related expenses -> row 193"
    },
    "feeds_into": "Income Statement!C13",
    "confidence": "high on totals; the row92+row104 merge is the single most structurally unusual link in the whole sheet -- worth explicit unit-testing in code."
  },

  "3.21": {
    "title": "Impairment Expenses",
    "rows": [206, 210],
    "total_row": 210,
    "key_rows": {"unlisted_shares": 208, "trade_receivables": 209},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "115": "Impairment on Unlisted Shares -> row 208",
      "114": "Impairment on Receivables -> row 209"
    },
    "feeds_into": "Income Statement!C16",
    "confidence": "high"
  },

  "3.22": {
    "title": "Administrative & Other Expenses",
    "rows": [212, 233],
    "total_row": 233,
    "key_rows": {
      "bank_charges": 214, "repair_and_maintenance": 215, "audit_fees": 216,
      "advertisement": 217, "fuel": 218, "lease_rentals": 219,
      "insurance": 226, "misc": 227, "printing_stationery": 228,
      "refreshment": 229, "travel": 230, "water_electricity": 231
    },
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "111": "Bank Charges -> row 214",
      "117,118,119,120,121": "Pool A+B+C+D+E (10,000+5,000+25,000+10,000+1,000=51,000) -> row 215 Repair and maintenance",
      "124": "Audit Fee -> row 216",
      "125": "Advertisement & Business Promotion -> row 217",
      "126": "Fuel Expenses -> row 218",
      "127": "House Rent -> row 219 (labeled 'Lease Rentals')",
      "135": "Insurance Premium -> row 226",
      "136": "Miscellaneous expenses -> row 227",
      "137": "Printing & Stationery -> row 228",
      "138": "Refreshment Expenses -> row 229",
      "139": "Travelling -> row 230",
      "140": "Water & Electricity Charges -> row 231"
    },
    "feeds_into": "Income Statement!C17",
    "confidence": "high"
  },

  "3.23": {
    "title": "Tax Expenses (Recognized in the Income Statement)",
    "rows": [235, 239],
    "total_row": 239,
    "key_rows": {"tax_on_profits": 237, "prior_period_adjustment": 238},
    "current_year_col": "E",
    "prev_year_col": "F",
    "feeds_from_tb_rows": {
      "122": "Income Tax Expense -> row 237 (ultimately sourced from Tax Calculation sheet)"
    },
    "feeds_into": "Income Statement!C22",
    "confidence": "high"
  }
};
