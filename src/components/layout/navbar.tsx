"use client";

import Link from "next/link";
import { useState } from "react";

import { NavbarCartIndicator } from "@/components/cart/navbar-cart-indicator";

const navigationItems = [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
];

const shopNavigationItems = [
    { label: "Best Sellers", href: "/shop?collection=best-sellers" },
    { label: "New Arrivals", href: "/shop?collection=new-arrivals" },
    { label: "Perfume", href: "/shop?category=perfume" },
    { label: "Body Care", href: "/shop?category=body-care" },
    { label: "Home Fragrance", href: "/shop?category=home-fragrance" },
    { label: "All Products", href: "/shop" },
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

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<"main" | "shop">("main");

    function closeMenu() {
        setIsMenuOpen(false);
        setActiveMenu("main");
    }

    function toggleMenu() {
        if (isMenuOpen) {
            closeMenu();
            return;
        }

        setIsMenuOpen(true);
    }

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
                                className="pointer-events-auto font-serif text-[1.35rem] font-medium tracking-[0.18em] text-stone-100 sm:text-[2.0rem]"
                            >
                                Sombre
                            </Link>
                        </div>

                        <div className="z-10 flex items-center justify-end">
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
                    onClick={closeMenu}
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
                    <div className="flex justify-end border-b border-white/10 pb-6">
                        <button
                            type="button"
                            onClick={closeMenu}
                            aria-label="Close navigation menu"
                            className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
                        >
                            <CloseIcon />
                        </button>
                    </div>

                    <nav
                        aria-label={activeMenu === "shop" ? "Shop" : "Primary"}
                        className="flex-1"
                    >
                        {activeMenu === "main" ? (
                            <div className="space-y-5 pt-8">
                                <button
                                    type="button"
                                    onClick={() => setActiveMenu("shop")}
                                    className="block text-left text-3xl font-medium tracking-[0.08em] text-stone-100 transition-colors hover:text-white"
                                >
                                    Shop
                                </button>

                                {navigationItems.map((item) => (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        onClick={closeMenu}
                                        className="block text-3xl font-medium tracking-[0.08em] text-stone-100 transition-colors hover:text-white"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="pt-8">
                                <button
                                    type="button"
                                    onClick={() => setActiveMenu("main")}
                                    className="mb-8 text-xs uppercase tracking-[0.3em] text-stone-500 transition-colors hover:text-stone-100"
                                >
                                    Back
                                </button>

                                <div className="space-y-5">
                                    {shopNavigationItems.map((item) => (
                                        <Link
                                            key={item.label}
                                            href={item.href}
                                            onClick={closeMenu}
                                            className="block text-2xl font-medium tracking-[0.08em] text-stone-100 transition-colors hover:text-white sm:text-3xl"
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </nav>
                </div>
            </aside>
        </>
    );
}
