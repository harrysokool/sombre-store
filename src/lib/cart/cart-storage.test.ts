// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addItemToCart,
  CART_STORAGE_KEY,
  CART_UPDATED_EVENT,
  clearCartItems,
  getCartItemCount,
  getCartItems,
  isCartStorageChange,
  reconcileCartWithCheckoutSession,
  saveCheckoutCartSnapshot,
  type CartItem,
} from "./cart";
import {
  isStorageAvailable,
  readStoredJson,
  readStoredText,
  removeStoredValue,
  writeStoredJson,
  writeStoredText,
} from "./storage";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "cs_test_123";
const SNAPSHOT_KEY = `sombre-checkout-session:${SESSION_ID}`;

function cartItem(id: string, quantity: number): CartItem {
  return {
    id,
    slug: `product-${id.slice(0, 4)}`,
    name: `Product ${id.slice(0, 4)}`,
    price: 1_000,
    size_label: "One Size",
    image_url: null,
    stock_quantity: 10,
    quantity,
  };
}

type Hooks = {
  onGet?: (key: string) => void;
  onSet?: (key: string, value: string) => void;
  onRemove?: (key: string) => void;
};

const originalDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
)!;

/** A localStorage stand-in whose methods can be made to throw on demand. */
function installStorage(hooks: Hooks = {}) {
  const data = new Map<string, string>();

  const storage: Storage = {
    getItem(key) {
      hooks.onGet?.(key);
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      hooks.onSet?.(key, value);
      data.set(key, String(value));
    },
    removeItem(key) {
      hooks.onRemove?.(key);
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    get length() {
      return data.size;
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });

  return data;
}

/**
 * The privacy-mode case: reading the `localStorage` property itself throws,
 * before any method on it can be called.
 */
function installBlockedStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Access is denied.", "SecurityError");
    },
  });
}

function quotaError() {
  return new DOMException("Quota exceeded.", "QuotaExceededError");
}

describe("cart browser storage safety", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installStorage();
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", originalDescriptor);
    vi.restoreAllMocks();
  });

  describe("reading a stored cart", () => {
    it("loads valid cart data unchanged", () => {
      const items = [cartItem(PRODUCT_A, 2), cartItem(PRODUCT_B, 1)];
      store.set(CART_STORAGE_KEY, JSON.stringify(items));

      expect(getCartItems()).toEqual(items);
      expect(getCartItemCount()).toBe(3);
    });

    it("does not throw on malformed JSON, and clears the unusable value", () => {
      store.set(CART_STORAGE_KEY, "{not json at all");

      expect(() => getCartItems()).not.toThrow();
      expect(getCartItems()).toEqual([]);
      // Nothing was recoverable, so it is dropped rather than re-parsed on
      // every future read.
      expect(store.has(CART_STORAGE_KEY)).toBe(false);
    });

    it.each([
      ["an object", { id: PRODUCT_A, quantity: 1 }],
      ["a string", "sombre-cart"],
      ["a number", 42],
      ["null", null],
    ])("refuses to treat %s as a cart", (_label, value) => {
      store.set(CART_STORAGE_KEY, JSON.stringify(value));

      expect(getCartItems()).toEqual([]);
      expect(store.has(CART_STORAGE_KEY)).toBe(false);
    });

    it("drops individual malformed items without losing the valid ones", () => {
      store.set(
        CART_STORAGE_KEY,
        JSON.stringify([
          cartItem(PRODUCT_A, 2),
          { id: PRODUCT_B, quantity: "many" },
          { ...cartItem(PRODUCT_B, 1), price: "1000" },
          null,
        ]),
      );

      // Only the well-formed line survives; nothing invalid is promoted into
      // the cart, and the rest of the cart is not thrown away with it.
      expect(getCartItems()).toEqual([cartItem(PRODUCT_A, 2)]);
    });

    it.each([
      ["a zero quantity", { ...cartItem(PRODUCT_A, 1), quantity: 0 }],
      ["a negative quantity", { ...cartItem(PRODUCT_A, 1), quantity: -3 }],
      ["a fractional quantity", { ...cartItem(PRODUCT_A, 1), quantity: 1.5 }],
      ["a quantity over the cap", { ...cartItem(PRODUCT_A, 1), quantity: 999 }],
    ])("never accepts %s from storage", (_label, item) => {
      store.set(CART_STORAGE_KEY, JSON.stringify([item]));

      expect(getCartItems()).toEqual([]);
    });

    it("does not crash when getItem throws", () => {
      installStorage({
        onGet() {
          throw new DOMException("Access is denied.", "SecurityError");
        },
      });

      expect(() => getCartItems()).not.toThrow();
      expect(getCartItems()).toEqual([]);
      expect(getCartItemCount()).toBe(0);
    });

    it("does not crash when storage is blocked entirely", () => {
      installBlockedStorage();

      expect(isStorageAvailable()).toBe(false);
      expect(() => getCartItems()).not.toThrow();
      expect(getCartItems()).toEqual([]);
      expect(readStoredText(CART_STORAGE_KEY)).toEqual({
        status: "unavailable",
      });
    });
  });

  describe("writing to storage", () => {
    it("does not crash when setItem throws, and reports the failure", () => {
      installStorage({
        onSet() {
          throw new DOMException("Access is denied.", "SecurityError");
        },
      });

      expect(() => addItemToCart(cartItem(PRODUCT_A, 1))).not.toThrow();
      expect(writeStoredText(CART_STORAGE_KEY, "[]")).toBe(false);
      expect(writeStoredJson(CART_STORAGE_KEY, [])).toBe(false);
    });

    it("handles a quota error the same way as any other write failure", () => {
      const stored = installStorage({
        onSet() {
          throw quotaError();
        },
      });

      expect(() => addItemToCart(cartItem(PRODUCT_A, 1))).not.toThrow();
      expect(writeStoredJson(CART_STORAGE_KEY, [cartItem(PRODUCT_A, 1)])).toBe(
        false,
      );
      expect(stored.has(CART_STORAGE_KEY)).toBe(false);
    });

    it("still notifies listeners when a write fails, so the UI shows what is really saved", () => {
      installStorage({
        onSet() {
          throw quotaError();
        },
      });
      const listener = vi.fn();
      window.addEventListener(CART_UPDATED_EVENT, listener);

      addItemToCart(cartItem(PRODUCT_A, 1));

      expect(listener).toHaveBeenCalledTimes(1);
      // The read is the source of truth, and it never saw the write.
      expect(getCartItems()).toEqual([]);

      window.removeEventListener(CART_UPDATED_EVENT, listener);
    });

    it("does not crash when removeItem throws", () => {
      store = installStorage({
        onRemove() {
          throw new DOMException("Access is denied.", "SecurityError");
        },
      });
      store.set(CART_STORAGE_KEY, "{broken");

      // Reading invalid data tries to clear it; the failed removal must not
      // escape.
      expect(() => getCartItems()).not.toThrow();
      expect(getCartItems()).toEqual([]);
      expect(removeStoredValue(CART_STORAGE_KEY)).toBe(false);
    });

    it("refuses to write a value that cannot be serialized", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(writeStoredJson(CART_STORAGE_KEY, circular)).toBe(false);
      expect(store.has(CART_STORAGE_KEY)).toBe(false);
    });

    it("keeps normal cart behaviour unchanged when storage works", () => {
      addItemToCart(cartItem(PRODUCT_A, 1), 2);
      addItemToCart(cartItem(PRODUCT_B, 1), 1);

      expect(getCartItems().map((item) => [item.id, item.quantity])).toEqual([
        [PRODUCT_A, 2],
        [PRODUCT_B, 1],
      ]);

      clearCartItems();

      expect(getCartItems()).toEqual([]);
      expect(store.get(CART_STORAGE_KEY)).toBe("[]");
    });
  });

  describe("storage read results", () => {
    it("separates empty, invalid, and unavailable", () => {
      const parseArray = (value: unknown) =>
        Array.isArray(value) ? value : null;

      expect(readStoredJson("missing-key", parseArray)).toEqual({
        status: "empty",
      });

      store.set("bad-key", "]]not json[[");
      expect(readStoredJson("bad-key", parseArray)).toEqual({
        status: "invalid",
      });

      store.set("wrong-shape", JSON.stringify({ nope: true }));
      expect(readStoredJson("wrong-shape", parseArray)).toEqual({
        status: "invalid",
      });

      store.set("good-key", JSON.stringify([1, 2]));
      expect(readStoredJson("good-key", parseArray)).toEqual({
        status: "ok",
        value: [1, 2],
      });

      installBlockedStorage();
      expect(readStoredJson("good-key", parseArray)).toEqual({
        status: "unavailable",
      });
    });

    it("treats a validator that throws as a rejection rather than crashing", () => {
      store.set("key", JSON.stringify([1]));

      expect(
        readStoredJson("key", () => {
          throw new Error("validator blew up");
        }),
      ).toEqual({ status: "invalid" });
    });
  });

  describe("cross-tab storage events", () => {
    it.each([
      ["null (the whole area was cleared)", null],
      ["the cart key", CART_STORAGE_KEY],
    ])("resyncs for %s", (_label, key) => {
      expect(isCartStorageChange(new StorageEvent("storage", { key }))).toBe(
        true,
      );
    });

    it("ignores an event for an unrelated key", () => {
      expect(
        isCartStorageChange(
          new StorageEvent("storage", { key: "sombre-coupon-code" }),
        ),
      ).toBe(false);
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["a number", 7],
      ["a string", "storage"],
      ["an object with no key", { type: "storage" }],
      ["an in-page CustomEvent", new CustomEvent(CART_UPDATED_EVENT)],
    ])("does not throw on %s", (_label, event) => {
      expect(() => isCartStorageChange(event)).not.toThrow();
      expect(typeof isCartStorageChange(event)).toBe("boolean");
    });

    it("applies a valid cross-tab cart update on the next read", () => {
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 1)]));
      expect(getCartItems()).toEqual([cartItem(PRODUCT_A, 1)]);

      // Another tab writes, then the browser notifies this one.
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 3)]));
      const event = new StorageEvent("storage", { key: CART_STORAGE_KEY });

      expect(isCartStorageChange(event)).toBe(true);
      expect(getCartItems()).toEqual([cartItem(PRODUCT_A, 3)]);
    });

    it("ignores a cross-tab write of malformed data instead of trusting it", () => {
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 1)]));
      store.set(CART_STORAGE_KEY, '[{"id":"x","quantity":"lots"}]');

      expect(
        isCartStorageChange(new StorageEvent("storage", { key: CART_STORAGE_KEY })),
      ).toBe(true);
      expect(getCartItems()).toEqual([]);
    });
  });

  describe("checkout snapshot and reconciliation", () => {
    it("removes only the quantities that belong to the confirmed session", () => {
      const cart = [cartItem(PRODUCT_A, 3), cartItem(PRODUCT_B, 2)];
      store.set(CART_STORAGE_KEY, JSON.stringify(cart));

      expect(saveCheckoutCartSnapshot(SESSION_ID, [cartItem(PRODUCT_A, 2)])).toBe(
        true,
      );

      const reconciled = reconcileCartWithCheckoutSession(SESSION_ID);

      // Two of A were purchased, so one remains. B was never in the session.
      expect(reconciled.map((item) => [item.id, item.quantity])).toEqual([
        [PRODUCT_A, 1],
        [PRODUCT_B, 2],
      ]);
      expect(getCartItems().map((item) => [item.id, item.quantity])).toEqual([
        [PRODUCT_A, 1],
        [PRODUCT_B, 2],
      ]);
      // The snapshot is consumed, so a replayed success page cannot subtract
      // the same quantities twice.
      expect(store.has(SNAPSHOT_KEY)).toBe(false);
    });

    it("subtracts only once when reconciliation runs twice for the same session", () => {
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 3)]));
      saveCheckoutCartSnapshot(SESSION_ID, [cartItem(PRODUCT_A, 2)]);

      expect(
        reconcileCartWithCheckoutSession(SESSION_ID).map((i) => i.quantity),
      ).toEqual([1]);

      // The success page can re-run this on any re-render or reload. The
      // snapshot was consumed by the first pass, so the second finds nothing
      // to prove and leaves the remaining item alone.
      expect(
        reconcileCartWithCheckoutSession(SESSION_ID).map((i) => i.quantity),
      ).toEqual([1]);
      expect(getCartItems().map((i) => i.quantity)).toEqual([1]);
    });

    it("drops a line entirely when the whole quantity was purchased", () => {
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 2)]));
      saveCheckoutCartSnapshot(SESSION_ID, [cartItem(PRODUCT_A, 2)]);

      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual([]);
    });

    it("leaves the cart untouched when no snapshot was ever stored", () => {
      const cart = [cartItem(PRODUCT_A, 3), cartItem(PRODUCT_B, 2)];
      store.set(CART_STORAGE_KEY, JSON.stringify(cart));

      // This is the state after a snapshot write failed at checkout: the
      // purchased quantities cannot be proven, so nothing may be removed.
      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual(cart);
      expect(getCartItems()).toEqual(cart);
    });

    it("leaves the cart untouched when the snapshot is malformed", () => {
      const cart = [cartItem(PRODUCT_A, 3)];
      store.set(CART_STORAGE_KEY, JSON.stringify(cart));
      store.set(SNAPSHOT_KEY, "{{{ not json");

      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual(cart);
      expect(getCartItems()).toEqual(cart);
      expect(store.has(SNAPSHOT_KEY)).toBe(false);
    });

    it("leaves the cart untouched when the snapshot is not an array", () => {
      const cart = [cartItem(PRODUCT_A, 3)];
      store.set(CART_STORAGE_KEY, JSON.stringify(cart));
      store.set(SNAPSHOT_KEY, JSON.stringify({ [PRODUCT_A]: 3 }));

      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual(cart);
      expect(getCartItems()).toEqual(cart);
    });

    it("leaves the cart untouched when storage is blocked", () => {
      installBlockedStorage();

      expect(() => reconcileCartWithCheckoutSession(SESSION_ID)).not.toThrow();
      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual([]);
    });

    it("reports a failed snapshot write instead of throwing", () => {
      installStorage({
        onSet() {
          throw quotaError();
        },
      });

      expect(() =>
        saveCheckoutCartSnapshot(SESSION_ID, [cartItem(PRODUCT_A, 2)]),
      ).not.toThrow();
      expect(
        saveCheckoutCartSnapshot(SESSION_ID, [cartItem(PRODUCT_A, 2)]),
      ).toBe(false);
    });

    it("never subtracts more than the cart holds", () => {
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 1)]));
      // A snapshot claiming more than the cart currently has — the line is
      // removed, and no negative quantity can be produced.
      saveCheckoutCartSnapshot(SESSION_ID, [cartItem(PRODUCT_A, 5)]);

      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual([]);
    });

    it("keeps snapshots for different sessions independent", () => {
      store.set(CART_STORAGE_KEY, JSON.stringify([cartItem(PRODUCT_A, 3)]));
      saveCheckoutCartSnapshot("cs_test_other", [cartItem(PRODUCT_A, 3)]);

      // Reconciling a session with no snapshot of its own must not consume
      // another session's.
      expect(reconcileCartWithCheckoutSession(SESSION_ID)).toEqual([
        cartItem(PRODUCT_A, 3),
      ]);
      expect(store.has("sombre-checkout-session:cs_test_other")).toBe(true);
    });
  });
});
