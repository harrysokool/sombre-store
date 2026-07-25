import Link from "next/link";

import {
  listAdminCoupons,
  type AdminCouponListItem,
} from "@/lib/admin/coupons";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

function formatCouponDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function loadCoupons() {
  try {
    return { coupons: await listAdminCoupons(), hasError: false };
  } catch (error) {
    console.error("Failed to load coupons for admin", error);
    return { coupons: [] as AdminCouponListItem[], hasError: true };
  }
}

export default async function AdminCouponsPage() {
  await requireAdminUser();

  const { coupons, hasError } = await loadCoupons();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-[0.08em] text-stone-100">
            Coupons
          </h1>
          <p className="text-sm leading-6 text-stone-400">
            Product-specific discounts for future checkouts.
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          New coupon
        </Link>
      </div>

      {hasError ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Coupons could not be loaded. Please try again.
        </p>
      ) : coupons.length === 0 ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-sm text-stone-400">No coupons yet.</p>
          <Link
            href="/admin/coupons/new"
            className="text-sm text-stone-200 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Create the first coupon
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-500">
                <th className="px-4 py-4 font-normal">Code</th>
                <th className="px-4 py-4 font-normal">Status</th>
                <th className="px-4 py-4 font-normal">Starts</th>
                <th className="px-4 py-4 font-normal">Expires</th>
                <th className="px-4 py-4 text-right font-normal">
                  Assigned products
                </th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr
                  key={coupon.id}
                  className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/coupons/${coupon.id}`}
                      className="font-mono text-stone-200 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      {coupon.code_normalized}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs ${
                        coupon.is_active
                          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                          : "border-white/10 bg-white/5 text-stone-400"
                      }`}
                    >
                      {coupon.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                    {formatCouponDate(coupon.starts_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-stone-400">
                    {formatCouponDate(coupon.expires_at)}
                  </td>
                  <td className="px-4 py-4 text-right text-stone-200">
                    {coupon.assigned_product_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
