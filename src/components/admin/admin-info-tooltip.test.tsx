// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AdminInfoTooltip } from "./admin-info-tooltip";

const TOOLTIP_TEXT = "Shown as a pill. Usually used for a coupon code.";

function renderTooltip() {
  return render(
    <div>
      <AdminInfoTooltip label="More information about Highlight">
        {TOOLTIP_TEXT}
      </AdminInfoTooltip>
      <button type="button">Elsewhere</button>
    </div>,
  );
}

function icon() {
  return screen.getByRole("button", {
    name: "More information about Highlight",
  });
}

function panel() {
  return screen.getByText(TOOLTIP_TEXT);
}

describe("AdminInfoTooltip", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the explanation closed until the icon is used", () => {
    renderTooltip();

    expect(panel()).toHaveAttribute("data-state", "closed");
  });

  it("exposes an accessible information icon with a field-specific label", () => {
    renderTooltip();

    const button = icon();
    expect(button).toHaveAttribute("aria-label", "More information about Highlight");
    expect(button).toHaveAttribute("aria-describedby", panel().id);
    expect(panel()).toHaveAttribute("role", "tooltip");
  });

  it("renders a centered SVG information icon rather than a text character", () => {
    renderTooltip();

    const button = icon();
    // No visible "i" glyph as the button's text content.
    expect(button.textContent).toBe("");

    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");

    // A fixed, exactly-centered square trigger, not a text-sized circle.
    expect(button).toHaveClass(
      "inline-flex",
      "h-6",
      "w-6",
      "shrink-0",
      "items-center",
      "justify-center",
      "rounded-full",
    );
  });

  it("opens on mouse hover and closes on mouse leave", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(icon());
    expect(panel()).toHaveAttribute("data-state", "open");

    await user.unhover(icon());
    expect(panel()).toHaveAttribute("data-state", "closed");
  });

  it("opens on keyboard focus and closes when focus leaves", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(icon()).toHaveFocus();
    expect(panel()).toHaveAttribute("data-state", "open");

    await user.tab();
    expect(panel()).toHaveAttribute("data-state", "closed");
  });

  it("opens on click", async () => {
    const user = userEvent.setup();
    renderTooltip();

    expect(panel()).toHaveAttribute("data-state", "closed");
    await user.click(icon());
    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("closes when the icon is clicked again", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.click(icon());
    expect(panel()).toHaveAttribute("data-state", "open");

    await user.click(icon());
    expect(panel()).toHaveAttribute("data-state", "closed");
  });

  it("opens on a mobile tap", () => {
    renderTooltip();

    // A touch tap dispatches touchstart/touchend ahead of the synthesized
    // click a real mobile browser sends; jsdom does not synthesize that
    // click automatically, so it is fired explicitly here.
    fireEvent.touchStart(icon());
    fireEvent.click(icon());

    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.click(icon());
    expect(panel()).toHaveAttribute("data-state", "open");

    await user.keyboard("{Escape}");
    expect(panel()).toHaveAttribute("data-state", "closed");
  });

  it("closes when clicking outside the tooltip", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.click(icon());
    expect(panel()).toHaveAttribute("data-state", "open");

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(panel()).toHaveAttribute("data-state", "closed");
  });

  it("does not rely only on hover: keyboard-only users can open and close it", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(panel()).toHaveAttribute("data-state", "open");

    await user.keyboard("{Escape}");
    expect(panel()).toHaveAttribute("data-state", "closed");
  });
});
