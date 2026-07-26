import type { Metadata } from "next";

import { AdminAccountPanel } from "@/components/admin/admin-account-panel";
import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { PRIVATE_ROBOTS } from "@/lib/seo/metadata";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

// Declared on the layout so every route in this group inherits it, including
// any added later that forgets its own metadata. These pages are already behind
// an auth gate; this is the belt-and-braces layer that stops a URL leaking into
// an index if one is ever shared or linked.
export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | Sombre Admin",
  },
  robots: PRIVATE_ROBOTS,
};

export const dynamic = "force-dynamic";

// Every route in this group is gated here. The admin data layers re-check
// independently, so private data cannot be read even if a future page forgets
// this layout.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = await requireAdminUser();

  return (
    <div className="min-h-screen overflow-x-clip lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside
        aria-label="Admin sidebar"
        className="sticky top-0 hidden h-dvh w-60 min-w-0 flex-col border-r border-white/10 bg-stone-950/70 px-4 py-6 lg:flex"
      >
        <div className="min-w-0 border-b border-white/10 px-3 pb-6">
          <p className="truncate font-display text-2xl font-normal tracking-[0.18em] text-stone-100">
            Sombre
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-stone-400">
            Admin
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-6">
          <AdminNav
            variant="desktop"
            ariaLabel="Admin primary navigation"
          />
        </div>

        <div className="shrink-0">
          <AdminAccountPanel email={adminUser.email} />
        </div>
      </aside>

      <div className="min-w-0">
        <AdminMobileNavigation email={adminUser.email} />

        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-12">
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
