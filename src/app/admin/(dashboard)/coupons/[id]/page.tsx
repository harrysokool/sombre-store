import Link from "next/link";
import { notFound } from "next/navigation";

import { CouponForm } from "@/app/admin/coupons/coupon-form";
import {
  formatCouponDateTimeInput,
  getAdminCoupon,
  type AdminCouponEditorData,
} from "@/lib/admin/coupons";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

async function loadCoupon(couponId: string) {
  try {
    return {
      data: await getAdminCoupon(couponId),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load coupon for admin", error);
    return {
      data: null as AdminCouponEditorData | null,
      hasError: true,
    };
  }
}

export default async function EditAdminCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id } = await params;
  const { data, hasError } = await loadCoupon(id);

  if (hasError) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/coupons"
          className="text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          &larr; All coupons
        </Link>
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Coupon details could not be loaded. Please try again.
        </p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/admin/coupons"
          className="text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          &larr; All coupons
        </Link>
        <h1 className="break-words text-2xl font-medium tracking-[0.08em] text-stone-100 [overflow-wrap:anywhere] sm:text-3xl">
          {data.coupon.code_normalized}
        </h1>
        <p className="text-sm leading-6 text-stone-400">
          Changes apply only to future checkout calculations. Saved orders are
          not modified.
        </p>
      </div>

      <CouponForm
        mode="edit"
        couponId={data.coupon.id}
        code={data.coupon.code_normalized}
        isActive={data.coupon.is_active}
        startsAt={formatCouponDateTimeInput(data.coupon.starts_at)}
        expiresAt={formatCouponDateTimeInput(data.coupon.expires_at)}
        products={data.products}
        initialAssignments={data.assignments}
      />
    </div>
  );
}
