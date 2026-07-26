"use client";

import { useActionState, useState } from "react";

import {
  updateOrderFulfilment,
  type FulfilmentActionState,
} from "@/app/admin/actions";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  FULFILMENT_STATUSES,
  isFulfilmentTransitionAllowed,
  requiresCourierAndTracking,
  type FulfilmentStatus,
} from "@/lib/admin/fulfilment-rules";

const initialState: FulfilmentActionState = { error: null, success: null };

const FULFILMENT_LABELS: Record<FulfilmentStatus, string> = {
  unfulfilled: "Unfulfilled",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

// FULFILMENT_STATUSES is ordered by progress, so its index is the rank the
// transition rules compare.
function rankOf(status: FulfilmentStatus) {
  return FULFILMENT_STATUSES.indexOf(status);
}

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50";

const buttonClassName =
  "rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-transparent disabled:text-stone-600 disabled:hover:border-white/5 disabled:hover:bg-transparent";

const backButtonClassName =
  "rounded-full border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-stone-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-200 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-stone-600 disabled:hover:border-white/5 disabled:hover:bg-transparent";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
        {label}
      </p>
      <p className="break-words text-sm leading-6 text-stone-200 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

export type OrderFulfilmentPanelProps = {
  orderId: string;
  status: FulfilmentStatus;
  courier: string | null;
  trackingNumber: string | null;
  // Pre-formatted on the server: formatting dates here would render one
  // timezone during SSR and another in the browser.
  shippedAtLabel: string | null;
  deliveredAtLabel: string | null;
  updatedAtLabel: string | null;
  lockedReason: string | null;
};

/**
 * Fulfilment controls for one order. Writes nothing directly: every change goes
 * through updateOrderFulfilment -> setOrderFulfilment -> set_order_fulfilment,
 * which touches only fulfilment columns. Payment, refund, customer, product,
 * total and stock values are rendered read-only by the page around this panel
 * and are not editable from anywhere in the admin UI.
 */
export function OrderFulfilmentPanel({
  orderId,
  status,
  courier,
  trackingNumber,
  shippedAtLabel,
  deliveredAtLabel,
  updatedAtLabel,
  lockedReason,
}: OrderFulfilmentPanelProps) {
  const [state, formAction, isPending] = useActionState(
    updateOrderFulfilment,
    initialState,
  );
  const [courierInput, setCourierInput] = useState(courier ?? "");
  const [trackingInput, setTrackingInput] = useState(trackingNumber ?? "");

  // A reversal clears the stored courier and tracking number, so the fields
  // have to follow rather than keep offering values the order no longer has.
  // Syncing on change instead of on every render leaves anything typed between
  // updates intact.
  const storedDetails = `${courier ?? ""}\u0000${trackingNumber ?? ""}`;
  const [syncedDetails, setSyncedDetails] = useState(storedDetails);

  if (storedDetails !== syncedDetails) {
    setSyncedDetails(storedDetails);
    setCourierInput(courier ?? "");
    setTrackingInput(trackingNumber ?? "");
  }

  const isLocked = Boolean(lockedReason);
  const currentRank = rankOf(status);
  const hasTracking =
    courierInput.trim().length > 0 && trackingInput.trim().length > 0;

  const forwardTargets = FULFILMENT_STATUSES.filter(
    (target) => rankOf(target) > currentRank,
  );
  const backwardTargets = FULFILMENT_STATUSES.filter(
    (target) => rankOf(target) < currentRank,
  );

  // Every reason a target is unavailable, so a disabled button can say why
  // rather than just looking broken.
  function describeUnavailable(target: FulfilmentStatus) {
    if (lockedReason) {
      return lockedReason;
    }

    if (!isFulfilmentTransitionAllowed(status, target)) {
      const previousStep = FULFILMENT_STATUSES[rankOf(target) - 1];
      return `Mark this order ${FULFILMENT_LABELS[previousStep].toLowerCase()} first.`;
    }

    if (requiresCourierAndTracking(target) && !hasTracking) {
      return `Add a courier and tracking number before marking this order ${target}.`;
    }

    return null;
  }

  const nextStep = forwardTargets.find((target) =>
    isFulfilmentTransitionAllowed(status, target),
  );
  const trackingHint =
    !isLocked && nextStep && requiresCourierAndTracking(nextStep) && !hasTracking
      ? `A courier and tracking number are required before this order can be marked ${nextStep}.`
      : null;

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs uppercase tracking-[0.24em] text-stone-400">
          Fulfilment
        </h3>
        <StatusBadge
          kind="fulfilment"
          value={status}
          label={FULFILMENT_LABELS[status]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Courier" value={courier || "—"} />
        <Field label="Tracking number" value={trackingNumber || "—"} />
        <Field label="Shipped" value={shippedAtLabel ?? "—"} />
        <Field label="Delivered" value={deliveredAtLabel ?? "—"} />
      </div>

      {updatedAtLabel ? (
        <p className="text-xs text-stone-400">
          Fulfilment last updated {updatedAtLabel}.
        </p>
      ) : null}

      {lockedReason ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-6 text-amber-200/90"
        >
          {lockedReason}
        </p>
      ) : null}

      <form action={formAction} className="space-y-5 border-t border-white/10 pt-6">
        <input type="hidden" name="orderId" value={orderId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-stone-400">
              Courier
            </span>
            <input
              type="text"
              name="courier"
              value={courierInput}
              onChange={(event) => setCourierInput(event.target.value)}
              disabled={isLocked || isPending}
              maxLength={100}
              autoComplete="off"
              placeholder="SF Express"
              className={inputClassName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-stone-400">
              Tracking number
            </span>
            <input
              type="text"
              name="trackingNumber"
              value={trackingInput}
              onChange={(event) => setTrackingInput(event.target.value)}
              disabled={isLocked || isPending}
              maxLength={100}
              autoComplete="off"
              placeholder="SF1234567890"
              className={inputClassName}
            />
          </label>
        </div>

        {trackingHint ? (
          <p className="text-xs leading-6 text-stone-400">{trackingHint}</p>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
            Advance fulfilment
          </p>
          {forwardTargets.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {forwardTargets.map((target) => {
                const unavailableReason = describeUnavailable(target);

                return (
                  <button
                    key={target}
                    type="submit"
                    name="status"
                    value={target}
                    disabled={isPending || Boolean(unavailableReason)}
                    title={unavailableReason ?? undefined}
                    className={buttonClassName}
                  >
                    Mark as {target}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-stone-400">
              This order is delivered. Nothing left to advance.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-white/10 pt-5">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
            Correct a mistake
          </p>
          {backwardTargets.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {backwardTargets.map((target) => (
                <button
                  key={target}
                  type="submit"
                  name="status"
                  value={target}
                  disabled={isPending || isLocked}
                  title={lockedReason ?? undefined}
                  className={backButtonClassName}
                >
                  Move back to {target}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">
              This order is unfulfilled, so there is nothing to move back to.
            </p>
          )}
        </div>

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
    </section>
  );
}
