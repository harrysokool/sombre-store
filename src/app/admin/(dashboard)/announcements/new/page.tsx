import type { Metadata } from "next";
import Link from "next/link";

import { AnnouncementForm } from "@/app/admin/announcements/announcement-form";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "New announcement",
};

export const dynamic = "force-dynamic";

export default async function NewAdminAnnouncementPage() {
  await requireAdminUser();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/admin/announcements"
          className="text-xs uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          &larr; All announcements
        </Link>
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
          New announcement
        </h1>
      </div>

      <AnnouncementForm mode="create" />
    </div>
  );
}
