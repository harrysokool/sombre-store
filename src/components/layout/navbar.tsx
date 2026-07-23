"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NavbarCartIndicator } from "@/components/cart/navbar-cart-indicator";
import { NavDrawer } from "@/components/layout/nav-drawer";
import { ProductSearchPanel } from "@/components/search/product-search-panel";

function MenuIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
        >
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
        >
            <path
                d="m21 21-4.35-4.35m1.35-5.4a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNavbarVisible, setIsNavbarVisible] = useState(true);
    // Handed to the drawer and search so closing either returns focus to the
    // control that opened it, rather than dropping the keyboard at the top.
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const [isAtPageTop, setIsAtPageTop] = useState(true);
    const previousScrollYRef = useRef(0);

    // The home page opens on a full-bleed campaign image, so the bar sits over
    // the artwork until the first scroll. Every other route keeps the solid bar.
    const isHomePage = usePathname() === "/";

    useEffect(() => {
        const topThreshold = 64;
        const directionThreshold = 8;

        function handleScroll() {
            const currentScrollY = window.scrollY;
            const previousScrollY = previousScrollYRef.current;

            setIsAtPageTop(currentScrollY <= 8);

            if (currentScrollY <= topThreshold) {
                setIsNavbarVisible(true);
                previousScrollYRef.current = currentScrollY;
                return;
            }

            if (currentScrollY > previousScrollY + directionThreshold) {
                setIsNavbarVisible(false);
            }

            if (currentScrollY < previousScrollY - directionThreshold) {
                setIsNavbarVisible(true);
            }

            previousScrollYRef.current = currentScrollY;
        }

        previousScrollYRef.current = window.scrollY;
        window.addEventListener("scroll", handleScroll, { passive: true });

        // Read the real position once after paint, so a restored scroll offset
        // (back navigation, a refreshed deep link) does not leave the bar
        // rendering as though the page were still at the top.
        const initialReadId = requestAnimationFrame(handleScroll);

        return () => {
            cancelAnimationFrame(initialReadId);
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const shouldShowNavbar = isMenuOpen || isSearchOpen || isNavbarVisible;
    // An open panel always gets the solid bar so its controls stay readable.
    const isOverlayHeader =
        isHomePage && isAtPageTop && !isMenuOpen && !isSearchOpen;

    function closeMenu() {
        setIsMenuOpen(false);
    }

    function closeSearch() {
        setIsSearchOpen(false);
    }

    function openSearch() {
        closeMenu();
        setIsSearchOpen(true);
    }

    function toggleMenu() {
        if (isMenuOpen) {
            closeMenu();
            return;
        }

        closeSearch();
        setIsMenuOpen(true);
    }

    return (
        <>
            <header
                className={`sticky top-0 z-30 transition-all duration-300 ease-out ${
                    isOverlayHeader
                        ? "border-b border-transparent bg-transparent"
                        : "border-b border-white/10 bg-stone-950/90 backdrop-blur-md"
                } ${
                    shouldShowNavbar
                        ? "pointer-events-auto translate-y-0 opacity-100 blur-0"
                        : "pointer-events-none -translate-y-2 opacity-0 blur-sm"
                }`}
            >
                <div className="relative w-full py-5 pl-4 pr-1 sm:pl-5 sm:pr-1.5 lg:pl-6 lg:pr-2">
                    {/* The wordmark below is absolutely centred, so it never
                        occupies a track here. Two flex ends keep each icon group
                        pinned to its own edge at every width. */}
                    <div className="flex items-center justify-between">
                        <div className="z-10 flex items-center justify-start">
                            <button
                                ref={menuButtonRef}
                                type="button"
                                aria-expanded={isMenuOpen}
                                aria-controls="site-menu"
                                aria-label={
                                    isMenuOpen
                                        ? "Close navigation menu"
                                        : "Open navigation menu"
                                }
                                onClick={toggleMenu}
                                className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
                            >
                                <MenuIcon />
                            </button>
                        </div>

                        <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center pointer-events-none">
                            <Link
                                href="/"
                                onClick={closeMenu}
                                aria-label="Sombre home"
                                className="pointer-events-auto font-display text-[1.15rem] font-normal leading-none tracking-[0.3em] text-stone-100 transition-colors hover:text-white sm:text-[2.05rem] sm:tracking-[0.34em]"
                            >
                                Sombre
                            </Link>
                        </div>

                        <div className="z-10 flex items-center justify-end gap-1">
                            <button
                                ref={searchButtonRef}
                                type="button"
                                aria-label="Open search"
                                aria-expanded={isSearchOpen}
                                aria-controls="site-search"
                                onClick={openSearch}
                                className="inline-flex h-10 w-10 items-center justify-center text-stone-200 transition-colors hover:text-stone-100"
                            >
                                <SearchIcon />
                            </button>
                            <NavbarCartIndicator />
                        </div>
                    </div>
                </div>
            </header>

            <NavDrawer
                isOpen={isMenuOpen}
                onClose={closeMenu}
                returnFocusRef={menuButtonRef}
            />

            <ProductSearchPanel
                isOpen={isSearchOpen}
                onClose={closeSearch}
                returnFocusRef={searchButtonRef}
            />
        </>
    );
}
