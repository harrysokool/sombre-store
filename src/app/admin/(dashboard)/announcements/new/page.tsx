import type { Metadata } from "next";

import { AnnouncementForm } from "@/app/admin/announcements/announcement-form";
import { AdminBackLink } from "@/components/admin/admin-back-link";
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
        <AdminBackLink href="/admin/announcements">
          All announcements
        </AdminBackLink>
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
          New announcement
        </h1>
      </div>

      <AnnouncementForm mode="create" />
    </div>
  );
}
