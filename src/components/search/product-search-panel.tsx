"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
};

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
}: ProductSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

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
          setHasLoaded(true);
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
  }, [hasLoaded, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const trimmedQuery = query.trim().toLowerCase();
  const matchingProducts = useMemo(() => {
    if (!trimmedQuery) {
      return [];
    }

    return products
      .filter((product) => getSearchableText(product).includes(trimmedQuery))
      .slice(0, 6);
  }, [products, trimmedQuery]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40">
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
      </div>

      <section
        id="site-search"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-[1.5rem] border border-white/10 bg-stone-950 p-5 shadow-2xl shadow-black/40 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
            Search
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="inline-flex h-10 w-10 items-center justify-center text-stone-300 transition-colors hover:text-stone-100"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 pt-5">
          <div>
            <label htmlFor="site-search-input" className="sr-only">
              Search fragrance
            </label>
            <input
              id="site-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fragrance"
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-base text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/25"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {!trimmedQuery ? (
              <p className="py-8 text-center text-sm text-stone-500">
                Search by fragrance or brand.
              </p>
            ) : isLoading ? (
              <p className="py-8 text-center text-sm text-stone-500">
                Searching products.
              </p>
            ) : hasError ? (
              <p className="py-8 text-center text-sm text-stone-500">
                Search is unavailable right now.
              </p>
            ) : matchingProducts.length > 0 ? (
              <div className="divide-y divide-white/10">
                {matchingProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={onClose}
                    className="grid grid-cols-[72px_1fr] gap-4 py-4 transition-colors hover:bg-white/[0.03] sm:grid-cols-[84px_1fr]"
                  >
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-stone-100">
                      {product.primaryImage ? (
                        <Image
                          src={product.primaryImage.image_url}
                          alt={
                            product.primaryImage.alt_text ??
                            `${product.name} product image`
                          }
                          width={168}
                          height={210}
                          className="aspect-[4/5] w-full object-contain p-2"
                        />
                      ) : (
                        <div className="flex aspect-[4/5] items-center justify-center">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                            No image
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col justify-center gap-2 pr-3">
                      <p className="truncate text-xs uppercase tracking-[0.2em] text-stone-500">
                        {product.brand?.name ?? "Sombre"}
                      </p>
                      <p className="text-base font-medium leading-snug text-stone-100">
                        {product.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-400">
                        {product.size_label ? <span>{product.size_label}</span> : null}
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
              <p className="py-8 text-center text-sm text-stone-500">
                No products found.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
