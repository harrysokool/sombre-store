"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { reconcileCartWithCheckoutSession } from "@/lib/cart/cart";

type CheckoutSuccessStateManagerProps = {
  shouldCleanupCart: boolean;
  shouldRefresh: boolean;
  sessionId: string;
};

export function CheckoutSuccessStateManager({
  shouldCleanupCart,
  shouldRefresh,
  sessionId,
}: CheckoutSuccessStateManagerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (shouldCleanupCart) {
      reconcileCartWithCheckoutSession(sessionId);
      return;
    }

    if (!shouldRefresh) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [router, sessionId, shouldCleanupCart, shouldRefresh]);

  return null;
}
