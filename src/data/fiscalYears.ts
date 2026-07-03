// Complete Bikram Sambat ↔ Gregorian calendar conversion table for FY 2078/79
// through 2089/90, matching the "Workings" sheet in MEs_Financials_Format.xlsx.
// Each fiscal year runs 1 Shrawan → 31/32 Ashadh (mid-July to mid-July).

export interface FiscalYearEntry {
  bsFY: string;           // '2081/82'
  bsYear: number;         // 2082 (end year)
  startBS: string;        // '1 Shrawan 2081'
  endBS: string;          // '31 Ashadh 2082'
  startAD: Date;          // JS Date for 16 July 2024
  endAD: Date;            // JS Date for 15 July 2025
  startExcelSerial: number; // Excel date serial (days since 1 Jan 1900)
  endExcelSerial: number;
  reportingDateBS: string;  // '31 Ashadh 2082'
  reportingDateAD: string;  // '15 July 2025'
  previousReportingDateBS: string;
  previousReportingDateAD: string;
  // Legacy aliases used by existing UI/excelWriter
  startDateBS?: string;
  endDateBS?: string;
  startDateAD?: string;
  endDateAD?: string;
  startYear?: number;
  endYear?: number;
  isLeapYear?: boolean;
}

const AD_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Convert Excel serial (1900 date system) to JavaScript Date (UTC midnight). */
export function excelSerialToAD(serial: number): Date {
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400000);
}

function formatADDate(d: Date): string {
  return `${d.getUTCDate()} ${AD_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function endYearFromFY(bsFY: string): number {
  const parts = bsFY.split('/');
  return parseInt(parts[1] ?? '0', 10) + 2000;
}

function startYearFromFY(bsFY: string): number {
  const parts = bsFY.split('/');
  return parseInt(parts[0] ?? '0', 10);
}

function buildEntry(
  bsFY: string,
  startSerial: number,
  endSerial: number,
  endBS: string,
  prevEndBS: string,
): FiscalYearEntry {
  const startAD = excelSerialToAD(startSerial);
  const endAD = excelSerialToAD(endSerial);
  const prevEndAD = excelSerialToAD(endSerial - 365); // approximate; overridden below for chain

  return {
    bsFY,
    bsYear: endYearFromFY(bsFY),
    startBS: `1 Shrawan ${startYearFromFY(bsFY)}`,
    endBS,
    startAD,
    endAD,
    startExcelSerial: startSerial,
    endExcelSerial: endSerial,
    reportingDateBS: endBS,
    reportingDateAD: formatADDate(endAD),
    previousReportingDateBS: prevEndBS,
    previousReportingDateAD: formatADDate(prevEndAD),
    // Legacy aliases
    startDateBS: `1 Shrawan ${startYearFromFY(bsFY)}`,
    endDateBS: endBS,
    startDateAD: formatADDate(startAD),
    endDateAD: formatADDate(endAD),
    startYear: startAD.getUTCFullYear(),
    endYear: endAD.getUTCFullYear(),
    isLeapYear: endBS.startsWith('32'),
  };
}

// Hardcoded serials from MEs_Financials_Format.xlsx Workings sheet
const FY_SERIALS: Array<{ bsFY: string; start: number; end: number; endBS: string }> = [
  { bsFY: '2078/79', start: 44393, end: 44758, endBS: '31 Ashadh 2079' },
  { bsFY: '2079/80', start: 44759, end: 45123, endBS: '31 Ashadh 2080' },
  { bsFY: '2080/81', start: 45124, end: 45488, endBS: '31 Ashadh 2081' },
  { bsFY: '2081/82', start: 45489, end: 45853, endBS: '31 Ashadh 2082' },
  { bsFY: '2082/83', start: 45854, end: 46219, endBS: '32 Ashadh 2083' },
  { bsFY: '2083/84', start: 46220, end: 46584, endBS: '31 Ashadh 2084' },
  { bsFY: '2084/85', start: 46585, end: 46980, endBS: '31 Ashadh 2085' },
  { bsFY: '2085/86', start: 46981, end: 47314, endBS: '32 Ashadh 2086' },
  { bsFY: '2086/87', start: 47315, end: 47680, endBS: '31 Ashadh 2087' },
  { bsFY: '2087/88', start: 47681, end: 48046, endBS: '31 Ashadh 2088' },
  { bsFY: '2088/89', start: 48047, end: 48411, endBS: '32 Ashadh 2089' },
  { bsFY: '2089/90', start: 48412, end: 48776, endBS: '31 Ashadh 2090' },
];

export const FISCAL_YEARS: FiscalYearEntry[] = FY_SERIALS.map((fy, i) => {
  const prevEndBS = i > 0 ? FY_SERIALS[i - 1].endBS : '31 Ashadh 2078';
  const entry = buildEntry(fy.bsFY, fy.start, fy.end, fy.endBS, prevEndBS);
  if (i > 0) {
    const prevEndAD = excelSerialToAD(FY_SERIALS[i - 1].end);
    entry.previousReportingDateAD = formatADDate(prevEndAD);
  }
  return entry;
});

export function getFiscalYear(bsFY: string): FiscalYearEntry | undefined {
  return FISCAL_YEARS.find((fy) => fy.bsFY === bsFY);
}

export function getCurrentFiscalYear(): FiscalYearEntry {
  const today = new Date();
  for (let i = FISCAL_YEARS.length - 1; i >= 0; i--) {
    if (FISCAL_YEARS[i].endAD < today) {
      return FISCAL_YEARS[i];
    }
  }
  return FISCAL_YEARS[FISCAL_YEARS.length - 1];
}

/** Approximate AD → BS string using fiscal year lookup (e.g. '15 July 2025' → '31 Ashadh 2082'). */
export function adDateToBS(adDate: Date | string): string {
  const d = typeof adDate === 'string' ? new Date(adDate) : adDate;
  const time = d.getTime();

  for (const fy of FISCAL_YEARS) {
    if (time >= fy.startAD.getTime() && time <= fy.endAD.getTime()) {
      // Within this fiscal year — map proximity to end date
      const daysToEnd = (fy.endAD.getTime() - time) / 86400000;
      if (daysToEnd <= 45) {
        return fy.reportingDateBS;
      }
      // Mid-year: approximate BS month from position in FY
      const totalDays = (fy.endAD.getTime() - fy.startAD.getTime()) / 86400000;
      const elapsed = totalDays - daysToEnd;
      const bsMonths = ['Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush',
        'Magh', 'Falgun', 'Chaitra', 'Baisakh', 'Jestha', 'Ashadh'];
      const monthIdx = Math.min(11, Math.floor((elapsed / totalDays) * 12));
      const startYear = startYearFromFY(fy.bsFY);
      const bsYear = monthIdx < 9 ? startYear : startYear + 1;
      const day = Math.max(1, Math.min(32, Math.round((elapsed % (totalDays / 12)) / (totalDays / 12) * 30) + 1));
      return `${day} ${bsMonths[monthIdx]} ${bsYear}`;
    }
  }

  const last = FISCAL_YEARS[FISCAL_YEARS.length - 1];
  return last.reportingDateBS;
}

// Legacy aliases for existing UI code
export type FiscalYear = FiscalYearEntry;
export function getFiscalYearOptions(): { value: string; label: string }[] {
  return FISCAL_YEARS.map((fy) => ({
    value: fy.bsFY,
    label: `${fy.bsFY}  (${formatADDate(fy.startAD)} – ${formatADDate(fy.endAD)})`,
  }));
}

export function bsMonthName(monthNumber: number): string {
  const months: Record<number, string> = {
    1: 'Shrawan', 2: 'Bhadra', 3: 'Aswin', 4: 'Kartik', 5: 'Mangsir', 6: 'Poush',
    7: 'Magh', 8: 'Falgun', 9: 'Chaitra', 10: 'Baisakh', 11: 'Jestha', 12: 'Ashadh',
  };
  const name = months[monthNumber];
  if (!name) throw new RangeError(`bsMonthName: monthNumber must be 1–12, got ${monthNumber}`);
  return name;
}
