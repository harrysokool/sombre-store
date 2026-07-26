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

import AdminError from "./error";
import AdminNotFound from "./not-found";

describe("admin recovery boundaries", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns an admin error to the Orders list", () => {
    render(
      <AdminError
        error={new Error("safe test error")}
        reset={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Back to orders" }),
    ).toHaveAttribute("href", "/admin/orders");
  });

  it("returns a missing admin record to the Orders list", () => {
    render(<AdminNotFound />);

    expect(
      screen.getByRole("link", { name: "Back to orders" }),
    ).toHaveAttribute("href", "/admin/orders");
  });
});
