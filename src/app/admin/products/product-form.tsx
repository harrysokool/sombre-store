"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createProductAction,
  type ProductActionState,
} from "@/app/admin/products/actions";
import { AdminInfoTooltip } from "@/components/admin/admin-info-tooltip";
import { useCheckboxResetGuard } from "@/hooks/use-checkbox-reset-guard";
import { useSelectResetGuard } from "@/hooks/use-select-reset-guard";
import { PRODUCT_TEXT_LIMITS } from "@/lib/admin/product-rules";
import {
  MAX_PRODUCT_SLUG_LENGTH,
  slugifyProductName,
} from "@/lib/admin/product-slug";
import type { AdminProductOption } from "@/lib/admin/products";

const initialActionState: ProductActionState = {
  error: null,
};

const fieldLabelClassName =
  "inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-stone-400";
const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-stone-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

type ProductFormProps = {
  brands: AdminProductOption[];
  categories: AdminProductOption[];
};

export function ProductForm({ brands, categories }: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(
    createProductAction,
    initialActionState,
  );
  // Controlled throughout: React resets the form element once its action
  // completes, which would discard the administrator's entries on a refused
  // save and make them retype the lot.
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [isActive, setIsActive] = useState(false);
  const activeRef = useCheckboxResetGuard(isActive);
  const brandRef = useSelectResetGuard(brandId);
  const categoryRef = useSelectResetGuard(categoryId);

  // The slug follows the name until the administrator writes their own, which
  // is the usual path here: the catalog's slugs are brand-prefixed while a
  // product's name is not.
  const [hasCustomSlug, setHasCustomSlug] = useState(false);

  function handleNameChange(value: string) {
    setName(value);

    if (!hasCustomSlug) {
      setSlug(slugifyProductName(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    // Clearing the field hands control back to the suggestion; anything else
    // typed there is deliberate and the name stops overwriting it.
    setHasCustomSlug(value.trim() !== "");
  }

  return (
    <form action={formAction} className="space-y-8">
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6">
        <div className="space-y-2 sm:col-span-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="name">Product name</label>
          </span>
          <input
            id="name"
            type="text"
            name="name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            maxLength={PRODUCT_TEXT_LIMITS.name}
            required
            disabled={isPending}
            placeholder="Replica Jazz Club"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="slug">Slug</label>
            <AdminInfoTooltip label="More information about Slug">
              The product&rsquo;s web address, suggested from the name until you
              edit it. Existing products are prefixed with their brand, as in
              maison-margiela-replica-jazz-club.
            </AdminInfoTooltip>
          </span>
          <input
            id="slug"
            type="text"
            name="slug"
            value={slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            maxLength={MAX_PRODUCT_SLUG_LENGTH}
            required
            disabled={isPending}
            spellCheck={false}
            autoComplete="off"
            placeholder="maison-margiela-replica-jazz-club"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="brandId">Brand</label>
          </span>
          <select
            ref={brandRef}
            id="brandId"
            name="brandId"
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            required
            disabled={isPending}
            className={inputClassName}
          >
            <option value="">Select a brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="categoryId">Category</label>
          </span>
          <select
            ref={categoryRef}
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            disabled={isPending}
            className={inputClassName}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="sizeLabel">Size label</label>
          </span>
          <input
            id="sizeLabel"
            type="text"
            name="sizeLabel"
            value={sizeLabel}
            onChange={(event) => setSizeLabel(event.target.value)}
            maxLength={PRODUCT_TEXT_LIMITS.sizeLabel}
            disabled={isPending}
            placeholder="100 mL"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="stockQuantity">Stock quantity</label>
          </span>
          <input
            id="stockQuantity"
            type="number"
            name="stockQuantity"
            value={stockQuantity}
            onChange={(event) => setStockQuantity(event.target.value)}
            min="0"
            step="1"
            inputMode="numeric"
            disabled={isPending}
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="price">Sombre price</label>
          </span>
          <input
            id="price"
            type="number"
            name="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            min="0"
            step="0.01"
            inputMode="decimal"
            required
            disabled={isPending}
            placeholder="165.00"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="retailPrice">Retail price</label>
            <AdminInfoTooltip label="More information about Retail price">
              The official price this product sells for elsewhere. Optional, and
              charged to nobody &mdash; checkout always uses the Sombre price.
            </AdminInfoTooltip>
          </span>
          <input
            id="retailPrice"
            type="number"
            name="retailPrice"
            value={retailPrice}
            onChange={(event) => setRetailPrice(event.target.value)}
            min="0"
            step="0.01"
            inputMode="decimal"
            disabled={isPending}
            className={inputClassName}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="shortDescription">Short description</label>
          </span>
          <input
            id="shortDescription"
            type="text"
            name="shortDescription"
            value={shortDescription}
            onChange={(event) => setShortDescription(event.target.value)}
            maxLength={PRODUCT_TEXT_LIMITS.shortDescription}
            disabled={isPending}
            placeholder="Spiced warmth and polished woods."
            className={inputClassName}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="description">Description</label>
          </span>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={PRODUCT_TEXT_LIMITS.description}
            rows={5}
            disabled={isPending}
            className={`${inputClassName} resize-y`}
          />
        </div>

        <div className="flex items-start gap-3 sm:col-span-2">
          <input
            ref={activeRef}
            id="isActive"
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            disabled={isPending}
            className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-stone-200">
            <label htmlFor="isActive">Active</label>
            <AdminInfoTooltip label="More information about Active">
              Active products are visible in the shop straight away. This product
              has no images yet, so leave it inactive until they are added.
            </AdminInfoTooltip>
          </span>
        </div>
      </section>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Create product"}
        </button>
        <Link href="/admin/inventory" className={secondaryButtonClassName}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
