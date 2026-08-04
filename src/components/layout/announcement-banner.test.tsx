// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: ComponentProps<"a">) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

import type { StorefrontAnnouncement } from "@/lib/storefront/announcements";

import { AnnouncementBanner } from "./announcement-banner";

// The row seeded by the migration that created the announcement tables, and
// the copy that was hardcoded here before the storefront read it from the
// database. The switch is meant to be a visual no-op.
const SEEDED: StorefrontAnnouncement = {
    id: "11111111-1111-4111-8111-111111111111",
    prefix_text: "Use code",
    highlight_text: "HAPPY2026",
    suffix_text: "for up to 60% off selected products",
    link_label: "Shop Now",
    link_href: "/shop",
};

function renderBanner(overrides: Partial<StorefrontAnnouncement> = {}) {
    return render(
        <AnnouncementBanner announcement={{ ...SEEDED, ...overrides }} />,
    );
}

describe("AnnouncementBanner", () => {
    afterEach(() => {
        mockPathname = "/";
        cleanup();
    });

    describe("seeded announcement", () => {
        it("shows the promo copy and a Shop Now link to /shop on the homepage", () => {
            mockPathname = "/";
            renderBanner();

            expect(screen.getByText("Use code")).toBeInTheDocument();
            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
            expect(
                screen.getByText("for up to 60% off selected products"),
            ).toBeInTheDocument();

            const shopNow = screen.getByRole("link", { name: "Shop Now" });
            expect(shopNow).toHaveAttribute("href", "/shop");
        });

        it("keeps the highlight in the black pill and the link underlined", () => {
            renderBanner();

            // The exact treatment the hardcoded banner used, so switching the
            // data source changes nothing visible.
            const pill = screen.getByText("HAPPY2026");
            expect(pill).toHaveClass(
                "rounded-full",
                "border-stone-900",
                "bg-stone-900",
                "text-stone-100",
            );

            expect(screen.getByRole("link", { name: "Shop Now" })).toHaveClass(
                "border-b",
                "border-stone-900/40",
            );
        });

        it("keeps the mobile wrapping classes on the copy", () => {
            renderBanner();

            const copy = screen.getByText("Use code").closest("p");
            expect(copy).toHaveClass(
                "flex-wrap",
                "sm:flex-nowrap",
                "sm:whitespace-nowrap",
            );
        });
    });

    describe("prop-driven content", () => {
        it("renders whatever copy it is given", () => {
            renderBanner({
                prefix_text: "Free shipping",
                highlight_text: "OVER500",
                suffix_text: "on Hong Kong orders",
                link_label: "See details",
                link_href: "/shipping-policy",
            });

            expect(screen.getByText("Free shipping")).toBeInTheDocument();
            expect(screen.getByText("OVER500")).toBeInTheDocument();
            expect(screen.getByText("on Hong Kong orders")).toBeInTheDocument();
            expect(
                screen.getByRole("link", { name: "See details" }),
            ).toHaveAttribute("href", "/shipping-policy");
        });

        it("omits absent text instead of leaving a gap", () => {
            renderBanner({ prefix_text: null, suffix_text: null });

            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
            expect(screen.queryByText("Use code")).toBeNull();
            expect(
                screen.queryByText("for up to 60% off selected products"),
            ).toBeNull();
        });

        it("renders no link when the announcement has none", () => {
            renderBanner({ link_label: null, link_href: null });

            expect(screen.queryByRole("link")).toBeNull();
            // The rest of the announcement still shows.
            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
        });

        it("renders text alone when only one field is set", () => {
            renderBanner({
                prefix_text: "Holiday hours apply",
                highlight_text: null,
                suffix_text: null,
                link_label: null,
                link_href: null,
            });

            expect(screen.getByText("Holiday hours apply")).toBeInTheDocument();
            expect(screen.queryByRole("link")).toBeNull();
        });
    });

    describe("route visibility", () => {
        it.each(["/shop", "/products/some-fragrance", "/cart"])(
            "renders on %s",
            (pathname) => {
                mockPathname = pathname;
                renderBanner();

                expect(screen.getByText("Use code")).toBeInTheDocument();
                expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
                expect(
                    screen.getByText("for up to 60% off selected products"),
                ).toBeInTheDocument();
            },
        );

        it.each(["/checkout", "/checkout/success", "/checkout/cancel"])(
            "hides on %s",
            (pathname) => {
                mockPathname = pathname;
                const { container } = renderBanner();

                expect(container).toBeEmptyDOMElement();
            },
        );
    });

    describe("dismissal", () => {
        it("dismisses when the close button is clicked, without touching storage", async () => {
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const user = userEvent.setup();

            const { container } = renderBanner();

            await user.click(
                screen.getByRole("button", { name: "Dismiss announcement" }),
            );

            expect(container).toBeEmptyDOMElement();
            expect(setItemSpy).not.toHaveBeenCalled();
            expect(document.cookie).toBe("");

            setItemSpy.mockRestore();
        });

        it("reads nothing from storage on mount, so a reload shows it again", () => {
            const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

            renderBanner();

            // Dismissal lives in component state only. Remounting is what a
            // full reload does, and it starts undismissed.
            expect(getItemSpy).not.toHaveBeenCalled();
            expect(document.cookie).toBe("");

            getItemSpy.mockRestore();
        });

        it("starts visible again on a fresh mount after being dismissed", async () => {
            const user = userEvent.setup();

            const first = renderBanner();
            await user.click(
                screen.getByRole("button", { name: "Dismiss announcement" }),
            );
            expect(first.container).toBeEmptyDOMElement();

            cleanup();
            renderBanner();

            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
        });
    });
});
