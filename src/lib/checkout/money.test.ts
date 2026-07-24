import { describe, expect, it } from "vitest";

import {
  addSafeNonNegativeIntegers,
  assertSafeNonNegativeInteger,
  formatHkdCentsForDatabase,
  multiplySafeNonNegativeIntegers,
  parseHkdDecimalToCents,
  parsePercentageToBasisPoints,
} from "./money";

describe("parseHkdDecimalToCents", () => {
  it.each([
    ["0", 0],
    ["10", 1_000],
    ["10.5", 1_050],
    ["10.50", 1_050],
    ["1280.00", 128_000],
  ])("parses %s as %i cents", (value, expected) => {
    expect(parseHkdDecimalToCents(value)).toBe(expected);
  });

  it.each([
    "-1",
    "1e2",
    "10.001",
    "",
    "NaN",
    "Infinity",
    "HKD 10",
    "10 HKD",
    " 10.00",
    "10.00 ",
    ".50",
    "10.",
  ])("rejects invalid money text %j", (value) => {
    expect(() => parseHkdDecimalToCents(value)).toThrow();
  });

  it("rejects an amount whose cents exceed the safe integer range", () => {
    expect(() =>
      parseHkdDecimalToCents("90071992547409.92"),
    ).toThrowError(/supported integer range/i);
  });
});

describe("formatHkdCentsForDatabase", () => {
  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [1_050, "10.50"],
    [128_000, "1280.00"],
    [Number.MAX_SAFE_INTEGER, "90071992547409.91"],
  ])("formats %i cents as %s", (value, expected) => {
    expect(formatHkdCentsForDatabase(value)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid cents %j",
    (value) => {
      expect(() => formatHkdCentsForDatabase(value)).toThrow();
    },
  );

  it("rejects unsafe cents", () => {
    expect(() =>
      formatHkdCentsForDatabase(Number.MAX_SAFE_INTEGER + 1),
    ).toThrowError(/safe integer/i);
  });
});

describe("parsePercentageToBasisPoints", () => {
  it.each([
    ["5", 500],
    ["5.25", 525],
    ["20.00", 2_000],
    ["100", 10_000],
  ])("parses %s percent as %i basis points", (value, expected) => {
    expect(parsePercentageToBasisPoints(value)).toBe(expected);
  });

  it.each([
    "0",
    "0.00",
    "-1",
    "100.01",
    "101",
    "5.001",
    "1e2",
    "",
    "NaN",
    "Infinity",
    " 5",
    "5 ",
  ])("rejects invalid percentage text %j", (value) => {
    expect(() => parsePercentageToBasisPoints(value)).toThrow();
  });
});

describe("safe integer arithmetic", () => {
  it.each([0, 1, Number.MAX_SAFE_INTEGER])(
    "accepts non-negative safe integer %i",
    (value) => {
      expect(() => assertSafeNonNegativeInteger(value)).not.toThrow();
    },
  );

  it.each([
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects unsafe or invalid integer %j", (value) => {
    expect(() => assertSafeNonNegativeInteger(value)).toThrow();
  });

  it("adds using an exact checked intermediate", () => {
    expect(addSafeNonNegativeIntegers([1, 2, 3])).toBe(6);
  });

  it("rejects addition overflow", () => {
    expect(() =>
      addSafeNonNegativeIntegers([Number.MAX_SAFE_INTEGER, 1]),
    ).toThrowError(/supported integer range/i);
  });

  it("multiplies using an exact checked intermediate", () => {
    expect(multiplySafeNonNegativeIntegers(128_000, 10)).toBe(1_280_000);
  });

  it("rejects multiplication overflow", () => {
    expect(() =>
      multiplySafeNonNegativeIntegers(Number.MAX_SAFE_INTEGER, 2),
    ).toThrowError(/supported integer range/i);
  });
});
