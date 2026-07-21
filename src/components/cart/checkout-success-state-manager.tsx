"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { reconcileCartWithCheckoutSession } from "@/lib/cart/cart";

type CheckoutSuccessStateManagerProps = {
  isPaymentConfirmed: boolean;
  sessionId: string;
};

export function CheckoutSuccessStateManager({
  isPaymentConfirmed,
  sessionId,
}: CheckoutSuccessStateManagerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (isPaymentConfirmed) {
      reconcileCartWithCheckoutSession(sessionId);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [isPaymentConfirmed, router, sessionId]);

  return null;
}
