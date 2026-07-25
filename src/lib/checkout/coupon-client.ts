import type { CartItem } from "@/lib/cart/cart";
import {
  readStoredText,
  removeStoredValue,
  writeStoredText,
} from "@/lib/cart/storage";

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
  const stored = readStoredText(COUPON_STORAGE_KEY, "session");

  if (stored.status !== "ok") {
    return null;
  }

  let normalizedCode: string;

  try {
    normalizedCode = normalizeCouponCode(stored.value);
  } catch {
    removeStoredValue(COUPON_STORAGE_KEY, "session");
    return null;
  }

  // Only an already-normalized value is trusted. Anything else was not written
  // by this app in a form it recognises, so it is discarded rather than used.
  if (stored.value !== normalizedCode) {
    removeStoredValue(COUPON_STORAGE_KEY, "session");
    return null;
  }

  return normalizedCode;
}

export function storeCouponCode(code: string) {
  let normalizedCode: string;

  try {
    normalizedCode = normalizeCouponCode(code);
  } catch {
    return;
  }

  if (code !== normalizedCode) {
    return;
  }

  // A failed write is ignored: the coupon is a convenience that is revalidated
  // server-side anyway, and losing it must never block checkout.
  writeStoredText(COUPON_STORAGE_KEY, normalizedCode, "session");
}

export function clearStoredCouponCode() {
  removeStoredValue(COUPON_STORAGE_KEY, "session");
}
