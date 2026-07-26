import type { Metadata } from "next";

import { AdminDesktopSidebar } from "@/components/admin/admin-desktop-sidebar";
import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";
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
    <div className="min-h-screen overflow-x-clip lg:flex">
      <AdminDesktopSidebar email={adminUser.email} />

      <div className="min-w-0 lg:flex-1">
        <AdminMobileNavigation email={adminUser.email} />

        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-12">
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
