import { describe, expect, it } from "vitest";

import {
  renderCustomerOrderConfirmation,
  type OrderEmailItem,
  type OrderEmailOrder,
} from "./templates";

function order(
  overrides: Partial<OrderEmailOrder> = {},
): OrderEmailOrder {
  return {
    id: "order-123",
    created_at: "2026-07-24T12:00:00.000Z",
    customer_email: "customer@example.com",
    customer_name: "Sombre Customer",
    customer_phone: null,
    address_line_1: "1 Fragrance Road",
    address_line_2: null,
    district: "Central",
    city: "Hong Kong",
    postal_code: null,
    country: "Hong Kong",
    coupon_code: "HAPPY2026",
    original_subtotal: "3500.00",
    discount_total: "426.25",
    subtotal: "3073.75",
    shipping_fee: "50.00",
    total: "3123.75",
    ...overrides,
  };
}

function item(
  overrides: Partial<OrderEmailItem> = {},
): OrderEmailItem {
  return {
    product_name: "Product A",
    size_label: "100 mL",
    unit_price: "800.00",
    original_unit_price: "1000.00",
    discount_percent: "20.00",
    quantity: 2,
    original_line_total: "2000.00",
    discount_amount: "400.00",
    discounted_line_total: "1600.00",
    ...overrides,
  };
}

function mixedItems(): OrderEmailItem[] {
  return [
    item(),
    item({
      product_name: "Product B",
      unit_price: "473.75",
      original_unit_price: "500.00",
      discount_percent: "5.25",
      quantity: 1,
      original_line_total: "500.00",
      discount_amount: "26.25",
      discounted_line_total: "473.75",
    }),
    item({
      product_name: "Product C",
      unit_price: "1000.00",
      original_unit_price: "1000.00",
      discount_percent: "0.00",
      quantity: 1,
      original_line_total: "1000.00",
      discount_amount: "0.00",
      discounted_line_total: "1000.00",
    }),
  ];
}

describe("order confirmation email discount snapshots", () => {
  it("renders saved coupon totals and mixed product percentages", () => {
    const rendered = renderCustomerOrderConfirmation(order(), mixedItems());

    expect(rendered.text).toContain("Original subtotal: HK$3,500.00");
    expect(rendered.text).toContain("Coupon: HAPPY2026");
    expect(rendered.text).toContain("Discount: −HK$426.25");
    expect(rendered.text).toContain(
      "Discounted subtotal: HK$3,073.75",
    );
    expect(rendered.text).toContain("Shipping: HK$50.00");
    expect(rendered.text).toContain("Total paid: HK$3,123.75");
    expect(rendered.text).toContain("Discount: 20%");
    expect(rendered.text).toContain("Discount: 5.25%");
    expect(rendered.text).toContain(
      "Product C (100 mL) x1 — HK$1,000.00",
    );
    expect(rendered.html).toContain("HAPPY2026");
  });

  it("renders a free discounted item while retaining paid shipping", () => {
    const rendered = renderCustomerOrderConfirmation(
      order({
        original_subtotal: "1000.00",
        discount_total: "1000.00",
        subtotal: "0.00",
        shipping_fee: "50.00",
        total: "50.00",
      }),
      [
        item({
          unit_price: "0.00",
          discount_percent: "100.00",
          quantity: 1,
          original_line_total: "1000.00",
          discount_amount: "1000.00",
          discounted_line_total: "0.00",
        }),
      ],
    );

    expect(rendered.text).toContain("Discount: 100%");
    expect(rendered.text).toContain("Final unit: HK$0.00");
    expect(rendered.text).toContain("Shipping: HK$50.00");
    expect(rendered.text).toContain("Total paid: HK$50.00");
  });

  it("keeps no-coupon and null legacy orders on the original presentation", () => {
    const rendered = renderCustomerOrderConfirmation(
      order({
        coupon_code: null,
        original_subtotal: null,
        discount_total: null,
        subtotal: "1000.00",
        total: "1050.00",
      }),
      [
        item({
          unit_price: "1000.00",
          original_unit_price: null,
          discount_percent: null,
          quantity: 1,
          original_line_total: null,
          discount_amount: null,
          discounted_line_total: null,
        }),
      ],
    );

    expect(rendered.text).toContain("Subtotal: HK$1,000.00");
    expect(rendered.text).toContain("Shipping: HK$50.00");
    expect(rendered.text).toContain("Total: HK$1,050.00");
    expect(rendered.text).not.toContain("Coupon:");
    expect(rendered.text).not.toContain("Original subtotal:");
    expect(rendered.html).not.toContain(">Coupon<");
  });

  it("is unchanged when unrelated current coupon configuration changes", () => {
    const savedOrder = order();
    const savedItems = mixedItems();
    let currentCouponConfiguration = {
      code: "HAPPY2026",
      active: true,
      productADiscount: 20,
    };
    const before = renderCustomerOrderConfirmation(
      savedOrder,
      savedItems,
    );

    currentCouponConfiguration = {
      code: "HAPPY2026",
      active: false,
      productADiscount: 0,
    };
    const after = renderCustomerOrderConfirmation(savedOrder, savedItems);

    expect(currentCouponConfiguration.active).toBe(false);
    expect(after).toEqual(before);
  });
});
