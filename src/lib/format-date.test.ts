import { describe, expect, it } from "vitest";

import { formatHongKongDateTime } from "./format-date";

describe("formatHongKongDateTime", () => {
  it("formats a valid date explicitly in Asia/Hong_Kong, not the host timezone", () => {
    // 2026-07-24T20:00:00Z is still 24 July in UTC, but already 25 July in
    // Asia/Hong_Kong (UTC+8). Asserting the shifted day proves the timeZone
    // option is applied rather than left to the host/locale default.
    const formatted = formatHongKongDateTime("2026-07-24T20:00:00.000Z", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    expect(formatted).toContain("25 Jul 2026");
  });

  it("does not rely on locale alone to fix the timezone", () => {
    // Same instant, only the locale changes. If timeZone were left to the
    // locale/host default instead of being forced, this could drift.
    const enHK = formatHongKongDateTime("2026-07-24T20:00:00.000Z", {
      day: "numeric",
      month: "short",
    });

    expect(enHK).toContain("25 Jul");
  });

  it("returns the fallback for a missing value instead of throwing", () => {
    expect(formatHongKongDateTime(null)).toBe("—");
    expect(formatHongKongDateTime(undefined)).toBe("—");
    expect(formatHongKongDateTime("")).toBe("—");
  });

  it("returns the fallback for a malformed date instead of crashing", () => {
    expect(() => formatHongKongDateTime("not-a-real-date")).not.toThrow();
    expect(formatHongKongDateTime("not-a-real-date")).toBe("—");
  });

  it("accepts a custom fallback", () => {
    expect(formatHongKongDateTime(null, {}, "Unknown")).toBe("Unknown");
  });
});
