// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

// The form imports these Server Actions, which reach the server-only data
// layer. Mocking them keeps this test to the page's own rendering.
vi.mock("@/app/admin/announcements/actions", () => ({
  createAnnouncementAction: vi.fn(),
  updateAnnouncementAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import NewAdminAnnouncementPage from "./page";

describe("admin new announcement page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("checks admin authentication before rendering the form", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(NewAdminAnnouncementPage()).rejects.toThrow(
      "redirect to admin login",
    );
  });

  it("renders an empty create form", async () => {
    render(await NewAdminAnnouncementPage());

    expect(screen.getByRole("textbox", { name: /^prefix/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /^highlight/i })).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: /active/i })).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Create announcement" }),
    ).toBeInTheDocument();
  });

  it("offers no position control, since position is assigned by the data layer", async () => {
    render(await NewAdminAnnouncementPage());

    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("no longer renders the old page-level description beneath the title", async () => {
    render(await NewAdminAnnouncementPage());

    expect(
      screen.queryByText(/added to the end of the current order/i),
    ).toBeNull();
  });

  it("offers a way back to the list", async () => {
    render(await NewAdminAnnouncementPage());

    expect(
      screen.getByRole("link", { name: /All announcements/ }),
    ).toHaveAttribute("href", "/admin/announcements");
  });
});
