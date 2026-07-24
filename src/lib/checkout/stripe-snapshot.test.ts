import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { calculateUnitDiscountCents } from "./discounts";
import {
  buildStripeCheckoutOrderSnapshot,
  formatBasisPointsForDatabase,
  PRODUCT_DISCOUNT_QUOTE_VERSION,
} from "./stripe-snapshot";

const PRODUCT_A_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B_ID = "22222222-2222-4222-8222-222222222222";

type CouponLineOptions = {
  id?: string;
  productId?: string;
  originalUnitCents?: number;
  discountBasisPoints?: number;
  quantity?: number;
};

function stripeProduct(
  productId: string,
  metadata: Record<string, string>,
) {
  return {
    id: `prod_${productId.slice(0, 8)}`,
    object: "product",
    active: true,
    attributes: [],
    created: 0,
    default_price: null,
    description: "One Size",
    images: [],
    livemode: false,
    marketing_features: [],
    metadata: {
      product_id: productId,
      product_slug: `slug-${productId.slice(0, 4)}`,
      ...metadata,
    },
    name: `Product ${productId.slice(0, 4)}`,
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "good",
    unit_label: null,
    updated: 0,
    url: null,
  } as Stripe.Product;
}

function couponLine({
  id = "li_a",
  productId = PRODUCT_A_ID,
  originalUnitCents = 100_000,
  discountBasisPoints = 2_000,
  quantity = 1,
}: CouponLineOptions = {}) {
  const unitDiscountCents = calculateUnitDiscountCents(
    originalUnitCents,
    discountBasisPoints,
  );
  const discountedUnitCents =
    originalUnitCents - unitDiscountCents;
  const lineTotalCents = discountedUnitCents * quantity;

  return {
    id,
    object: "item",
    amount_discount: 0,
    amount_subtotal: lineTotalCents,
    amount_tax: 0,
    amount_total: lineTotalCents,
    currency: "hkd",
    description: `Product ${productId.slice(0, 4)}`,
    discounts: [],
    price: {
      id: `price_${id}`,
      object: "price",
      active: true,
      billing_scheme: "per_unit",
      created: 0,
      currency: "hkd",
      custom_unit_amount: null,
      livemode: false,
      lookup_key: null,
      metadata: {},
      nickname: null,
      product: stripeProduct(productId, {
        original_unit_minor: String(originalUnitCents),
        discount_basis_points: String(discountBasisPoints),
        unit_discount_minor: String(unitDiscountCents),
        discounted_unit_minor: String(discountedUnitCents),
      }),
      recurring: null,
      tax_behavior: "unspecified",
      tiers_mode: null,
      transform_quantity: null,
      type: "one_time",
      unit_amount: discountedUnitCents,
      unit_amount_decimal: String(discountedUnitCents),
    },
    quantity,
    taxes: [],
  } as unknown as Stripe.LineItem;
}

function noCouponLine({
  id = "li_a",
  productId = PRODUCT_A_ID,
  unitAmountCents = 100_000,
  quantity = 1,
}: {
  id?: string;
  productId?: string;
  unitAmountCents?: number;
  quantity?: number;
} = {}) {
  const lineTotalCents = unitAmountCents * quantity;

  return {
    ...couponLine({
      id,
      productId,
      originalUnitCents: unitAmountCents,
      discountBasisPoints: 0,
      quantity,
    }),
    amount_subtotal: lineTotalCents,
    amount_total: lineTotalCents,
    price: {
      ...couponLine({
        id,
        productId,
        originalUnitCents: unitAmountCents,
        discountBasisPoints: 0,
        quantity,
      }).price,
      product: stripeProduct(productId, {}),
      unit_amount: unitAmountCents,
      unit_amount_decimal: String(unitAmountCents),
    },
  } as unknown as Stripe.LineItem;
}

function sumCouponLines(lines: Stripe.LineItem[]) {
  return lines.reduce(
    (totals, line) => {
      const metadata =
        typeof line.price?.product === "object" &&
        line.price.product &&
        !line.price.product.deleted
          ? line.price.product.metadata
          : {};
      const quantity = line.quantity ?? 0;

      totals.original +=
        Number(metadata.original_unit_minor) * quantity;
      totals.discount +=
        Number(metadata.unit_discount_minor) * quantity;
      totals.discounted += line.amount_subtotal;
      return totals;
    },
    { original: 0, discount: 0, discounted: 0 },
  );
}

function couponSession(
  lines: Stripe.LineItem[],
  {
    shippingCents = 5_000,
    metadata = {},
  }: {
    shippingCents?: number;
    metadata?: Record<string, string | undefined>;
  } = {},
) {
  const totals = sumCouponLines(lines);
  const sessionMetadata: Record<string, string> = {
    quote_version: PRODUCT_DISCOUNT_QUOTE_VERSION,
    coupon_code: "SOMBRE",
    original_subtotal_minor: String(totals.original),
    discount_minor: String(totals.discount),
    discounted_subtotal_minor: String(totals.discounted),
    shipping_minor: String(shippingCents),
    total_minor: String(totals.discounted + shippingCents),
  };

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) {
      delete sessionMetadata[key];
    } else {
      sessionMetadata[key] = value;
    }
  }

  return {
    id: "cs_coupon",
    object: "checkout.session",
    amount_subtotal: totals.discounted,
    amount_total: totals.discounted + shippingCents,
    currency: "hkd",
    metadata: sessionMetadata,
    payment_status: "paid",
    total_details: {
      amount_discount: 0,
      amount_shipping: shippingCents,
      amount_tax: 0,
    },
  } as Stripe.Checkout.Session;
}

function noCouponSession(
  lines: Stripe.LineItem[],
  shippingCents = 5_000,
) {
  const subtotal = lines.reduce(
    (total, line) => total + line.amount_subtotal,
    0,
  );

  return {
    id: "cs_no_coupon",
    object: "checkout.session",
    amount_subtotal: subtotal,
    amount_total: subtotal + shippingCents,
    currency: "hkd",
    metadata: {},
    payment_status: "paid",
    total_details: {
      amount_discount: 0,
      amount_shipping: shippingCents,
      amount_tax: 0,
    },
  } as Stripe.Checkout.Session;
}

function expandedProduct(line: Stripe.LineItem) {
  const product = line.price?.product;

  if (!product || typeof product === "string" || product.deleted) {
    throw new Error("Expected an expanded Stripe product.");
  }

  return product;
}

describe("buildStripeCheckoutOrderSnapshot", () => {
  it("builds truthful zero-discount snapshots for no-coupon orders", () => {
    const lines = [
      noCouponLine({ quantity: 2 }),
      noCouponLine({
        id: "li_b",
        productId: PRODUCT_B_ID,
        unitAmountCents: 50_025,
      }),
    ];

    const snapshot = buildStripeCheckoutOrderSnapshot(
      noCouponSession(lines),
      lines,
    );

    expect(snapshot).toMatchObject({
      couponCode: null,
      originalSubtotalCents: 250_025,
      discountTotalCents: 0,
      discountedSubtotalCents: 250_025,
      shippingCents: 5_000,
      totalCents: 255_025,
    });
    expect(
      snapshot.lines.map((line) => ({
        original: line.originalUnitAmountCents,
        basisPoints: line.discountBasisPoints,
        charged: line.discountedUnitAmountCents,
      })),
    ).toEqual([
      { original: 100_000, basisPoints: 0, charged: 100_000 },
      { original: 50_025, basisPoints: 0, charged: 50_025 },
    ]);
  });

  it("reconciles mixed discounts, different percentages, and quantities", () => {
    const lines = [
      couponLine({ quantity: 2, discountBasisPoints: 2_000 }),
      couponLine({
        id: "li_b",
        productId: PRODUCT_B_ID,
        originalUnitCents: 50_000,
        discountBasisPoints: 525,
        quantity: 3,
      }),
    ];

    const snapshot = buildStripeCheckoutOrderSnapshot(
      couponSession(lines),
      lines,
    );

    expect(snapshot).toMatchObject({
      couponCode: "SOMBRE",
      originalSubtotalCents: 350_000,
      discountTotalCents: 47_875,
      discountedSubtotalCents: 302_125,
      shippingCents: 5_000,
      totalCents: 307_125,
    });
    expect(
      snapshot.lines.map((line) => [
        line.quantity,
        line.discountBasisPoints,
        line.discountedUnitAmountCents,
        line.lineDiscountCents,
      ]),
    ).toEqual([
      [2, 2_000, 80_000, 40_000],
      [3, 525, 47_375, 7_875],
    ]);
  });

  it("preserves a full-price product inside a coupon snapshot", () => {
    const lines = [
      couponLine({ discountBasisPoints: 2_000 }),
      couponLine({
        id: "li_b",
        productId: PRODUCT_B_ID,
        originalUnitCents: 50_000,
        discountBasisPoints: 0,
      }),
    ];

    const snapshot = buildStripeCheckoutOrderSnapshot(
      couponSession(lines),
      lines,
    );

    expect(snapshot.lines[1]).toMatchObject({
      discountBasisPoints: 0,
      unitDiscountCents: 0,
      originalUnitAmountCents: 50_000,
      discountedUnitAmountCents: 50_000,
    });
  });

  it("verifies half-up per-unit rounding", () => {
    const lines = [
      couponLine({
        originalUnitCents: 1_001,
        discountBasisPoints: 5_000,
        quantity: 2,
      }),
    ];

    const snapshot = buildStripeCheckoutOrderSnapshot(
      couponSession(lines),
      lines,
    );

    expect(snapshot.lines[0]).toMatchObject({
      unitDiscountCents: 501,
      discountedUnitAmountCents: 500,
      lineDiscountCents: 1_002,
      discountedLineTotalCents: 1_000,
    });
  });

  it("supports a 100 percent product discount with full shipping", () => {
    const lines = [couponLine({ discountBasisPoints: 10_000 })];
    const snapshot = buildStripeCheckoutOrderSnapshot(
      couponSession(lines),
      lines,
    );

    expect(snapshot).toMatchObject({
      originalSubtotalCents: 100_000,
      discountTotalCents: 100_000,
      discountedSubtotalCents: 0,
      shippingCents: 5_000,
      totalCents: 5_000,
    });
    expect(snapshot.lines[0].discountedUnitAmountCents).toBe(0);
  });

  it.each([
    "coupon_code",
    "original_subtotal_minor",
    "discount_minor",
    "discounted_subtotal_minor",
    "shipping_minor",
    "total_minor",
  ])("rejects missing Session metadata %s", (key) => {
    const lines = [couponLine()];
    const session = couponSession(lines, {
      metadata: { [key]: undefined },
    });

    expect(() =>
      buildStripeCheckoutOrderSnapshot(session, lines),
    ).toThrow("Invalid Stripe Checkout snapshot");
  });

  it.each(["-1", "1.00", " 1", "01", "abc", "9007199254740992"])(
    "rejects malformed integer Session metadata %j",
    (value) => {
      const lines = [couponLine()];
      const session = couponSession(lines, {
        metadata: { discount_minor: value },
      });

      expect(() =>
        buildStripeCheckoutOrderSnapshot(session, lines),
      ).toThrow("Invalid Stripe Checkout snapshot");
    },
  );

  it.each([
    {
      label: "subtotal arithmetic",
      metadata: { discounted_subtotal_minor: "1" },
    },
    {
      label: "shipping arithmetic",
      metadata: { total_minor: "1" },
    },
    {
      label: "Stripe subtotal",
      mutate: (session: Stripe.Checkout.Session) => {
        session.amount_subtotal = 1;
      },
    },
    {
      label: "Stripe total",
      mutate: (session: Stripe.Checkout.Session) => {
        session.amount_total = 1;
      },
    },
    {
      label: "Stripe shipping",
      mutate: (session: Stripe.Checkout.Session) => {
        session.total_details!.amount_shipping = 1;
      },
    },
  ])("rejects inconsistent $label", ({ metadata, mutate }) => {
    const lines = [couponLine()];
    const session = couponSession(lines, { metadata });
    mutate?.(session);

    expect(() =>
      buildStripeCheckoutOrderSnapshot(session, lines),
    ).toThrow("Invalid Stripe Checkout snapshot");
  });

  it.each([
    "product_id",
    "original_unit_minor",
    "discount_basis_points",
    "unit_discount_minor",
    "discounted_unit_minor",
  ])("rejects missing coupon product metadata %s", (key) => {
    const lines = [couponLine()];
    delete expandedProduct(lines[0]).metadata[key];

    expect(() =>
      buildStripeCheckoutOrderSnapshot(couponSession(lines), lines),
    ).toThrow("Invalid Stripe Checkout snapshot");
  });

  it.each([
    {
      label: "malformed original amount",
      key: "original_unit_minor",
      value: "100.00",
    },
    {
      label: "basis points over 10000",
      key: "discount_basis_points",
      value: "10001",
    },
    {
      label: "unit arithmetic mismatch",
      key: "discounted_unit_minor",
      value: "1",
    },
    {
      label: "rounding mismatch",
      key: "unit_discount_minor",
      value: "19999",
    },
  ])("rejects $label in product metadata", ({ key, value }) => {
    const lines = [couponLine()];
    expandedProduct(lines[0]).metadata[key] = value;

    expect(() =>
      buildStripeCheckoutOrderSnapshot(couponSession(lines), lines),
    ).toThrow("Invalid Stripe Checkout snapshot");
  });

  it("rejects a Stripe unit amount that differs from product metadata", () => {
    const lines = [couponLine()];
    lines[0].price!.unit_amount = 1;

    expect(() =>
      buildStripeCheckoutOrderSnapshot(couponSession(lines), lines),
    ).toThrow("Invalid Stripe Checkout snapshot");
  });

  it("rejects Stripe line totals that differ from unit amount times quantity", () => {
    const lines = [couponLine({ quantity: 2 })];
    lines[0].amount_total -= 1;

    expect(() =>
      buildStripeCheckoutOrderSnapshot(couponSession(lines), lines),
    ).toThrow("Invalid Stripe Checkout snapshot");
  });

  it("rejects product line sums that differ from Session totals", () => {
    const lines = [couponLine()];
    const session = couponSession(lines);
    session.metadata!.original_subtotal_minor = "200000";
    session.metadata!.discount_minor = "120000";

    expect(() =>
      buildStripeCheckoutOrderSnapshot(session, lines),
    ).toThrow("product lines do not match Session coupon totals");
  });

  it("rejects duplicate Stripe line-item IDs", () => {
    const lines = [
      couponLine({ id: "li_duplicate" }),
      couponLine({
        id: "li_duplicate",
        productId: PRODUCT_B_ID,
        originalUnitCents: 50_000,
        discountBasisPoints: 1_000,
      }),
    ];

    expect(() =>
      buildStripeCheckoutOrderSnapshot(couponSession(lines), lines),
    ).toThrow("duplicate line-item IDs");
  });

  it("rejects discount metadata on a no-coupon Stripe line", () => {
    const lines = [noCouponLine()];
    expandedProduct(lines[0]).metadata.original_unit_minor = "100000";

    expect(() =>
      buildStripeCheckoutOrderSnapshot(noCouponSession(lines), lines),
    ).toThrow("product discount metadata requires quote_version");
  });

  it("rejects partial coupon metadata without the supported quote version", () => {
    const lines = [noCouponLine()];
    const session = noCouponSession(lines);
    session.metadata = { coupon_code: "SOMBRE" };

    expect(() =>
      buildStripeCheckoutOrderSnapshot(session, lines),
    ).toThrow("coupon metadata requires quote_version");
  });

  it("rejects an unknown quote version", () => {
    const lines = [noCouponLine()];
    const session = noCouponSession(lines);
    session.metadata = { quote_version: "future-version" };

    expect(() =>
      buildStripeCheckoutOrderSnapshot(session, lines),
    ).toThrow("unsupported quote_version");
  });
});

describe("formatBasisPointsForDatabase", () => {
  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [525, "5.25"],
    [2_000, "20.00"],
    [10_000, "100.00"],
  ])("formats %i basis points as %s", (basisPoints, expected) => {
    expect(formatBasisPointsForDatabase(basisPoints)).toBe(expected);
  });
});
