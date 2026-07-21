import { NextResponse } from "next/server";

import type { CartItem } from "@/lib/cart/cart";
import {
  getCartItemCount,
  MAX_CART_ITEM_QUANTITY,
} from "@/lib/cart/cart";
import { getCartSubtotal } from "@/lib/cart/math";
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

// A valid cart payload is a few kilobytes at most. Reject anything larger
// before parsing it as JSON.
const MAX_CHECKOUT_BODY_BYTES = 16 * 1024;

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

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown) {
  return typeof value === "string" || value === null || value === undefined;
}

function isValidEmail(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  const quantity = item.quantity;

  return (
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.slug) &&
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    quantity <= MAX_CART_ITEM_QUANTITY &&
    isOptionalString(item.size_label) &&
    isOptionalString(item.image_url)
  );
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

function isValidCustomer(value: unknown): value is CheckoutCustomerDetails {
  if (!value || typeof value !== "object") {
    return false;
  }

  const customer = value as Record<string, unknown>;

  return (
    isNonEmptyString(customer.fullName) &&
    isValidEmail(customer.email) &&
    isOptionalString(customer.phone) &&
    isNonEmptyString(customer.addressLine1) &&
    isOptionalString(customer.addressLine2) &&
    isNonEmptyString(customer.city) &&
    isNonEmptyString(customer.postalCode) &&
    isSupportedShippingCountry(customer.country)
  );
}

function parseCheckoutPayload(body: unknown): CheckoutSessionPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Record<string, unknown>;

  if (
    !Array.isArray(payload.cartItems) ||
    payload.cartItems.length === 0 ||
    !payload.cartItems.every(isValidCartItem) ||
    !isValidCustomer(payload.customer) ||
    typeof payload.subtotal !== "number" ||
    !Number.isFinite(payload.subtotal)
  ) {
    return null;
  }

  const productIds = payload.cartItems.map((item) => item.id);

  if (new Set(productIds).size !== productIds.length) {
    return null;
  }

  return {
    cartItems: payload.cartItems,
    subtotal: payload.subtotal,
    customer: {
      fullName: payload.customer.fullName.trim(),
      email: payload.customer.email.trim(),
      phone: payload.customer.phone?.trim() ?? "",
      addressLine1: payload.customer.addressLine1.trim(),
      addressLine2: payload.customer.addressLine2?.trim() ?? "",
      city: payload.customer.city.trim(),
      postalCode: payload.customer.postalCode.trim(),
      country: SHIPPING_COUNTRY,
    },
  };
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request) ?? "unknown";
  const rateLimit = checkRateLimit(
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

    const payload = parseCheckoutPayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid checkout payload." },
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: payload.customer.email,
      success_url: `${siteOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/checkout/cancel`,
      line_items: validatedCartItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "hkd",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
            description: item.size_label ?? undefined,
            metadata: {
              product_id: item.id,
              product_slug: item.slug,
            },
          },
        },
      })),
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
        city: payload.customer.city,
        postal_code: payload.customer.postalCode,
        country: payload.customer.country,
        cart_item_count: String(validatedCartItems.length),
        cart_quantity_total: String(getCartItemCount(validatedCartItems)),
        subtotal: calculatedSubtotal.toFixed(2),
        shipping_fee: SHIPPING_FEE_HKD.toFixed(2),
        total: calculatedTotal.toFixed(2),
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
