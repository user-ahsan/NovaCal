// ─── ISO-8601 Timestamp Validation ───
// Rule: All API timestamps use ISO-8601 format with timezone (Z or ±HH:MM)

const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export class InvalidTimestampError extends Error {
  constructor(value: string, reason: string) {
    super(`Invalid timestamp "${value}": ${reason}`);
    this.name = "InvalidTimestampError";
  }
}

/**
 * Parses and validates an ISO-8601 timestamp string.
 * Throws InvalidTimestampError if the value is not valid ISO-8601.
 */
export function parseISODate(value: string): Date {
  if (!ISO_8601_REGEX.test(value)) {
    throw new InvalidTimestampError(
      value,
      "must match ISO-8601 format (e.g. 2026-05-10T09:00:00Z)",
    );
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidTimestampError(value, "not a valid date");
  }

  return date;
}

/**
 * Validates that startTime is before endTime.
 */
export function validateTimeRange(start: Date, end: Date): void {
  if (start >= end) {
    throw new InvalidTimestampError(
      start.toISOString(),
      "startTime must be before endTime",
    );
  }
}
