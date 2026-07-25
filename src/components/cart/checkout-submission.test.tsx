// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/lib/cart/cart";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

const testState = vi.hoisted(() => ({
  cartItems: [] as CartItem[],
}));

const mocks = vi.hoisted(() => ({
  saveCheckoutCartSnapshot: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("@/hooks/use-cart-items", () => ({
  useCartItems: () => ({
    cartItems: testState.cartItems,
    setCartItems: vi.fn(),
  }),
}));

// Only the snapshot write is stubbed; every other cart helper keeps its real
// implementation so nothing about cart maths is faked away here.
vi.mock("@/lib/cart/cart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cart/cart")>();

  return {
    ...actual,
    saveCheckoutCartSnapshot: mocks.saveCheckoutCartSnapshot,
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

import { CheckoutPageContent } from "./checkout-page-content";

const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_123";
const SESSION_ID = "cs_test_123";

const fetchMock = vi.fn<typeof fetch>();
const originalLocation = Object.getOwnPropertyDescriptor(window, "location")!;

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

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function sessionResponse() {
  return jsonResponse({ sessionId: SESSION_ID, url: STRIPE_URL });
}

/** Resolves only when the returned `release` is called. */
function deferredResponse() {
  let release: () => void = () => {};
  const promise = new Promise<Response>((resolve) => {
    release = () =>
      resolve(
        new Response(JSON.stringify({ sessionId: SESSION_ID, url: STRIPE_URL }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
  });

  return { promise, release };
}

function checkoutForm() {
  return document.querySelector<HTMLFormElement>("#checkout-form")!;
}

function submitCheckout() {
  fireEvent.submit(checkoutForm());
}

function sessionCalls() {
  return fetchMock.mock.calls.filter(
    ([input]) => input === "/api/checkout/session",
  );
}

function submitButton() {
  return screen.getByRole("button", { name: /Continue to Payment|Opening Stripe/ });
}

describe("checkout submission safety", () => {
  beforeEach(() => {
    testState.cartItems = [cartItem()];
    window.sessionStorage.clear();
    fetchMock.mockReset();
    mocks.saveCheckoutCartSnapshot.mockReset();
    mocks.saveCheckoutCartSnapshot.mockReturnValue(true);
    mocks.assign.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation.value, assign: mocks.assign },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Object.defineProperty(window, "location", originalLocation);
  });

  describe("snapshot failure after a Stripe Session exists", () => {
    it("still redirects to Stripe when the snapshot cannot be stored", async () => {
      // Storage blocked or full: the write reports failure rather than throwing.
      mocks.saveCheckoutCartSnapshot.mockReturnValue(false);
      fetchMock.mockImplementationOnce(sessionResponse);

      render(<CheckoutPageContent />);
      submitCheckout();

      await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(STRIPE_URL));
      expect(sessionCalls()).toHaveLength(1);
    });

    it("still redirects when the snapshot write throws outright", async () => {
      mocks.saveCheckoutCartSnapshot.mockImplementation(() => {
        throw new DOMException("Quota exceeded.", "QuotaExceededError");
      });
      fetchMock.mockImplementationOnce(sessionResponse);

      render(<CheckoutPageContent />);
      submitCheckout();

      // Even a throwing snapshot must not be mistaken for checkout failing.
      await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(STRIPE_URL));
    });

    it("does not report a checkout failure when only the snapshot failed", async () => {
      mocks.saveCheckoutCartSnapshot.mockReturnValue(false);
      fetchMock.mockImplementationOnce(sessionResponse);

      render(<CheckoutPageContent />);
      submitCheckout();

      await waitFor(() => expect(mocks.assign).toHaveBeenCalled());

      // The customer is never told checkout failed, because it did not: a
      // payable Session exists and telling them otherwise invites a second one.
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.queryByText(/Could not start Stripe Checkout/),
      ).toBeNull();
    });

    it("keeps the submit button disabled after the Session is created", async () => {
      mocks.saveCheckoutCartSnapshot.mockReturnValue(false);
      fetchMock.mockImplementationOnce(sessionResponse);

      render(<CheckoutPageContent />);
      submitCheckout();

      await waitFor(() => expect(mocks.assign).toHaveBeenCalled());
      expect(submitButton()).toBeDisabled();

      // And a further submit attempt cannot reach the API.
      submitCheckout();
      submitCheckout();

      await waitFor(() => expect(sessionCalls()).toHaveLength(1));
    });

    it("does not clear or reduce the cart when the snapshot was not stored", async () => {
      mocks.saveCheckoutCartSnapshot.mockReturnValue(false);
      fetchMock.mockImplementationOnce(sessionResponse);
      window.localStorage.setItem(
        "sombre-cart",
        JSON.stringify([cartItem(2)]),
      );

      render(<CheckoutPageContent />);
      submitCheckout();

      await waitFor(() => expect(mocks.assign).toHaveBeenCalled());

      // Checkout never touches the cart; only a confirmed order does, and then
      // only via a snapshot it can actually read.
      expect(
        JSON.parse(window.localStorage.getItem("sombre-cart") ?? "null"),
      ).toEqual([cartItem(2)]);

      window.localStorage.removeItem("sombre-cart");
    });
  });

  describe("duplicate submission protection", () => {
    it("blocks a second submission while the first is still in flight", async () => {
      const deferred = deferredResponse();
      fetchMock.mockImplementationOnce(() => deferred.promise);

      render(<CheckoutPageContent />);

      submitCheckout();
      submitCheckout();
      submitCheckout();

      await waitFor(() => expect(sessionCalls()).toHaveLength(1));

      deferred.release();
      await waitFor(() => expect(mocks.assign).toHaveBeenCalled());

      // Only ever one Stripe Session for the three attempts.
      expect(sessionCalls()).toHaveLength(1);
    });

    it("rejects repeat submissions dispatched in the same tick", async () => {
      const deferred = deferredResponse();
      fetchMock.mockImplementationOnce(() => deferred.promise);

      render(<CheckoutPageContent />);

      // Fired back to back with no await between them, so the disabled state
      // has had no chance to flush. The synchronous lock is what stops these.
      const form = checkoutForm();
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(sessionCalls()).toHaveLength(1));

      deferred.release();
      await waitFor(() => expect(mocks.assign).toHaveBeenCalledTimes(1));
    });

    it("shows the loading label while a submission is in flight", async () => {
      const deferred = deferredResponse();
      fetchMock.mockImplementationOnce(() => deferred.promise);

      render(<CheckoutPageContent />);
      submitCheckout();

      await screen.findByRole("button", { name: "Opening Stripe…" });
      expect(submitButton()).toBeDisabled();

      deferred.release();
      await waitFor(() => expect(mocks.assign).toHaveBeenCalled());
    });
  });

  describe("Session creation failure", () => {
    it("shows the safe error and allows a retry when no Session was created", async () => {
      fetchMock.mockImplementationOnce(() =>
        jsonResponse({ error: "Some items are no longer available." }, 409),
      );

      render(<CheckoutPageContent />);
      submitCheckout();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Some items are no longer available.",
      );
      // No Session exists, so nothing was snapshotted and no redirect happened.
      expect(mocks.saveCheckoutCartSnapshot).not.toHaveBeenCalled();
      expect(mocks.assign).not.toHaveBeenCalled();

      // The button is usable again, and a retry does reach the API.
      await waitFor(() => expect(submitButton()).toBeEnabled());

      fetchMock.mockImplementationOnce(sessionResponse);
      submitCheckout();

      await waitFor(() => expect(sessionCalls()).toHaveLength(2));
      await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(STRIPE_URL));
    });

    it("allows a retry after a network failure", async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.reject(new Error("Failed to fetch")),
      );

      render(<CheckoutPageContent />);
      submitCheckout();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to fetch",
      );
      await waitFor(() => expect(submitButton()).toBeEnabled());

      fetchMock.mockImplementationOnce(sessionResponse);
      submitCheckout();

      await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith(STRIPE_URL));
    });

    it("treats a 200 response with no Session id as a failure that can be retried", async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse({ url: STRIPE_URL }));

      render(<CheckoutPageContent />);
      submitCheckout();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not start Stripe Checkout.",
      );
      expect(mocks.saveCheckoutCartSnapshot).not.toHaveBeenCalled();
      expect(mocks.assign).not.toHaveBeenCalled();
      await waitFor(() => expect(submitButton()).toBeEnabled());
    });
  });

  describe("redirect failure after a Session exists", () => {
    it("offers a manual link instead of an error when navigation throws", async () => {
      mocks.assign.mockImplementation(() => {
        throw new Error("Navigation blocked.");
      });
      fetchMock.mockImplementationOnce(sessionResponse);

      render(<CheckoutPageContent />);
      submitCheckout();

      const link = await screen.findByRole("link", {
        name: "Continue to secure payment",
      });
      expect(link).toHaveAttribute("href", STRIPE_URL);

      // Explicitly steers away from retrying, and shows no failure alert.
      expect(
        screen.getByText(/do not start checkout again/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(submitButton()).toBeDisabled();
    });

    it("offers the manual link when navigation silently does nothing", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      // assign() resolves without throwing but the page never leaves.
      fetchMock.mockImplementationOnce(sessionResponse);

      render(<CheckoutPageContent />);
      submitCheckout();

      await waitFor(() => expect(mocks.assign).toHaveBeenCalled());
      expect(
        screen.queryByRole("link", { name: "Continue to secure payment" }),
      ).toBeNull();

      await vi.advanceTimersByTimeAsync(3_000);

      const link = await screen.findByRole("link", {
        name: "Continue to secure payment",
      });
      expect(link).toHaveAttribute("href", STRIPE_URL);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
