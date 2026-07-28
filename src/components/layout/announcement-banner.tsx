"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PROMO_PREFIX = "Use code";
const COUPON_CODE = "HAPPY2026";
const PROMO_SUFFIX = "for up to 60% off selected products";

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

export function AnnouncementBanner() {
    const pathname = usePathname();
    // Local component state only: dismissing clears on unmount (a full page
    // reload or revisit), never written to localStorage or cookies, so the
    // banner returns on the next visit as required.
    const [isDismissed, setIsDismissed] = useState(false);

    const isCheckoutRoute = pathname.startsWith("/checkout");

    if (isCheckoutRoute || isDismissed) {
        return null;
    }

    return (
        <div className="relative border-b border-stone-900/10 bg-stone-100 text-stone-900">
            <div className="flex items-center gap-3 px-10 py-3 sm:px-14 sm:py-2.5">
                <div className="flex flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center sm:flex-nowrap">
                    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.65rem] uppercase leading-relaxed tracking-[0.14em] sm:flex-nowrap sm:whitespace-nowrap sm:text-xs sm:tracking-[0.2em]">
                        <span>{PROMO_PREFIX}</span>
                        <span className="inline-flex items-center rounded-full border border-stone-900 bg-stone-900 px-2 py-0.5 font-medium text-stone-100 sm:px-2.5">
                            {COUPON_CODE}
                        </span>
                        <span>{PROMO_SUFFIX}</span>
                    </p>
                    <Link
                        href="/shop"
                        className="shrink-0 border-b border-stone-900/40 pb-0.5 text-[0.65rem] uppercase tracking-[0.2em] transition-colors hover:border-stone-900 sm:text-xs"
                    >
                        Shop Now
                    </Link>
                </div>
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
