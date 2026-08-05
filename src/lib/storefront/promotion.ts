// The featured storefront promotion: the single source of truth for its coupon
// code, plus the cache tag and TTL its storefront read uses.
//
// Kept in its own module, free of server-only and Supabase imports, so an admin
// Server Action can name the tag — and a client component can name the code —
// without pulling the storefront's cached read into its import graph.
//
// The code is a display and lookup key only. It confers no discount by itself:
// the percentage for each product lives in discount_code_products, and checkout
// revalidates the coupon server-side before Stripe is ever called.

export const PROMOTION_COUPON_CODE = "HAPPY2026";

export const PROMOTION_CACHE_TAG = "storefront-promotion";

// Admin coupon mutations expire the tag immediately, so this is only a backstop
// for an invalidation that never arrived: a missed update self-heals within five
// minutes instead of persisting until the next deploy.
//
// The coupon's own start and expiry instants are deliberately not covered by
// this TTL. They are evaluated fresh on every call, so the cache can never hold
// a promotion open past its expiry.
export const PROMOTION_CACHE_TTL_SECONDS = 300;
