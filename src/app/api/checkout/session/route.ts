import { NextResponse } from "next/server";

import type { CartItem } from "@/lib/cart/cart";
import { getCartItemCount } from "@/lib/cart/cart";
import { getCartSubtotal } from "@/lib/cart/math";
import {
  getCartItemReferenceError,
  hasDuplicateCartProductIds,
  MAX_CHECKOUT_BODY_BYTES,
} from "@/lib/checkout/cart-validation";
import { getCouponPublicError } from "@/lib/checkout/coupon-preview";
import {
  CouponPreviewError,
  type BuiltCouponPreview,
} from "@/lib/checkout/coupon-quote";
import { loadCouponPreview } from "@/lib/checkout/coupons";
import { assertDiscountQuoteInvariants } from "@/lib/checkout/discounts";
import type {
  CheckoutCustomerDetails,
  CheckoutSessionPayload,
} from "@/lib/checkout/payload";
import {
  getCheckoutTotal,
  isSupportedShippingCountry,
  SHIPPING_COUNTRY,
  SHIPPING_FEE_HKD,
  SHIPPING_FEE_HKD_CENTS,
} from "@/lib/checkout/shipping";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";

const DEVELOPMENT_SITE_URL = "http://localhost:3000";

// Anonymous guest checkout is the only path here, so the client IP is the only
// identity available to throttle on. Ten attempts per minute leaves room for
// genuine retries (cart edits, a declined card, a reloaded page) while blocking
// scripted abuse of Stripe session creation.
const CHECKOUT_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

// These fields are copied into Stripe Checkout Session metadata, and Stripe
// rejects any metadata value longer than 500 characters. Validating well below
// that ceiling turns an opaque Stripe failure into a clear, fixable 400.
const CUSTOMER_FIELD_RULES = [
  { key: "fullName", label: "Full name", maxLength: 120, isRequired: true },
  { key: "email", label: "Email", maxLength: 254, isRequired: true },
  { key: "phone", label: "Phone", maxLength: 32, isRequired: false },
  {
    key: "addressLine1",
    label: "Address line 1",
    maxLength: 200,
    isRequired: true,
  },
  {
    key: "addressLine2",
    label: "Address line 2",
    maxLength: 200,
    isRequired: false,
  },
  { key: "district", label: "District", maxLength: 85, isRequired: true },
  { key: "city", label: "City", maxLength: 85, isRequired: true },
  // Hong Kong has no postal code system, so this stays optional.
  { key: "postalCode", label: "Postal code", maxLength: 32, isRequired: false },
] as const satisfies readonly {
  key: keyof Omit<CheckoutCustomerDetails, "country">;
  label: string;
  maxLength: number;
  isRequired: boolean;
}[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CheckoutPayloadResult =
  | { payload: CheckoutSessionPayload; error?: undefined }
  | { payload?: undefined; error: string };

type CheckoutCustomerResult =
  | { customer: CheckoutCustomerDetails; error?: undefined }
  | { customer?: undefined; error: string };

function getTrustedSiteOrigin() {
  const configuredSiteUrl = process.env.SITE_URL?.trim();
  const siteUrl =
    configuredSiteUrl ||
    (process.env.NODE_ENV === "development" ? DEVELOPMENT_SITE_URL : null);

  if (!siteUrl) {
    throw new Error(
      "Missing SITE_URL. Set it to the trusted public origin for this application.",
    );
  }

  let parsedSiteUrl: URL;

  try {
    parsedSiteUrl = new URL(siteUrl);
  } catch {
    throw new Error("SITE_URL must be a valid absolute URL.");
  }

  const isLocalDevelopmentUrl =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
      parsedSiteUrl.hostname,
    );

  if (
    parsedSiteUrl.protocol !== "https:" &&
    !(parsedSiteUrl.protocol === "http:" && isLocalDevelopmentUrl)
  ) {
    throw new Error(
      "SITE_URL must use HTTPS, except for localhost during development.",
    );
  }

  if (
    parsedSiteUrl.username ||
    parsedSiteUrl.password ||
    parsedSiteUrl.pathname !== "/" ||
    parsedSiteUrl.search ||
    parsedSiteUrl.hash
  ) {
    throw new Error(
      "SITE_URL must contain only the trusted origin without credentials, a path, query parameters, or a fragment.",
    );
  }

  return parsedSiteUrl.origin;
}

function isOptionalString(value: unknown) {
  return typeof value === "string" || value === null || value === undefined;
}

function getCartItemError(value: unknown): string | null {
  const referenceError = getCartItemReferenceError(value);

  if (referenceError) {
    return referenceError;
  }

  const item = value as Record<string, unknown>;

  if (!isOptionalString(item.size_label) || !isOptionalString(item.image_url)) {
    return "One or more cart items have invalid product details.";
  }

  return null;
}

function isValidCartItem(value: unknown): value is CartItem {
  return getCartItemError(value) === null;
}

type CheckoutProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  size_label: string | null;
  is_active: boolean;
  stock_quantity: number;
};

async function getCheckoutProducts(cartItems: CartItem[]) {
  const supabase = createSupabaseServerClient();
  const productIds = cartItems.map((item) => item.id);

  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, price, size_label, is_active, stock_quantity")
    .in("id", productIds)
    .returns<CheckoutProduct[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

function parseCustomer(value: unknown): CheckoutCustomerResult {
  if (!value || typeof value !== "object") {
    return { error: "Shipping details are required." };
  }

  const source = value as Record<string, unknown>;
  const fields: Record<string, string> = {};

  for (const rule of CUSTOMER_FIELD_RULES) {
    const rawValue = source[rule.key];

    if (
      rawValue !== null &&
      rawValue !== undefined &&
      typeof rawValue !== "string"
    ) {
      return { error: `${rule.label} must be text.` };
    }

    const trimmedValue = (rawValue ?? "").trim();

    if (!trimmedValue) {
      if (rule.isRequired) {
        return { error: `${rule.label} is required.` };
      }

      fields[rule.key] = "";
      continue;
    }

    if (trimmedValue.length > rule.maxLength) {
      return {
        error: `${rule.label} must be ${rule.maxLength} characters or fewer.`,
      };
    }

    fields[rule.key] = trimmedValue;
  }

  if (!EMAIL_PATTERN.test(fields.email)) {
    return { error: "Enter a valid email address." };
  }

  if (!isSupportedShippingCountry(source.country)) {
    return { error: `Sombre currently ships only to ${SHIPPING_COUNTRY}.` };
  }

  return {
    customer: {
      fullName: fields.fullName,
      email: fields.email,
      phone: fields.phone,
      addressLine1: fields.addressLine1,
      addressLine2: fields.addressLine2,
      district: fields.district,
      city: fields.city,
      postalCode: fields.postalCode,
      country: SHIPPING_COUNTRY,
    },
  };
}

function parseCheckoutPayload(body: unknown): CheckoutPayloadResult {
  if (!body || typeof body !== "object") {
    return { error: "Invalid checkout payload." };
  }

  const payload = body as Record<string, unknown>;

  if (!Array.isArray(payload.cartItems) || payload.cartItems.length === 0) {
    return { error: "Your cart is empty." };
  }

  const cartItemError = payload.cartItems
    .map(getCartItemError)
    .find((message): message is string => message !== null);

  if (cartItemError) {
    return { error: cartItemError };
  }

  // Every entry passed validation above, so this narrows without dropping any.
  const cartItems = payload.cartItems.filter(isValidCartItem);
  if (hasDuplicateCartProductIds(cartItems)) {
    return { error: "Your cart lists the same product more than once." };
  }

  if (
    typeof payload.subtotal !== "number" ||
    !Number.isFinite(payload.subtotal)
  ) {
    return { error: "Invalid checkout payload." };
  }

  if (
    payload.couponCode !== undefined &&
    payload.couponCode !== null &&
    (typeof payload.couponCode !== "string" ||
      payload.couponCode.trim().length === 0)
  ) {
    return { error: "Coupon code must be non-empty text." };
  }

  const { customer, error: customerError } = parseCustomer(payload.customer);

  if (!customer) {
    return { error: customerError ?? "Invalid checkout payload." };
  }

  return {
    payload: {
      cartItems,
      subtotal: payload.subtotal,
      customer,
      couponCode: payload.couponCode as string | null | undefined,
    },
  };
}

function validateCouponPreview(
  preview: BuiltCouponPreview,
  cartItems: CartItem[],
) {
  assertDiscountQuoteInvariants(preview.quote);

  if (
    preview.quote.shippingCents !== SHIPPING_FEE_HKD_CENTS ||
    preview.quote.discountTotalCents === 0 ||
    preview.quote.lines.length !== cartItems.length
  ) {
    throw new CouponPreviewError("unavailable");
  }

  const lineMap = new Map(
    preview.quote.lines.map((line) => [line.productId, line]),
  );

  for (const item of cartItems) {
    const line = lineMap.get(item.id);

    if (!line || line.quantity !== item.quantity) {
      throw new CouponPreviewError("unavailable");
    }
  }
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request) ?? "unknown";
  const rateLimit = await checkRateLimit(
    `checkout-session:${clientIp}`,
    CHECKOUT_RATE_LIMIT,
  );

  if (!rateLimit.isAllowed) {
    return NextResponse.json(
      {
        error:
          "Too many checkout attempts. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const declaredBodySize = Number(request.headers.get("content-length"));

    if (
      Number.isFinite(declaredBodySize) &&
      declaredBodySize > MAX_CHECKOUT_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Checkout request is too large." },
        { status: 413 },
      );
    }

    const rawBody = await request.text();

    if (new TextEncoder().encode(rawBody).length > MAX_CHECKOUT_BODY_BYTES) {
      return NextResponse.json(
        { error: "Checkout request is too large." },
        { status: 413 },
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid checkout payload." },
        { status: 400 },
      );
    }

    const { payload, error: payloadError } = parseCheckoutPayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: payloadError ?? "Invalid checkout payload." },
        { status: 400 },
      );
    }

    const siteOrigin = getTrustedSiteOrigin();

    const products = await getCheckoutProducts(payload.cartItems);
    const productMap = new Map(products.map((product) => [product.id, product]));

    if (products.length !== payload.cartItems.length) {
      return NextResponse.json(
        { error: "One or more cart items could not be found." },
        { status: 400 },
      );
    }

    const insufficientStockItem = payload.cartItems.find((item) => {
      const product = productMap.get(item.id);
      return product && item.quantity > product.stock_quantity;
    });

    if (insufficientStockItem) {
      const product = productMap.get(insufficientStockItem.id);

      return NextResponse.json(
        {
          error:
            product && product.stock_quantity > 0
              ? `${product.name} only has ${product.stock_quantity} available.`
              : `${product?.name ?? "A product in your cart"} is sold out.`,
        },
        { status: 409 },
      );
    }

    const serverCartItems = payload.cartItems.map((item) => {
      const product = productMap.get(item.id);

      if (!product || !product.is_active || product.slug !== item.slug) {
        return null;
      }

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        size_label: product.size_label,
        image_url: null,
        quantity: item.quantity,
      };
    });

    if (serverCartItems.some((item) => item === null)) {
      return NextResponse.json(
        { error: "One or more cart items are no longer available." },
        { status: 400 },
      );
    }

    const validatedCartItems = serverCartItems.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    const calculatedSubtotal = getCartSubtotal(validatedCartItems);
    const calculatedTotal = getCheckoutTotal(calculatedSubtotal);

    if (Math.abs(calculatedSubtotal - payload.subtotal) > 0.01) {
      return NextResponse.json(
        { error: "Checkout prices changed. Please review your cart and try again." },
        { status: 400 },
      );
    }

    let couponPreview: BuiltCouponPreview | null = null;

    if (payload.couponCode !== undefined && payload.couponCode !== null) {
      try {
        couponPreview = await loadCouponPreview({
          code: payload.couponCode,
          cartItems: payload.cartItems,
        });
        validateCouponPreview(couponPreview, validatedCartItems);
      } catch (error) {
        const publicError = getCouponPublicError(error);

        return NextResponse.json(
          { error: publicError.message },
          { status: publicError.status },
        );
      }
    }

    const couponLineMap = new Map(
      couponPreview?.quote.lines.map((line) => [line.productId, line]) ?? [],
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: payload.customer.email,
      success_url: `${siteOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/checkout/cancel`,
      line_items: validatedCartItems.map((item) => {
        const couponLine = couponLineMap.get(item.id);

        return {
          quantity: item.quantity,
          price_data: {
            currency: "hkd",
            unit_amount:
              couponLine?.discountedUnitAmountCents ??
              Math.round(item.price * 100),
            product_data: {
              name: item.name,
              description: item.size_label ?? undefined,
              metadata: {
                product_id: item.id,
                product_slug: item.slug,
                ...(couponLine
                  ? {
                      original_unit_minor: String(
                        couponLine.originalUnitAmountCents,
                      ),
                      discount_basis_points: String(
                        couponLine.discountBasisPoints,
                      ),
                      unit_discount_minor: String(
                        couponLine.unitDiscountCents,
                      ),
                      discounted_unit_minor: String(
                        couponLine.discountedUnitAmountCents,
                      ),
                    }
                  : {}),
              },
            },
          },
        };
      }),
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Hong Kong delivery",
            fixed_amount: {
              amount: SHIPPING_FEE_HKD_CENTS,
              currency: "hkd",
            },
          },
        },
      ],
      metadata: {
        customer_name: payload.customer.fullName,
        customer_phone: payload.customer.phone,
        address_line_1: payload.customer.addressLine1,
        address_line_2: payload.customer.addressLine2,
        district: payload.customer.district,
        city: payload.customer.city,
        postal_code: payload.customer.postalCode,
        country: payload.customer.country,
        cart_item_count: String(validatedCartItems.length),
        cart_quantity_total: String(getCartItemCount(validatedCartItems)),
        subtotal: calculatedSubtotal.toFixed(2),
        shipping_fee: SHIPPING_FEE_HKD.toFixed(2),
        total: calculatedTotal.toFixed(2),
        ...(couponPreview
          ? {
              quote_version: "product-discount-v1",
              coupon_code: couponPreview.couponCode,
              original_subtotal_minor: String(
                couponPreview.quote.originalSubtotalCents,
              ),
              discount_minor: String(
                couponPreview.quote.discountTotalCents,
              ),
              discounted_subtotal_minor: String(
                couponPreview.quote.discountedSubtotalCents,
              ),
              shipping_minor: String(couponPreview.quote.shippingCents),
              total_minor: String(couponPreview.quote.finalTotalCents),
            }
          : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Checkout Session:", error);

    return NextResponse.json(
      { error: "Could not start Stripe Checkout." },
      { status: 500 },
    );
  }
}
