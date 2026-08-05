import "server-only";

import { unstable_cache } from "next/cache";

import {
  assertCouponIsAvailable,
  isCouponPreviewError,
  type CouponConfiguration,
} from "@/lib/checkout/coupon-quote";
import { parsePercentageToBasisPoints } from "@/lib/checkout/money";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import {
  PROMOTION_CACHE_TAG,
  PROMOTION_CACHE_TTL_SECONDS,
  PROMOTION_COUPON_CODE,
} from "./promotion";

// The storefront's read of the featured promotion.
//
// discount_codes and discount_code_products have RLS enabled with every
// privilege revoked from anon and authenticated, so the service-role client is
// the only one that can read them at all. That makes this module server-only in
// the strict sense: the key it uses bypasses RLS, and it must never be reachable
// from a client bundle.
//
// Only two fields ever leave here — a product id and its configured basis
// points. No coupon row, date window, or unrelated assignment is exposed, so
// nothing about coupons the customer has not been shown can leak into a page.

const PROMOTION_CACHE_KEY = ["storefront-promotion-discounts"];

type PromotionCouponRow = {
  id: string;
  code_normalized: string;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  discount_code_products: {
    product_id: string;
    discount_percent: string | number;
  }[] | null;
};

/**
 * The cached payload: the coupon's raw configuration plus every product
 * assignment, keyed by product id.
 *
 * The date window is stored, not resolved. Whether the promotion is live right
 * now is decided per call in `loadPromotionDiscounts`, so a cached entry can
 * never keep a promotion open past its expiry or start one early — the TTL
 * covers only admin edits, which are tag-invalidated anyway.
 */
type PromotionSnapshot = {
  coupon: CouponConfiguration | null;
  discountBasisPointsByProductId: Record<string, number>;
};

/**
 * Deliberately throws on a database error rather than returning an empty
 * snapshot. An empty result is a legitimate state that is safe to cache; a
 * failed query is not, and swallowing it here would cache a transient outage as
 * "no promotion" for the whole TTL. The caller catches instead.
 *
 * A coupon that does not exist is a real state and fine to cache.
 */
async function readPromotionSnapshot(): Promise<PromotionSnapshot> {
  const supabase = createSupabaseServiceRoleClient();

  // One round trip for the coupon and all of its assignments. The embed is what
  // keeps this independent of how many products a page renders: the request
  // count is fixed at one whether the caller asks about a single product or the
  // entire catalog.
  const { data, error } = await supabase
    .from("discount_codes")
    .select(
      `
        id,
        code_normalized,
        is_active,
        starts_at,
        expires_at,
        discount_code_products (
          product_id,
          discount_percent
        )
      `,
    )
    .eq("code_normalized", PROMOTION_COUPON_CODE)
    .maybeSingle<PromotionCouponRow>();

  if (error) {
    throw new Error("The storefront promotion could not be read.");
  }

  if (!data) {
    return { coupon: null, discountBasisPointsByProductId: {} };
  }

  const discountBasisPointsByProductId: Record<string, number> = {};

  for (const assignment of data.discount_code_products ?? []) {
    // The same parser checkout uses, so an assignment this rejects is one
    // checkout would reject too. A malformed row fails the whole read rather
    // than being silently dropped, which would understate a discount on a page
    // while checkout still honoured it.
    discountBasisPointsByProductId[assignment.product_id] =
      parsePercentageToBasisPoints(String(assignment.discount_percent));
  }

  return {
    coupon: {
      codeNormalized: data.code_normalized,
      isActive: data.is_active,
      startsAt: data.starts_at,
      expiresAt: data.expires_at,
    },
    discountBasisPointsByProductId,
  };
}

/**
 * The cached read every storefront page shares.
 *
 * Caching under one fixed key, rather than per product id, is what keeps this
 * cheap: every page shares a single entry instead of fragmenting the cache by
 * whichever products happened to be on screen. It also touches no cookies,
 * headers, or session state, so it introduces no dynamic dependency of its own.
 */
const getPromotionSnapshot = unstable_cache(
  readPromotionSnapshot,
  PROMOTION_CACHE_KEY,
  {
    tags: [PROMOTION_CACHE_TAG],
    revalidate: PROMOTION_CACHE_TTL_SECONDS,
  },
);

/**
 * The configured discount, in basis points, for each of `productIds` that is
 * eligible right now.
 *
 * A product is present in the result only when the coupon exists, is active,
 * is inside its start and expiry window, and has an assignment for that
 * product. Everything else is absent rather than zero, so a caller cannot
 * mistake "no promotion" for "a promotion of nothing".
 *
 * Fails closed: if the promotion cannot be read, the result is empty and no
 * discount is shown. Showing nothing understates an offer, which is recoverable
 * on the next load; showing a discount that checkout would refuse is not.
 */
export async function loadPromotionDiscounts(
  productIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const discounts = new Map<string, number>();

  if (productIds.length === 0) {
    return discounts;
  }

  let snapshot: PromotionSnapshot;

  try {
    snapshot = await getPromotionSnapshot();
  } catch (error) {
    console.error("Failed to load the storefront promotion:", error);
    return discounts;
  }

  try {
    // The same availability rules checkout enforces — existence, the active
    // flag, an inclusive start and an exclusive expiry — evaluated against the
    // current instant rather than a cached verdict. Reusing the checkout
    // function is what keeps the two from drifting apart.
    assertCouponIsAvailable(snapshot.coupon, PROMOTION_COUPON_CODE, now);
  } catch (error) {
    if (isCouponPreviewError(error)) {
      return discounts;
    }

    throw error;
  }

  for (const productId of productIds) {
    const discountBasisPoints =
      snapshot.discountBasisPointsByProductId[productId];

    if (discountBasisPoints !== undefined) {
      discounts.set(productId, discountBasisPoints);
    }
  }

  return discounts;
}
