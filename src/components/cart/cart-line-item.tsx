import Image from "next/image";
import Link from "next/link";

import { getCartItemQuantityLimit, type CartItem } from "@/lib/cart/cart";
import { getCartLineTotal } from "@/lib/cart/math";
import { formatPrice } from "@/lib/storefront/format-price";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

type CartLineItemProps = {
  item: CartItem;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

// The item's stock snapshot, captured when it was added, is the same value the
// quantity cap already relies on. These notes only surface what that snapshot
// says — live stock is re-validated server-side at checkout.
function getAvailabilityNote(item: CartItem, quantityLimit: number) {
  const stock = item.stock_quantity;

  if (typeof stock === "number" && stock <= 0) {
    return "Currently unavailable";
  }

  if (typeof stock === "number" && item.quantity > stock) {
    return `Only ${stock} available`;
  }

  if (item.quantity >= quantityLimit) {
    return "Maximum available quantity";
  }

  return null;
}

export function CartLineItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartLineItemProps) {
  const quantityLimit = getCartItemQuantityLimit(item);
  const isAtLimit = item.quantity >= quantityLimit;
  const availabilityNote = getAvailabilityNote(item, quantityLimit);

  return (
    <article className="grid grid-cols-[5.5rem_1fr] gap-5 border-b border-white/10 py-8 first:pt-0 sm:grid-cols-[8rem_1fr] sm:gap-8">
      <Link
        href={`/products/${item.slug}`}
        className={`relative aspect-square w-full overflow-hidden bg-white ${focusRing}`}
      >
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={`${item.name} fragrance bottle`}
            fill
            sizes="(min-width: 640px) 128px, 88px"
            className="object-contain p-3 sm:p-4"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[0.55rem] uppercase tracking-[0.2em] text-stone-500">
            No image
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Link
              href={`/products/${item.slug}`}
              className={`font-display text-xl font-normal leading-tight text-stone-100 transition-colors hover:text-white sm:text-2xl ${focusRing}`}
            >
              {item.name}
            </Link>
            {item.size_label ? (
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-stone-500">
                {item.size_label}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.name} from cart`}
            className={`shrink-0 text-[0.65rem] uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-200 ${focusRing}`}
          >
            Remove
          </button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onDecrement(item.id)}
                aria-label={`Decrease quantity for ${item.name}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-stone-200 transition-colors hover:border-white/25 hover:text-stone-100 ${focusRing}`}
              >
                &minus;
              </button>
              <span
                aria-live="polite"
                className="min-w-8 text-center text-base tabular-nums text-stone-100"
              >
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onIncrement(item.id)}
                disabled={isAtLimit}
                aria-label={`Increase quantity for ${item.name}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-lg text-stone-200 transition-colors hover:border-white/25 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
              >
                +
              </button>
            </div>
            {availabilityNote ? (
              <p className="text-[0.7rem] text-stone-500">{availabilityNote}</p>
            ) : null}
          </div>

          <div className="text-right">
            <p className="text-base font-light text-stone-100">
              {formatPrice(getCartLineTotal(item.price, item.quantity))}
            </p>
            {item.quantity > 1 ? (
              <p className="mt-1 text-[0.7rem] text-stone-500">
                {formatPrice(item.price)} each
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
