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

import { AnnouncementBanner } from "./announcement-banner";

describe("AnnouncementBanner", () => {
    afterEach(() => {
        mockPathname = "/";
        cleanup();
    });

    it("shows the promo copy and a Shop Now link to /shop on the homepage", () => {
        mockPathname = "/";
        render(<AnnouncementBanner />);

        expect(screen.getByText("Use code")).toBeInTheDocument();
        expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
        expect(
            screen.getByText("for up to 60% off selected products"),
        ).toBeInTheDocument();

        const shopNow = screen.getByRole("link", { name: "Shop Now" });
        expect(shopNow).toHaveAttribute("href", "/shop");
    });

    it.each(["/shop", "/products/some-fragrance", "/cart"])(
        "renders on %s",
        (pathname) => {
            mockPathname = pathname;
            render(<AnnouncementBanner />);

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
            const { container } = render(<AnnouncementBanner />);

            expect(container).toBeEmptyDOMElement();
        },
    );

    it("dismisses when the close button is clicked, without touching storage", async () => {
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
        const user = userEvent.setup();

        const { container } = render(<AnnouncementBanner />);

        await user.click(
            screen.getByRole("button", { name: "Dismiss announcement" }),
        );

        expect(container).toBeEmptyDOMElement();
        expect(setItemSpy).not.toHaveBeenCalled();
        expect(document.cookie).toBe("");

        setItemSpy.mockRestore();
    });
});
