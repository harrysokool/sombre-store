import type { Metadata } from "next";

import { ProductForm } from "@/app/admin/products/product-form";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import {
  listAdminProductFormOptions,
  type AdminProductFormOptions,
} from "@/lib/admin/products";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "New product",
};

export const dynamic = "force-dynamic";

async function loadFormOptions() {
  try {
    return {
      options: await listAdminProductFormOptions(),
      hasError: false,
    };
  } catch (error) {
    console.error(
      "Failed to load brands and categories for /admin/products/new:",
      error,
    );

    return {
      options: { brands: [], categories: [] } as AdminProductFormOptions,
      hasError: true,
    };
  }
}

export default async function NewAdminProductPage() {
  // Runs outside the loader so the redirect signal is never caught.
  await requireAdminUser();

  const { options, hasError } = await loadFormOptions();
  // A product must be filed under an existing brand and category, and neither
  // can be created from here, so an empty list is a dead end worth naming
  // rather than a dropdown with nothing to choose.
  const hasNoOptions =
    options.brands.length === 0 || options.categories.length === 0;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <AdminBackLink href="/admin/inventory">Inventory</AdminBackLink>
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
          New product
        </h1>
      </div>

      {hasError || hasNoOptions ? (
        <p
          role="alert"
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400"
        >
          {hasError
            ? "Brands and categories could not be loaded. Please try again."
            : "A product needs an existing brand and category, and at least one of those is missing."}
        </p>
      ) : (
        <ProductForm brands={options.brands} categories={options.categories} />
      )}
    </div>
  );
}
