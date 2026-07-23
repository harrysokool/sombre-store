import Link from "next/link";

import { formatPrice } from "@/lib/storefront/format-price";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

type CartOrderSummaryProps = {
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
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

export function CartOrderSummary({
  itemCount,
  subtotal,
  shippingFee,
  total,
}: CartOrderSummaryProps) {
  return (
    <div className="lg:sticky lg:top-28">
      <div className="space-y-8 border-t border-white/10 pt-8 lg:border-t-0 lg:pt-0">
        <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
          Summary
        </h2>

        <dl className="space-y-4">
          <SummaryRow
            label={`Subtotal · ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            value={formatPrice(subtotal)}
          />
          <SummaryRow label="Shipping" value={formatPrice(shippingFee)} />
          <div className="border-t border-white/10 pt-4">
            <SummaryRow label="Total" value={formatPrice(total)} emphasis />
          </div>
        </dl>

        <div className="space-y-4">
          <Link
            href="/checkout"
            className={`flex w-full items-center justify-center rounded-full bg-stone-100 px-6 py-4 text-xs uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-white ${focusRing}`}
          >
            Checkout
          </Link>

          <Link
            href="/shop"
            className={`flex w-full items-center justify-center py-1 text-xs uppercase tracking-[0.24em] text-stone-400 transition-colors hover:text-stone-100 ${focusRing}`}
          >
            Continue Shopping
          </Link>
        </div>

        <p className="text-center text-[0.7rem] leading-6 text-stone-500">
          Payment is completed securely through Stripe. Your card details are
          never stored by Sombre.
        </p>
      </div>
    </div>
  );
}
