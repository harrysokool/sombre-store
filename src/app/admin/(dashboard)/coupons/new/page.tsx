import Link from "next/link";

import { CouponForm } from "@/app/admin/coupons/coupon-form";
import {
  listAdminCouponProducts,
  type AdminCouponProduct,
} from "@/lib/admin/coupons";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

async function loadProducts() {
  try {
    return {
      products: await listAdminCouponProducts(),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load products for new coupon", error);
    return {
      products: [] as AdminCouponProduct[],
      hasError: true,
    };
  }
}

export default async function NewAdminCouponPage() {
  await requireAdminUser();

  const { products, hasError } = await loadProducts();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/admin/coupons"
          className="text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          &larr; All coupons
        </Link>
        <h1 className="text-3xl font-medium tracking-[0.08em] text-stone-100">
          New coupon
        </h1>
      </div>

      {hasError ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Active products could not be loaded. Please try again before creating
          a coupon.
        </p>
      ) : (
        <CouponForm mode="create" products={products} />
      )}
    </div>
  );
}
