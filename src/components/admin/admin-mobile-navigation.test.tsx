// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
  signOutAdmin: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("@/app/admin/actions", () => ({
  signOutAdmin: mocks.signOutAdmin,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: ComponentProps<"a">) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

import { AdminMobileNavigation } from "./admin-mobile-navigation";

function renderNavigation(pathname = "/admin") {
  mocks.usePathname.mockReturnValue(pathname);
  return render(<AdminMobileNavigation email="admin@example.com" />);
}

async function openDrawer() {
  const user = userEvent.setup();
  const menuButton = screen.getByRole("button", {
    name: "Open admin navigation",
  });

  await user.click(menuButton);

  return {
    user,
    menuButton,
    drawer: screen.getByRole("dialog", { name: "Admin navigation" }),
  };
}

describe("AdminMobileNavigation", () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
    mocks.signOutAdmin.mockReset();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("shows the active page title and an accessible menu trigger", () => {
    const { container } = renderNavigation("/admin/orders/order-1");

    const header = screen.getByRole("banner");
    const drawer = screen.getByRole("dialog", { name: "Admin navigation" });
    const trigger = within(header).getByRole("button", {
      name: "Open admin navigation",
    });

    expect(within(header).getByText("Orders")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-controls", "admin-navigation-drawer");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(
      within(drawer).queryByRole("button", {
        name: /(?:collapse|expand) sidebar/i,
      }),
    ).toBeNull();
    expect(container.querySelector(".lucide")).toBeNull();
  });

  it("opens the dialog, locks scrolling, and focuses its named close button", async () => {
    document.body.style.overflow = "auto";
    renderNavigation();

    const { drawer, menuButton } = await openDrawer();
    const closeButton = within(drawer).getByRole("button", {
      name: "Close admin navigation",
    });

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(closeButton).toHaveFocus());

    await userEvent.setup().click(closeButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(drawer).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("auto");
    await waitFor(() => expect(menuButton).toHaveFocus());
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    renderNavigation();

    const { user, menuButton, drawer } = await openDrawer();
    await user.keyboard("{Escape}");

    expect(drawer).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(menuButton).toHaveFocus());
  });

  it("closes from both the overlay and a selected navigation item", async () => {
    renderNavigation();

    let opened = await openDrawer();
    const overlay = document.querySelector<HTMLButtonElement>(
      "[data-admin-navigation-overlay]",
    );

    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(opened.drawer).toHaveAttribute("inert");
    await waitFor(() => expect(opened.menuButton).toHaveFocus());

    opened = await openDrawer();
    await opened.user.click(
      within(opened.drawer).getByRole("link", { name: "Inventory" }),
    );

    expect(opened.drawer).toHaveAttribute("inert");
    await waitFor(() => expect(opened.menuButton).toHaveFocus());
  });

  it("wraps keyboard focus at both ends of the open drawer", async () => {
    renderNavigation();

    const { user, drawer } = await openDrawer();
    const closeButton = within(drawer).getByRole("button", {
      name: "Close admin navigation",
    });
    const signOutButton = within(drawer).getByRole("button", {
      name: "Sign Out",
    });

    await waitFor(() => expect(closeButton).toHaveFocus());
    await user.tab({ shift: true });
    expect(signOutButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it("closes when the pathname changes without a link click", async () => {
    const { rerender } = renderNavigation("/admin/orders");
    const { menuButton, drawer } = await openDrawer();

    mocks.usePathname.mockReturnValue("/admin/coupons");
    rerender(<AdminMobileNavigation email="admin@example.com" />);

    await waitFor(() => expect(drawer).toHaveAttribute("inert"));
    expect(
      within(screen.getByRole("banner")).getByText("Coupons"),
    ).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(menuButton).toHaveFocus());
  });

  it("restores the previous body overflow if it unmounts while open", async () => {
    document.body.style.overflow = "clip";
    const { unmount } = renderNavigation();

    await openDrawer();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("clip");
  });
});
