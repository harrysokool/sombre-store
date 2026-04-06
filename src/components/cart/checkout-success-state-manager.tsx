"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { reconcileCartWithCheckoutSession } from "@/lib/cart/cart";

type CheckoutSuccessStateManagerProps = {
  isOrderConfirmed: boolean;
  sessionId: string;
};

export function CheckoutSuccessStateManager({
  isOrderConfirmed,
  sessionId,
}: CheckoutSuccessStateManagerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (isOrderConfirmed) {
      reconcileCartWithCheckoutSession(sessionId);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [isOrderConfirmed, router, sessionId]);

  return null;
}
