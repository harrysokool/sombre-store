"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  createCouponAction,
  updateCouponAction,
  type CouponActionState,
} from "@/app/admin/coupons/actions";
import type {
  AdminCouponAssignment,
  AdminCouponProduct,
} from "@/lib/admin/coupons";
import { formatPrice } from "@/lib/storefront/format-price";

const initialActionState: CouponActionState = {
  error: null,
  success: null,
  couponId: null,
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-stone-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

type CouponFormProps = {
  mode: "create" | "edit";
  couponId?: string;
  code?: string;
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
  products: AdminCouponProduct[];
  initialAssignments?: AdminCouponAssignment[];
};

type AssignmentRow = {
  productId: string;
  productName: string;
  productSlug: string;
  productPrice: number | string;
  isActive: boolean;
  discountPercent: string;
};

export function CouponForm({
  mode,
  couponId,
  code = "",
  isActive = false,
  startsAt = "",
  expiresAt = "",
  products,
  initialAssignments = [],
}: CouponFormProps) {
  const action =
    mode === "create" ? createCouponAction : updateCouponAction;
  const [state, formAction, isPending] = useActionState(
    action,
    initialActionState,
  );
  // Keyed by product ID so an assignment to a product that has since gone
  // inactive keeps its own name, price, and active flag even though it no
  // longer appears in the active `products` list. Every row here is
  // submitted on save; only `removeProduct` should ever drop one.
  const [assignments, setAssignments] = useState<AssignmentRow[]>(() =>
    initialAssignments.map((assignment) => ({
      productId: assignment.product_id,
      productName: assignment.product_name,
      productSlug: assignment.product_slug,
      productPrice: assignment.product_price,
      isActive: assignment.is_active,
      discountPercent: String(assignment.discount_percent),
    })),
  );
  const [productToAdd, setProductToAdd] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const assignedProductIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.productId)),
    [assignments],
  );
  // Only ever sourced from `products` (active products), so an inactive
  // product can never be added here.
  const availableProducts = products.filter(
    (product) => !assignedProductIds.has(product.id),
  );

  function addProduct() {
    if (!productToAdd || assignedProductIds.has(productToAdd)) {
      return;
    }

    const product = productMap.get(productToAdd);

    if (!product) {
      return;
    }

    setAssignments((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productPrice: product.price,
        isActive: true,
        discountPercent: "10.00",
      },
    ]);
    setProductToAdd("");
  }

  function removeProduct(productId: string) {
    setAssignments((current) =>
      current.filter((assignment) => assignment.productId !== productId),
    );
  }

  function setDiscountPercent(productId: string, value: string) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.productId === productId
          ? { ...assignment, discountPercent: value }
          : assignment,
      ),
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {couponId ? (
        <input type="hidden" name="couponId" value={couponId} />
      ) : null}

      <section className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6">
        <label className="block space-y-2 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
            Coupon code
          </span>
          {mode === "create" ? (
            <input
              type="text"
              name="code"
              required
              minLength={3}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              placeholder="SOMBRE"
              className={inputClassName}
            />
          ) : (
            <span className="block break-words font-mono text-lg text-stone-100 [overflow-wrap:anywhere]">
              {code}
            </span>
          )}
          <span className="block text-xs leading-5 text-stone-500">
            Codes are saved uppercase. Use 3–32 letters, numbers, hyphens, or
            underscores.
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
            Starts
          </span>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={startsAt}
            step={1}
            className={inputClassName}
          />
          <span className="block text-xs text-stone-500">
            Optional, Hong Kong time.
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
            Expires
          </span>
          <input
            type="datetime-local"
            name="expiresAt"
            defaultValue={expiresAt}
            step={1}
            className={inputClassName}
          />
          <span className="block text-xs text-stone-500">
            Optional, Hong Kong time.
          </span>
        </label>

        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={isActive}
            className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <span>
            <span className="block text-sm text-stone-200">Active</span>
            <span className="block text-xs leading-5 text-stone-500">
              Inactive coupons remain saved but cannot be applied to checkout.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xs uppercase tracking-[0.24em] text-stone-500">
              Product discounts
            </h2>
            <p className="text-sm leading-6 text-stone-400">
              Unassigned products remain full price.
            </p>
          </div>
          <p className="text-xs text-stone-500">
            {assignments.length}{" "}
            {assignments.length === 1 ? "product" : "products"} assigned
          </p>
        </div>

        {availableProducts.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1 space-y-2">
              <span className="sr-only">Active product to add</span>
              <select
                value={productToAdd}
                onChange={(event) => setProductToAdd(event.target.value)}
                disabled={isPending}
                className={inputClassName}
              >
                <option value="">Select an active product</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {formatPrice(product.price)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addProduct}
              disabled={!productToAdd || isPending}
              className={`${secondaryButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Add product
            </button>
          </div>
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-white/10 px-4 py-5 text-sm text-stone-500">
            No active products are available.
          </p>
        ) : (
          <p className="rounded-2xl border border-white/10 px-4 py-5 text-sm text-stone-500">
            Every active product is already assigned to this coupon.
          </p>
        )}

        {assignments.length > 0 ? (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.productId}
                className="grid min-w-0 gap-4 rounded-2xl border border-white/10 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
              >
                <input
                  type="hidden"
                  name="productId"
                  value={assignment.productId}
                />
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                    {assignment.productName}
                    {!assignment.isActive ? (
                      <span className="ml-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 align-middle text-[0.65rem] uppercase tracking-[0.12em] text-amber-200/90">
                        Inactive product
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-stone-500">
                    Current price {formatPrice(assignment.productPrice)}
                  </p>
                </div>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Discount %
                  </span>
                  <input
                    type="number"
                    name={`discount:${assignment.productId}`}
                    value={assignment.discountPercent}
                    onChange={(event) =>
                      setDiscountPercent(
                        assignment.productId,
                        event.target.value,
                      )
                    }
                    aria-label={`Discount percentage for ${assignment.productName}`}
                    min="0.01"
                    max="100"
                    step="0.01"
                    required
                    inputMode="decimal"
                    className={inputClassName}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeProduct(assignment.productId)}
                  disabled={isPending}
                  className={`${secondaryButtonClassName} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-label={`Remove ${assignment.productName} assignment`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-stone-500">
            No products assigned. This coupon will have no effect until a
            product is added.
          </p>
        )}
      </section>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200"
        >
          <span>{state.success}</span>
          {mode === "create" && state.couponId ? (
            <Link
              href={`/admin/coupons/${state.couponId}`}
              className="underline underline-offset-4 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/50"
            >
              Open coupon
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Saving..."
            : mode === "create"
              ? "Create coupon"
              : "Save changes"}
        </button>
        <Link href="/admin/coupons" className={secondaryButtonClassName}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
