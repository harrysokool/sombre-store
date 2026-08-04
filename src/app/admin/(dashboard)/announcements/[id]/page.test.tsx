// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  getAdminAnnouncement: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/announcements", () => ({
  getAdminAnnouncement: mocks.getAdminAnnouncement,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import EditAdminAnnouncementPage from "./page";

const ANNOUNCEMENT_ID = "11111111-1111-4111-8111-111111111111";

const ANNOUNCEMENT = {
  id: ANNOUNCEMENT_ID,
  prefix_text: "Use code",
  highlight_text: "HAPPY2026",
  suffix_text: "for up to 60% off selected products",
  link_label: "Shop Now",
  link_href: "/shop",
  is_active: true,
  sort_order: 0,
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

function renderPage(id = ANNOUNCEMENT_ID) {
  return EditAdminAnnouncementPage({ params: Promise.resolve({ id }) });
}

describe("admin announcement editor page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.getAdminAnnouncement.mockReset();
    mocks.notFound.mockClear();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.getAdminAnnouncement.mockResolvedValue(ANNOUNCEMENT);
  });

  afterEach(() => {
    cleanup();
  });

  it("checks admin authentication before reading the announcement", async () => {
    mocks.requireAdminUser.mockRejectedValue(
      new Error("redirect to admin login"),
    );

    await expect(renderPage()).rejects.toThrow("redirect to admin login");
    expect(mocks.getAdminAnnouncement).not.toHaveBeenCalled();
  });

  it("seeds the form from the saved announcement", async () => {
    render(await renderPage());

    expect(mocks.getAdminAnnouncement).toHaveBeenCalledWith(ANNOUNCEMENT_ID);
    expect(screen.getByRole("textbox", { name: /^prefix/i })).toHaveValue(
      "Use code",
    );
    expect(screen.getByRole("textbox", { name: /^highlight/i })).toHaveValue(
      "HAPPY2026",
    );
    expect(screen.getByRole("textbox", { name: /link path/i })).toHaveValue(
      "/shop",
    );
    expect(screen.getByRole("checkbox", { name: /active/i })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("renders empty fields for an announcement with null optional values", async () => {
    mocks.getAdminAnnouncement.mockResolvedValue({
      ...ANNOUNCEMENT,
      prefix_text: null,
      suffix_text: null,
      link_label: null,
      link_href: null,
      is_active: false,
    });

    render(await renderPage());

    expect(screen.getByRole("textbox", { name: /^prefix/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /link path/i })).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: /active/i })).not.toBeChecked();
  });

  it("shows the ordinary not-found page for an unknown announcement", async () => {
    mocks.getAdminAnnouncement.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("shows the ordinary not-found page for a malformed reference", async () => {
    mocks.getAdminAnnouncement.mockResolvedValue(null);

    await expect(renderPage("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    // No replacement announcement is invented to fill the gap.
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("reports a failed read without falling through to not-found", async () => {
    mocks.getAdminAnnouncement.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(await renderPage());

    expect(
      screen.getByText(/announcement details could not be loaded/i),
    ).toBeInTheDocument();
    // A transient read failure is not the same as a missing record.
    expect(mocks.notFound).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("offers a way back to the list", async () => {
    render(await renderPage());

    expect(
      screen.getByRole("link", { name: /All announcements/ }),
    ).toHaveAttribute("href", "/admin/announcements");
  });
});
