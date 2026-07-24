import Image from "next/image";
import type { ReactNode } from "react";

import type { CartItem } from "@/lib/cart/cart";
import type { CouponPreviewResponse } from "@/lib/checkout/coupon-preview";
import { getCartLineTotal } from "@/lib/cart/math";
import { formatPrice } from "@/lib/storefront/format-price";

type CheckoutOrderSummaryProps = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  couponPreview: CouponPreviewResponse | null;
  /** The action area (submit button, messages, links) rendered by the page,
      which owns the submit state and the form linkage. */
  children: ReactNode;
};

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={`text-xs uppercase tracking-[0.2em] ${
          emphasis ? "text-stone-300" : "text-stone-500"
        }`}
      >
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "text-xl font-light text-stone-100"
            : "text-sm text-stone-300"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function CheckoutOrderSummary({
  items,
  itemCount,
  subtotal,
  shippingFee,
  total,
  couponPreview,
  children,
}: CheckoutOrderSummaryProps) {
  return (
    <div className="lg:sticky lg:top-28">
      <div className="space-y-8 border-t border-white/10 pt-8 lg:border-t-0 lg:pt-0">
        <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
          Summary
        </h2>

        <ul className="space-y-5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4">
              <div className="relative aspect-square w-16 shrink-0 overflow-hidden bg-white">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={`${item.name} fragrance bottle`}
                    fill
                    sizes="64px"
                    className="object-contain p-2"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[0.5rem] uppercase tracking-[0.2em] text-stone-500">
                    No image
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-display text-base font-normal leading-tight text-stone-100 [overflow-wrap:anywhere]">
                    {item.name}
                  </p>
                  {item.size_label ? (
                    <p className="break-words text-[0.6rem] uppercase tracking-[0.2em] text-stone-500 [overflow-wrap:anywhere]">
                      {item.size_label}
                    </p>
                  ) : null}
                  <p className="text-xs text-stone-500">Qty {item.quantity}</p>
                </div>

                <p className="shrink-0 text-sm text-stone-200">
                  {formatPrice(getCartLineTotal(item.price, item.quantity))}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-4 border-t border-white/10 pt-6">
          {couponPreview ? (
            <>
              <SummaryRow
                label={`Original subtotal · ${itemCount} ${
                  itemCount === 1 ? "item" : "items"
                }`}
                value={formatPrice(
                  couponPreview.originalSubtotalMinor / 100,
                )}
              />
              <SummaryRow
                label="Discount"
                value={`−${formatPrice(couponPreview.discountMinor / 100)}`}
              />
              <SummaryRow
                label="Discounted subtotal"
                value={formatPrice(
                  couponPreview.discountedSubtotalMinor / 100,
                )}
              />
              <SummaryRow
                label="Shipping"
                value={formatPrice(couponPreview.shippingMinor / 100)}
              />
            </>
          ) : (
            <>
              <SummaryRow
                label={`Subtotal · ${itemCount} ${
                  itemCount === 1 ? "item" : "items"
                }`}
                value={formatPrice(subtotal)}
              />
              <SummaryRow
                label="Shipping"
                value={formatPrice(shippingFee)}
              />
            </>
          )}
          <div className="border-t border-white/10 pt-4">
            <SummaryRow
              label="Total"
              value={formatPrice(
                couponPreview ? couponPreview.totalMinor / 100 : total,
              )}
              emphasis
            />
          </div>
        </dl>

        {children}
      </div>
    </div>
  );
}
