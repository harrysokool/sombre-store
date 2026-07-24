// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/lib/cart/cart";
import {
  COUPON_STORAGE_KEY,
} from "@/lib/checkout/coupon-client";
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

import { CheckoutPageContent } from "./checkout-page-content";

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

function preview(): CouponPreviewResponse {
  return {
    applicable: true,
    couponCode: "SOMBRE",
    currency: "hkd",
    originalSubtotalMinor: 200_000,
    discountMinor: 40_000,
    discountedSubtotalMinor: 160_000,
    shippingMinor: 5_000,
    totalMinor: 165_000,
    items: [
      {
        productId: PRODUCT_ID,
        quantity: 2,
        discountBasisPoints: 2_000,
        originalUnitMinor: 100_000,
        unitDiscountMinor: 20_000,
        discountedUnitMinor: 80_000,
        originalLineMinor: 200_000,
        discountMinor: 40_000,
        discountedLineMinor: 160_000,
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

function pendingResponse() {
  return new Promise<Response>(() => {});
}

function getFetchBody(callIndex: number) {
  const options = fetchMock.mock.calls[callIndex]?.[1];

  if (!options?.body || typeof options.body !== "string") {
    throw new Error(`Fetch call ${callIndex} has no JSON body.`);
  }

  return JSON.parse(options.body) as Record<string, unknown>;
}

function submitCheckout() {
  fireEvent.submit(
    document.querySelector<HTMLFormElement>("#checkout-form")!,
  );
}

describe("Checkout coupon revalidation", () => {
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

  it("does not render coupon entry controls", () => {
    render(<CheckoutPageContent />);

    expect(
      screen.queryByRole("textbox", { name: "Coupon code" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).toBeNull();
  });

  it("reloads and revalidates a stored coupon against the current cart", async () => {
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, "SOMBRE");
    fetchMock.mockImplementationOnce(() => jsonResponse(preview()));

    render(<CheckoutPageContent />);

    await screen.findByRole("button", {
      name: "Remove SOMBRE coupon",
    });
    expect(
      screen.getByRole("region", { name: "Applied coupon" }),
    ).toHaveTextContent("Coupon SOMBRE applied");
    expect(
      screen.getByRole("region", { name: "Applied coupon" }),
    ).toHaveTextContent("Discount: −HK$400.00");
    expect(screen.getByText("Original subtotal · 2 items")).toBeInTheDocument();
    expect(screen.getByText("Discounted subtotal")).toBeInTheDocument();
    expect(screen.getByText("HK$50.00")).toBeInTheDocument();
    expect(screen.getByText("HK$1,650.00")).toBeInTheDocument();
    expect(getFetchBody(0)).toEqual({
      code: "SOMBRE",
      cartItems: [
        {
          id: PRODUCT_ID,
          slug: "product-a",
          quantity: 2,
        },
      ],
    });
  });

  it("sends only the successfully revalidated code to Session creation", async () => {
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, "SOMBRE");
    fetchMock
      .mockImplementationOnce(() => jsonResponse(preview()))
      .mockImplementationOnce(pendingResponse);

    render(<CheckoutPageContent />);
    await screen.findByRole("button", {
      name: "Remove SOMBRE coupon",
    });
    submitCheckout();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/checkout/session");

    const sessionBody = getFetchBody(1);
    expect(sessionBody.couponCode).toBe("SOMBRE");
    expect(sessionBody.subtotal).toBe(2_000);
    expect(sessionBody).not.toHaveProperty("discount");
    expect(sessionBody).not.toHaveProperty("discountMinor");
    expect(sessionBody).not.toHaveProperty("totalMinor");
  });

  it("clears a failed stored coupon and displays the safe server message", async () => {
    const message = "This coupon is invalid, expired, or unavailable.";
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, "SOMBRE");
    fetchMock.mockImplementationOnce(() =>
      jsonResponse(
        { error: "invalid_coupon", message },
        400,
      ),
    );

    render(<CheckoutPageContent />);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBeNull();
    expect(screen.queryByText("Discount")).toBeNull();

    fetchMock.mockImplementationOnce(pendingResponse);
    submitCheckout();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/checkout/session");
    expect(getFetchBody(1).couponCode).toBeNull();
  });

  it("removes a revalidated coupon and restores normal totals", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, "SOMBRE");
    fetchMock.mockImplementationOnce(() => jsonResponse(preview()));

    render(<CheckoutPageContent />);
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

  it("preserves normal checkout when no coupon is stored", async () => {
    fetchMock.mockImplementationOnce(pendingResponse);

    render(<CheckoutPageContent />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue to Payment" }),
      ).toBeEnabled(),
    );
    submitCheckout();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/checkout/session");
    expect(getFetchBody(0).couponCode).toBeNull();
    expect(screen.getByText("Subtotal · 2 items")).toBeInTheDocument();
  });

  it("preserves and revalidates the coupon after a checkout refresh", async () => {
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, "SOMBRE");
    fetchMock
      .mockImplementationOnce(() => jsonResponse(preview()))
      .mockImplementationOnce(() => jsonResponse(preview()));

    const firstView = render(<CheckoutPageContent />);
    await screen.findByRole("button", {
      name: "Remove SOMBRE coupon",
    });
    firstView.unmount();

    render(<CheckoutPageContent />);

    expect(
      await screen.findByRole("button", {
        name: "Remove SOMBRE coupon",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBe("SOMBRE");
  });

  it("discards an invalid stored value without sending it to either API", async () => {
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, " sombre ");

    render(<CheckoutPageContent />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue to Payment" }),
      ).toBeEnabled(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(COUPON_STORAGE_KEY),
    ).toBeNull();
  });
});
