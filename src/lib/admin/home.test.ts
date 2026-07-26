import { describe, expect, it } from "vitest";

import {
  ADMIN_HOME_RECENT_LIMIT,
  calculateAdminHomeRevenueCents,
  selectRecentAdminHomeFailures,
  type AdminHomeRecentFailure,
  type AdminHomeRevenueOrder,
} from "./home";

function revenueOrder(
  id: string,
  overrides: Partial<AdminHomeRevenueOrder> = {},
): AdminHomeRevenueOrder {
  return {
    id,
    total: "100.00",
    ...overrides,
  };
}

function failure(
  id: string,
  occurredAt: string,
  source: AdminHomeRecentFailure["source"] = "webhook",
): AdminHomeRecentFailure {
  return {
    source,
    id,
    orderId: null,
    title: source === "webhook" ? "checkout.session.completed" : "seller_email",
    status: "failed",
    occurredAt,
  };
}

describe("Admin Home revenue", () => {
  it("adds filtered order totals exactly in cents", () => {
    expect(
      calculateAdminHomeRevenueCents([
        revenueOrder("paid", { total: "0.10" }),
        revenueOrder("free", { total: "0.20" }),
        revenueOrder("number", { total: 12.34 }),
      ]),
    ).toBe(1_264);
  });

  it("conservatively excludes every order with a linked refund failure", () => {
    expect(
      calculateAdminHomeRevenueCents(
        [
          revenueOrder("normal", { total: "50.00" }),
          revenueOrder("partial-refund", { total: "80.00" }),
        ],
        new Set(["partial-refund"]),
      ),
    ).toBe(5_000);
  });

  it("rejects malformed included money instead of silently under-reporting", () => {
    expect(() =>
      calculateAdminHomeRevenueCents([
        revenueOrder("malformed", { total: "12.345" }),
      ]),
    ).toThrow(/two decimal places/i);
  });
});

describe("Admin Home recent failures", () => {
  it("sorts both sources newest first and caps the combined list at five", () => {
    const failures = [
      failure("one", "2026-07-24T00:00:00.000Z"),
      failure("six", "2026-07-24T05:00:00.000Z", "email"),
      failure("three", "2026-07-24T02:00:00.000Z"),
      failure("five", "2026-07-24T04:00:00.000Z"),
      failure("two", "2026-07-24T01:00:00.000Z", "email"),
      failure("four", "2026-07-24T03:00:00.000Z"),
    ];

    expect(selectRecentAdminHomeFailures(failures).map(({ id }) => id)).toEqual(
      ["six", "five", "four", "three", "two"],
    );
    expect(selectRecentAdminHomeFailures(failures)).toHaveLength(
      ADMIN_HOME_RECENT_LIMIT,
    );
    expect(failures.map(({ id }) => id)).toEqual([
      "one",
      "six",
      "three",
      "five",
      "two",
      "four",
    ]);
  });

  it("puts malformed timestamps last and accepts an explicit zero limit", () => {
    expect(
      selectRecentAdminHomeFailures([
        failure("invalid", "not-a-date"),
        failure("valid", "2026-07-24T00:00:00.000Z"),
      ]).map(({ id }) => id),
    ).toEqual(["valid", "invalid"]);
    expect(selectRecentAdminHomeFailures([failure("one", "invalid")], 0)).toEqual(
      [],
    );
  });
});
