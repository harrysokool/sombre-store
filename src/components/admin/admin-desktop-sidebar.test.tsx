// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY,
  ADMIN_SIDEBAR_PREFERENCE_VERSION,
} from "@/lib/admin/sidebar-preference";

const mocks = vi.hoisted(() => ({
  signOutAdmin: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({
  signOutAdmin: mocks.signOutAdmin,
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AdminDesktopSidebar } from "./admin-desktop-sidebar";

const EMAIL = "admin@example.com";
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
)!;

type StorageHooks = {
  onGet?: () => void;
  onSet?: () => void;
};

function installStorage(hooks: StorageHooks = {}) {
  const data = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => {
      hooks.onGet?.();
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      hooks.onSet?.();
      data.set(key, String(value));
    },
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
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

function installBlockedStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage blocked", "SecurityError");
    },
  });
}

function storedPreference(expanded: boolean) {
  return JSON.stringify({
    version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
    expanded,
  });
}

function renderSidebar() {
  return render(<AdminDesktopSidebar email={EMAIL} />);
}

function sidebar() {
  return screen.getByRole("complementary", { name: "Admin sidebar" });
}

describe("AdminDesktopSidebar", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = installStorage();
    mocks.signOutAdmin.mockReset();
    mocks.usePathname.mockReset();
    mocks.usePathname.mockReturnValue("/admin/orders/order-1");
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(
      window,
      "localStorage",
      originalStorageDescriptor,
    );
    vi.restoreAllMocks();
  });

  it("starts expanded with labels, the close icon, and correct aria state", () => {
    renderSidebar();

    const aside = sidebar();
    const toggle = within(aside).getByRole("button", {
      name: "Collapse sidebar",
    });
    const links = within(
      within(aside).getByRole("navigation", {
        name: "Admin primary navigation",
      }),
    ).getAllByRole("link");

    expect(aside).toHaveAttribute("data-sidebar-state", "expanded");
    expect(aside).toHaveClass("w-60", "overflow-x-clip");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("title", "Collapse sidebar");
    expect(toggle.querySelector("svg")).toHaveClass(
      "lucide-panel-left-close",
    );

    for (const link of links) {
      expect(link.querySelector("span")).not.toHaveClass("sr-only");
      expect(link.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  it("collapses to icon-only navigation without losing accessible names", async () => {
    const user = userEvent.setup();
    renderSidebar();

    const collapse = within(sidebar()).getByRole("button", {
      name: "Collapse sidebar",
    });
    await user.click(collapse);

    const aside = sidebar();
    const expand = within(aside).getByRole("button", {
      name: "Expand sidebar",
    });

    expect(aside).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(aside).toHaveClass("w-[4.5rem]");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute("title", "Expand sidebar");
    expect(expand.querySelector("svg")).toHaveClass(
      "lucide-panel-left-open",
    );
    expect(expand).toHaveFocus();

    for (const link of within(aside)
      .getByRole("navigation", { name: "Admin primary navigation" })
      .querySelectorAll<HTMLAnchorElement>("a")) {
      expect(link).toHaveAccessibleName(link.textContent!);
      expect(link).toHaveAttribute("title", link.textContent!);
      expect(link.querySelector("span")).toHaveClass("sr-only");
    }

    expect(
      within(aside).getByRole("img", {
        name: `Signed in as ${EMAIL}`,
      }),
    ).toHaveAttribute("title", `Signed in as ${EMAIL}`);
    expect(
      within(aside).getByRole("link", { name: "View store" }),
    ).toHaveAttribute("href", "/");
    expect(
      within(aside).getByRole("button", { name: "Sign Out" }),
    ).toHaveAttribute("type", "submit");
  });

  it("saves both states and restores a collapsed preference", async () => {
    const user = userEvent.setup();
    const firstRender = renderSidebar();

    await user.click(
      within(sidebar()).getByRole("button", {
        name: "Collapse sidebar",
      }),
    );

    expect(
      storage.get(ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY),
    ).toBe(storedPreference(false));

    firstRender.unmount();
    renderSidebar();

    expect(sidebar()).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );

    await user.click(
      within(sidebar()).getByRole("button", {
        name: "Expand sidebar",
      }),
    );

    expect(
      storage.get(ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY),
    ).toBe(storedPreference(true));
    expect(sidebar()).toHaveAttribute("data-sidebar-state", "expanded");
  });

  it("falls back expanded when storage is blocked but still toggles safely", async () => {
    installBlockedStorage();

    expect(() => renderSidebar()).not.toThrow();
    expect(sidebar()).toHaveAttribute("data-sidebar-state", "expanded");

    await userEvent.setup().click(
      within(sidebar()).getByRole("button", {
        name: "Collapse sidebar",
      }),
    );

    expect(sidebar()).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );
  });

  it("keeps the in-memory control usable when preference writes fail", async () => {
    installStorage({
      onSet() {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    });
    renderSidebar();

    await userEvent.setup().click(
      within(sidebar()).getByRole("button", {
        name: "Collapse sidebar",
      }),
    );

    expect(sidebar()).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );
    expect(
      within(sidebar()).getByRole("button", {
        name: "Expand sidebar",
      }),
    ).toHaveFocus();
  });

  it("keeps the in-memory control usable when preference reads fail", async () => {
    installStorage({
      onGet() {
        throw new DOMException("Blocked read", "SecurityError");
      },
    });
    renderSidebar();

    expect(sidebar()).toHaveAttribute("data-sidebar-state", "expanded");

    await userEvent.setup().click(
      within(sidebar()).getByRole("button", {
        name: "Collapse sidebar",
      }),
    );

    expect(sidebar()).toHaveAttribute(
      "data-sidebar-state",
      "collapsed",
    );
  });

  it("uses a restrained reduced-motion-safe width transition and focus rings", () => {
    const { container } = renderSidebar();

    expect(sidebar()).toHaveClass(
      "transition-[width]",
      "duration-200",
      "motion-reduce:transition-none",
    );
    expect(
      within(sidebar()).getByRole("button", {
        name: "Collapse sidebar",
      }),
    ).toHaveClass(
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-stone-200/50",
    );

    for (const element of container.querySelectorAll<HTMLElement>(
      '[class*="text-stone-"]',
    )) {
      expect(element.className).not.toContain("text-stone-500");
      expect(element.className).not.toContain("text-stone-600");
    }
  });

  it("hydrates from the expanded server default before restoring storage", async () => {
    storage.set(
      ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY,
      storedPreference(false),
    );

    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <AdminDesktopSidebar email={EMAIL} />,
    );
    document.body.append(container);

    expect(
      container.querySelector('[aria-label="Admin sidebar"]'),
    ).toHaveAttribute("data-sidebar-state", "expanded");

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    let root: Root | undefined;

    await act(async () => {
      root = hydrateRoot(
        container,
        <AdminDesktopSidebar email={EMAIL} />,
      );
    });

    await waitFor(() => {
      expect(
        container.querySelector('[aria-label="Admin sidebar"]'),
      ).toHaveAttribute("data-sidebar-state", "collapsed");
    });

    const hydrationMessages = consoleError.mock.calls
      .flat()
      .join(" ")
      .match(/hydration|did not match|server rendered/gi);
    expect(hydrationMessages).toBeNull();

    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });
});
