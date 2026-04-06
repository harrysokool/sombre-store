"use client";

import { useEffect } from "react";

import { clearCartItems } from "@/lib/cart/cart";

type CheckoutSuccessCartResetProps = {
  shouldClearCart: boolean;
};

export function CheckoutSuccessCartReset({
  shouldClearCart,
}: CheckoutSuccessCartResetProps) {
  useEffect(() => {
    if (!shouldClearCart) {
      return;
    }

    clearCartItems();
  }, [shouldClearCart]);

  return null;
}
