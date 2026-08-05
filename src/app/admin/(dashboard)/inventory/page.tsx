import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import {
  ALL_INVENTORY_FILTER,
  formatInventoryPrice,
  getInventoryRelationOptions,
  getInventoryStockStatus,
  getVisibleInventoryProducts,
  normalizeInventoryView,
  STOCK_STATUS_LABELS,
  summarizeInventory,
  type AdminInventoryProduct,
  type InventorySearchParams,
  type InventoryStockStatus,
} from "@/lib/admin/inventory";
import { listAdminInventory } from "@/lib/admin/inventory-data";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Inventory",
};

export const dynamic = "force-dynamic";

type InventoryPageProps = {
  searchParams?: Promise<InventorySearchParams>;
};

const CONTROL_CLASS_NAME =
  "min-w-0 w-full rounded-xl border border-white/10 bg-[#141211] px-3 py-2.5 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-400 hover:border-white/20 focus:border-white/30 focus:ring-2 focus:ring-white/20";

const STOCK_FILTER_OPTIONS = [
  { value: ALL_INVENTORY_FILTER, label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
] as const;

const ACTIVE_FILTER_OPTIONS = [
  { value: ALL_INVENTORY_FILTER, label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

const SORT_OPTIONS = [
  { value: "name", label: "Product name" },
  { value: "brand", label: "Brand" },
  { value: "category", label: "Category" },
  { value: "stock-asc", label: "Stock quantity, lowest first" },
  { value: "stock-desc", label: "Stock quantity, highest first" },
] as const;

function ProductThumbnail({ product }: { product: AdminInventoryProduct }) {
  const image = product.primaryImage;

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
      {image ? (
        <Image
          src={image.imageUrl}
          alt={image.altText ?? `${product.name} product thumbnail`}
          width={64}
          height={64}
          sizes="64px"
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <div
          role="img"
          aria-label={`No image available for ${product.name}`}
          className="flex h-full items-center justify-center px-2 text-center"
        >
          <span className="text-[0.55rem] uppercase tracking-[0.14em] text-stone-500">
            No image
          </span>
        </div>
      )}
    </div>
  );
}

function StockStatusBadge({ status }: { status: InventoryStockStatus }) {
  const label = STOCK_STATUS_LABELS[status];

  return (
    <StatusBadge
      kind="stock"
      value={status}
      label={label}
      ariaLabel={`Stock status: ${label}`}
    />
  );
}

function ProductStatusBadge({ isActive }: { isActive: boolean }) {
  const value = isActive ? "active" : "inactive";

  return (
    <StatusBadge
      kind="product"
      value={value}
      ariaLabel={`Product status: ${isActive ? "Active" : "Inactive"}`}
    />
  );
}

function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-stone-200 [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

async function loadInventory() {
  try {
    return {
      products: await listAdminInventory(),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load inventory for /admin/inventory:", error);

    return {
      products: [] as AdminInventoryProduct[],
      hasError: true,
    };
  }
}

function InventorySummaryCards({
  products,
}: {
  products: AdminInventoryProduct[];
}) {
  const summary = summarizeInventory(products);
  const cards = [
    { label: "Total products", value: summary.totalProducts },
    { label: "Total stock units", value: summary.totalStockUnits },
    { label: "Low stock products", value: summary.lowStockProducts },
    { label: "Out of stock products", value: summary.outOfStockProducts },
  ];

  return (
    <dl
      aria-label="Inventory summary"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-5"
        >
          <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">
            {card.label}
          </dt>
          <dd className="mt-3 text-3xl font-medium text-stone-100">
            {card.value.toLocaleString("en-HK")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function InventoryFilters({
  products,
  view,
}: {
  products: AdminInventoryProduct[];
  view: ReturnType<typeof normalizeInventoryView>;
}) {
  const brandOptions = getInventoryRelationOptions(products, "brand");
  const categoryOptions = getInventoryRelationOptions(products, "category");

  return (
    <form
      action="/admin/inventory"
      method="get"
      aria-label="Inventory filters"
      className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label htmlFor="inventory-search" className="min-w-0 space-y-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-stone-400">
            Product name
          </span>
          <input
            id="inventory-search"
            name="q"
            type="search"
            maxLength={120}
            defaultValue={view.search}
            placeholder="Search products"
            className={CONTROL_CLASS_NAME}
          />
        </label>

        <label htmlFor="inventory-brand" className="min-w-0 space-y-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-stone-400">
            Brand
          </span>
          <select
            id="inventory-brand"
            name="brand"
            defaultValue={view.brand}
            className={CONTROL_CLASS_NAME}
          >
            <option value={ALL_INVENTORY_FILTER}>All brands</option>
            {brandOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="inventory-category" className="min-w-0 space-y-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-stone-400">
            Category
          </span>
          <select
            id="inventory-category"
            name="category"
            defaultValue={view.category}
            className={CONTROL_CLASS_NAME}
          >
            <option value={ALL_INVENTORY_FILTER}>All categories</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="inventory-stock" className="min-w-0 space-y-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-stone-400">
            Stock status
          </span>
          <select
            id="inventory-stock"
            name="stock"
            defaultValue={view.stock}
            className={CONTROL_CLASS_NAME}
          >
            {STOCK_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="inventory-active" className="min-w-0 space-y-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-stone-400">
            Active status
          </span>
          <select
            id="inventory-active"
            name="active"
            defaultValue={view.active}
            className={CONTROL_CLASS_NAME}
          >
            {ACTIVE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="inventory-sort" className="min-w-0 space-y-2">
          <span className="block text-xs uppercase tracking-[0.18em] text-stone-400">
            Sort by
          </span>
          <select
            id="inventory-sort"
            name="sort"
            defaultValue={view.sort}
            className={CONTROL_CLASS_NAME}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Apply filters
          </button>
          <Link
            href="/admin/inventory"
            className="rounded-full px-4 py-2.5 text-xs uppercase tracking-[0.2em] text-stone-400 transition-colors hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Reset view
          </Link>
        </div>
      </div>
    </form>
  );
}

function InventoryProducts({
  products,
}: {
  products: AdminInventoryProduct[];
}) {
  return (
    <>
      <ul aria-label="Inventory products" className="space-y-3 lg:hidden">
        {products.map((product) => {
          const stockStatus = getInventoryStockStatus(product.stockQuantity);

          return (
            <li
              key={product.id}
              className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
            >
              <div className="flex min-w-0 gap-3">
                <ProductThumbnail product={product} />
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="break-words text-base font-medium text-stone-100 [overflow-wrap:anywhere]">
                    {product.name}
                  </h2>
                  <ProductStatusBadge isActive={product.isActive} />
                </div>
              </div>

              <dl className="space-y-3 border-t border-white/10 pt-4">
                <CardField label="Brand">
                  {product.brand?.name ?? "No brand"}
                </CardField>
                <CardField label="Category">
                  {product.category?.name ?? "No category"}
                </CardField>
                <CardField label="Stock quantity">
                  {product.stockQuantity.toLocaleString("en-HK")}
                </CardField>
                <CardField label="Price">
                  {formatInventoryPrice(product.price)}
                </CardField>
                <CardField label="Stock status">
                  <StockStatusBadge status={stockStatus} />
                </CardField>
              </dl>
            </li>
          );
        })}
      </ul>

      <div className="hidden w-full max-w-full overflow-x-auto rounded-2xl border border-white/10 lg:block">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <caption className="sr-only">Inventory products</caption>
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-400">
              <th className="px-4 py-4 font-normal">Product</th>
              <th className="px-4 py-4 font-normal">Brand</th>
              <th className="px-4 py-4 font-normal">Category</th>
              <th className="px-4 py-4 text-right font-normal">Stock</th>
              <th className="px-4 py-4 text-right font-normal">Price</th>
              <th className="px-4 py-4 font-normal">Product status</th>
              <th className="px-4 py-4 font-normal">Stock status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stockStatus = getInventoryStockStatus(
                product.stockQuantity,
              );

              return (
                <tr
                  key={product.id}
                  className="border-b border-white/5 align-middle transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="max-w-[18rem] px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumbnail product={product} />
                      <span className="min-w-0 break-words font-medium text-stone-100 [overflow-wrap:anywhere]">
                        {product.name}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[12rem] break-words px-4 py-4 text-stone-300 [overflow-wrap:anywhere]">
                    {product.brand?.name ?? "No brand"}
                  </td>
                  <td className="max-w-[12rem] break-words px-4 py-4 text-stone-300 [overflow-wrap:anywhere]">
                    {product.category?.name ?? "No category"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-stone-100">
                    {product.stockQuantity.toLocaleString("en-HK")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-stone-200">
                    {formatInventoryPrice(product.price)}
                  </td>
                  <td className="px-4 py-4">
                    <ProductStatusBadge isActive={product.isActive} />
                  </td>
                  <td className="px-4 py-4">
                    <StockStatusBadge status={stockStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function AdminInventoryPage({
  searchParams,
}: InventoryPageProps = {}) {
  // Runs outside the inventory loader so the redirect signal is never caught.
  await requireAdminUser();

  const params = searchParams ? await searchParams : {};
  const { products, hasError } = await loadInventory();
  const view = normalizeInventoryView(params, products);
  const visibleProducts = getVisibleInventoryProducts(products, view);

  return (
    <div className="min-w-0 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
          Inventory
        </h1>
      </div>

      {hasError ? (
        <p
          role="alert"
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400"
        >
          Inventory could not be loaded. Please try again.
        </p>
      ) : (
        <>
          <InventorySummaryCards products={products} />
          <InventoryFilters products={products} view={view} />

          <section
            aria-labelledby="inventory-results-heading"
            className="min-w-0 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2
                id="inventory-results-heading"
                className="text-xl font-medium tracking-[0.08em] text-stone-100"
              >
                Products
              </h2>
              <p
                aria-live="polite"
                className="text-xs uppercase tracking-[0.18em] text-stone-400"
              >
                {visibleProducts.length === products.length
                  ? `${products.length} ${
                      products.length === 1 ? "product" : "products"
                    }`
                  : `${visibleProducts.length} of ${products.length} products`}
              </p>
            </div>

            {visibleProducts.length > 0 ? (
              <InventoryProducts products={visibleProducts} />
            ) : (
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                <p className="text-sm text-stone-200">
                  {products.length === 0
                    ? "No products in inventory."
                    : "No products match this view."}
                </p>
                {products.length > 0 ? (
                  <p className="text-sm text-stone-400">
                    Try changing the search or filters.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
