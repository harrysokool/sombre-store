"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";

const primaryLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const shopLinks = [
  { label: "Best Sellers", href: "/shop?collection=best-sellers" },
  { label: "New Arrivals", href: "/shop?collection=new-arrivals" },
  { label: "Perfume", href: "/shop?category=perfume" },
  { label: "Body Care", href: "/shop?category=body-care" },
  { label: "Home Fragrance", href: "/shop?category=home-fragrance" },
  { label: "All Products", href: "/shop" },
];

// Mirrors the policy list in the footer. Kept local so this component owns its
// own navigation data and the footer is not coupled to the drawer.
const policyLinks = [
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Return and Refund Policy", href: "/refund-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms and Conditions", href: "/terms" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

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
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d={direction === "right" ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NavDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Focus returns here when the drawer closes, so the keyboard never resets. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export function NavDrawer({ isOpen, onClose, returnFocusRef }: NavDrawerProps) {
  const [activeLevel, setActiveLevel] = useState<"main" | "shop">("main");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const shopTriggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const isShopLevel = activeLevel === "shop";

  // Every close path funnels through here, so the panel always reopens at the
  // top level rather than wherever it was last left.
  function closeDrawer() {
    setActiveLevel("main");
    onClose();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      // Recomputed per keypress: which controls exist changes with the level.
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped the panel.
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // closeDrawer is stable for this component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // One place decides where focus lands: entering the drawer, moving between
  // levels, and leaving. Splitting these would let two effects fight over it.
  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        returnFocusRef.current?.focus();
      }

      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    // The control that was clicked has just unmounted with its level, so focus
    // moves to the equivalent control on the level now showing.
    if (isShopLevel) {
      backButtonRef.current?.focus();
    } else {
      shopTriggerRef.current?.focus();
    }
  }, [isOpen, isShopLevel, returnFocusRef]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeDrawer}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
      </div>

      {/* `inert` while closed keeps the off-screen panel out of the tab order
          and out of the accessibility tree, without unmounting it mid-slide. */}
      <div
        ref={panelRef}
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        inert={!isOpen}
        className={`fixed left-0 top-0 z-50 flex h-full w-[86%] max-w-[22rem] flex-col bg-stone-950 transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 px-6 pt-6 sm:px-7">
          <div className="flex justify-start">
            {isShopLevel ? (
              <button
                ref={backButtonRef}
                type="button"
                onClick={() => setActiveLevel("main")}
                aria-label="Back to main menu"
                className={`inline-flex h-10 w-10 items-center justify-center text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
              >
                <ChevronIcon direction="left" />
              </button>
            ) : null}
          </div>

          <p className="text-center font-display text-base font-normal tracking-[0.28em] text-stone-300">
            {isShopLevel ? "Shop" : ""}
          </p>

          <div className="flex justify-end">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation menu"
              className={`inline-flex h-10 w-10 items-center justify-center text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="mx-6 mt-5 border-t border-white/10 sm:mx-7" />

        <nav
          aria-label={isShopLevel ? "Shop navigation" : "Main navigation"}
          className="flex-1 overflow-y-auto px-6 py-10 sm:px-7"
        >
          {isShopLevel ? (
            <ul key="shop" className="animate-drawer-level space-y-1">
              {shopLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeDrawer}
                    className={`block py-3 text-lg font-light tracking-[0.04em] text-stone-300 transition-colors hover:text-white ${focusRing}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul key="main" className="animate-drawer-level space-y-1">
              <li>
                <button
                  ref={shopTriggerRef}
                  type="button"
                  onClick={() => setActiveLevel("shop")}
                  aria-expanded={false}
                  aria-haspopup="true"
                  className={`flex w-full items-center justify-between gap-4 py-4 text-left text-[1.75rem] font-light leading-tight tracking-[0.01em] text-stone-100 transition-colors hover:text-white ${focusRing}`}
                >
                  Shop
                  <ChevronIcon direction="right" />
                </button>
              </li>

              {primaryLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeDrawer}
                    className={`block py-4 text-[1.75rem] font-light leading-tight tracking-[0.01em] text-stone-100 transition-colors hover:text-white ${focusRing}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="border-t border-white/10 px-6 pb-9 pt-7 sm:px-7">
          <ul className="space-y-3">
            {policyLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeDrawer}
                  className={`block text-[0.7rem] uppercase tracking-[0.18em] text-stone-500 transition-colors hover:text-stone-200 ${focusRing}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
