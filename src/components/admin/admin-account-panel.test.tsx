// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOutAdmin: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({
  signOutAdmin: mocks.signOutAdmin,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AdminAccountPanel } from "./admin-account-panel";

const EMAIL = "admin@example.com";

describe("AdminAccountPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the default mobile and expanded presentation fully labelled", () => {
    const { container } = render(<AdminAccountPanel email={EMAIL} />);

    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View store" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("button", { name: "Sign Out" }),
    ).toHaveAttribute("type", "submit");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses named icon-only controls and account identity when collapsed", () => {
    render(<AdminAccountPanel collapsed email={EMAIL} />);

    const identity = screen.getByRole("img", {
      name: `Signed in as ${EMAIL}`,
    });
    const storeLink = screen.getByRole("link", { name: "View store" });
    const signOutButton = screen.getByRole("button", { name: "Sign Out" });

    expect(identity).toHaveAttribute("title", `Signed in as ${EMAIL}`);
    expect(identity).not.toHaveAttribute("tabindex");
    expect(identity).toHaveClass("text-stone-300");
    expect(storeLink).toHaveAttribute("href", "/");
    expect(storeLink).toHaveAttribute("title", "View store");
    expect(signOutButton).toHaveAttribute("title", "Sign Out");
    expect(signOutButton).toHaveAttribute("type", "submit");
    expect(signOutButton.closest("form")).not.toBeNull();

    for (const element of [identity, storeLink, signOutButton]) {
      expect(element.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  it("keeps visible keyboard focus styles on expanded and collapsed actions", () => {
    const { rerender } = render(<AdminAccountPanel email={EMAIL} />);

    for (const action of [
      screen.getByRole("link", { name: "View store" }),
      screen.getByRole("button", { name: "Sign Out" }),
    ]) {
      expect(action).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-stone-200/50",
        "focus-visible:ring-offset-2",
      );
    }

    rerender(<AdminAccountPanel collapsed email={EMAIL} />);

    for (const action of [
      screen.getByRole("link", { name: "View store" }),
      screen.getByRole("button", { name: "Sign Out" }),
    ]) {
      expect(action).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-stone-200/50",
        "focus-visible:ring-offset-2",
      );
    }
  });

  it("avoids failing normal-text contrast classes in either presentation", () => {
    const { container, rerender } = render(
      <AdminAccountPanel email={EMAIL} />,
    );

    function expectPassingClasses() {
      for (const element of container.querySelectorAll<HTMLElement>(
        '[class*="text-stone-"]',
      )) {
        expect(element.className).not.toContain("text-stone-500");
        expect(element.className).not.toContain("text-stone-600");
      }
    }

    expectPassingClasses();
    rerender(<AdminAccountPanel collapsed email={EMAIL} />);
    expectPassingClasses();
  });
});
