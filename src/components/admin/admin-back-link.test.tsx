// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AdminBackLink } from "./admin-back-link";

describe("AdminBackLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("links to the given destination with the given label", () => {
    render(
      <AdminBackLink href="/admin/announcements">
        All announcements
      </AdminBackLink>,
    );

    expect(
      screen.getByRole("link", { name: "All announcements" }),
    ).toHaveAttribute("href", "/admin/announcements");
  });

  it("renders as a real button-styled control, not plain arrow-prefixed text", () => {
    render(
      <AdminBackLink href="/admin/announcements">
        All announcements
      </AdminBackLink>,
    );

    const link = screen.getByRole("link", { name: "All announcements" });

    expect(link).toHaveClass(
      "rounded-full",
      "border",
      "border-white/10",
      "bg-white/5",
    );
    // No manual arrow entity in the text; the icon carries that meaning.
    expect(link).not.toHaveTextContent("←");
  });

  it("includes a decorative back icon that assistive tech skips", () => {
    render(
      <AdminBackLink href="/admin/announcements">
        All announcements
      </AdminBackLink>,
    );

    const link = screen.getByRole("link", { name: "All announcements" });
    const icon = link.querySelector("svg");

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("defines hover, focus-visible, and active states", () => {
    render(
      <AdminBackLink href="/admin/announcements">
        All announcements
      </AdminBackLink>,
    );

    const link = screen.getByRole("link", { name: "All announcements" });

    expect(link.className).toMatch(/hover:/);
    expect(link.className).toMatch(/focus-visible:/);
    expect(link.className).toMatch(/active:/);
  });
});
