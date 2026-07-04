# Excel & Adjustment Workflow — Source of Truth

## Trial Balance columns (already exist in RawTBRow/MappedTBRow)
openingDr, openingCr, duringDr, duringCr, adjustmentDr, adjustmentCr, closingDr, closingCr
Rule: closingDr/closingCr = (openingDr+duringDr+adjustmentDr) net (openingCr+duringCr+adjustmentCr).
Positive net => closingDr, negative net => closingCr (mirrors deriveClosingBalances in tbHierarchy.ts).

## Adjusted Trial Balance (NEW concept)
"Adjusted TB" = a cloned copy of the mapped/classified TB where adjustmentDr/adjustmentCr on
each row have been populated from TWO sources, then closingDr/closingCr recomputed:
  1. System-computed adjustments: depreciation expense, staff bonus provision, income tax
     provision, dividend declaration + TDS on dividend, investment fair value gain/loss.
  2. User-uploaded manual journal entries (grouped, multi-line, see below), OR none if the
     user clicked "No adjustment entries to upload".
Every statement computation (Balance Sheet, Income Statement, Cash Flow, Notes) MUST read
from the Adjusted TB, never the raw/original mapped TB. The Excel Trial Balance sheet and
Adjustments sheet MUST also render from the Adjusted TB, so the numbers always tie out.

## Journal entry template format (must match reference "Adjustment" sheet exactly)
Columns: S.No. | Dr/Cr | Particulars | Dr. Amount | Cr. Amount | Linked to
Rules:
 - One journal entry = one or more consecutive rows sharing the same S.No. (S.No. is only
   printed on the FIRST line of the group; subsequent lines of the same entry leave S.No. blank).
 - Each row is either a Dr line or a Cr line for one ledger account, never both.
 - A group may have any number of Dr lines and any number of Cr lines (supports >2-leg entries).
 - After the last line of a group, an optional narration row may appear: S.No./Dr-Cr/Amounts
   blank, Particulars = "(Being ...)" free text.
 - A group is valid only if SUM(Dr Amount) == SUM(Cr Amount) for that S.No., tolerance NPR 1.
 - "Linked to" is informational (defaults to "Trial") and is preserved but not required from
   the user — auto-filled as "Trial" if left blank.

## Skip option
The "No adjustment entries to upload" action must fully bypass steps 2 in Adjusted TB
construction above — the Adjusted TB then equals TB + system-computed adjustments only.

## Excel sheet structure (must mirror MEs Financials Format.xlsx)
Notes 3.2 through 3.23 render into a SINGLE worksheet named "Notes 3.2 to 3.23" (not one
sheet per note). Note 3.1 (PPE) keeps its own sheet because of its wide grid. All statement
sheets pull note totals via live cross-sheet Excel formulas, never hardcoded numbers.

## Preview requirement
The in-app preview must render the ACTUAL bytes of the generated .xlsx (parsed client-side),
not a hand-built HTML approximation, so preview and downloaded file can never disagree.
