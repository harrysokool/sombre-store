import { describe, expect, it } from "vitest";

import {
  getDiscountedOrderDisplay,
  getDiscountedOrderItemDisplay,
  type SavedOrderDiscountFields,
  type SavedOrderItemDiscountFields,
} from "./discount-snapshots";

function discountedOrder(
  overrides: Partial<SavedOrderDiscountFields> = {},
): SavedOrderDiscountFields {
  return {
    coupon_code: "HAPPY2026",
    original_subtotal: "3500.00",
    discount_total: "478.75",
    subtotal: "3021.25",
    shipping_fee: "50.00",
    total: "3071.25",
    ...overrides,
  };
}

function discountedItem(
  overrides: Partial<SavedOrderItemDiscountFields> = {},
): SavedOrderItemDiscountFields {
  return {
    original_unit_price: "1000.00",
    discount_percent: "20.00",
    unit_price: "800.00",
    quantity: 2,
    original_line_total: "2000.00",
    discount_amount: "400.00",
    discounted_line_total: "1600.00",
    ...overrides,
  };
}

describe("saved order discount displays", () => {
  it("accepts an exactly reconciled saved order snapshot", () => {
    expect(getDiscountedOrderDisplay(discountedOrder())).toEqual({
      couponCode: "HAPPY2026",
      originalSubtotal: "3500.00",
      discountTotal: "478.75",
      discountedSubtotal: "3021.25",
      shipping: "50.00",
      total: "3071.25",
    });
  });

  it("does not label no-coupon or null legacy snapshots as discounted", () => {
    expect(
      getDiscountedOrderDisplay(
        discountedOrder({
          coupon_code: null,
          original_subtotal: "3021.25",
          discount_total: "0.00",
        }),
      ),
    ).toBeNull();
    expect(
      getDiscountedOrderDisplay(
        discountedOrder({
          coupon_code: null,
          original_subtotal: null,
          discount_total: null,
        }),
      ),
    ).toBeNull();
  });

  it.each([
    { discount_total: "478.74" },
    { subtotal: "3021.24" },
    { shipping_fee: "49.99" },
    { total: "3071.24" },
  ])("rejects inconsistent order totals: %o", (overrides) => {
    expect(
      getDiscountedOrderDisplay(discountedOrder(overrides)),
    ).toBeNull();
  });

  it("accepts per-unit half-up rounding and quantity reconciliation", () => {
    expect(
      getDiscountedOrderItemDisplay(
        discountedItem({
          original_unit_price: "10.01",
          discount_percent: "50.00",
          unit_price: "5.00",
          quantity: 2,
          original_line_total: "20.02",
          discount_amount: "10.02",
          discounted_line_total: "10.00",
        }),
      ),
    ).toEqual({
      originalUnitPrice: "10.01",
      discountPercent: "50%",
      finalUnitPrice: "5.00",
      originalLineTotal: "20.02",
      lineDiscount: "10.02",
      finalLineTotal: "10.00",
    });
  });

  it("supports a 100 percent discounted item without affecting paid shipping", () => {
    expect(
      getDiscountedOrderItemDisplay(
        discountedItem({
          discount_percent: "100.00",
          unit_price: "0.00",
          quantity: 1,
          original_line_total: "1000.00",
          discount_amount: "1000.00",
          discounted_line_total: "0.00",
        }),
      ),
    ).toMatchObject({
      discountPercent: "100%",
      finalUnitPrice: "0.00",
      finalLineTotal: "0.00",
    });
    expect(
      getDiscountedOrderDisplay(
        discountedOrder({
          original_subtotal: "1000.00",
          discount_total: "1000.00",
          subtotal: "0.00",
          shipping_fee: "50.00",
          total: "50.00",
        }),
      ),
    ).toMatchObject({
      shipping: "50.00",
      total: "50.00",
    });
  });

  it("leaves full-price and inconsistent item snapshots in legacy presentation", () => {
    expect(
      getDiscountedOrderItemDisplay(
        discountedItem({
          original_unit_price: "1000.00",
          discount_percent: "0.00",
          unit_price: "1000.00",
          original_line_total: "2000.00",
          discount_amount: "0.00",
          discounted_line_total: "2000.00",
        }),
      ),
    ).toBeNull();
    expect(
      getDiscountedOrderItemDisplay(
        discountedItem({ discounted_line_total: "1599.99" }),
      ),
    ).toBeNull();
  });
});
