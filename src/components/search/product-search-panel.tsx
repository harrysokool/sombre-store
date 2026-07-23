"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/storefront/format-price";
import {
  normalizeProductListItem,
  type ProductListItem,
  type ProductListItemRow,
} from "@/lib/storefront/shop";

type ProductSearchPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Focus returns here when the panel closes, so the keyboard never resets. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

// Full-width result rows sit inside an overflow container, so an offset ring
// would clip; an inset ring stays visible without being cut off.
const rowFocusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-stone-300";

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
      className="h-5 w-5 shrink-0 text-stone-500"
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

async function getActiveProducts() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `
        id,
        name,
        slug,
        short_description,
        price,
        size_label,
        stock_quantity,
        is_featured,
        created_at,
        brand:brands (
          name,
          slug
        ),
        category:categories (
          name,
          slug
        ),
        product_images (
          image_url,
          alt_text,
          sort_order,
          is_primary
        )
      `,
    )
    .eq("is_active", true)
    .order("name")
    .returns<ProductListItemRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeProductListItem);
}

function getSearchableText(product: ProductListItem) {
  return `${product.name} ${product.brand?.name ?? ""}`.toLowerCase();
}

export function ProductSearchPanel({
  isOpen,
  onClose,
  returnFocusRef,
}: ProductSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Success-only latch: the active catalog is fetched once and cached. A failed
  // request leaves this false so reopening or "Try again" refetches.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen || hasLoaded) {
      return;
    }

    let isActive = true;

    async function loadProducts() {
      try {
        setIsLoading(true);
        setHasError(false);

        const activeProducts = await getActiveProducts();

        if (isActive) {
          setProducts(activeProducts);
          setHasLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load products for search:", error);

        if (isActive) {
          setHasError(true);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [hasLoaded, isOpen, reloadToken]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  // Escape to close, a wrap-around Tab trap, and a body-scroll lock while open —
  // mirrors the navigation drawer so both dialogs behave identically.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      // Recomputed per keypress: the number of result links changes as the
      // shopper types, so the trap boundaries move with them.
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

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
    // onClose only flips a boolean setter; re-subscribing solely on open/close
    // is intentional and matches the drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // One effect owns focus: into the input on open, back to the trigger on close.
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
      inputRef.current?.focus();
    }
  }, [isOpen, returnFocusRef]);

  const trimmedQuery = query.trim().toLowerCase();
  const matchingProducts = useMemo(() => {
    if (!trimmedQuery) {
      return [];
    }

    return products
      .filter((product) => getSearchableText(product).includes(trimmedQuery))
      .slice(0, 6);
  }, [products, trimmedQuery]);

  // Concise, polite announcement for assistive tech. The error state carries its
  // own alert, so it is intentionally excluded here to avoid a double read.
  const statusMessage = !trimmedQuery
    ? ""
    : isLoading
      ? "Searching products."
      : hasError
        ? ""
        : matchingProducts.length > 0
          ? `${matchingProducts.length} ${
              matchingProducts.length === 1 ? "result" : "results"
            }.`
          : "No products found.";

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
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
      </div>

      {/* `inert` while closed keeps the off-screen sheet out of the tab order
          and the accessibility tree without unmounting it mid-transition. */}
      <section
        ref={panelRef}
        id="site-search"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        inert={!isOpen}
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-stone-950 transition-all duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto w-full max-w-4xl px-6 py-6 sm:px-10 sm:py-8 lg:px-12">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
              Search
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className={`inline-flex h-11 w-11 items-center justify-center text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-6 flex items-center gap-4 border-b border-white/25 pb-4 transition-colors focus-within:border-stone-100 sm:mt-8">
            <SearchIcon />
            <label htmlFor="site-search-input" className="sr-only">
              Search fragrance or brand
            </label>
            <input
              id="site-search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fragrance or brand"
              autoComplete="off"
              className="w-full min-w-0 bg-transparent text-lg font-light text-stone-100 outline-none placeholder:text-stone-600 sm:text-2xl"
            />
          </div>

          <div
            className="mt-6 max-h-[60vh] overflow-y-auto sm:mt-8"
            aria-busy={isLoading}
          >
            <p role="status" aria-live="polite" className="sr-only">
              {statusMessage}
            </p>

            {!trimmedQuery ? (
              <p className="py-10 text-sm text-stone-500">
                Search by fragrance or brand.
              </p>
            ) : isLoading ? (
              <p className="py-10 text-sm text-stone-500">
                Searching products.
              </p>
            ) : hasError ? (
              <div role="alert" className="py-10">
                <p className="text-sm text-stone-400">
                  Search is unavailable right now.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHasError(false);
                    setReloadToken((token) => token + 1);
                  }}
                  className={`mt-4 inline-flex min-h-11 items-center border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.24em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white ${focusRing}`}
                >
                  Try again
                </button>
              </div>
            ) : matchingProducts.length > 0 ? (
              <div className="divide-y divide-white/10">
                {matchingProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={onClose}
                    className={`grid grid-cols-[64px_1fr] items-center gap-5 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[72px_1fr] ${rowFocusRing}`}
                  >
                    <div className="overflow-hidden border border-white/10 bg-stone-100">
                      {product.primaryImage ? (
                        <Image
                          src={product.primaryImage.image_url}
                          alt={
                            product.primaryImage.alt_text ??
                            `${product.name} product image`
                          }
                          width={144}
                          height={180}
                          className="aspect-[4/5] w-full object-contain p-1.5"
                        />
                      ) : (
                        <div className="flex aspect-[4/5] items-center justify-center">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-stone-500">
                            No image
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-1.5">
                      <p className="truncate text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
                        {product.brand?.name ?? "Sombre"}
                      </p>
                      <p className="text-base font-light leading-snug text-stone-100 [overflow-wrap:anywhere]">
                        {product.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-400">
                        {product.size_label ? (
                          <span>{product.size_label}</span>
                        ) : null}
                        <span className="font-medium text-stone-200">
                          {formatPrice(product.price)}
                        </span>
                        {product.stock_quantity <= 0 ? (
                          <span className="uppercase tracking-[0.16em] text-stone-500">
                            Sold out
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-10 text-sm text-stone-500">No products found.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
