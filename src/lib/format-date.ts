const HONG_KONG_TIME_ZONE = "Asia/Hong_Kong";

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
