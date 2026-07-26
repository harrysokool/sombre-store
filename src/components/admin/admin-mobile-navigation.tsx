"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AdminAccountPanel } from "@/components/admin/admin-account-panel";
import { AdminNav } from "@/components/admin/admin-nav";
import { getActiveAdminNavigationItem } from "@/components/admin/admin-navigation";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

function MenuIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-5 flex-col justify-between py-0.5"
    >
      <span className="block h-px w-full bg-current" />
      <span className="block h-px w-full bg-current" />
      <span className="block h-px w-full bg-current" />
    </span>
  );
}

function CloseIcon() {
  return (
    <span aria-hidden="true" className="text-2xl font-light leading-none">
      ×
    </span>
  );
}

type AdminMobileNavigationProps = {
  email?: string | null;
};

export function AdminMobileNavigation({
  email,
}: AdminMobileNavigationProps) {
  const pathname = usePathname() ?? "";
  const currentItem = getActiveAdminNavigationItem(pathname);
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const previousPathnameRef = useRef(pathname);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  // A route can change without the drawer link receiving a click (for example,
  // browser history). Never carry an open drawer into the next admin page.
  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    const closeId = window.setTimeout(closeDrawer, 0);

    return () => {
      window.clearTimeout(closeId);
    };
  }, [closeDrawer, pathname]);

  // If the viewport grows into the permanent-sidebar layout, close the mobile
  // dialog as well as hiding it so body scrolling cannot remain locked.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const desktopMedia = window.matchMedia("(min-width: 1024px)");

    function handleDesktopChange(event: MediaQueryListEvent) {
      if (event.matches) {
        closeDrawer();
      }
    }

    desktopMedia.addEventListener("change", handleDesktopChange);

    return () => {
      desktopMedia.removeEventListener("change", handleDesktopChange);
    };
  }, [closeDrawer]);

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

      const drawer = drawerRef.current;

      if (!drawer) {
        return;
      }

      const focusable = [
        ...drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (active === last || !drawer.contains(active))) {
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
  }, [closeDrawer, isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 flex min-w-0 items-center gap-3 border-b border-white/10 bg-stone-950/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls="admin-navigation-drawer"
          aria-label={
            isOpen ? "Close admin navigation" : "Open admin navigation"
          }
          onClick={() => setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-200 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white ${focusRing}`}
        >
          <MenuIcon />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[0.65rem] uppercase tracking-[0.28em] text-stone-400">
            Sombre Admin
          </p>
          <p className="truncate text-sm font-medium text-stone-100">
            {currentItem?.label ?? "Admin"}
          </p>
        </div>
      </header>

      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 transition-opacity duration-200 motion-reduce:transition-none lg:hidden ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-admin-navigation-overlay=""
          onClick={closeDrawer}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />
      </div>

      <div
        ref={drawerRef}
        id="admin-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        inert={!isOpen}
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[86%] max-w-[20rem] flex-col border-r border-white/10 bg-stone-950 shadow-2xl shadow-black/40 transition-transform duration-200 ease-out motion-reduce:transition-none lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.28em] text-stone-300">
              Sombre Admin
            </p>
            <p className="truncate text-xs text-stone-400">
              {currentItem?.label ?? "Admin"}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close admin navigation"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-300 transition-colors hover:bg-white/[0.05] hover:text-white ${focusRing}`}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <AdminNav
            variant="mobile"
            ariaLabel="Admin mobile navigation"
            onNavigate={closeDrawer}
          />
        </div>

        <div className="shrink-0 px-5 pb-5">
          <AdminAccountPanel email={email} />
        </div>
      </div>
    </>
  );
}
