// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { Footer } from "./footer";

describe("footer text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the store description off the failing low-contrast class", () => {
    render(<Footer />);

    const description = screen.getByText(
      /A curated store for fragrance, skincare, makeup/,
    );

    expect(description.className).not.toContain("text-stone-500");
    expect(description.className).not.toContain("text-stone-600");
    expect(description.className).toContain("text-stone-400");
  });

  it("keeps the store policy links off the failing low-contrast class", () => {
    render(<Footer />);

    const policyNav = screen.getByRole("navigation", {
      name: "Store policies",
    });

    expect(policyNav.className).not.toContain("text-stone-500");
    expect(policyNav.className).not.toContain("text-stone-600");
    expect(policyNav.className).toContain("text-stone-400");
  });
});
