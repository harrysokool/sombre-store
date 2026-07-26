export const HONG_KONG_TIME_ZONE = "Asia/Hong_Kong";

const HONG_KONG_UTC_OFFSET = "+08:00";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const hongKongDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HONG_KONG_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type HongKongDayBounds = {
  startInclusive: string;
  endExclusive: string;
};

/**
 * Returns the UTC instants that bound the calendar day containing `now` in
 * Hong Kong.
 *
 * Hong Kong has used UTC+8 without daylight-saving transitions since 1979.
 * Constructing the local midnight with an explicit offset keeps the result
 * independent of the server's own timezone. The exclusive upper bound also
 * makes adjacent-day database queries meet without overlapping.
 */
export function getHongKongDayBounds(
  now: Date = new Date(),
): HongKongDayBounds {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("Cannot calculate Hong Kong bounds for an invalid date.");
  }

  const parts = hongKongDatePartsFormatter.formatToParts(now);
  const year = parts.find(({ type }) => type === "year")?.value;
  const month = parts.find(({ type }) => type === "month")?.value;
  const day = parts.find(({ type }) => type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("Could not determine the Hong Kong calendar date.");
  }

  const startMilliseconds = Date.parse(
    `${year}-${month}-${day}T00:00:00${HONG_KONG_UTC_OFFSET}`,
  );

  if (!Number.isFinite(startMilliseconds)) {
    throw new RangeError("Could not calculate Hong Kong midnight.");
  }

  return {
    startInclusive: new Date(startMilliseconds).toISOString(),
    endExclusive: new Date(
      startMilliseconds + MILLISECONDS_PER_DAY,
    ).toISOString(),
  };
}

// Locale (e.g. "en-HK") only controls wording and field order, not timezone —
// so Asia/Hong_Kong is always forced here rather than left to the caller.
export function formatHongKongDateTime(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  fallback = "—",
): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString("en-HK", {
    ...options,
    timeZone: HONG_KONG_TIME_ZONE,
  });
}
