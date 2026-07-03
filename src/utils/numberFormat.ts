// src/utils/numberFormat.ts

/**
 * Format a number in Indian/Nepali numbering system (lakh/crore).
 * e.g., 1234567 → "12,34,567"
 */
export function formatNPR(n: number): string {
  if (n === 0) return '0';
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const str = intPart.toString();

  if (str.length <= 3) {
    return (isNeg ? '-' : '') + str;
  }

  let result = str.slice(-3);
  let remaining = str.slice(0, -3);

  while (remaining.length > 0) {
    const chunk = remaining.slice(-2);
    result = chunk + ',' + result;
    remaining = remaining.slice(0, -2);
  }

  if (result.startsWith(',')) {
    result = result.slice(1);
  }

  return (isNeg ? '-' : '') + result;
}

/**
 * Format amount for financial statements with brackets for negatives.
 */
export function formatAmount(n: number | undefined | null, roundingLevel: number = 1): string {
  if (n === undefined || n === null || n === 0) return '—';
  const rounded = Math.round(n / roundingLevel) * roundingLevel;
  if (rounded === 0) return '—';
  const abs = Math.abs(rounded);
  const formatted = formatNPR(abs);
  return rounded < 0 ? `(${formatted})` : formatted;
}

/**
 * Format as percentage string.
 */
export function formatPercent(n: number, decimals: number = 2): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

/**
 * Parse a formatted Indian number string back to a number.
 */
export function parseFormattedNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/[()]/g, '')
    .replace(/NPR/gi, '')
    .replace(/Rs\.?/gi, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Safe rounding to avoid floating point issues.
 */
export function safeRound(n: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/** Alias for formatNPR used in subledger views. */
export function formatNPRSimple(n: number): string {
  return formatNPR(n);
}
