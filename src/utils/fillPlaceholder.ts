/**
 * When a value is missing, return a bracketed hint for the user to complete
 * in the downloaded workbook, e.g. "(Fill PAN)".
 */
export function fillPlaceholder(label: string, value?: string | number | null): string {
  if (value === null || value === undefined) return `(Fill ${label})`;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return `(Fill ${label})`;
    return String(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return `(Fill ${label})`;
  return trimmed;
}

/** Like fillPlaceholder but keeps numeric zero as a valid entered value. */
export function fillNumericPlaceholder(label: string, value?: number | null): string | number {
  if (value === null || value === undefined || Number.isNaN(value)) return `(Fill ${label})`;
  return value;
}
