import type { CartItem } from "@/lib/cart/cart";

import { normalizeCouponCode } from "./coupon-quote";
import type { CouponPreviewResponse } from "./coupon-preview";

export const COUPON_STORAGE_KEY = "sombre-coupon-code";

const COUPON_FALLBACK_MESSAGE = "Could not apply this coupon.";

export class CouponClientError extends Error {}

export function getCouponCartFingerprint(
  items: readonly Pick<CartItem, "id" | "slug" | "quantity">[],
) {
  return JSON.stringify(
    items.map(({ id, slug, quantity }) => ({ id, slug, quantity })),
  );
}

export function isCouponPreviewResponse(
  value: unknown,
): value is CouponPreviewResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preview = value as Record<string, unknown>;
  const minorFields = [
    preview.originalSubtotalMinor,
    preview.discountMinor,
    preview.discountedSubtotalMinor,
    preview.shippingMinor,
    preview.totalMinor,
  ];
  let hasNormalizedCouponCode = false;

  try {
    hasNormalizedCouponCode =
      typeof preview.couponCode === "string" &&
      normalizeCouponCode(preview.couponCode) === preview.couponCode;
  } catch {
    hasNormalizedCouponCode = false;
  }

  return (
    preview.applicable === true &&
    hasNormalizedCouponCode &&
    preview.currency === "hkd" &&
    minorFields.every(
      (amount) =>
        typeof amount === "number" &&
        Number.isSafeInteger(amount) &&
        amount >= 0,
    ) &&
    Array.isArray(preview.items)
  );
}

export async function requestCouponPreview(
  code: string,
  cartItems: readonly Pick<CartItem, "id" | "slug" | "quantity">[],
) {
  const response = await fetch("/api/checkout/coupon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      cartItems: cartItems.map(({ id, slug, quantity }) => ({
        id,
        slug,
        quantity,
      })),
    }),
  });

  let data: unknown;

  try {
    data = (await response.json()) as unknown;
  } catch {
    throw new CouponClientError(COUPON_FALLBACK_MESSAGE);
  }

  if (!response.ok || !isCouponPreviewResponse(data)) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string" &&
      data.message.trim()
        ? data.message
        : COUPON_FALLBACK_MESSAGE;

    throw new CouponClientError(message);
  }

  return data;
}

export function readStoredCouponCode() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedCode = window.sessionStorage.getItem(COUPON_STORAGE_KEY);

    if (!storedCode) {
      return null;
    }

    const normalizedCode = normalizeCouponCode(storedCode);

    if (storedCode !== normalizedCode) {
      window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
      return null;
    }

    return normalizedCode;
  } catch {
    return null;
  }
}

export function storeCouponCode(code: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalizedCode = normalizeCouponCode(code);

    if (code !== normalizedCode) {
      return;
    }

    window.sessionStorage.setItem(COUPON_STORAGE_KEY, normalizedCode);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function clearStoredCouponCode() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
  } catch {
    // Removing an optional convenience value must never block checkout.
  }
}
