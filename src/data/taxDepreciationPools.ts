/** Nepal Income Tax Act 2058 Schedule 2 pool definitions (shared UI + server reference). */
export const ITA_TAX_DEPRECIATION_POOLS = [
  { pool: 'A', rate: 0.05, label: 'Pool A (5%) – Buildings / Structures' },
  { pool: 'B', rate: 0.25, label: 'Pool B (25%) – Computers / Intangibles' },
  { pool: 'C', rate: 0.25, label: 'Pool C (25%) – Office Equipment / Furniture' },
  { pool: 'D', rate: 0.20, label: 'Pool D (20%) – Vehicles' },
  { pool: 'E', rate: 0.15, label: 'Pool E (15%) – Plant & Machinery' },
] as const;
