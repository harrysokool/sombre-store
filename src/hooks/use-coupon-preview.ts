"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CartItem } from "@/lib/cart/cart";
import {
  clearStoredCouponCode,
  CouponClientError,
  getCouponCartFingerprint,
  readStoredCouponCode,
  requestCouponPreview,
  storeCouponCode,
} from "@/lib/checkout/coupon-client";
import type { CouponPreviewResponse } from "@/lib/checkout/coupon-preview";

const CART_CHANGED_MESSAGE =
  "Your cart changed. Apply your coupon again.";

type AppliedCoupon = {
  preview: CouponPreviewResponse;
  cartFingerprint: string;
};

export function useCouponPreview(cartItems: CartItem[] | null) {
  const requestIdRef = useRef(0);
  const previousCartFingerprintRef = useRef<string | undefined>(
    undefined,
  );
  const cartItemsRef = useRef(cartItems);
  const cartFingerprint =
    cartItems === null ? null : getCouponCartFingerprint(cartItems);
  const cartFingerprintRef = useRef(cartFingerprint);
  const appliedCouponRef = useRef<AppliedCoupon | null>(null);
  const loadingRef = useRef(false);
  const [appliedCoupon, setAppliedCoupon] =
    useState<AppliedCoupon | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  cartItemsRef.current = cartItems;
  cartFingerprintRef.current = cartFingerprint;
  appliedCouponRef.current = appliedCoupon;
  loadingRef.current = isLoading;

  const applyCoupon = useCallback(async (
    code: string,
    preserveStoredCode = false,
  ) => {
    const submittedCode = code.trim();
    const currentItems = cartItemsRef.current;
    const requestedCartFingerprint = cartFingerprintRef.current;

    if (
      !submittedCode ||
      !currentItems ||
      currentItems.length === 0 ||
      requestedCartFingerprint === null ||
      loadingRef.current
    ) {
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setErrorMessage(null);
    setAppliedCoupon(null);

    if (!preserveStoredCode) {
      clearStoredCouponCode();
    }

    try {
      const preview = await requestCouponPreview(
        submittedCode,
        currentItems,
      );

      if (
        requestIdRef.current !== requestId ||
        cartFingerprintRef.current !== requestedCartFingerprint
      ) {
        return null;
      }

      setAppliedCoupon({
        preview,
        cartFingerprint: requestedCartFingerprint,
      });
      storeCouponCode(preview.couponCode);

      return preview;
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return null;
      }

      clearStoredCouponCode();
      setErrorMessage(
        error instanceof CouponClientError
          ? error.message
          : "Could not apply this coupon.",
      );

      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, []);

  const removeCoupon = useCallback(() => {
    requestIdRef.current += 1;
    clearStoredCouponCode();
    setAppliedCoupon(null);
    setErrorMessage(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (cartFingerprint === null || cartItems === null) {
      return;
    }

    const previousFingerprint = previousCartFingerprintRef.current;
    previousCartFingerprintRef.current = cartFingerprint;

    if (previousFingerprint === undefined) {
      const storedCode = readStoredCouponCode();

      if (storedCode && cartItems.length > 0) {
        void applyCoupon(storedCode, true);
      } else if (storedCode) {
        clearStoredCouponCode();
      }

      setHasCheckedStorage(true);
      return;
    }

    if (previousFingerprint === cartFingerprint) {
      return;
    }

    const couponWasActive =
      appliedCouponRef.current !== null ||
      loadingRef.current ||
      readStoredCouponCode() !== null;

    requestIdRef.current += 1;
    clearStoredCouponCode();
    setAppliedCoupon(null);
    setIsLoading(false);

    if (couponWasActive) {
      setErrorMessage(CART_CHANGED_MESSAGE);
    }
  }, [applyCoupon, cartFingerprint, cartItems]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [],
  );

  const preview =
    appliedCoupon &&
    appliedCoupon.cartFingerprint === cartFingerprint
      ? appliedCoupon.preview
      : null;

  return {
    preview,
    isLoading,
    isReady: hasCheckedStorage,
    errorMessage,
    applyCoupon,
    removeCoupon,
  };
}
