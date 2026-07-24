import {
  hasDuplicateCartProductIds,
  isCheckoutCartReference,
  MAX_CART_LINE_ITEMS,
  type CheckoutCartReference,
} from "./cart-validation";
import {
  CouponPreviewError,
  isCouponPreviewError,
  normalizeCouponCode,
  type BuiltCouponPreview,
  type CouponPreviewFailureReason,
} from "./coupon-quote";

export const COUPON_PREVIEW_CACHE_CONTROL = "no-store";

export type CouponPreviewPayload = {
  code: string;
  cartItems: CheckoutCartReference[];
};

export type CouponPreviewResponse = {
  applicable: true;
  couponCode: string;
  currency: "hkd";
  originalSubtotalMinor: number;
  discountMinor: number;
  discountedSubtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  items: {
    productId: string;
    quantity: number;
    discountBasisPoints: number;
    originalUnitMinor: number;
    unitDiscountMinor: number;
    discountedUnitMinor: number;
    originalLineMinor: number;
    discountMinor: number;
    discountedLineMinor: number;
  }[];
};

export type CouponPublicErrorCode =
  | CouponPreviewFailureReason
  | "rate_limited";

export type CouponPublicError = {
  code: CouponPublicErrorCode;
  message: string;
  status: number;
};

const PUBLIC_ERRORS: Record<CouponPublicErrorCode, CouponPublicError> = {
  invalid_coupon: {
    code: "invalid_coupon",
    message: "This coupon is invalid, expired, or unavailable.",
    status: 400,
  },
  not_applicable: {
    code: "not_applicable",
    message: "This coupon does not apply to the items in your cart.",
    status: 400,
  },
  cart_changed: {
    code: "cart_changed",
    message: "Your cart changed. Please review it and try again.",
    status: 409,
  },
  unavailable: {
    code: "unavailable",
    message: "Coupon preview is temporarily unavailable.",
    status: 503,
  },
  rate_limited: {
    code: "rate_limited",
    message: "Too many coupon attempts. Please wait a moment and try again.",
    status: 429,
  },
};

export function parseCouponPreviewPayload(body: unknown): CouponPreviewPayload {
  const source =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  const code = normalizeCouponCode(source.code);

  if (
    !Array.isArray(source.cartItems) ||
    source.cartItems.length === 0 ||
    source.cartItems.length > MAX_CART_LINE_ITEMS
  ) {
    throw new CouponPreviewError("cart_changed");
  }

  if (!source.cartItems.every(isCheckoutCartReference)) {
    throw new CouponPreviewError("cart_changed");
  }

  const cartItems = source.cartItems.map(({ id, slug, quantity }) => ({
    id,
    slug,
    quantity,
  }));

  if (hasDuplicateCartProductIds(cartItems)) {
    throw new CouponPreviewError("cart_changed");
  }

  return { code, cartItems };
}

export function toCouponPreviewResponse({
  couponCode,
  quote,
}: BuiltCouponPreview): CouponPreviewResponse {
  return {
    applicable: true,
    couponCode,
    currency: "hkd",
    originalSubtotalMinor: quote.originalSubtotalCents,
    discountMinor: quote.discountTotalCents,
    discountedSubtotalMinor: quote.discountedSubtotalCents,
    shippingMinor: quote.shippingCents,
    totalMinor: quote.finalTotalCents,
    items: quote.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      discountBasisPoints: line.discountBasisPoints,
      originalUnitMinor: line.originalUnitAmountCents,
      unitDiscountMinor: line.unitDiscountCents,
      discountedUnitMinor: line.discountedUnitAmountCents,
      originalLineMinor: line.originalLineTotalCents,
      discountMinor: line.lineDiscountCents,
      discountedLineMinor: line.discountedLineTotalCents,
    })),
  };
}

export function getCouponPublicError(
  error: unknown,
  fallback: CouponPublicErrorCode = "unavailable",
) {
  const code = isCouponPreviewError(error) ? error.reason : fallback;
  return PUBLIC_ERRORS[code];
}

export function getRateLimitedCouponPublicError() {
  return PUBLIC_ERRORS.rate_limited;
}
