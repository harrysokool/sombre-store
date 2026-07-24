import type Stripe from "stripe";

import {
  addSafeNonNegativeIntegers,
  assertSafeNonNegativeInteger,
  multiplySafeNonNegativeIntegers,
} from "./money";
import { normalizeCouponCode } from "./coupon-quote";
import { calculateUnitDiscountCents } from "./discounts";

export const PRODUCT_DISCOUNT_QUOTE_VERSION = "product-discount-v1";

const STRICT_INTEGER_PATTERN = /^(0|[1-9]\d*)$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const SESSION_SNAPSHOT_METADATA_KEYS = [
  "coupon_code",
  "original_subtotal_minor",
  "discount_minor",
  "discounted_subtotal_minor",
  "shipping_minor",
  "total_minor",
] as const;
const PRODUCT_SNAPSHOT_METADATA_KEYS = [
  "original_unit_minor",
  "discount_basis_points",
  "unit_discount_minor",
  "discounted_unit_minor",
] as const;

export type StripeCheckoutLineSnapshot = {
  stripeLineItemId: string;
  productId: string | null;
  quantity: number;
  originalUnitAmountCents: number;
  discountBasisPoints: number;
  unitDiscountCents: number;
  discountedUnitAmountCents: number;
  originalLineTotalCents: number;
  lineDiscountCents: number;
  discountedLineTotalCents: number;
};

export type StripeCheckoutOrderSnapshot = {
  couponCode: string | null;
  originalSubtotalCents: number;
  discountTotalCents: number;
  discountedSubtotalCents: number;
  shippingCents: number;
  totalCents: number;
  lines: StripeCheckoutLineSnapshot[];
};

function snapshotError(message: string): never {
  throw new Error(`Invalid Stripe Checkout snapshot: ${message}`);
}

function parseStrictMetadataInteger(
  value: string | undefined,
  label: string,
) {
  if (!value || !STRICT_INTEGER_PATTERN.test(value)) {
    snapshotError(`${label} must be a canonical non-negative integer.`);
  }

  const parsed = BigInt(value);

  if (parsed > MAX_SAFE_INTEGER) {
    snapshotError(`${label} exceeds the supported integer range.`);
  }

  return Number(parsed);
}

function parseStripeInteger(value: unknown, label: string) {
  try {
    assertSafeNonNegativeInteger(value, label);
  } catch {
    snapshotError(`${label} must be a non-negative safe integer.`);
  }

  return value;
}

function parseQuantity(value: unknown) {
  const quantity = parseStripeInteger(value, "line quantity");

  if (quantity < 1) {
    snapshotError("line quantity must be at least one.");
  }

  return quantity;
}

function getExpandedStripeProduct(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined,
) {
  if (!product || typeof product === "string" || product.deleted) {
    return null;
  }

  return product;
}

function getProductId(product: Stripe.Product | null, isCouponOrder: boolean) {
  const productId = product?.metadata.product_id;

  if (isCouponOrder && (!productId || !UUID_PATTERN.test(productId))) {
    snapshotError("coupon product metadata has an invalid product_id.");
  }

  return productId || null;
}

function parseStripeUnitAmount(lineItem: Stripe.LineItem) {
  const priceUnitAmount = lineItem.price?.unit_amount;

  if (priceUnitAmount !== null && priceUnitAmount !== undefined) {
    return parseStripeInteger(priceUnitAmount, "Stripe unit amount");
  }

  const quantity = parseQuantity(lineItem.quantity);
  const lineSubtotal = parseStripeInteger(
    lineItem.amount_subtotal,
    "Stripe line subtotal",
  );

  if (lineSubtotal % quantity !== 0) {
    snapshotError(
      "Stripe line subtotal cannot be represented as an integer unit amount.",
    );
  }

  return lineSubtotal / quantity;
}

function assertLineAmounts(
  lineItem: Stripe.LineItem,
  discountedLineTotalCents: number,
) {
  const stripeLineSubtotal = parseStripeInteger(
    lineItem.amount_subtotal,
    "Stripe line subtotal",
  );
  const stripeLineTotal = parseStripeInteger(
    lineItem.amount_total,
    "Stripe line total",
  );

  if (
    stripeLineSubtotal !== discountedLineTotalCents ||
    stripeLineTotal !== discountedLineTotalCents
  ) {
    snapshotError("Stripe line totals do not match the charged unit amount.");
  }
}

function parseCouponLineSnapshot(
  lineItem: Stripe.LineItem,
): StripeCheckoutLineSnapshot {
  const stripeProduct = getExpandedStripeProduct(lineItem.price?.product);

  if (!stripeProduct) {
    snapshotError("coupon product metadata is unavailable.");
  }

  const metadata = stripeProduct.metadata;
  const productId = getProductId(stripeProduct, true);
  const quantity = parseQuantity(lineItem.quantity);
  const originalUnitAmountCents = parseStrictMetadataInteger(
    metadata.original_unit_minor,
    "original_unit_minor",
  );
  const discountBasisPoints = parseStrictMetadataInteger(
    metadata.discount_basis_points,
    "discount_basis_points",
  );
  const unitDiscountCents = parseStrictMetadataInteger(
    metadata.unit_discount_minor,
    "unit_discount_minor",
  );
  const discountedUnitAmountCents = parseStrictMetadataInteger(
    metadata.discounted_unit_minor,
    "discounted_unit_minor",
  );

  if (discountBasisPoints > 10_000) {
    snapshotError("discount_basis_points must not exceed 10000.");
  }

  if (
    unitDiscountCents > originalUnitAmountCents ||
    originalUnitAmountCents - unitDiscountCents !==
      discountedUnitAmountCents
  ) {
    snapshotError("coupon unit amounts do not reconcile.");
  }

  if (
    calculateUnitDiscountCents(
      originalUnitAmountCents,
      discountBasisPoints,
    ) !== unitDiscountCents
  ) {
    snapshotError("coupon unit discount does not match its percentage.");
  }

  const stripeUnitAmount = parseStripeUnitAmount(lineItem);

  if (stripeUnitAmount !== discountedUnitAmountCents) {
    snapshotError(
      "Stripe unit amount does not match discounted_unit_minor.",
    );
  }

  const originalLineTotalCents = multiplySafeNonNegativeIntegers(
    originalUnitAmountCents,
    quantity,
    "Original line total",
  );
  const lineDiscountCents = multiplySafeNonNegativeIntegers(
    unitDiscountCents,
    quantity,
    "Line discount",
  );
  const discountedLineTotalCents = multiplySafeNonNegativeIntegers(
    discountedUnitAmountCents,
    quantity,
    "Discounted line total",
  );

  assertLineAmounts(lineItem, discountedLineTotalCents);

  return {
    stripeLineItemId: lineItem.id,
    productId,
    quantity,
    originalUnitAmountCents,
    discountBasisPoints,
    unitDiscountCents,
    discountedUnitAmountCents,
    originalLineTotalCents,
    lineDiscountCents,
    discountedLineTotalCents,
  };
}

function parseNoCouponLineSnapshot(
  lineItem: Stripe.LineItem,
): StripeCheckoutLineSnapshot {
  const stripeProduct = getExpandedStripeProduct(lineItem.price?.product);
  const metadata = stripeProduct?.metadata ?? {};

  if (
    PRODUCT_SNAPSHOT_METADATA_KEYS.some(
      (key) => metadata[key] !== undefined,
    )
  ) {
    snapshotError(
      "product discount metadata requires quote_version=product-discount-v1.",
    );
  }

  const productId = getProductId(stripeProduct, false);
  const quantity = parseQuantity(lineItem.quantity);
  const unitAmountCents = parseStripeUnitAmount(lineItem);
  const lineTotalCents = multiplySafeNonNegativeIntegers(
    unitAmountCents,
    quantity,
    "Line total",
  );

  assertLineAmounts(lineItem, lineTotalCents);

  return {
    stripeLineItemId: lineItem.id,
    productId,
    quantity,
    originalUnitAmountCents: unitAmountCents,
    discountBasisPoints: 0,
    unitDiscountCents: 0,
    discountedUnitAmountCents: unitAmountCents,
    originalLineTotalCents: lineTotalCents,
    lineDiscountCents: 0,
    discountedLineTotalCents: lineTotalCents,
  };
}

function assertUniqueLineItemIds(lines: StripeCheckoutLineSnapshot[]) {
  if (
    new Set(lines.map((line) => line.stripeLineItemId)).size !==
    lines.length
  ) {
    snapshotError("Stripe returned duplicate line-item IDs.");
  }
}

function getStripeSessionAmount(value: unknown, label: string) {
  return parseStripeInteger(value, label);
}

function buildCouponOrderSnapshot(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
): StripeCheckoutOrderSnapshot {
  const metadata = session.metadata ?? {};
  const rawCouponCode = metadata.coupon_code;

  if (!rawCouponCode) {
    snapshotError("coupon_code is required.");
  }

  let couponCode: string;

  try {
    couponCode = normalizeCouponCode(rawCouponCode);
  } catch {
    snapshotError("coupon_code is invalid.");
  }

  if (couponCode !== rawCouponCode) {
    snapshotError("coupon_code must already be normalized.");
  }

  const originalSubtotalCents = parseStrictMetadataInteger(
    metadata.original_subtotal_minor,
    "original_subtotal_minor",
  );
  const discountTotalCents = parseStrictMetadataInteger(
    metadata.discount_minor,
    "discount_minor",
  );
  const discountedSubtotalCents = parseStrictMetadataInteger(
    metadata.discounted_subtotal_minor,
    "discounted_subtotal_minor",
  );
  const shippingCents = parseStrictMetadataInteger(
    metadata.shipping_minor,
    "shipping_minor",
  );
  const totalCents = parseStrictMetadataInteger(
    metadata.total_minor,
    "total_minor",
  );

  if (
    discountTotalCents === 0 ||
    discountTotalCents > originalSubtotalCents ||
    originalSubtotalCents - discountTotalCents !==
      discountedSubtotalCents
  ) {
    snapshotError("Session discount subtotals do not reconcile.");
  }

  if (
    addSafeNonNegativeIntegers(
      [discountedSubtotalCents, shippingCents],
      "Session total",
    ) !== totalCents
  ) {
    snapshotError("Session shipping and total do not reconcile.");
  }

  const stripeSubtotalCents = getStripeSessionAmount(
    session.amount_subtotal,
    "Stripe amount_subtotal",
  );
  const stripeTotalCents = getStripeSessionAmount(
    session.amount_total,
    "Stripe amount_total",
  );
  const stripeShippingCents = getStripeSessionAmount(
    session.total_details?.amount_shipping,
    "Stripe shipping amount",
  );

  if (
    stripeSubtotalCents !== discountedSubtotalCents ||
    stripeShippingCents !== shippingCents ||
    stripeTotalCents !== totalCents
  ) {
    snapshotError("Stripe Session amounts do not match coupon metadata.");
  }

  const lines = lineItems.map(parseCouponLineSnapshot);
  assertUniqueLineItemIds(lines);

  const lineOriginalSubtotal = addSafeNonNegativeIntegers(
    lines.map((line) => line.originalLineTotalCents),
    "Line original subtotal",
  );
  const lineDiscountTotal = addSafeNonNegativeIntegers(
    lines.map((line) => line.lineDiscountCents),
    "Line discount total",
  );
  const lineDiscountedSubtotal = addSafeNonNegativeIntegers(
    lines.map((line) => line.discountedLineTotalCents),
    "Line discounted subtotal",
  );

  if (
    lineOriginalSubtotal !== originalSubtotalCents ||
    lineDiscountTotal !== discountTotalCents ||
    lineDiscountedSubtotal !== discountedSubtotalCents
  ) {
    snapshotError("product lines do not match Session coupon totals.");
  }

  return {
    couponCode,
    originalSubtotalCents,
    discountTotalCents,
    discountedSubtotalCents,
    shippingCents,
    totalCents,
    lines,
  };
}

function buildNoCouponOrderSnapshot(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
): StripeCheckoutOrderSnapshot {
  const metadata = session.metadata ?? {};

  if (
    SESSION_SNAPSHOT_METADATA_KEYS.some(
      (key) => metadata[key] !== undefined,
    )
  ) {
    snapshotError(
      "coupon metadata requires quote_version=product-discount-v1.",
    );
  }

  const lines = lineItems.map(parseNoCouponLineSnapshot);
  assertUniqueLineItemIds(lines);

  const lineSubtotalCents = addSafeNonNegativeIntegers(
    lines.map((line) => line.discountedLineTotalCents),
    "Line subtotal",
  );
  const subtotalCents =
    session.amount_subtotal === null
      ? lineSubtotalCents
      : getStripeSessionAmount(
          session.amount_subtotal,
          "Stripe amount_subtotal",
        );
  const shippingCents =
    session.total_details?.amount_shipping === null ||
    session.total_details?.amount_shipping === undefined
      ? 0
      : getStripeSessionAmount(
          session.total_details.amount_shipping,
          "Stripe shipping amount",
        );
  const calculatedTotalCents = addSafeNonNegativeIntegers(
    [subtotalCents, shippingCents],
    "Order total",
  );
  const totalCents =
    session.amount_total === null
      ? calculatedTotalCents
      : getStripeSessionAmount(session.amount_total, "Stripe amount_total");

  if (
    subtotalCents !== lineSubtotalCents ||
    totalCents !== calculatedTotalCents
  ) {
    snapshotError("no-coupon Stripe amounts do not reconcile.");
  }

  return {
    couponCode: null,
    originalSubtotalCents: subtotalCents,
    discountTotalCents: 0,
    discountedSubtotalCents: subtotalCents,
    shippingCents,
    totalCents,
    lines,
  };
}

export function buildStripeCheckoutOrderSnapshot(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
): StripeCheckoutOrderSnapshot {
  const quoteVersion = session.metadata?.quote_version;

  if (quoteVersion === PRODUCT_DISCOUNT_QUOTE_VERSION) {
    return buildCouponOrderSnapshot(session, lineItems);
  }

  if (quoteVersion !== undefined) {
    snapshotError(`unsupported quote_version ${JSON.stringify(quoteVersion)}.`);
  }

  return buildNoCouponOrderSnapshot(session, lineItems);
}

export function formatBasisPointsForDatabase(basisPoints: number) {
  assertSafeNonNegativeInteger(basisPoints, "Discount basis points");

  if (basisPoints > 10_000) {
    throw new RangeError("Discount basis points must not exceed 10000.");
  }

  const wholePart = Math.floor(basisPoints / 100);
  const fractionalPart = String(basisPoints % 100).padStart(2, "0");

  return `${wholePart}.${fractionalPart}`;
}
