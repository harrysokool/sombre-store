import { signOutAdmin } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

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
    <div className="min-h-screen px-4 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="mx-auto w-full max-w-6xl space-y-8 sm:space-y-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
              Sombre Admin
            </p>
            <AdminNav />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <span className="min-w-0 break-words text-xs text-stone-500 [overflow-wrap:anywhere]">
              {adminUser.email}
            </span>
            <form action={signOutAdmin}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
