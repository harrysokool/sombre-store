import type { FormEvent } from "react";

import type { CouponPreviewResponse } from "@/lib/checkout/coupon-preview";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

type CartCouponFormProps = {
  code: string;
  onCodeChange: (code: string) => void;
  onApply: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: () => void;
  isLoading: boolean;
  appliedCoupon: CouponPreviewResponse | null;
  errorMessage: string | null;
};

export function CartCouponForm({
  code,
  onCodeChange,
  onApply,
  onRemove,
  isLoading,
  appliedCoupon,
  errorMessage,
}: CartCouponFormProps) {
  const messageId = errorMessage
    ? "cart-coupon-error"
    : appliedCoupon
      ? "cart-coupon-success"
      : undefined;

  return (
    <section
      aria-labelledby="cart-coupon-heading"
      className="space-y-4 border-t border-white/10 pt-6"
    >
      <div className="space-y-1">
        <h3
          id="cart-coupon-heading"
          className="text-xs uppercase tracking-[0.2em] text-stone-300"
        >
          Coupon
        </h3>
        <p className="text-xs leading-6 text-stone-500">
          Enter one code. Applying another replaces the current coupon.
        </p>
      </div>

      <form
        onSubmit={onApply}
        aria-busy={isLoading}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Coupon code</span>
          <input
            id="cart-coupon-code"
            name="couponCode"
            type="text"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={messageId}
            aria-invalid={errorMessage ? true : undefined}
            placeholder="Coupon code"
            className="w-full rounded-lg border border-white/15 bg-transparent px-4 py-3.5 text-sm uppercase text-stone-100 outline-none transition-colors placeholder:normal-case placeholder:text-stone-600 hover:border-white/25 focus-visible:border-white/40 focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950"
          />
        </label>

        <button
          type="submit"
          disabled={isLoading || code.trim().length === 0}
          className={`rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.22em] text-stone-200 transition-colors hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-600 sm:shrink-0 ${focusRing}`}
        >
          {isLoading ? "Applying…" : "Apply"}
        </button>
      </form>

      {isLoading ? (
        <p
          role="status"
          aria-live="polite"
          className="text-xs leading-6 text-stone-400"
        >
          Checking this coupon&hellip;
        </p>
      ) : null}

      {appliedCoupon ? (
        <div
          id="cart-coupon-success"
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs leading-6 text-emerald-200">
            <span className="font-medium">{appliedCoupon.couponCode}</span>{" "}
            applied.
          </p>
          <button
            type="button"
            onClick={onRemove}
            className={`self-start text-xs uppercase tracking-[0.2em] text-stone-300 underline decoration-stone-600 underline-offset-4 transition-colors hover:text-white sm:self-auto ${focusRing}`}
            aria-label={`Remove ${appliedCoupon.couponCode} coupon`}
          >
            Remove
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          id="cart-coupon-error"
          role="alert"
          className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs leading-6 text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
