// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPageHeader } from "./admin-page-header";

describe("AdminPageHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a page heading with optional description and actions", () => {
    render(
      <AdminPageHeader
        title="Orders"
        description="Review every customer order."
        actions={<button type="button">Export orders</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Review every customer order.")).toHaveClass(
      "text-stone-400",
    );
    expect(
      screen.getByRole("button", { name: "Export orders" }),
    ).toBeInTheDocument();
  });

  it("omits unused optional regions without losing the heading", () => {
    const { container } = render(<AdminPageHeader title="Home" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
