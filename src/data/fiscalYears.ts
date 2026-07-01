// ===== src/data/fiscalYears.ts =====
// Lookup table mapping Nepal Bikram Sambat (BS) fiscal years to their
// Gregorian (AD) calendar equivalents, plus utility functions for
// date display and selection UIs.
//
// Nepal's fiscal year runs from 1 Shrawan to 31/32 Ashadh of the
// following BS year (roughly mid-July to mid-July AD).
//
// Source: Official Nepal Rastra Bank and GoN gazette notifications.

// ---------------------------------------------------------------------------
// FiscalYear — shape of one entry in the lookup table
// ---------------------------------------------------------------------------
export interface FiscalYear {
  /** Fiscal year in BS format, e.g. "2081/82" */
  bsYear: string;
  /** BS start date, always "1 Shrawan YYYY" */
  startDateBS: string;
  /** BS end date, "31 Ashadh YYYY" or "32 Ashadh YYYY" for leap years */
  endDateBS: string;
  /** AD start date in long format, e.g. "July 16, 2024" */
  startDateAD: string;
  /** AD end date in long format, e.g. "July 15, 2025" */
  endDateAD: string;
  /** AD calendar year in which 1 Shrawan falls */
  startYear: number;
  /** AD calendar year in which 31/32 Ashadh falls */
  endYear: number;
  /**
   * True if Chaitra has 31 days in this BS year (leap year) — affects
   * Ashadh end date and certain pro-rata depreciation calculations.
   */
  isLeapYear: boolean;
}

// ---------------------------------------------------------------------------
// FISCAL_YEARS — the complete lookup table (2072/73 to 2090/91)
// ---------------------------------------------------------------------------
export const FISCAL_YEARS: FiscalYear[] = [
  {
    bsYear: '2072/73',
    startDateBS: '1 Shrawan 2072',
    endDateBS: '31 Ashadh 2073',
    startDateAD: 'July 17, 2015',
    endDateAD: 'July 15, 2016',
    startYear: 2015,
    endYear: 2016,
    isLeapYear: false,
  },
  {
    bsYear: '2073/74',
    startDateBS: '1 Shrawan 2073',
    endDateBS: '32 Ashadh 2074',
    startDateAD: 'July 16, 2016',
    endDateAD: 'July 16, 2017',
    startYear: 2016,
    endYear: 2017,
    isLeapYear: true,
  },
  {
    bsYear: '2074/75',
    startDateBS: '1 Shrawan 2074',
    endDateBS: '31 Ashadh 2075',
    startDateAD: 'July 17, 2017',
    endDateAD: 'July 15, 2018',
    startYear: 2017,
    endYear: 2018,
    isLeapYear: false,
  },
  {
    bsYear: '2075/76',
    startDateBS: '1 Shrawan 2075',
    endDateBS: '31 Ashadh 2076',
    startDateAD: 'July 16, 2018',
    endDateAD: 'July 15, 2019',
    startYear: 2018,
    endYear: 2019,
    isLeapYear: false,
  },
  {
    bsYear: '2076/77',
    startDateBS: '1 Shrawan 2076',
    endDateBS: '32 Ashadh 2077',
    startDateAD: 'July 16, 2019',
    endDateAD: 'July 15, 2020',
    startYear: 2019,
    endYear: 2020,
    isLeapYear: true,
  },
  {
    bsYear: '2077/78',
    startDateBS: '1 Shrawan 2077',
    endDateBS: '31 Ashadh 2078',
    startDateAD: 'July 16, 2020',
    endDateAD: 'July 15, 2021',
    startYear: 2020,
    endYear: 2021,
    isLeapYear: false,
  },
  {
    bsYear: '2078/79',
    startDateBS: '1 Shrawan 2078',
    endDateBS: '31 Ashadh 2079',
    startDateAD: 'July 16, 2021',
    endDateAD: 'July 15, 2022',
    startYear: 2021,
    endYear: 2022,
    isLeapYear: false,
  },
  {
    bsYear: '2079/80',
    startDateBS: '1 Shrawan 2079',
    endDateBS: '31 Ashadh 2080',
    startDateAD: 'July 17, 2022',
    endDateAD: 'July 15, 2023',
    startYear: 2022,
    endYear: 2023,
    isLeapYear: false,
  },
  {
    bsYear: '2080/81',
    startDateBS: '1 Shrawan 2080',
    endDateBS: '31 Ashadh 2081',
    startDateAD: 'July 16, 2023',
    endDateAD: 'July 15, 2024',
    startYear: 2023,
    endYear: 2024,
    isLeapYear: false,
  },
  {
    bsYear: '2081/82',
    startDateBS: '1 Shrawan 2081',
    endDateBS: '31 Ashadh 2082',
    startDateAD: 'July 16, 2024',
    endDateAD: 'July 15, 2025',
    startYear: 2024,
    endYear: 2025,
    isLeapYear: false,
  },
  {
    bsYear: '2082/83',
    startDateBS: '1 Shrawan 2082',
    endDateBS: '32 Ashadh 2083',
    startDateAD: 'July 16, 2025',
    endDateAD: 'July 16, 2026',
    startYear: 2025,
    endYear: 2026,
    isLeapYear: true,
  },
  {
    bsYear: '2083/84',
    startDateBS: '1 Shrawan 2083',
    endDateBS: '31 Ashadh 2084',
    startDateAD: 'July 17, 2026',
    endDateAD: 'July 15, 2027',
    startYear: 2026,
    endYear: 2027,
    isLeapYear: false,
  },
  {
    bsYear: '2084/85',
    startDateBS: '1 Shrawan 2084',
    endDateBS: '31 Ashadh 2085',
    startDateAD: 'July 16, 2027',
    endDateAD: 'July 15, 2028',
    startYear: 2027,
    endYear: 2028,
    isLeapYear: false,
  },
  {
    bsYear: '2085/86',
    startDateBS: '1 Shrawan 2085',
    endDateBS: '32 Ashadh 2086',
    startDateAD: 'July 15, 2028',
    endDateAD: 'July 15, 2029',
    startYear: 2028,
    endYear: 2029,
    isLeapYear: true,
  },
  {
    bsYear: '2086/87',
    startDateBS: '1 Shrawan 2086',
    endDateBS: '31 Ashadh 2087',
    startDateAD: 'July 16, 2029',
    endDateAD: 'July 15, 2030',
    startYear: 2029,
    endYear: 2030,
    isLeapYear: false,
  },
  {
    bsYear: '2087/88',
    startDateBS: '1 Shrawan 2087',
    endDateBS: '31 Ashadh 2088',
    startDateAD: 'July 16, 2030',
    endDateAD: 'July 15, 2031',
    startYear: 2030,
    endYear: 2031,
    isLeapYear: false,
  },
  {
    bsYear: '2088/89',
    startDateBS: '1 Shrawan 2088',
    endDateBS: '32 Ashadh 2089',
    startDateAD: 'July 17, 2031',
    endDateAD: 'July 16, 2032',
    startYear: 2031,
    endYear: 2032,
    isLeapYear: true,
  },
  {
    bsYear: '2089/90',
    startDateBS: '1 Shrawan 2089',
    endDateBS: '31 Ashadh 2090',
    startDateAD: 'July 16, 2032',
    endDateAD: 'July 15, 2033',
    startYear: 2032,
    endYear: 2033,
    isLeapYear: false,
  },
  {
    bsYear: '2090/91',
    startDateBS: '1 Shrawan 2090',
    endDateBS: '31 Ashadh 2091',
    startDateAD: 'July 16, 2033',
    endDateAD: 'July 15, 2034',
    startYear: 2033,
    endYear: 2034,
    isLeapYear: false,
  },
];

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Look up a fiscal year entry by its BS year string.
 * Returns undefined if the year is not in the table.
 *
 * @example getFiscalYear('2081/82')  // → { bsYear: '2081/82', … }
 */
export function getFiscalYear(bsYear: string): FiscalYear | undefined {
  return FISCAL_YEARS.find((fy) => fy.bsYear === bsYear);
}

/**
 * Returns an array of { value, label } objects suitable for use in a
 * React <select> dropdown. The label shows both BS and AD date ranges.
 *
 * @example
 * getFiscalYearOptions()
 * // → [
 * //     { value: '2072/73', label: '2072/73  (July 17, 2015 – July 15, 2016)' },
 * //     …
 * //   ]
 */
export function getFiscalYearOptions(): { value: string; label: string }[] {
  return FISCAL_YEARS.map((fy) => ({
    value: fy.bsYear,
    label: `${fy.bsYear}  (${fy.startDateAD} – ${fy.endDateAD})`,
  }));
}

/**
 * Returns the most recent COMPLETED fiscal year.
 *
 * "Completed" means the AD end date is before today's date.
 * Falls back to the last entry in the table when no system clock is
 * available (e.g. in a test environment with a mocked date).
 */
export function getCurrentFiscalYear(): FiscalYear | undefined {
  const today = new Date();

  // Walk the list in reverse; find the last year whose AD end date has passed.
  for (let i = FISCAL_YEARS.length - 1; i >= 0; i--) {
    const fy = FISCAL_YEARS[i];
    // Parse the AD end date. Format: "Month DD, YYYY"
    const endDate = new Date(fy.endDateAD);
    if (!isNaN(endDate.getTime()) && endDate < today) {
      return fy;
    }
  }

  // Fallback: return the last entry (future-proofing for deployment in Nepal)
  return FISCAL_YEARS[FISCAL_YEARS.length - 1];
}

/**
 * Returns the Nepali month name in English for a given month number (1–12).
 * Month 1 is Shrawan (start of the Nepal fiscal year).
 *
 * @throws RangeError if monthNumber is outside 1–12
 *
 * @example bsMonthName(1)  // → "Shrawan"
 * @example bsMonthName(12) // → "Ashadh"
 */
export function bsMonthName(monthNumber: number): string {
  const months: Record<number, string> = {
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
  const name = months[monthNumber];
  if (name === undefined) {
    throw new RangeError(
      `bsMonthName: monthNumber must be between 1 and 12, got ${monthNumber}`
    );
  }
  return name;
}
