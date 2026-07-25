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
  const [assignmentPercentages, setAssignmentPercentages] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialAssignments.map((assignment) => [
        assignment.product_id,
        String(assignment.discount_percent),
      ]),
    ),
  );
  const [productToAdd, setProductToAdd] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const selectedProducts = Object.keys(assignmentPercentages)
    .map((productId) => productMap.get(productId))
    .filter((product): product is AdminCouponProduct => Boolean(product));
  const availableProducts = products.filter(
    (product) => !(product.id in assignmentPercentages),
  );

  function addProduct() {
    if (!productToAdd || productToAdd in assignmentPercentages) {
      return;
    }

    setAssignmentPercentages((current) => ({
      ...current,
      [productToAdd]: "10.00",
    }));
    setProductToAdd("");
  }

  function removeProduct(productId: string) {
    setAssignmentPercentages((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
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
            {selectedProducts.length}{" "}
            {selectedProducts.length === 1 ? "product" : "products"} assigned
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
        ) : null}

        {selectedProducts.length > 0 ? (
          <div className="space-y-3">
            {selectedProducts.map((product) => (
              <div
                key={product.id}
                className="grid min-w-0 gap-4 rounded-2xl border border-white/10 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
              >
                <input type="hidden" name="productId" value={product.id} />
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                    {product.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    Current price {formatPrice(product.price)}
                  </p>
                </div>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Discount %
                  </span>
                  <input
                    type="number"
                    name={`discount:${product.id}`}
                    value={assignmentPercentages[product.id]}
                    onChange={(event) =>
                      setAssignmentPercentages((current) => ({
                        ...current,
                        [product.id]: event.target.value,
                      }))
                    }
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
                  onClick={() => removeProduct(product.id)}
                  disabled={isPending}
                  className={`${secondaryButtonClassName} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-label={`Remove ${product.name} assignment`}
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
