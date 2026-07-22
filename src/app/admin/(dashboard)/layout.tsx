import Link from "next/link";

import { signOutAdmin } from "@/app/admin/actions";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

// Every route in this group is gated here. The data layer in
// src/lib/admin/orders.ts re-checks independently, so no order data can be read
// even if a future page forgets this layout.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = await requireAdminUser();

  return (
    <div className="px-6 py-16 sm:px-10 sm:py-20 lg:px-12">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Sombre Admin
            </p>
            <Link
              href="/admin"
              className="text-3xl font-medium tracking-[0.14em] text-stone-100 transition-colors hover:text-white"
            >
              Orders
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-stone-500">{adminUser.email}</span>
            <form action={signOutAdmin}>
              <button
                type="submit"
                className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
