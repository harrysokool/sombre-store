import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementForm } from "@/app/admin/announcements/announcement-form";
import {
  getAdminAnnouncement,
  type AdminAnnouncement,
} from "@/lib/admin/announcements";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Edit announcement",
};

export const dynamic = "force-dynamic";

async function loadAnnouncement(announcementId: string) {
  try {
    return {
      announcement: await getAdminAnnouncement(announcementId),
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load announcement for admin", error);
    return {
      announcement: null as AdminAnnouncement | null,
      hasError: true,
    };
  }
}

export default async function EditAdminAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id } = await params;
  const { announcement, hasError } = await loadAnnouncement(id);

  if (hasError) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/announcements"
          className="text-xs uppercase tracking-[0.22em] text-stone-400 transition-colors hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          &larr; All announcements
        </Link>
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Announcement details could not be loaded. Please try again.
        </p>
      </div>
    );
  }

  // An unknown or deleted id gets the ordinary admin 404. Nothing is created
  // to stand in for the missing announcement.
  if (!announcement) {
    notFound();
  }

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
          Edit announcement
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-stone-400">
          Saving keeps this announcement in its current position.
        </p>
      </div>

      <AnnouncementForm
        mode="edit"
        announcementId={announcement.id}
        prefixText={announcement.prefix_text ?? ""}
        highlightText={announcement.highlight_text ?? ""}
        suffixText={announcement.suffix_text ?? ""}
        linkLabel={announcement.link_label ?? ""}
        linkHref={announcement.link_href ?? ""}
        isActive={announcement.is_active}
      />
    </div>
  );
}
