import { describe, expect, it } from "vitest";

import {
  MAX_ROTATION_INTERVAL_SECONDS,
  MIN_ROTATION_INTERVAL_SECONDS,
  parseRotationIntervalSeconds,
  validateAnnouncementSettingsSubmission,
} from "./announcement-settings-rules";

describe("rotation interval bounds", () => {
  it("matches the range the database constraint enforces", () => {
    // announcement_settings_rotation_interval_range_check is
    // `between 3 and 60`. If that ever moves, this pair must move with it.
    expect(MIN_ROTATION_INTERVAL_SECONDS).toBe(3);
    expect(MAX_ROTATION_INTERVAL_SECONDS).toBe(60);
  });
});

describe("parseRotationIntervalSeconds", () => {
  it.each([
    ["the minimum", 3],
    ["the maximum", 60],
    ["a mid-range value", 10],
  ])("accepts %s", (_name, seconds) => {
    expect(parseRotationIntervalSeconds(seconds)).toEqual({
      ok: true,
      value: seconds,
    });
    // Form data arrives as a string, so both spellings must agree.
    expect(parseRotationIntervalSeconds(String(seconds))).toEqual({
      ok: true,
      value: seconds,
    });
  });

  it.each([2, 0, -1, 61, 3600])("rejects %s as out of range", (seconds) => {
    const result = parseRotationIntervalSeconds(seconds);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(
      "between 3 and 60 seconds",
    );
  });

  it.each([3.5, 10.01, "10.5", "3.0"])(
    "rejects the decimal value %s",
    (seconds) => {
      const result = parseRotationIntervalSeconds(seconds);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain("whole number");
    },
  );

  it.each([
    ["an empty string", ""],
    ["whitespace", "   "],
    ["a missing value", null],
    ["undefined", undefined],
    ["letters", "ten"],
    ["a boolean", true],
    ["an object", {}],
  ])("rejects %s", (_name, value) => {
    expect(parseRotationIntervalSeconds(value).ok).toBe(false);
  });

  it.each([
    ["exponent notation", "1e1"],
    ["hexadecimal", "0x0a"],
    ["a leading plus", "+10"],
    ["a negative", "-5"],
    ["infinity", Number.POSITIVE_INFINITY],
    ["not a number", Number.NaN],
  ])("rejects %s that Number() would otherwise coerce", (_name, value) => {
    expect(parseRotationIntervalSeconds(value).ok).toBe(false);
  });

  it("tolerates surrounding whitespace on an otherwise valid value", () => {
    expect(parseRotationIntervalSeconds(" 15 ")).toEqual({
      ok: true,
      value: 15,
    });
  });
});

describe("validateAnnouncementSettingsSubmission", () => {
  it("returns the parsed interval alongside the toggle", () => {
    expect(
      validateAnnouncementSettingsSubmission({
        isEnabled: true,
        rotationIntervalSeconds: "12",
      }),
    ).toEqual({
      ok: true,
      value: { isEnabled: true, rotationIntervalSeconds: 12 },
    });
  });

  it("keeps a disabled banner disabled", () => {
    const result = validateAnnouncementSettingsSubmission({
      isEnabled: false,
      rotationIntervalSeconds: 10,
    });

    expect(result.ok === true && result.value.isEnabled).toBe(false);
  });

  it("refuses the whole submission when the interval is invalid", () => {
    const result = validateAnnouncementSettingsSubmission({
      isEnabled: true,
      rotationIntervalSeconds: "61",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(
      "between 3 and 60 seconds",
    );
  });
});
