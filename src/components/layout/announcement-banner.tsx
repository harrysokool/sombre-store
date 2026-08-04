"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { StorefrontAnnouncement } from "@/lib/storefront/announcements";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function CloseIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
        >
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
    );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
        >
            <path
                d={direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * One announcement's copy. The three text fields are optional individually, so
 * an absent one is skipped rather than rendered as a gap. The database
 * guarantees at least one is present, and that a link has both halves or
 * neither.
 */
function AnnouncementContent({
    announcement,
}: {
    announcement: StorefrontAnnouncement;
}) {
    const hasLink = Boolean(announcement.link_label && announcement.link_href);

    return (
        <>
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.65rem] uppercase leading-relaxed tracking-[0.14em] sm:flex-nowrap sm:whitespace-nowrap sm:text-xs sm:tracking-[0.2em]">
                {announcement.prefix_text ? (
                    <span>{announcement.prefix_text}</span>
                ) : null}
                {announcement.highlight_text ? (
                    <span className="inline-flex items-center rounded-full border border-stone-900 bg-stone-900 px-2 py-0.5 font-medium text-stone-100 sm:px-2.5">
                        {announcement.highlight_text}
                    </span>
                ) : null}
                {announcement.suffix_text ? (
                    <span>{announcement.suffix_text}</span>
                ) : null}
            </p>
            {hasLink ? (
                <Link
                    href={announcement.link_href as string}
                    className="shrink-0 border-b border-stone-900/40 pb-0.5 text-[0.65rem] uppercase tracking-[0.2em] transition-colors hover:border-stone-900 sm:text-xs"
                >
                    {announcement.link_label}
                </Link>
            ) : null}
        </>
    );
}

const navigationButtonClassName =
    "inline-flex h-8 w-6 shrink-0 items-center justify-center text-stone-700 transition-colors hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 sm:w-8";

export function AnnouncementBanner({
    announcements,
    rotationIntervalSeconds,
}: {
    announcements: StorefrontAnnouncement[];
    rotationIntervalSeconds: number;
}) {
    const pathname = usePathname();
    // Local component state only: dismissing clears on unmount (a full page
    // reload or revisit), never written to localStorage or cookies, so the
    // banner returns on the next visit as required.
    const [isDismissed, setIsDismissed] = useState(false);
    const [index, setIndex] = useState(0);
    // Both default to the value the server cannot know, so the first client
    // render matches the markup it hydrates and the effects correct it after.
    const [isPageVisible, setIsPageVisible] = useState(true);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    const count = announcements.length;
    const isCheckoutRoute = pathname.startsWith("/checkout");
    const isHidden = isCheckoutRoute || isDismissed || count === 0;
    // A lone announcement never rotates, so it never creates a timer.
    const rotates = count > 1 && !isHidden;
    // Modulo rather than raw state, so a shrinking list (an administrator
    // deleting announcements) can never leave the index past the end.
    const activeIndex = count > 0 ? index % count : 0;

    useEffect(() => {
        const syncVisibility = () => {
            setIsPageVisible(document.visibilityState !== "hidden");
        };

        syncVisibility();
        document.addEventListener("visibilitychange", syncVisibility);

        return () => {
            document.removeEventListener("visibilitychange", syncVisibility);
        };
    }, []);

    useEffect(() => {
        // jsdom, and any environment without the API, simply keeps the default.
        if (typeof window.matchMedia !== "function") {
            return;
        }

        const query = window.matchMedia(REDUCED_MOTION_QUERY);
        const syncPreference = () => setPrefersReducedMotion(query.matches);

        syncPreference();
        query.addEventListener("change", syncPreference);

        return () => {
            query.removeEventListener("change", syncPreference);
        };
    }, []);

    /**
     * The rotation.
     *
     * One pending timer at a time: each tick schedules the next, so there is
     * never a second interval running alongside. `index` is a dependency, so
     * manual navigation tears the pending timer down and starts a full fresh
     * one; the functional update means the callback never reads a stale count
     * or index. Dismissal, unmount, an empty list, and a hidden tab all clear
     * it through the same cleanup, so no state is set after unmount.
     */
    useEffect(() => {
        if (!rotates || !isPageVisible) {
            return;
        }

        const timer = setTimeout(
            () => setIndex((current) => (current + 1) % count),
            Math.max(rotationIntervalSeconds, 1) * 1000,
        );

        return () => clearTimeout(timer);
    }, [rotates, isPageVisible, index, count, rotationIntervalSeconds]);

    if (isHidden) {
        return null;
    }

    const goToPrevious = () =>
        setIndex((current) => (current - 1 + count) % count);
    const goToNext = () => setIndex((current) => (current + 1) % count);

    return (
        <div className="relative border-b border-stone-900/10 bg-stone-100 text-stone-900">
            <div className="flex items-center gap-3 px-10 py-3 sm:px-14 sm:py-2.5">
                {rotates ? (
                    <button
                        type="button"
                        onClick={goToPrevious}
                        aria-label="Previous announcement"
                        className={navigationButtonClassName}
                    >
                        <ChevronIcon direction="left" />
                    </button>
                ) : null}

                {rotates ? (
                    <div
                        role="group"
                        aria-label="Announcements"
                        aria-roledescription="carousel"
                        className="min-w-0 flex-1 overflow-hidden"
                    >
                        {/* Every announcement stays in the flex row, so the
                            banner is always as tall as its tallest message and
                            the page below never jumps as it advances. */}
                        <div
                            data-testid="announcement-track"
                            style={{
                                transform: `translateX(-${activeIndex * 100}%)`,
                            }}
                            className={`flex ${
                                prefersReducedMotion
                                    ? ""
                                    : "transition-transform duration-500 ease-out"
                            }`}
                        >
                            {announcements.map((announcement, slideIndex) => (
                                <div
                                    key={announcement.id}
                                    aria-hidden={slideIndex !== activeIndex}
                                    className="w-full shrink-0"
                                >
                                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center sm:flex-nowrap">
                                        <AnnouncementContent
                                            announcement={announcement}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center sm:flex-nowrap">
                        <AnnouncementContent
                            announcement={announcements[activeIndex]}
                        />
                    </div>
                )}

                {rotates ? (
                    <button
                        type="button"
                        onClick={goToNext}
                        aria-label="Next announcement"
                        className={navigationButtonClassName}
                    >
                        <ChevronIcon direction="right" />
                    </button>
                ) : null}
            </div>

            <button
                type="button"
                onClick={() => setIsDismissed(true)}
                aria-label="Dismiss announcement"
                className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-stone-700 transition-colors hover:text-stone-900 sm:right-3"
            >
                <CloseIcon />
            </button>
        </div>
    );
}
