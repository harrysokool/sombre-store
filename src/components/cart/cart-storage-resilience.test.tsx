// @vitest-environment jsdom

// Every other cart component test mocks `@/hooks/use-cart-items` (or the
// entire `@/lib/cart/cart` module) outright, which proves the component's own
// logic but never proves the real storage-reading path survives broken
// storage once it's actually wired into a mounted tree. This file mounts the
// real hook and the real cart module against deliberately broken
// `localStorage`, for exactly the surfaces the audit named: the navbar
// indicator, the add-to-cart button, and the cart/checkout pages (via
// useCartItems, exercised directly here rather than through the full pages,
// since both pages already have their own dedicated test suites that mock
// this hook for unrelated reasons).

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { useCartItems } from "@/hooks/use-cart-items";
import { NavbarCartIndicator } from "@/components/cart/navbar-cart-indicator";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CART_STORAGE_KEY } from "@/lib/cart/cart";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const originalDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
)!;

function installStorage(overrides: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
    ...overrides,
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });

  return data;
}

function installBlockedStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Access is denied.", "SecurityError");
    },
  });
}

function throwing(message: string): never {
  throw new DOMException(message, "SecurityError");
}

function product() {
  return {
    id: PRODUCT_ID,
    slug: "product-a",
    name: "Product A",
    price: 1_000,
    size_label: "One Size",
    image_url: null,
    stock_quantity: 5,
  };
}

/** Exercises the same hook the cart and checkout pages render through. */
function CartPageStandIn() {
  const { cartItems } = useCartItems();

  if (cartItems === null) {
    return <p role="status">Loading your cart&hellip;</p>;
  }

  return (
    <p role="status">
      {cartItems.length === 0 ? "Your cart is empty" : `${cartItems.length} items`}
    </p>
  );
}

describe("cart surfaces survive broken storage", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "localStorage", originalDescriptor);
    vi.restoreAllMocks();
  });

  describe.each([
    ["blocked entirely", () => installBlockedStorage()],
    [
      "getItem throwing",
      () => installStorage({ getItem: () => throwing("blocked read") }),
    ],
    [
      "setItem throwing",
      () => installStorage({ setItem: () => throwing("quota exceeded") }),
    ],
    [
      "removeItem throwing",
      () => installStorage({ removeItem: () => throwing("blocked remove") }),
    ],
    [
      "malformed JSON stored",
      () => {
        const data = installStorage();
        data.set(CART_STORAGE_KEY, "{not valid json");
      },
    ],
    [
      "an invalid cart shape stored",
      () => {
        const data = installStorage();
        data.set(CART_STORAGE_KEY, JSON.stringify({ not: "an array" }));
      },
    ],
  ])("with storage %s", (_label, breakStorage) => {
    beforeEach(() => {
      breakStorage();
    });

    it("mounts the navbar cart indicator without crashing", async () => {
      expect(() => render(<NavbarCartIndicator />)).not.toThrow();
      expect(await screen.findByRole("link")).toBeInTheDocument();
      // No crash means no count is ever shown for data that couldn't be read.
      expect(screen.queryByText(/^\d+$/)).toBeNull();
    });

    it("mounts the add-to-cart button and allows a click without crashing", async () => {
      const user = userEvent.setup();
      expect(() => render(<AddToCartButton product={product()} />)).not.toThrow();

      const button = await screen.findByRole("button", { name: /Add to Cart/i });
      expect(button).toBeEnabled();

      await expect(user.click(button)).resolves.not.toThrow();
    });

    it("mounts a component using the real useCartItems hook without crashing", async () => {
      expect(() => render(<CartPageStandIn />)).not.toThrow();

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /Your cart is empty|Loading your cart/,
        ),
      );
    });
  });

  it("recovers once storage becomes available again (navbar)", async () => {
    installBlockedStorage();
    const { unmount } = render(<NavbarCartIndicator />);
    await screen.findByRole("link");
    unmount();

    installStorage();
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        {
          id: PRODUCT_ID,
          slug: "product-a",
          name: "Product A",
          price: 1_000,
          size_label: "One Size",
          image_url: null,
          stock_quantity: 5,
          quantity: 3,
        },
      ]),
    );

    render(<NavbarCartIndicator />);
    expect(await screen.findByLabelText("Cart with 3 items")).toBeInTheDocument();
  });
});
