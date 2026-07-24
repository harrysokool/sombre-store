import { NextResponse } from "next/server";

import { MAX_CHECKOUT_BODY_BYTES } from "@/lib/checkout/cart-validation";
import {
  COUPON_PREVIEW_CACHE_CONTROL,
  getCouponPublicError,
  getRateLimitedCouponPublicError,
  parseCouponPreviewPayload,
  toCouponPreviewResponse,
  type CouponPublicError,
} from "@/lib/checkout/coupon-preview";
import { CouponPreviewError } from "@/lib/checkout/coupon-quote";
import { loadCouponPreview } from "@/lib/checkout/coupons";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const COUPON_PREVIEW_RATE_LIMIT = {
  limit: 20,
  windowMs: 60_000,
} as const;

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": COUPON_PREVIEW_CACHE_CONTROL,
      ...headers,
    },
  });
}

function publicErrorResponse(error: CouponPublicError, status = error.status) {
  return jsonResponse(
    {
      error: error.code,
      message: error.message,
    },
    status,
  );
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request) ?? "unknown";
  const rateLimit = await checkRateLimit(
    `coupon-preview:${clientIp}`,
    COUPON_PREVIEW_RATE_LIMIT,
  );

  if (!rateLimit.isAllowed) {
    return jsonResponse(
      {
        error: "rate_limited",
        message: getRateLimitedCouponPublicError().message,
      },
      429,
      {
        "Retry-After": String(Math.max(1, rateLimit.retryAfterSeconds)),
      },
    );
  }

  try {
    const declaredBodySize = Number(request.headers.get("content-length"));

    if (
      Number.isFinite(declaredBodySize) &&
      declaredBodySize > MAX_CHECKOUT_BODY_BYTES
    ) {
      return publicErrorResponse(
        getCouponPublicError(
          new CouponPreviewError("cart_changed"),
        ),
        413,
      );
    }

    const rawBody = await request.text();

    if (new TextEncoder().encode(rawBody).length > MAX_CHECKOUT_BODY_BYTES) {
      return publicErrorResponse(
        getCouponPublicError(
          new CouponPreviewError("cart_changed"),
        ),
        413,
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return publicErrorResponse(
        getCouponPublicError(
          new CouponPreviewError("cart_changed"),
        ),
        400,
      );
    }

    const payload = parseCouponPreviewPayload(body);
    const preview = await loadCouponPreview(payload);

    return jsonResponse(toCouponPreviewResponse(preview), 200);
  } catch (error) {
    return publicErrorResponse(getCouponPublicError(error));
  }
}
