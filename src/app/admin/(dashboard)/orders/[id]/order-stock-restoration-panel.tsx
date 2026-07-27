"use client";

import { useActionState } from "react";

import {
  restoreOrderItemStockAction,
  type StockRestorationActionState,
} from "@/app/admin/actions";

const initialState: StockRestorationActionState = {
  error: null,
  success: null,
};

export type RestorableOrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  purchasedQuantity: number;
  restoredQuantity: number;
  remainingQuantity: number;
  requestId: string;
};

export type StockRestorationHistoryEntry = {
  id: string;
  productName: string;
  productId: string;
  quantityRestored: number;
  reason: string;
  administratorIdentity: string;
  restoredAtLabel: string;
  isLegacy: boolean;
};

export type OrderStockRestorationPanelProps = {
  orderId: string;
  items: RestorableOrderItem[];
  history: StockRestorationHistoryEntry[];
  lockedReason: string | null;
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50";

function RestorationForm({
  orderId,
  item,
}: {
  orderId: string;
  item: RestorableOrderItem;
}) {
  const [state, formAction, isPending] = useActionState(
    restoreOrderItemStockAction,
    initialState,
  );
  const quantityId = `restore-quantity-${item.id}`;
  const reasonId = `restore-reason-${item.id}`;

  return (
    <form action={formAction} className="mt-5 space-y-4 border-t border-white/10 pt-5">
      <input type="hidden" name="requestId" value={item.requestId} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderItemId" value={item.id} />

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <label htmlFor={quantityId} className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
            Safe quantity
          </span>
          <input
            id={quantityId}
            type="number"
            name="quantity"
            min={1}
            max={item.remainingQuantity}
            step={1}
            defaultValue={item.remainingQuantity}
            required
            disabled={isPending}
            className={inputClassName}
          />
        </label>

        <label htmlFor={reasonId} className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
            Inspection reason
          </span>
          <textarea
            id={reasonId}
            name="reason"
            required
            maxLength={1000}
            rows={3}
            disabled={isPending}
            placeholder="Example: Two sealed units inspected; packaging intact and batch details verified."
            className={inputClassName}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-emerald-200 transition-colors hover:border-emerald-300/30 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Restoring…" : "Restore inspected stock"}
      </button>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs leading-6 text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs leading-6 text-emerald-300"
        >
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function OrderStockRestorationPanel({
  orderId,
  items,
  history,
  lockedReason,
}: OrderStockRestorationPanelProps) {
  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:px-6">
      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-[0.24em] text-stone-400">
          Sellable stock restoration
        </h3>
        <p className="max-w-3xl text-sm leading-6 text-stone-300">
          A refund does not return inventory automatically. Restore only units
          you have inspected and confirmed are unopened, intact, and safe to
          sell again.
        </p>
      </div>

      {lockedReason ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-6 text-amber-200/90"
        >
          {lockedReason}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 px-4 py-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <h4 className="break-words text-sm text-stone-100 [overflow-wrap:anywhere]">
                    {item.productName}
                  </h4>
                  <p className="mt-1 break-all font-mono text-[0.65rem] text-stone-500">
                    {item.productId ?? "Catalog product unavailable"}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-4 text-right text-xs">
                  <div>
                    <dt className="text-stone-400">Purchased</dt>
                    <dd className="mt-1 text-stone-200">
                      {item.purchasedQuantity}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400">Restored</dt>
                    <dd className="mt-1 text-stone-200">
                      {item.restoredQuantity}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400">Remaining</dt>
                    <dd className="mt-1 text-stone-200">
                      {item.remainingQuantity}
                    </dd>
                  </div>
                </dl>
              </div>

              {!item.productId ? (
                <p className="mt-4 text-xs leading-6 text-amber-200/90">
                  This historical item is no longer linked to a catalog product,
                  so its stock cannot be changed.
                </p>
              ) : item.remainingQuantity <= 0 ? (
                <p className="mt-4 text-xs leading-6 text-stone-400">
                  Every purchased unit on this line has already been restored.
                </p>
              ) : (
                <RestorationForm
                  key={item.requestId}
                  orderId={orderId}
                  item={item}
                />
              )}
            </article>
          ))}
        </div>
      )}

      <div className="space-y-3 border-t border-white/10 pt-6">
        <h4 className="text-xs uppercase tracking-[0.24em] text-stone-400">
          Restoration audit history
        </h4>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((entry) => (
              <article
                key={entry.id}
                className="grid gap-3 rounded-2xl border border-white/10 px-4 py-4 text-xs sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-stone-200 [overflow-wrap:anywhere]">
                    {entry.productName}: {entry.quantityRestored} unit(s)
                  </p>
                  <p className="break-words leading-5 text-stone-400 [overflow-wrap:anywhere]">
                    {entry.reason}
                  </p>
                  <p className="break-all font-mono text-[0.65rem] text-stone-500">
                    Product {entry.productId}
                  </p>
                </div>
                <div className="space-y-1 text-stone-400 sm:text-right">
                  <p>{entry.administratorIdentity}</p>
                  <p>{entry.restoredAtLabel}</p>
                  {entry.isLegacy ? <p>Legacy automatic record</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400">
            No sellable stock has been restored for this order.
          </p>
        )}
      </div>
    </section>
  );
}
