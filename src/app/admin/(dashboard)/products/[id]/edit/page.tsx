import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "@/app/admin/products/product-form";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import {
  getAdminProductEditorData,
  type AdminProductEditorData,
} from "@/lib/admin/products";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Edit product",
};

export const dynamic = "force-dynamic";

async function loadProduct(productId: string) {
  try {
    return {
      data: await getAdminProductEditorData(productId),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load product for admin", error);

    return {
      data: null as AdminProductEditorData | null,
      hasError: true,
    };
  }
}

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Runs outside the loader so the redirect signal is never caught.
  await requireAdminUser();

  const { id } = await params;
  const { data, hasError } = await loadProduct(id);

  if (hasError) {
    return (
      <div className="space-y-6">
        <AdminBackLink href="/admin/inventory">Inventory</AdminBackLink>
        <p
          role="alert"
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400"
        >
          Product details could not be loaded. Please try again.
        </p>
      </div>
    );
  }

  // Covers both a malformed id and a product that does not exist, which the
  // data layer reports the same way.
  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <AdminBackLink href="/admin/inventory">Inventory</AdminBackLink>
        <h1 className="break-words text-2xl font-medium tracking-[0.08em] text-stone-100 [overflow-wrap:anywhere] sm:text-3xl">
          {data.product.name}
        </h1>
      </div>

      <ProductForm
        mode="edit"
        brands={data.brands}
        categories={data.categories}
        productId={data.product.id}
        name={data.product.name}
        slug={data.product.slug}
        brandId={data.product.brandId}
        categoryId={data.product.categoryId}
        sizeLabel={data.product.sizeLabel}
        shortDescription={data.product.shortDescription}
        description={data.product.description}
        price={data.product.price}
        retailPrice={data.product.retailPrice}
        stockQuantity={data.product.stockQuantity}
        isActive={data.product.isActive}
      />
    </div>
  );
}
