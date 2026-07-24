const DECIMAL_PATTERN = /^\d+(?:\.(\d{1,2}))?$/;
const CENTS_PER_HKD = BigInt(100);
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

function toSafeNonNegativeInteger(value: bigint, label: string) {
  if (value < BigInt(0) || value > MAX_SAFE_INTEGER) {
    throw new RangeError(`${label} exceeds the supported integer range.`);
  }

  return Number(value);
}

export function assertSafeNonNegativeInteger(
  value: unknown,
  label = "Value",
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

export function addSafeNonNegativeIntegers(
  values: readonly number[],
  label = "Integer sum",
) {
  const total = values.reduce((sum, value) => {
    assertSafeNonNegativeInteger(value, label);
    return sum + BigInt(value);
  }, BigInt(0));

  return toSafeNonNegativeInteger(total, label);
}

export function multiplySafeNonNegativeIntegers(
  multiplicand: number,
  multiplier: number,
  label = "Integer product",
) {
  assertSafeNonNegativeInteger(multiplicand, label);
  assertSafeNonNegativeInteger(multiplier, label);

  return toSafeNonNegativeInteger(
    BigInt(multiplicand) * BigInt(multiplier),
    label,
  );
}

export function parseHkdDecimalToCents(value: string) {
  if (typeof value !== "string") {
    throw new TypeError("HKD amount must be a decimal string.");
  }

  const match = DECIMAL_PATTERN.exec(value);

  if (!match) {
    throw new RangeError("HKD amount must have at most two decimal places.");
  }

  const [wholePart, fractionalPart = ""] = value.split(".");
  const cents =
    BigInt(wholePart) * CENTS_PER_HKD +
    BigInt(fractionalPart.padEnd(2, "0") || "0");

  return toSafeNonNegativeInteger(cents, "HKD amount");
}

export function formatHkdCentsForDatabase(cents: number) {
  assertSafeNonNegativeInteger(cents, "HKD cents");

  const value = BigInt(cents);
  const wholePart = value / CENTS_PER_HKD;
  const fractionalPart = String(value % CENTS_PER_HKD).padStart(2, "0");

  return `${wholePart}.${fractionalPart}`;
}

export function parsePercentageToBasisPoints(value: string) {
  if (typeof value !== "string") {
    throw new TypeError("Discount percentage must be a decimal string.");
  }

  const match = DECIMAL_PATTERN.exec(value);

  if (!match) {
    throw new RangeError(
      "Discount percentage must have at most two decimal places.",
    );
  }

  const [wholePart, fractionalPart = ""] = value.split(".");
  const basisPoints =
    BigInt(wholePart) * CENTS_PER_HKD +
    BigInt(fractionalPart.padEnd(2, "0") || "0");

  if (basisPoints <= BigInt(0) || basisPoints > BigInt(10_000)) {
    throw new RangeError(
      "Discount percentage must be greater than 0 and at most 100.",
    );
  }

  return Number(basisPoints);
}
