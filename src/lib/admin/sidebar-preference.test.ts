// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY,
  ADMIN_SIDEBAR_PREFERENCE_VERSION,
  readAdminSidebarPreference,
  writeAdminSidebarPreference,
} from "./sidebar-preference";

const originalStorageDescriptor = Object.getOwnPropertyDescriptor(
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

function storageError(message: string): never {
  throw new DOMException(message, "SecurityError");
}

describe("admin sidebar preference", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = installStorage();
  });

  afterEach(() => {
    Object.defineProperty(
      window,
      "localStorage",
      originalStorageDescriptor,
    );
  });

  it("restores and writes the strict current-version preference", () => {
    storage.set(
      ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
        expanded: true,
      }),
    );

    expect(readAdminSidebarPreference()).toEqual({
      version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
      expanded: true,
    });

    expect(writeAdminSidebarPreference(false)).toBe(true);
    expect(
      JSON.parse(storage.get(ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY) ?? ""),
    ).toEqual({
      version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
      expanded: false,
    });
  });

  it("defaults to expanded when the preference is missing", () => {
    expect(readAdminSidebarPreference()).toEqual({
      version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
      expanded: true,
    });
  });

  it.each([
    ["malformed JSON", "{not-json"],
    [
      "the wrong version",
      JSON.stringify({ version: 2, expanded: true }),
    ],
    [
      "a non-boolean value",
      JSON.stringify({ version: 1, expanded: "yes" }),
    ],
    [
      "an object with extra fields",
      JSON.stringify({ version: 1, expanded: true, future: true }),
    ],
  ])("defaults safely and clears %s", (_label, rawValue) => {
    storage.set(ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY, rawValue);

    expect(readAdminSidebarPreference()).toEqual({
      version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
      expanded: true,
    });
    expect(storage.has(ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY)).toBe(false);
  });

  it("never throws when reading the localStorage property is blocked", () => {
    installBlockedStorage();

    expect(() => readAdminSidebarPreference()).not.toThrow();
    expect(readAdminSidebarPreference()).toEqual({
      version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
      expanded: true,
    });
    expect(writeAdminSidebarPreference(true)).toBe(false);
  });

  it("uses the expanded default when no browser window is available", () => {
    const browserWindow = window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      expect(readAdminSidebarPreference()).toEqual({
        version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
        expanded: true,
      });
      expect(writeAdminSidebarPreference(false)).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: browserWindow,
      });
    }
  });

  it("never throws when getItem fails", () => {
    installStorage({
      getItem: () => storageError("Blocked read"),
    });

    expect(() => readAdminSidebarPreference()).not.toThrow();
    expect(readAdminSidebarPreference()).toEqual({
      version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
      expanded: true,
    });
  });

  it("never throws and reports failure when setItem fails", () => {
    installStorage({
      setItem: () => storageError("Blocked write"),
    });

    expect(() => writeAdminSidebarPreference(true)).not.toThrow();
    expect(writeAdminSidebarPreference(true)).toBe(false);
  });
});
