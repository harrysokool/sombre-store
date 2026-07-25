// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import StorefrontLayout from "./layout";

describe("storefront route group layout", () => {
  afterEach(() => {
    cleanup();
  });

  // The counterpart assertions live in the admin layout tests: the same public
  // chrome that must be present here must be absent there.
  it("wraps public pages in the storefront navbar and footer", () => {
    render(
      <StorefrontLayout>
        <p>storefront page body</p>
      </StorefrontLayout>,
    );

    expect(
      screen.getByRole("link", { name: "Sombre home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open search" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("storefront page body")).toBeInTheDocument();
  });
});
