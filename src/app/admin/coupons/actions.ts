"use server";

import { revalidatePath, updateTag } from "next/cache";

import {
  createAdminCoupon,
  updateAdminCoupon,
  type AdminCouponAssignmentInput,
  type AdminCouponMutationResult,
  type AdminCouponSubmission,
} from "@/lib/admin/coupons";
import { PROMOTION_CACHE_TAG } from "@/lib/storefront/promotion";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export type CouponActionState = {
  error: string | null;
  success: string | null;
  couponId: string | null;
};

function readCouponSubmission(formData: FormData): AdminCouponSubmission {
  const assignments: AdminCouponAssignmentInput[] = formData
    .getAll("productId")
    .map((productId) => ({
      productId,
      discountPercent:
        typeof productId === "string"
          ? formData.get(`discount:${productId}`)
          : null,
    }));

  return {
    code: formData.get("code"),
    isActive: formData.get("isActive") === "on",
    startsAt: formData.get("startsAt"),
    expiresAt: formData.get("expiresAt"),
    assignments,
  };
}

function mutationState(
  result: AdminCouponMutationResult,
  success: string,
): CouponActionState {
  if (!result.ok) {
    return { error: result.error, success: null, couponId: null };
  }

  return {
    error: null,
    success,
    couponId: result.couponId,
  };
}

async function hasAdminSession() {
  return Boolean(await getAdminUser());
}

// Called only after a confirmed write. updateTag expires the storefront's
// cached promotion immediately; revalidatePath keeps the admin views fresh.
// A validation, authorization, or database failure must not reach here — the
// storefront is still correct, so discarding its cache would be wasted work.
//
// Every successful coupon mutation expires the tag, not only one that names the
// featured code. A coupon's code is itself editable, so an edit can move the
// featured code onto or off any coupon, and matching on the code here would
// miss exactly those changes.
function refreshCouponViews(couponId?: string) {
  revalidatePath("/admin/coupons");

  if (couponId) {
    revalidatePath(`/admin/coupons/${couponId}`);
  }

  updateTag(PROMOTION_CACHE_TAG);
}

export async function createCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  if (!(await hasAdminSession())) {
    return {
      error: "Your admin session has ended. Sign in again to create a coupon.",
      success: null,
      couponId: null,
    };
  }

  try {
    const result = await createAdminCoupon(readCouponSubmission(formData));

    if (result.ok) {
      refreshCouponViews();
    }

    return mutationState(result, "Coupon created.");
  } catch (error) {
    console.error("Admin coupon creation failed", error);
    return {
      error: "Coupon could not be created. Try again.",
      success: null,
      couponId: null,
    };
  }
}

export async function updateCouponAction(
  _previousState: CouponActionState,
  formData: FormData,
): Promise<CouponActionState> {
  if (!(await hasAdminSession())) {
    return {
      error: "Your admin session has ended. Sign in again to update coupons.",
      success: null,
      couponId: null,
    };
  }

  const couponId = formData.get("couponId");

  if (typeof couponId !== "string") {
    return {
      error: "That coupon reference is not valid.",
      success: null,
      couponId: null,
    };
  }

  try {
    const result = await updateAdminCoupon(
      couponId.trim(),
      readCouponSubmission(formData),
    );

    if (result.ok) {
      refreshCouponViews(result.couponId);
    }

    return mutationState(result, "Coupon updated.");
  } catch (error) {
    console.error("Admin coupon update failed", error);
    return {
      error: "Coupon could not be updated. Try again.",
      success: null,
      couponId: null,
    };
  }
}
