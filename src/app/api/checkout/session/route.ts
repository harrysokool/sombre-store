import { NextResponse } from "next/server";

import type { CartItem } from "@/lib/cart/cart";
import { getCartItemCount } from "@/lib/cart/cart";
import { getCartSubtotal } from "@/lib/cart/math";
import type {
  CheckoutCustomerDetails,
  CheckoutSessionPayload,
} from "@/lib/checkout/payload";
import { stripe } from "@/lib/stripe/server";

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

  return (
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.slug) &&
    isNonEmptyString(item.name) &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    isOptionalString(item.size_label) &&
    isOptionalString(item.image_url)
  );
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
    isNonEmptyString(customer.country)
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
      country: payload.customer.country.trim(),
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parseCheckoutPayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid checkout payload." },
        { status: 400 },
      );
    }

    const calculatedSubtotal = getCartSubtotal(payload.cartItems);

    if (Math.abs(calculatedSubtotal - payload.subtotal) > 0.01) {
      return NextResponse.json(
        { error: "Checkout subtotal did not match cart contents." },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: payload.customer.email,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      line_items: payload.cartItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
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
      metadata: {
        customer_name: payload.customer.fullName,
        customer_phone: payload.customer.phone,
        address_line_1: payload.customer.addressLine1,
        address_line_2: payload.customer.addressLine2,
        city: payload.customer.city,
        postal_code: payload.customer.postalCode,
        country: payload.customer.country,
        cart_item_count: String(payload.cartItems.length),
        cart_quantity_total: String(getCartItemCount(payload.cartItems)),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Checkout Session:", error);

    return NextResponse.json(
      { error: "Could not start Stripe Checkout." },
      { status: 500 },
    );
  }
}
