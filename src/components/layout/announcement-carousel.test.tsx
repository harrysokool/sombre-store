// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const INTERVAL_SECONDS = 8;
const INTERVAL_MS = INTERVAL_SECONDS * 1000;

const FIRST: StorefrontAnnouncement = {
    id: "11111111-1111-4111-8111-111111111111",
    prefix_text: "Use code",
    highlight_text: "HAPPY2026",
    suffix_text: "for up to 60% off selected products",
    link_label: "Shop Now",
    link_href: "/shop",
};

const SECOND: StorefrontAnnouncement = {
    id: "22222222-2222-4222-8222-222222222222",
    prefix_text: "Free shipping",
    highlight_text: "OVER500",
    suffix_text: "on Hong Kong orders",
    link_label: null,
    link_href: null,
};

const THIRD: StorefrontAnnouncement = {
    id: "33333333-3333-4333-8333-333333333333",
    prefix_text: "New arrivals",
    highlight_text: null,
    suffix_text: "every Friday",
    link_label: null,
    link_href: null,
};

// jsdom does not implement matchMedia, so every test supplies it explicitly.
function stubReducedMotion(matches: boolean) {
    const listeners = new Set<() => void>();
    const mql = {
        matches,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: (_event: string, listener: () => void) =>
            listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) =>
            listeners.delete(listener),
    };

    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn(() => mql),
    });
}

function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: state,
    });
    act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });
}

function renderCarousel(
    announcements: StorefrontAnnouncement[] = [FIRST, SECOND, THIRD],
    rotationIntervalSeconds = INTERVAL_SECONDS,
) {
    return render(
        <AnnouncementBanner
            announcements={announcements}
            rotationIntervalSeconds={rotationIntervalSeconds}
        />,
    );
}

function track() {
    return screen.getByTestId("announcement-track");
}

/** The slide currently translated into view, derived from the transform. */
function visibleSlideIndex() {
    const transform = track().style.transform;
    const percent = Number(/-?([\d.]+)%/.exec(transform)?.[1] ?? "0");

    return percent / 100;
}

function advance(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

/**
 * Each tick schedules the next only after React re-renders, so one
 * advanceTimersByTime call can only ever move the carousel a single step.
 * Stepping explicitly keeps that honest.
 */
function advanceSteps(steps: number) {
    for (let step = 0; step < steps; step += 1) {
        advance(INTERVAL_MS);
    }
}

// fireEvent rather than userEvent: userEvent schedules its own timers between
// pointer events, which never resolve while the clock is fake. These tests are
// about timer behaviour, and realistic pointer simulation for the dismiss
// control is covered in announcement-banner.test.tsx.
function click(element: HTMLElement) {
    fireEvent.click(element);
}

const nextButton = () =>
    screen.getByRole("button", { name: "Next announcement" });
const previousButton = () =>
    screen.getByRole("button", { name: "Previous announcement" });

describe("announcement carousel", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        stubReducedMotion(false);
        setVisibility("visible");
        mockPathname = "/";
    });

    afterEach(() => {
        cleanup();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe("a single announcement", () => {
        it("renders without a timer or navigation controls", () => {
            const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

            renderCarousel([FIRST]);

            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: "Next announcement" }),
            ).toBeNull();
            expect(
                screen.queryByRole("button", { name: "Previous announcement" }),
            ).toBeNull();
            // Only the dismiss control exists.
            expect(screen.getAllByRole("button")).toHaveLength(1);
            expect(setTimeoutSpy).not.toHaveBeenCalled();

            setTimeoutSpy.mockRestore();
        });

        it("is not animated and has no sliding track", () => {
            renderCarousel([FIRST]);

            expect(screen.queryByTestId("announcement-track")).toBeNull();
        });

        it("stays put when time passes", () => {
            renderCarousel([FIRST]);

            advance(INTERVAL_MS * 5);

            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
        });
    });

    describe("automatic rotation", () => {
        it("starts on the first announcement", () => {
            renderCarousel();

            expect(visibleSlideIndex()).toBe(0);
        });

        it("advances after the configured interval", () => {
            renderCarousel();

            advance(INTERVAL_MS);

            expect(visibleSlideIndex()).toBe(1);
        });

        it("uses the configured interval rather than a hardcoded value", () => {
            renderCarousel([FIRST, SECOND], 30);

            // Well past a shorter default, still before the real interval.
            advance(29_000);
            expect(visibleSlideIndex()).toBe(0);

            advance(1_000);
            expect(visibleSlideIndex()).toBe(1);
        });

        it("keeps advancing one step per interval", () => {
            renderCarousel();

            advance(INTERVAL_MS);
            expect(visibleSlideIndex()).toBe(1);

            advance(INTERVAL_MS);
            expect(visibleSlideIndex()).toBe(2);
        });

        it("loops from the final announcement back to the first", () => {
            renderCarousel();

            advanceSteps(2);
            expect(visibleSlideIndex()).toBe(2);

            advance(INTERVAL_MS);
            expect(visibleSlideIndex()).toBe(0);
        });

        it("runs one timer at a time", () => {
            const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

            renderCarousel();
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

            advance(INTERVAL_MS);

            // The previous timer fired and exactly one replacement was set.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

            setTimeoutSpy.mockRestore();
        });

        it("renders every announcement so the height never jumps", () => {
            renderCarousel();

            // All three stay in the flex row; only the transform changes.
            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
            expect(screen.getByText("OVER500")).toBeInTheDocument();
            expect(screen.getByText("every Friday")).toBeInTheDocument();
        });
    });

    describe("manual navigation", () => {
        it("moves forward and back one at a time", () => {
            renderCarousel();

            click(nextButton());
            expect(visibleSlideIndex()).toBe(1);

            click(previousButton());
            expect(visibleSlideIndex()).toBe(0);
        });

        it("loops backwards from the first to the final announcement", () => {
            renderCarousel();

            click(previousButton());

            expect(visibleSlideIndex()).toBe(2);
        });

        it("loops forwards from the final announcement to the first", () => {
            renderCarousel();

            advanceSteps(2);
            expect(visibleSlideIndex()).toBe(2);

            click(nextButton());

            expect(visibleSlideIndex()).toBe(0);
        });

        it("restarts the full interval after a manual move", () => {
            renderCarousel();

            // Most of the way through the first interval.
            advance(INTERVAL_MS - 1_000);
            click(nextButton());
            expect(visibleSlideIndex()).toBe(1);

            // The old remaining time must not carry over.
            advance(INTERVAL_MS - 1_000);
            expect(visibleSlideIndex()).toBe(1);

            advance(1_000);
            expect(visibleSlideIndex()).toBe(2);
        });

        it("labels both controls for assistive technology", () => {
            renderCarousel();

            expect(previousButton()).toBeInTheDocument();
            expect(nextButton()).toBeInTheDocument();
            expect(
                screen.getByRole("group", { name: "Announcements" }),
            ).toHaveAttribute("aria-roledescription", "carousel");
        });

        it("keeps the controls out of the message flow so they cannot overlap", () => {
            renderCarousel();

            // Both controls sit in the padded flex row beside the viewport,
            // not absolutely positioned over the copy.
            for (const control of [previousButton(), nextButton()]) {
                expect(control.className).toContain("shrink-0");
                expect(control.className).not.toContain("absolute");
            }
            // The dismiss button keeps its own reserved space at the edge.
            expect(
                screen.getByRole("button", { name: "Dismiss announcement" })
                    .className,
            ).toContain("absolute");
        });
    });

    describe("tab visibility", () => {
        it("stops advancing while the tab is hidden", () => {
            renderCarousel();

            setVisibility("hidden");
            advance(INTERVAL_MS * 3);

            expect(visibleSlideIndex()).toBe(0);
        });

        it("resumes with a fresh interval when the tab is visible again", () => {
            renderCarousel();

            setVisibility("hidden");
            advance(INTERVAL_MS * 3);
            setVisibility("visible");

            // A fresh full interval, not the time that elapsed while hidden.
            advance(INTERVAL_MS - 1);
            expect(visibleSlideIndex()).toBe(0);

            advance(1);
            expect(visibleSlideIndex()).toBe(1);
        });

        it("clears the pending timer when the tab becomes hidden", () => {
            const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

            renderCarousel();
            setVisibility("hidden");

            expect(clearTimeoutSpy).toHaveBeenCalled();

            clearTimeoutSpy.mockRestore();
        });
    });

    describe("timer cleanup", () => {
        it("clears the timer on unmount and sets no state afterwards", () => {
            const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            const { unmount } = renderCarousel();
            unmount();

            expect(clearTimeoutSpy).toHaveBeenCalled();

            // Nothing may fire after unmount; React would log an update
            // warning if it did.
            advance(INTERVAL_MS * 3);
            expect(errorSpy).not.toHaveBeenCalled();

            clearTimeoutSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it("clears the timer when the banner is dismissed", () => {
            const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

            const { container } = renderCarousel();

            click(
                screen.getByRole("button", { name: "Dismiss announcement" }),
            );

            expect(container).toBeEmptyDOMElement();
            expect(clearTimeoutSpy).toHaveBeenCalled();

            // The carousel is gone and stays gone.
            advance(INTERVAL_MS * 3);
            expect(container).toBeEmptyDOMElement();

            clearTimeoutSpy.mockRestore();
        });

        it("schedules nothing once dismissed", () => {
            renderCarousel();

            click(
                screen.getByRole("button", { name: "Dismiss announcement" }),
            );

            const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
            advance(INTERVAL_MS * 2);
            expect(setTimeoutSpy).not.toHaveBeenCalled();

            setTimeoutSpy.mockRestore();
        });
    });

    describe("reduced motion", () => {
        it("drops the sliding animation but keeps rotating", () => {
            stubReducedMotion(true);
            renderCarousel();

            expect(track().className).not.toContain("transition-transform");

            advance(INTERVAL_MS);

            // The message still changes, it just does not slide.
            expect(visibleSlideIndex()).toBe(1);
        });

        it("keeps manual navigation available", () => {
            stubReducedMotion(true);
            renderCarousel();

            click(nextButton());
            expect(visibleSlideIndex()).toBe(1);

            click(previousButton());
            expect(visibleSlideIndex()).toBe(0);
        });

        it("animates when motion is not reduced", () => {
            stubReducedMotion(false);
            renderCarousel();

            expect(track().className).toContain("transition-transform");
        });

        it("still renders when matchMedia is unavailable", () => {
            // jsdom's own default, and any environment lacking the API.
            Reflect.deleteProperty(window, "matchMedia");

            expect(() => renderCarousel()).not.toThrow();
            expect(track().className).toContain("transition-transform");
        });
    });

    describe("behaviour carried over from before the carousel", () => {
        it.each(["/checkout", "/checkout/success", "/checkout/cancel"])(
            "stays hidden on %s",
            (pathname) => {
                mockPathname = pathname;

                const { container } = renderCarousel();

                expect(container).toBeEmptyDOMElement();
            },
        );

        it("creates no timer on a checkout route", () => {
            mockPathname = "/checkout";
            const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

            renderCarousel();

            expect(setTimeoutSpy).not.toHaveBeenCalled();

            setTimeoutSpy.mockRestore();
        });

        it("touches no storage and no cookies while rotating", () => {
            const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
            const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

            renderCarousel();
            advanceSteps(2);
            click(nextButton());
            click(
                screen.getByRole("button", { name: "Dismiss announcement" }),
            );

            expect(setItemSpy).not.toHaveBeenCalled();
            expect(getItemSpy).not.toHaveBeenCalled();
            expect(document.cookie).toBe("");

            setItemSpy.mockRestore();
            getItemSpy.mockRestore();
        });

        it("returns on a fresh mount after being dismissed", () => {

            const first = renderCarousel();
            click(
                screen.getByRole("button", { name: "Dismiss announcement" }),
            );
            expect(first.container).toBeEmptyDOMElement();

            cleanup();
            renderCarousel();

            expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
        });

        it("keeps the pill, link, and optional-field rendering", () => {
            renderCarousel();

            expect(screen.getByText("HAPPY2026")).toHaveClass(
                "rounded-full",
                "border-stone-900",
                "bg-stone-900",
                "text-stone-100",
            );
            expect(
                screen.getByRole("link", { name: "Shop Now" }),
            ).toHaveAttribute("href", "/shop");
            // The second announcement has no link, the third no highlight.
            expect(screen.getAllByRole("link")).toHaveLength(1);
            expect(screen.getByText("every Friday")).toBeInTheDocument();
        });
    });
});
