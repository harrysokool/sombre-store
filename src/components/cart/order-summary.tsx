import type { ReactNode } from "react";

import { formatPrice } from "@/lib/storefront/format-price";

type OrderSummaryProps = {
  eyebrow: string;
  title: string;
  itemCount: number;
  subtotal: number;
  shippingFee?: number;
  total?: number;
  children: ReactNode;
  className: string;
  contentClassName?: string;
  lineItems?: ReactNode;
};

export function OrderSummary({
  eyebrow,
  title,
  itemCount,
  subtotal,
  shippingFee,
  total,
  children,
  className,
  contentClassName = "space-y-8",
  lineItems,
}: OrderSummaryProps) {
  return (
    <div className={className}>
      <div className={contentClassName}>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
            {eyebrow}
          </p>
          <h2 className="text-2xl font-medium text-stone-100">{title}</h2>
        </div>

        {lineItems}

        <div className="space-y-4 border-t border-white/10 pt-6">
          <div className="flex items-end justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.18em] text-stone-400">
              Items
            </p>
            <p className="text-base text-stone-300">{itemCount}</p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.18em] text-stone-400">
              {shippingFee === undefined ? "Subtotal" : "Product subtotal"}
            </p>
            <p className="text-2xl font-medium text-stone-100">
              {formatPrice(subtotal)}
            </p>
          </div>

          {shippingFee !== undefined ? (
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm uppercase tracking-[0.18em] text-stone-400">
                Shipping
              </p>
              <p className="text-base text-stone-300">
                {formatPrice(shippingFee)}
              </p>
            </div>
          ) : null}

          {total !== undefined ? (
            <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-4">
              <p className="text-sm uppercase tracking-[0.18em] text-stone-300">
                Total
              </p>
              <p className="text-2xl font-medium text-stone-100">
                {formatPrice(total)}
              </p>
            </div>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  );
}
