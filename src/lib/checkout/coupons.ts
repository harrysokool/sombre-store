import "server-only";

import { SHIPPING_FEE_HKD_CENTS } from "@/lib/checkout/shipping";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import {
  getCartItemReferenceError,
  hasDuplicateCartProductIds,
  MAX_CART_LINE_ITEMS,
  type CheckoutCartReference,
} from "./cart-validation";
import {
  assertCouponIsAvailable,
  buildCouponPreviewQuote,
  CouponPreviewError,
  normalizeCouponCode,
  type BuiltCouponPreview,
  type CouponConfiguration,
  type CouponProduct,
  type CouponProductAssignment,
} from "./coupon-quote";

type DiscountCodeRow = {
  id: string;
  code_normalized: string;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
};

type DiscountCodeProductRow = {
  product_id: string;
  discount_percent: string | number;
};

type ProductRow = {
  id: string;
  slug: string;
  price: string | number;
  is_active: boolean;
  stock_quantity: number;
};

function toCouponConfiguration(row: DiscountCodeRow): CouponConfiguration {
  return {
    codeNormalized: row.code_normalized,
    isActive: row.is_active,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
  };
}

function toCouponAssignment(
  row: DiscountCodeProductRow,
): CouponProductAssignment {
  return {
    productId: row.product_id,
    discountPercent: row.discount_percent,
  };
}

function toCouponProduct(row: ProductRow): CouponProduct {
  return {
    id: row.id,
    slug: row.slug,
    price: row.price,
    isActive: row.is_active,
    stockQuantity: row.stock_quantity,
  };
}

export async function loadCouponPreview({
  code,
  cartItems,
  now = new Date(),
}: {
  code: unknown;
  cartItems: readonly CheckoutCartReference[];
  now?: Date;
}): Promise<BuiltCouponPreview> {
  const normalizedCode = normalizeCouponCode(code);

  if (
    cartItems.length === 0 ||
    cartItems.length > MAX_CART_LINE_ITEMS ||
    cartItems.some((item) => getCartItemReferenceError(item) !== null) ||
    hasDuplicateCartProductIds(cartItems)
  ) {
    throw new CouponPreviewError("cart_changed");
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: couponRow, error: couponError } = await supabase
    .from("discount_codes")
    .select("id, code_normalized, is_active, starts_at, expires_at")
    .eq("code_normalized", normalizedCode)
    .maybeSingle<DiscountCodeRow>();

  if (couponError) {
    throw new CouponPreviewError("unavailable");
  }

  const coupon = couponRow ? toCouponConfiguration(couponRow) : null;
  assertCouponIsAvailable(coupon, normalizedCode, now);

  const productIds = cartItems.map((item) => item.id);
  const [assignmentsResult, productsResult] = await Promise.all([
    supabase
      .from("discount_code_products")
      .select("product_id, discount_percent")
      .eq("discount_code_id", couponRow!.id)
      .in("product_id", productIds)
      .returns<DiscountCodeProductRow[]>(),
    supabase
      .from("products")
      .select("id, slug, price, is_active, stock_quantity")
      .in("id", productIds)
      .returns<ProductRow[]>(),
  ]);

  if (assignmentsResult.error || productsResult.error) {
    throw new CouponPreviewError("unavailable");
  }

  return buildCouponPreviewQuote({
    code: normalizedCode,
    coupon,
    assignments: (assignmentsResult.data ?? []).map(toCouponAssignment),
    products: (productsResult.data ?? []).map(toCouponProduct),
    cartItems,
    shippingCents: SHIPPING_FEE_HKD_CENTS,
    now,
  });
}
