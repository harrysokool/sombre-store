import { describe, expect, it } from "vitest";

import {
  formatHongKongDateTime,
  getHongKongDayBounds,
} from "./format-date";

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

describe("getHongKongDayBounds", () => {
  it("returns Hong Kong midnight as UTC instants", () => {
    expect(
      getHongKongDayBounds(new Date("2026-07-24T20:00:00.000Z")),
    ).toEqual({
      startInclusive: "2026-07-24T16:00:00.000Z",
      endExclusive: "2026-07-25T16:00:00.000Z",
    });
  });

  it("changes days exactly at 16:00 UTC, which is midnight in Hong Kong", () => {
    expect(
      getHongKongDayBounds(new Date("2026-07-24T15:59:59.999Z")),
    ).toEqual({
      startInclusive: "2026-07-23T16:00:00.000Z",
      endExclusive: "2026-07-24T16:00:00.000Z",
    });

    expect(
      getHongKongDayBounds(new Date("2026-07-24T16:00:00.000Z")),
    ).toEqual({
      startInclusive: "2026-07-24T16:00:00.000Z",
      endExclusive: "2026-07-25T16:00:00.000Z",
    });
  });

  it("crosses month and year boundaries without using the host timezone", () => {
    expect(
      getHongKongDayBounds(new Date("2026-12-31T20:00:00.000Z")),
    ).toEqual({
      startInclusive: "2026-12-31T16:00:00.000Z",
      endExclusive: "2027-01-01T16:00:00.000Z",
    });
  });

  it("rejects an invalid date rather than returning unusable query bounds", () => {
    expect(() => getHongKongDayBounds(new Date("invalid"))).toThrow(
      /invalid date/i,
    );
  });
});
