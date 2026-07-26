// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("maps an optional accessible label onto the badge", () => {
    render(
      <StatusBadge
        kind="stock"
        value="low_stock"
        ariaLabel="Stock status: Low stock"
      />,
    );

    const badge = screen.getByLabelText("Stock status: Low stock");

    expect(badge).toHaveTextContent("Low stock");
    expect(badge).toHaveAttribute("data-tone", "pending");
  });

  it("does not add an aria-label when none is provided", () => {
    render(<StatusBadge kind="product" value="active" />);

    expect(screen.getByText("Active")).not.toHaveAttribute("aria-label");
  });
});
