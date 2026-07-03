// src/utils/nepaliCalendar.ts
// Bikram Sambat ↔ Gregorian conversion utilities for Nepal fiscal year handling.

// BS month days for years 2070–2090 (official government data)
// Each entry: [Baishakh, Jestha, Ashadh, Shrawan, Bhadra, Aswin, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra]
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2073: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2074: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2075: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2080: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2086: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2089: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
};

// Nepali months in calendar order (Baishakh = month 1 in civil calendar)
const NEPALI_MONTHS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Aswin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

// Fiscal year months (Shrawan = month 1 of fiscal year = month 4 of civil year)
const FISCAL_MONTHS = [
  'Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baishakh', 'Jestha', 'Ashadh',
];

// Reference point: 1 Baishakh 2070 BS = April 14, 2013 AD
const BS_REF_YEAR = 2070;
const AD_REF_DATE = new Date(2013, 3, 14); // April 14, 2013

/**
 * Get BS month name from 1-based month index (civil calendar).
 * Month 1 = Baishakh, Month 12 = Chaitra
 */
export function getBSMonthName(month: number): string {
  if (month < 1 || month > 12) return '';
  return NEPALI_MONTHS[month - 1];
}

/**
 * Get fiscal month name from 1-based fiscal month index.
 * Fiscal month 1 = Shrawan, Fiscal month 12 = Ashadh
 */
export function getFiscalMonthName(fiscalMonth: number): string {
  if (fiscalMonth < 1 || fiscalMonth > 12) return '';
  return FISCAL_MONTHS[fiscalMonth - 1];
}

/**
 * Get total days in a BS year.
 */
export function getTotalDaysInBSYear(bsYear: number): number {
  const months = BS_CALENDAR_DATA[bsYear];
  if (!months) return 365;
  return months.reduce((sum, d) => sum + d, 0);
}

/**
 * Get days in a specific BS month (1-based, civil calendar order).
 */
export function getDaysInBSMonth(bsYear: number, bsMonth: number): number {
  const months = BS_CALENDAR_DATA[bsYear];
  if (!months || bsMonth < 1 || bsMonth > 12) return 30;
  return months[bsMonth - 1];
}

/**
 * Convert BS date to AD date.
 */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): Date {
  if (!BS_CALENDAR_DATA[bsYear]) {
    // Approximate conversion: BS year ≈ AD year - 56.7
    const approxYear = bsYear - 57;
    return new Date(approxYear, bsMonth + 2, bsDay); // rough
  }

  // Count total days from reference point
  let totalDays = 0;

  // Add days for complete years between ref and target
  if (bsYear > BS_REF_YEAR) {
    for (let y = BS_REF_YEAR; y < bsYear; y++) {
      totalDays += getTotalDaysInBSYear(y);
    }
  } else if (bsYear < BS_REF_YEAR) {
    for (let y = bsYear; y < BS_REF_YEAR; y++) {
      totalDays -= getTotalDaysInBSYear(y);
    }
  }

  // Add days for complete months in target year
  const months = BS_CALENDAR_DATA[bsYear];
  if (months) {
    for (let m = 0; m < bsMonth - 1; m++) {
      totalDays += months[m];
    }
  }

  // Add remaining days
  totalDays += bsDay - 1;

  const result = new Date(AD_REF_DATE);
  result.setDate(result.getDate() + totalDays);
  return result;
}

/**
 * Convert AD date to BS date.
 */
export function adToBS(adDate: Date): { year: number; month: number; day: number } {
  // Calculate total days from reference
  const diffTime = adDate.getTime() - AD_REF_DATE.getTime();
  let remainingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let bsYear = BS_REF_YEAR;
  let bsMonth = 1;
  let bsDay = 1;

  if (remainingDays >= 0) {
    // Forward from reference
    while (remainingDays > 0) {
      const yearDays = getTotalDaysInBSYear(bsYear);
      if (remainingDays >= yearDays) {
        remainingDays -= yearDays;
        bsYear++;
      } else {
        break;
      }
    }

    const months = BS_CALENDAR_DATA[bsYear];
    if (months) {
      for (let m = 0; m < 12; m++) {
        if (remainingDays >= months[m]) {
          remainingDays -= months[m];
          bsMonth++;
        } else {
          break;
        }
      }
    }
    bsDay = remainingDays + 1;
  } else {
    // Backward from reference (rare case)
    remainingDays = Math.abs(remainingDays);
    bsYear--;
    while (remainingDays > 0) {
      const yearDays = getTotalDaysInBSYear(bsYear);
      if (remainingDays > yearDays) {
        remainingDays -= yearDays;
        bsYear--;
      } else {
        break;
      }
    }
    const months = BS_CALENDAR_DATA[bsYear];
    if (months) {
      bsMonth = 12;
      for (let m = 11; m >= 0; m--) {
        if (remainingDays >= months[m]) {
          remainingDays -= months[m];
          bsMonth--;
        } else {
          break;
        }
      }
      bsDay = months[bsMonth - 1] - remainingDays;
    }
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

/**
 * Format a BS date to human-readable string: "15 Shrawan 2081"
 */
export function formatBSDate(year: number, month: number, day: number): string {
  return `${day} ${getBSMonthName(month)} ${year}`;
}

/**
 * Format an AD date to long format: "July 15, 2025"
 */
export function formatADDate(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Parse a BS date string like "15 Shrawan 2081" or "1 Shrawan 2081"
 */
export function parseBSDateString(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[\s\-\/]+/);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const monthName = parts[1].toLowerCase().trim();
  const year = parseInt(parts[2], 10);

  const monthIndex = NEPALI_MONTHS.findIndex(m => m.toLowerCase() === monthName);
  if (monthIndex === -1 || isNaN(day) || isNaN(year)) return null;

  return { year, month: monthIndex + 1, day };
}

/**
 * Get the AD start date of a Nepal fiscal year.
 * "2081/82" → the AD date of 1 Shrawan 2081
 */
export function getFYStartAD(bsYear: string): Date {
  const startYear = parseInt(bsYear.split('/')[0], 10);
  // Shrawan = civil month 4
  return bsToAd(startYear, 4, 1);
}

/**
 * Get the AD end date of a Nepal fiscal year.
 * "2081/82" → the AD date of last day of Ashadh 2082
 */
export function getFYEndAD(bsYear: string): Date {
  const endYear = parseInt(bsYear.split('/')[0], 10) + 1;
  // Ashadh = civil month 3
  const ashadhDays = getDaysInBSMonth(endYear, 3);
  return bsToAd(endYear, 3, ashadhDays);
}

/**
 * Get BS format start date: "1 Shrawan 2081"
 */
export function getFYStartBS(bsYear: string): string {
  const startYear = parseInt(bsYear.split('/')[0], 10);
  return `1 Shrawan ${startYear}`;
}

/**
 * Get BS format end date: "31 Ashadh 2082"
 */
export function getFYEndBS(bsYear: string): string {
  const endYear = parseInt(bsYear.split('/')[0], 10) + 1;
  const ashadhDays = getDaysInBSMonth(endYear, 3);
  return `${ashadhDays} Ashadh ${endYear}`;
}

/**
 * Get the fiscal month number (1-based) from a civil BS month.
 * Shrawan (civil 4) = fiscal 1, Ashadh (civil 3) = fiscal 12
 */
export function civilToFiscalMonth(civilMonth: number): number {
  // Civil: Baishakh=1 ... Chaitra=12
  // Fiscal: Shrawan=1 (civil 4) ... Ashadh=12 (civil 3)
  if (civilMonth >= 4) return civilMonth - 3;
  return civilMonth + 9;
}

/**
 * Count days between two BS dates within the same fiscal year.
 */
export function daysBetweenBS(
  y1: number, m1: number, d1: number,
  y2: number, m2: number, d2: number,
): number {
  const ad1 = bsToAd(y1, m1, d1);
  const ad2 = bsToAd(y2, m2, d2);
  return Math.floor((ad2.getTime() - ad1.getTime()) / (1000 * 60 * 60 * 24));
}
