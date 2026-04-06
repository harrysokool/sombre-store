"use client";

import Link from "next/link";
import { useState } from "react";

import { NavbarCartIndicator } from "@/components/cart/navbar-cart-indicator";

const navigationItems = [
    { label: "Shop", href: "/shop" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
];

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

function CloseIcon() {
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
                d="M6 6l12 12M18 6 6 18"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
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
                d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function UserIcon() {
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
                d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Zm-11.25 13.5a7.5 7.5 0 0 1 15 0"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-30 border-b border-white/10 bg-stone-950/90 backdrop-blur-md">
                <div className="relative w-full py-5 pl-4 pr-2 sm:pl-5 sm:pr-3 lg:pl-6 lg:pr-3">
                    <div className="grid grid-cols-[5.5rem_auto_5rem] items-center sm:grid-cols-[7.5rem_auto_6.75rem]">
                        <div className="z-10 flex items-center justify-start">
                            <button
                                type="button"
                                aria-expanded={isMenuOpen}
                                aria-controls="site-menu"
                                aria-label={
                                    isMenuOpen
                                        ? "Close navigation menu"
                                        : "Open navigation menu"
                                }
                                onClick={() => setIsMenuOpen((open) => !open)}
                                className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
                            >
                                <MenuIcon />
                            </button>
                        </div>

                        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center pointer-events-none">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                aria-label="Sombre home"
                                className="pointer-events-auto font-serif text-[1.35rem] font-medium tracking-[0.18em] text-stone-100 sm:text-[2.0rem]"
                            >
                                Sombre
                            </Link>
                        </div>

                        <div className="z-10 flex items-center justify-end gap-1 sm:gap-2">
                            <button
                                type="button"
                                aria-label="Search coming soon"
                                className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
                            >
                                <SearchIcon />
                            </button>

                            <button
                                type="button"
                                aria-label="Account features coming soon"
                                className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
                            >
                                <UserIcon />
                            </button>

                            <NavbarCartIndicator />
                        </div>
                    </div>
                </div>
            </header>

            <div
                className={`fixed inset-0 z-40 transition-opacity duration-300 ${
                    isMenuOpen
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0"
                }`}
                aria-hidden={!isMenuOpen}
            >
                <button
                    type="button"
                    aria-label="Close navigation menu"
                    onClick={() => setIsMenuOpen(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
            </div>

            <aside
                id="site-menu"
                aria-label="Navigation panel"
                className={`fixed left-0 top-0 z-50 h-full w-full max-w-[24rem] border-r border-white/10 bg-stone-950 px-6 py-6 transition-transform duration-300 ease-out sm:px-8 ${
                    isMenuOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-6">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                                Navigation
                            </p>
                            <p className="max-w-xs text-sm leading-7 text-stone-400">
                                Enter the collection through the house, the
                                shop, or customer correspondence.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(false)}
                            aria-label="Close navigation menu"
                            className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
                        >
                            <CloseIcon />
                        </button>
                    </div>

                    <nav
                        aria-label="Primary"
                        className="flex flex-1 flex-col justify-between"
                    >
                        <div className="space-y-5 pt-8">
                            {navigationItems.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block text-3xl font-medium tracking-[0.08em] text-stone-100 transition-colors hover:text-white"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        <div className="border-t border-white/10 pt-6">
                            <Link
                                href="/shop"
                                onClick={() => setIsMenuOpen(false)}
                                className="text-xs uppercase tracking-[0.3em] text-stone-500 transition-colors hover:text-stone-100"
                            >
                                Explore the Collection
                            </Link>
                        </div>
                    </nav>
                </div>
            </aside>
        </>
    );
}
