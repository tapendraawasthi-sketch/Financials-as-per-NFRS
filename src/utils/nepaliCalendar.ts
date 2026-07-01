// ===== src/utils/nepaliCalendar.ts =====
// Utility functions for Nepal Bikram Sambat (BS) calendar operations.
// Used throughout the NFRS system for partial-year depreciation calculations,
// tax depreciation time-apportionment, and BS date display.
//
// Nepal fiscal year: 1 Shrawan (month 1) to 31/32 Ashadh (month 12).
// All months are numbered relative to the fiscal year start:
//   1=Shrawan, 2=Bhadra, 3=Aswin, 4=Kartik, 5=Mangsir, 6=Poush,
//   7=Magh, 8=Falgun, 9=Chaitra, 10=Baisakh, 11=Jestha, 12=Ashadh

import { getFiscalYear } from '../data/fiscalYears';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** English month name → 0-based index (for JS Date parsing) */
const AD_MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** BS month name (lower-case) → BS month number (1–12, fiscal order) */
const BS_MONTH_NUMBER: Record<string, number> = {
  shrawan: 1,
  bhadra: 2,
  aswin: 3,
  kartik: 4,
  mangsir: 5,
  poush: 6,
  magh: 7,
  falgun: 8,
  chaitra: 9,
  baisakh: 10,
  jestha: 11,
  ashadh: 12,
};

/** BS month number → canonical English name */
const BS_MONTH_NAMES: Record<number, string> = {
  1: 'Shrawan',
  2: 'Bhadra',
  3: 'Aswin',
  4: 'Kartik',
  5: 'Mangsir',
  6: 'Poush',
  7: 'Magh',
  8: 'Falgun',
  9: 'Chaitra',
  10: 'Baisakh',
  11: 'Jestha',
  12: 'Ashadh',
};

/**
 * Approximate day counts for each BS month.
 * Chaitra is 30 days in a normal year, 31 in a leap year.
 * Ashadh is 31 days normally, 32 in a leap year.
 * These are used only to compute cumulative day offsets within a year —
 * the AD anchor dates from the fiscal year table are the authoritative boundaries.
 */
const BS_MONTH_DAYS_NORMAL: Record<number, number> = {
  1: 31,  // Shrawan
  2: 32,  // Bhadra
  3: 31,  // Aswin
  4: 30,  // Kartik
  5: 30,  // Mangsir
  6: 30,  // Poush
  7: 30,  // Magh
  8: 30,  // Falgun
  9: 30,  // Chaitra (31 in leap year)
  10: 31, // Baisakh
  11: 32, // Jestha
  12: 31, // Ashadh (32 in leap year)
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Parses an AD date string in the format "Month DD, YYYY" or "Month D, YYYY"
 * (as stored in FISCAL_YEARS) into a JS Date (local midnight).
 */
function parseAdDateString(adDateStr: string): Date | null {
  // Expected format: "July 16, 2024"
  const parts = adDateStr.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const month = AD_MONTH_MAP[parts[0].toLowerCase()];
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day);
}

/**
 * Returns the cumulative day offset (0-based) of the START of a given
 * BS month within the fiscal year, using approximate month lengths.
 * Month 1 (Shrawan) starts at offset 0.
 * isLeapYear affects Chaitra (month 9) and Ashadh (month 12).
 */
function cumulativeDaysBefore(bsMonth: number, isLeapYear: boolean): number {
  let total = 0;
  for (let m = 1; m < bsMonth; m++) {
    let days = BS_MONTH_DAYS_NORMAL[m] ?? 30;
    if (m === 9 && isLeapYear) days = 31;  // Chaitra in leap year
    if (m === 12 && isLeapYear) days = 32; // Ashadh in leap year
    total += days;
  }
  return total;
}

/**
 * Converts a BS date (month number 1–12, day, year BS) to an approximate
 * AD Date by computing the day offset from the fiscal year start AD date.
 *
 * This is an approximation valid for depreciation purposes (±1 day
 * acceptable for rounding to days-held calculations).
 */
function bsDateToApproxAD(
  bsDay: number,
  bsMonth: number,
  bsYearOfFY: string,
  fyStartAD: Date,
  isLeapYear: boolean,
): Date {
  // Day offset from 1 Shrawan = first day of the fiscal year
  const offsetDays = cumulativeDaysBefore(bsMonth, isLeapYear) + (bsDay - 1);
  const result = new Date(fyStartAD.getTime());
  result.setDate(result.getDate() + offsetDays);
  return result;
}

/** Returns the number of whole days between two JS Dates (end - start). */
function daysBetween(start: Date, end: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// 1. parseBSDateString
// ---------------------------------------------------------------------------

/**
 * Parses a BS date string such as "15 Poush 2079" into its numeric parts.
 * Month is returned as 1–12 in fiscal order (1 = Shrawan).
 * Returns null if the string cannot be parsed.
 *
 * @example parseBSDateString("15 Poush 2079")  // → { day: 15, month: 6, year: 2079 }
 * @example parseBSDateString("1 Shrawan 2081") // → { day: 1,  month: 1, year: 2081 }
 */
export function parseBSDateString(
  dateStr: string,
): { day: number; month: number; year: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  // Accept formats: "15 Poush 2079", "15-Poush-2079", "15/Poush/2079"
  const parts = trimmed.split(/[\s\-\/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const monthName = parts[1].toLowerCase();
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(year) || day < 1 || day > 32) return null;

  const month = BS_MONTH_NUMBER[monthName];
  if (month === undefined) return null;

  return { day, month, year };
}

// ---------------------------------------------------------------------------
// 2. formatBSDate
// ---------------------------------------------------------------------------

/**
 * Returns a formatted BS date string.
 * @example formatBSDate(1, 1, 2081) → "1 Shrawan 2081"
 * @example formatBSDate(15, 6, 2079) → "15 Poush 2079"
 */
export function formatBSDate(day: number, month: number, year: number): string {
  const monthName = BS_MONTH_NAMES[month];
  if (!monthName) {
    throw new RangeError(`formatBSDate: month must be 1–12, got ${month}`);
  }
  return `${day} ${monthName} ${year}`;
}

// ---------------------------------------------------------------------------
// 3. getDaysInFiscalYear
// ---------------------------------------------------------------------------

/**
 * Returns the total number of days in the given fiscal year (365 or 366).
 * Determined from the AD start and end dates in the fiscal year lookup table.
 * Falls back to 365 if the fiscal year is not found.
 *
 * @example getDaysInFiscalYear('2082/83') // → 366 (leap year)
 * @example getDaysInFiscalYear('2081/82') // → 365
 */
export function getDaysInFiscalYear(fiscalYear: string): number {
  const fy = getFiscalYear(fiscalYear);
  if (!fy) return 365;

  const startAD = parseAdDateString(fy.startDateAD);
  const endAD = parseAdDateString(fy.endDateAD);
  if (!startAD || !endAD) return fy.isLeapYear ? 366 : 365;

  // +1 because both start and end are inclusive in the fiscal year
  const diff = daysBetween(startAD, endAD) + 1;
  // Sanity clamp: should be 365 or 366
  return diff === 366 ? 366 : 365;
}

// ---------------------------------------------------------------------------
// 4. bsToAdDays
// ---------------------------------------------------------------------------

/**
 * Converts a BS date string (e.g. "15 Poush 2079") to the number of days
 * REMAINING in the fiscal year from (and including) that date.
 *
 * This is used for SLM partial-year depreciation:
 *   depreciationForYear = (cost − residual) / usefulLife × (daysRemaining / daysInYear)
 *
 * Returns 0 if the date is before the fiscal year start.
 * Returns the total days in the fiscal year if the date is at or before 1 Shrawan.
 * Returns 1 if the date falls on the last day of the fiscal year.
 *
 * @param bsDateStr   BS date string, e.g. "15 Poush 2079"
 * @param fiscalYear  Fiscal year string, e.g. "2079/80"
 */
export function bsToAdDays(bsDateStr: string, fiscalYear: string): number {
  const fy = getFiscalYear(fiscalYear);
  if (!fy) return 0;

  const parsed = parseBSDateString(bsDateStr);
  if (!parsed) return 0;

  const fyStartAD = parseAdDateString(fy.startDateAD);
  const fyEndAD = parseAdDateString(fy.endDateAD);
  if (!fyStartAD || !fyEndAD) return 0;

  const totalDays = daysBetween(fyStartAD, fyEndAD) + 1; // inclusive

  // Convert the BS date to an approximate AD date using the FY start as anchor
  // The BS year of the purchase might span two AD years; we determine which
  // half of the BS year we are in by the month number:
  //   Months 1-9 (Shrawan–Chaitra): same BS year as the FY start BS year
  //   Months 10-12 (Baisakh–Ashadh): next BS year (but same AD year end)
  // The fiscal year lookup already gives us the AD anchor, so we compute
  // cumulative offsets from 1 Shrawan of the FY start BS year.

  // Determine fiscal year's BS start year from the startDateBS
  const fyBSYearMatch = fy.startDateBS.match(/(\d{4})$/);
  const fyBSYear = fyBSYearMatch ? parseInt(fyBSYearMatch[1], 10) : 0;

  // If purchase BS year does not fall in the fiscal year's span, clamp.
  // FY spans from BS year X (Shrawan) to BS year X+1 (Ashadh).
  const purchaseBSYear = parsed.year;
  const isInFiscalYear =
    (purchaseBSYear === fyBSYear && parsed.month >= 1 && parsed.month <= 12) ||
    (purchaseBSYear === fyBSYear + 1 && parsed.month >= 10 && parsed.month <= 12);

  if (!isInFiscalYear) {
    // Before fiscal year start
    if (purchaseBSYear < fyBSYear) return totalDays;
    // After fiscal year end
    if (purchaseBSYear > fyBSYear + 1) return 0;
    // Same BS start year but month < 1 is impossible; same end year but month > 12 impossible
    return totalDays;
  }

  // Compute approximate AD purchase date
  const purchaseAD = bsDateToApproxAD(
    parsed.day,
    parsed.month,
    fiscalYear,
    fyStartAD,
    fy.isLeapYear,
  );

  // Days remaining = from purchase date to fiscal year end (inclusive of purchase day)
  if (purchaseAD < fyStartAD) return totalDays;
  if (purchaseAD > fyEndAD) return 0;

  return daysBetween(purchaseAD, fyEndAD) + 1;
}

// ---------------------------------------------------------------------------
// 5. getDepreciationFraction
// ---------------------------------------------------------------------------

/**
 * Returns the fraction of the fiscal year for which an asset purchased on
 * `purchaseDateBS` was held, as a number between 0.0 and 1.0.
 *
 * Used for pro-rata SLM depreciation:
 *   depn = (cost − residual) / usefulLife × getDepreciationFraction(...)
 *
 * @example getDepreciationFraction('1 Shrawan 2081', '2081/82')  // → 1.0
 * @example getDepreciationFraction('1 Magh 2081', '2081/82')     // → ~0.5
 */
export function getDepreciationFraction(
  purchaseDateBS: string,
  fiscalYear: string,
): number {
  const totalDays = getDaysInFiscalYear(fiscalYear);
  if (totalDays === 0) return 0;

  const daysHeld = bsToAdDays(purchaseDateBS, fiscalYear);
  const fraction = daysHeld / totalDays;
  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, fraction));
}

// ---------------------------------------------------------------------------
// 6. getTaxDepreciationProportion
// ---------------------------------------------------------------------------

/**
 * Returns the Nepal Income Tax Act 2058 (Schedule 2, Section 19)
 * time-apportionment factor for tax depreciation based on the BS month
 * of purchase:
 *
 *   Shrawan–Poush  (months 1–6): 100 % → return 1.0
 *   Magh–Chaitra   (months 7–9): 2/3  → return 0.667
 *   Baisakh–Ashadh (months 10–12): 1/3 → return 0.333
 *
 * Returns 1.0 if the date cannot be parsed (conservative / safe default).
 */
export function getTaxDepreciationProportion(
  purchaseDateBS: string,
): 1.0 | 0.667 | 0.333 {
  const parsed = parseBSDateString(purchaseDateBS);
  if (!parsed) return 1.0;

  const { month } = parsed;

  if (month >= 1 && month <= 6) return 1.0;
  if (month >= 7 && month <= 9) return 0.667;
  return 0.333; // months 10–12
}
