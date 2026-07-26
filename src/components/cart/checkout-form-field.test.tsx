// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CheckoutFormField } from "./checkout-form-field";

describe("checkout form field text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the field label off the failing low-contrast class", () => {
    render(
      <CheckoutFormField
        label="Full name"
        name="fullName"
        type="text"
        placeholder="Your full name"
        required
      />,
    );

    const label = screen.getByText("Full name");
    expect(label.className).not.toContain("text-stone-500");
    expect(label.className).toContain("text-stone-400");
  });

  it("keeps the optional-field annotation off the failing low-contrast class", () => {
    render(
      <CheckoutFormField
        label="Phone"
        name="phone"
        type="tel"
        placeholder="Optional"
      />,
    );

    const optionalNote = screen.getByText("(optional)");
    expect(optionalNote.className).not.toContain("text-stone-600");
    expect(optionalNote.className).toContain("text-stone-400");
  });

  it("leaves the decorative required asterisk and the placeholder styling untouched", () => {
    render(
      <CheckoutFormField
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
      />,
    );

    const asterisk = screen.getByText("*");
    expect(asterisk).toHaveAttribute("aria-hidden", "true");
    expect(asterisk.className).toContain("text-stone-400");

    const input = screen.getByPlaceholderText("you@example.com");
    // Placeholder text is a WCAG-exempt state and is left as-is.
    expect(input.className).toContain("placeholder:text-stone-600");
  });
});
