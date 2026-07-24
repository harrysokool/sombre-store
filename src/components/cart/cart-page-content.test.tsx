// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/lib/cart/cart";
import { COUPON_STORAGE_KEY } from "@/lib/checkout/coupon-client";
import type { CouponPreviewResponse } from "@/lib/checkout/coupon-preview";

const testState = vi.hoisted(() => ({
  cartItems: [] as CartItem[],
}));

vi.mock("@/hooks/use-cart-items", () => ({
  useCartItems: () => ({
    cartItems: testState.cartItems,
    setCartItems: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => (
    <span role="img" aria-label={alt} />
  ),
}));

import { CartPageContent } from "./cart-page-content";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn<typeof fetch>();

function cartItem(quantity = 2): CartItem {
  return {
    id: PRODUCT_ID,
    slug: "product-a",
    name: "Product A",
    price: 1_000,
    size_label: "One Size",
    image_url: null,
    stock_quantity: 10,
    quantity,
  };
}

function preview({
  couponCode = "SOMBRE",
  discountMinor = 40_000,
}: {
  couponCode?: string;
  discountMinor?: number;
} = {}): CouponPreviewResponse {
  const originalSubtotalMinor = 200_000;
  const discountedSubtotalMinor =
    originalSubtotalMinor - discountMinor;
  const shippingMinor = 5_000;

  return {
    applicable: true,
    couponCode,
    currency: "hkd",
    originalSubtotalMinor,
    discountMinor,
    discountedSubtotalMinor,
    shippingMinor,
    totalMinor: discountedSubtotalMinor + shippingMinor,
    items: [
      {
        productId: PRODUCT_ID,
        quantity: 2,
        discountBasisPoints: 2_000,
        originalUnitMinor: 100_000,
        unitDiscountMinor: discountMinor / 2,
        discountedUnitMinor: 100_000 - discountMinor / 2,
        originalLineMinor: originalSubtotalMinor,
        discountMinor,
        discountedLineMinor: discountedSubtotalMinor,
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function applyCoupon(
  user: ReturnType<typeof userEvent.setup>,
  code = "sombre",
) {
  const input = screen.getByRole("textbox", { name: "Coupon code" });
  await user.clear(input);
  await user.type(input, code);
  await user.click(screen.getByRole("button", { name: "Apply" }));
}

describe("Cart coupon interface", () => {
  beforeEach(() => {
    testState.cartItems = [cartItem()];
    window.sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the coupon form on cart and stores only the normalized code", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(() => jsonResponse(preview()));

    render(<CartPageContent />);
    await applyCoupon(user, "  sombre  ");

    expect(
      await screen.findByRole("button", {
        name: "Remove SOMBRE coupon",
      }),
    ).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBe("SOMBRE");
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem(COUPON_STORAGE_KEY)).not.toContain(
      "40000",
    );
    expect(screen.getByText("Original subtotal · 2 items")).toBeInTheDocument();
    expect(screen.getByText("Discounted subtotal")).toBeInTheDocument();
    expect(screen.getByText("HK$50.00")).toBeInTheDocument();
    expect(screen.getByText("HK$1,650.00")).toBeInTheDocument();
  });

  it("removes the coupon and restores original cart totals", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(() => jsonResponse(preview()));

    render(<CartPageContent />);
    await applyCoupon(user);
    await user.click(
      await screen.findByRole("button", {
        name: "Remove SOMBRE coupon",
      }),
    );

    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBeNull();
    expect(screen.queryByText("Discount")).toBeNull();
    expect(screen.getByText("Subtotal · 2 items")).toBeInTheDocument();
    expect(screen.getByText("HK$2,050.00")).toBeInTheDocument();
  });

  it("replaces the active coupon without compounding", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockImplementationOnce(() => jsonResponse(preview()))
      .mockImplementationOnce(() =>
        jsonResponse(
          preview({ couponCode: "DARK", discountMinor: 20_000 }),
        ),
      );

    render(<CartPageContent />);
    await applyCoupon(user);
    await screen.findByRole("button", {
      name: "Remove SOMBRE coupon",
    });
    await applyCoupon(user, "dark");

    expect(
      await screen.findByRole("button", {
        name: "Remove DARK coupon",
      }),
    ).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBe("DARK");
    expect(screen.getByText(/HK\$200\.00/)).toBeInTheDocument();
    expect(screen.getByText("HK$1,850.00")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the coupon and storage when the cart changes", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(() => jsonResponse(preview()));

    const view = render(<CartPageContent />);
    await applyCoupon(user);
    await screen.findByRole("button", {
      name: "Remove SOMBRE coupon",
    });

    testState.cartItems = [cartItem(3)];
    view.rerender(<CartPageContent />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your cart changed. Apply your coupon again.",
    );
    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBeNull();
    expect(screen.queryByText("Discount")).toBeNull();
    expect(screen.getByText("Subtotal · 3 items")).toBeInTheDocument();
  });

  it("disables Apply and announces loading", async () => {
    const user = userEvent.setup();
    let resolveResponse: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    render(<CartPageContent />);
    await applyCoupon(user);

    expect(
      screen.getByRole("button", { name: "Applying…" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking this coupon…",
    );

    await act(async () => {
      resolveResponse?.(
        new Response(JSON.stringify(preview()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });

  it.each([
    {
      code: "invalid_coupon",
      status: 400,
      message: "This coupon is invalid, expired, or unavailable.",
    },
    {
      code: "not_applicable",
      status: 400,
      message: "This coupon does not apply to the items in your cart.",
    },
    {
      code: "cart_changed",
      status: 409,
      message: "Your cart changed. Please review it and try again.",
    },
    {
      code: "rate_limited",
      status: 429,
      message:
        "Too many coupon attempts. Please wait a moment and try again.",
    },
    {
      code: "unavailable",
      status: 503,
      message: "Coupon preview is temporarily unavailable.",
    },
  ])(
    "uses the safe server message for $code",
    async ({ code, status, message }) => {
      const user = userEvent.setup();
      fetchMock.mockImplementationOnce(() =>
        jsonResponse({ error: code, message }, status),
      );

      render(<CartPageContent />);
      await applyCoupon(user, "wrong");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        message,
      );
      expect(
        window.sessionStorage.getItem(COUPON_STORAGE_KEY),
      ).toBeNull();
    },
  );
});
