import {
  getCartItemReferenceError,
  hasDuplicateCartProductIds,
  type CheckoutCartReference,
} from "./cart-validation";
import { calculateDiscountQuote, type DiscountQuote } from "./discounts";
import {
  parseHkdDecimalToCents,
  parsePercentageToBasisPoints,
} from "./money";

const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export type CouponPreviewFailureReason =
  | "invalid_coupon"
  | "not_applicable"
  | "cart_changed"
  | "unavailable";

export class CouponPreviewError extends Error {
  constructor(public readonly reason: CouponPreviewFailureReason) {
    super(reason);
    this.name = "CouponPreviewError";
  }
}

export type CouponConfiguration = {
  codeNormalized: string;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
};

export type CouponProductAssignment = {
  productId: string;
  discountPercent: string | number;
};

export type CouponProduct = {
  id: string;
  slug: string;
  price: string | number;
  isActive: boolean;
  stockQuantity: number;
};

export type BuiltCouponPreview = {
  couponCode: string;
  quote: DiscountQuote;
};

export function normalizeCouponCode(value: unknown) {
  if (typeof value !== "string") {
    throw new CouponPreviewError("invalid_coupon");
  }

  const normalizedCode = value.trim().toUpperCase();

  if (!COUPON_CODE_PATTERN.test(normalizedCode)) {
    throw new CouponPreviewError("invalid_coupon");
  }

  return normalizedCode;
}

function parseCouponDate(value: string | null) {
  if (value === null) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new CouponPreviewError("unavailable");
  }

  return timestamp;
}

export function assertCouponIsAvailable(
  coupon: CouponConfiguration | null,
  normalizedCode: string,
  now: Date,
) {
  const currentTimestamp = now.getTime();

  if (!Number.isFinite(currentTimestamp)) {
    throw new CouponPreviewError("unavailable");
  }

  if (
    !coupon ||
    coupon.codeNormalized !== normalizedCode ||
    !coupon.isActive
  ) {
    throw new CouponPreviewError("invalid_coupon");
  }

  const startsAt = parseCouponDate(coupon.startsAt);
  const expiresAt = parseCouponDate(coupon.expiresAt);

  // The start boundary is inclusive and the expiry boundary is exclusive.
  if (
    (startsAt !== null && currentTimestamp < startsAt) ||
    (expiresAt !== null && currentTimestamp >= expiresAt)
  ) {
    throw new CouponPreviewError("invalid_coupon");
  }
}

export function isCouponPreviewError(
  error: unknown,
): error is CouponPreviewError {
  return error instanceof CouponPreviewError;
}

export function buildCouponPreviewQuote({
  code,
  coupon,
  assignments,
  products,
  cartItems,
  shippingCents,
  now = new Date(),
}: {
  code: unknown;
  coupon: CouponConfiguration | null;
  assignments: readonly CouponProductAssignment[];
  products: readonly CouponProduct[];
  cartItems: readonly CheckoutCartReference[];
  shippingCents: number;
  now?: Date;
}): BuiltCouponPreview {
  const normalizedCode = normalizeCouponCode(code);
  assertCouponIsAvailable(coupon, normalizedCode, now);

  if (
    cartItems.length === 0 ||
    cartItems.some((item) => getCartItemReferenceError(item) !== null) ||
    hasDuplicateCartProductIds(cartItems)
  ) {
    throw new CouponPreviewError("cart_changed");
  }

  try {
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const assignmentMap = new Map<string, number>();

    if (productMap.size !== products.length) {
      throw new CouponPreviewError("unavailable");
    }

    for (const assignment of assignments) {
      if (assignmentMap.has(assignment.productId)) {
        throw new CouponPreviewError("unavailable");
      }

      assignmentMap.set(
        assignment.productId,
        parsePercentageToBasisPoints(String(assignment.discountPercent)),
      );
    }

    const quoteLines = cartItems.map((item) => {
      const product = productMap.get(item.id);

      if (
        !product ||
        !product.isActive ||
        product.slug !== item.slug ||
        !Number.isSafeInteger(product.stockQuantity) ||
        product.stockQuantity < 0
      ) {
        throw new CouponPreviewError("cart_changed");
      }

      if (item.quantity > product.stockQuantity) {
        throw new CouponPreviewError("cart_changed");
      }

      return {
        productId: product.id,
        quantity: item.quantity,
        originalUnitAmountCents: parseHkdDecimalToCents(
          String(product.price),
        ),
        discountBasisPoints: assignmentMap.get(product.id),
      };
    });

    const quote = calculateDiscountQuote(quoteLines, shippingCents);

    if (quote.discountTotalCents === 0) {
      throw new CouponPreviewError("not_applicable");
    }

    return { couponCode: normalizedCode, quote };
  } catch (error) {
    if (isCouponPreviewError(error)) {
      throw error;
    }

    throw new CouponPreviewError("unavailable");
  }
}
