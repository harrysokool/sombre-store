"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { reconcileCartWithCheckoutSession } from "@/lib/cart/cart";

type CheckoutSuccessStateManagerProps = {
  shouldCleanupCart: boolean;
  shouldRefresh: boolean;
  sessionId: string;
};

// A pending or refund-pending order used to refresh the page every three
// seconds forever. These bounds stop that: at most MAX_POLL_ATTEMPTS refreshes,
// spaced out by exponential backoff (3s, 6s, 12s, 24s, then capped at 30s) so
// requests to Stripe/Supabase become less frequent and then stop entirely.
const MAX_POLL_ATTEMPTS = 8;
const BASE_POLL_DELAY_MS = 3000;
const MAX_POLL_DELAY_MS = 30000;

function getPollDelayMs(attempt: number) {
  return Math.min(BASE_POLL_DELAY_MS * 2 ** attempt, MAX_POLL_DELAY_MS);
}

export function CheckoutSuccessStateManager({
  shouldCleanupCart,
  shouldRefresh,
  sessionId,
}: CheckoutSuccessStateManagerProps) {
  const router = useRouter();
  // A single tracked timer id: we always clear it before scheduling another and
  // on cleanup, so at most one refresh timer is ever pending.
  const timerRef = useRef<number | null>(null);
  // Survives router.refresh() (client state is preserved across it), which is
  // what makes the attempt cap actually bound the number of refreshes.
  const attemptsRef = useRef(0);
  const [hasReachedPollLimit, setHasReachedPollLimit] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Cart cleanup stays gated on the confirmed-order condition, exactly as
    // before, and never polls.
    if (shouldCleanupCart) {
      reconcileCartWithCheckoutSession(sessionId);
      return;
    }

    // A final (non-refreshing) order state: nothing to schedule.
    if (!shouldRefresh) {
      return;
    }

    // Budget exhausted: stop scheduling. The notice is driven by the callback
    // below, which flips the limit state when the last attempt is spent.
    if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
      return;
    }

    // Guarantee a single active timer before scheduling the next poll.
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const delay = getPollDelayMs(attemptsRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      attemptsRef.current += 1;
      // Once the final attempt is spent, surface the paused-updates notice.
      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
        setHasReachedPollLimit(true);
      }
      router.refresh();
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [router, sessionId, shouldCleanupCart, shouldRefresh]);

  // Only while the order is still in a refreshing state (and not being cleaned
  // up as confirmed) does the paused-updates notice make sense.
  if (hasReachedPollLimit && shouldRefresh && !shouldCleanupCart) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto mb-12 max-w-3xl border border-white/10 px-6 py-5 text-center sm:mb-16"
      >
        <p className="text-sm leading-7 text-stone-400">
          Automatic updates have paused. Your payment may still be processing,
          so you can refresh this page later to check for the latest status.
        </p>
      </div>
    );
  }

  return null;
}
