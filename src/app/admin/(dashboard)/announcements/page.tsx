import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AnnouncementRowControls } from "@/app/admin/announcements/announcement-row-controls";
import { AnnouncementSettingsForm } from "@/app/admin/announcements/announcement-settings-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { describeAnnouncement } from "@/lib/admin/announcement-content-rules";
import {
  getAdminAnnouncementSettings,
  listAdminAnnouncements,
  type AdminAnnouncement,
  type AdminAnnouncementSettings,
} from "@/lib/admin/announcements";
import { requireAdminUser } from "@/lib/supabase/admin-auth";

export const metadata: Metadata = {
  title: "Announcements",
};

export const dynamic = "force-dynamic";

// Two jobs, two sections: the banner switch and speed, then the messages it
// rotates through. Each announcement leads with the sentence a customer would
// actually read rather than its stored fields, so the list scans like the
// storefront it configures.

const addAnnouncementClassName =
  "inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

/**
 * A titled block within the page.
 *
 * Local to this page on purpose: the Operations page has its own copy of a
 * similar heading, and merging them is a separate change from this one.
 */
function SectionHeading({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2
        id={id}
        className="min-w-0 text-lg font-medium tracking-[0.06em] text-stone-100 sm:text-xl"
      >
        {title}
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** The list position a customer would count, not the stored sort_order. */
function PositionBadge({ position }: { position: number }) {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs tabular-nums text-stone-400">
      {position}
    </span>
  );
}

/**
 * The three text fields as the sentence they will form, with highlight_text in
 * the pill the storefront gives it. Absent fields are skipped, so this also
 * shows at a glance whether the pill leads, closes, or sits inside the line.
 */
function AnnouncementPreview({
  announcement,
}: {
  announcement: AdminAnnouncement;
}) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-100 [overflow-wrap:anywhere]">
      {announcement.prefix_text ? (
        <span className="break-words">{announcement.prefix_text}</span>
      ) : null}
      {announcement.highlight_text ? (
        <span className="inline-flex items-center break-words rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-medium text-stone-100">
          {announcement.highlight_text}
        </span>
      ) : null}
      {announcement.suffix_text ? (
        <span className="break-words">{announcement.suffix_text}</span>
      ) : null}
    </p>
  );
}

/**
 * The call to action as one muted line rather than two columns. The database
 * pairs the label and the path, so either both are present or neither is.
 */
function LinkSummary({ announcement }: { announcement: AdminAnnouncement }) {
  if (!announcement.link_label || !announcement.link_href) {
    return null;
  }

  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-stone-400 [overflow-wrap:anywhere]">
      <span className="break-words">{announcement.link_label}</span>
      <span aria-hidden="true" className="text-stone-600">
        &rarr;
      </span>
      <span className="break-words font-mono">{announcement.link_href}</span>
    </p>
  );
}

function AnnouncementStatus({ isActive }: { isActive: boolean }) {
  return (
    <StatusBadge
      kind="announcement"
      value={isActive ? "active" : "inactive"}
    />
  );
}

/**
 * The settings form, or an honest refusal to show one.
 *
 * A missing singleton row means the database is not in the state this code
 * expects. Rendering the form with invented defaults would let an administrator
 * "save" values against a row that does not exist, so the configuration problem
 * is reported instead and no row is created here.
 */
function BannerSettings({
  settings,
}: {
  settings: AdminAnnouncementSettings | null;
}) {
  if (!settings) {
    return (
      <section
        aria-label="Banner settings"
        className="rounded-2xl border border-red-400/20 bg-red-400/5 px-6 py-6"
      >
        <h3 className="text-sm font-medium text-red-100">
          Banner settings are missing
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-red-200/90">
          No settings row was found, so the banner has no configuration to read
          and nothing here can be changed. The row is created by the migration
          that added the announcement tables; restore it before editing the
          banner.
        </p>
      </section>
    );
  }

  return (
    <AnnouncementSettingsForm
      isEnabled={settings.is_enabled}
      rotationIntervalSeconds={settings.rotation_interval_seconds}
    />
  );
}

async function loadAnnouncementData() {
  try {
    const [settings, announcements] = await Promise.all([
      getAdminAnnouncementSettings(),
      listAdminAnnouncements(),
    ]);

    return { settings, announcements, hasError: false };
  } catch (error) {
    console.error("Failed to load announcements for admin", error);

    return {
      settings: null,
      announcements: [] as AdminAnnouncement[],
      hasError: true,
    };
  }
}

function MessagesSection({
  announcements,
}: {
  announcements: AdminAnnouncement[];
}) {
  const count = announcements.length;

  return (
    <section aria-labelledby="announcement-messages-heading" className="space-y-4">
      <SectionHeading
        id="announcement-messages-heading"
        title="Messages"
        action={
          <Link
            href="/admin/announcements/new"
            className={addAnnouncementClassName}
          >
            Add announcement
          </Link>
        }
      />

      {count === 0 ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-stone-400">No announcements yet.</p>
          <Link
            href="/admin/announcements/new"
            className={addAnnouncementClassName}
          >
            Create the first announcement
          </Link>
        </div>
      ) : (
        <>
          {/* Small screens: one stacked card per announcement. The table below
              takes over at `lg`, the first width where its columns fit. */}
          <ul aria-label="Announcements" className="space-y-3 lg:hidden">
            {announcements.map((announcement, index) => (
              <li
                key={announcement.id}
                className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <PositionBadge position={index + 1} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <AnnouncementPreview announcement={announcement} />
                    <LinkSummary announcement={announcement} />
                  </div>
                  <AnnouncementStatus isActive={announcement.is_active} />
                </div>

                <AnnouncementRowControls
                  announcementId={announcement.id}
                  isActive={announcement.is_active}
                  description={describeAnnouncement(announcement)}
                  isFirst={index === 0}
                  isLast={index === announcements.length - 1}
                />
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">Announcements</caption>
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-400">
                  <th className="w-16 px-4 py-4 font-normal">Position</th>
                  <th className="px-4 py-4 font-normal">Message</th>
                  <th className="w-32 px-4 py-4 font-normal">Status</th>
                  <th className="px-4 py-4 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((announcement, index) => (
                  <tr
                    key={announcement.id}
                    className="border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-5">
                      <PositionBadge position={index + 1} />
                    </td>
                    <td className="min-w-0 px-4 py-5">
                      <div className="min-w-0 space-y-1.5">
                        <AnnouncementPreview announcement={announcement} />
                        <LinkSummary announcement={announcement} />
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <AnnouncementStatus isActive={announcement.is_active} />
                    </td>
                    <td className="px-4 py-5">
                      <AnnouncementRowControls
                        announcementId={announcement.id}
                        isActive={announcement.is_active}
                        description={describeAnnouncement(announcement)}
                        isFirst={index === 0}
                        isLast={index === announcements.length - 1}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default async function AdminAnnouncementsPage() {
  // Outside the try/catch below: redirect() signals by throwing, and catching
  // it would swallow the redirect and render the page to a signed-out visitor.
  await requireAdminUser();

  const { settings, announcements, hasError } = await loadAnnouncementData();

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Announcements"
        description="Manage the storefront banner and the messages it rotates through."
      />

      {hasError ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Announcements could not be loaded. Please try again.
        </p>
      ) : (
        <>
          <section
            aria-labelledby="announcement-banner-heading"
            className="space-y-4"
          >
            <SectionHeading
              id="announcement-banner-heading"
              title="Announcement banner settings"
            />
            <BannerSettings settings={settings} />
          </section>

          <MessagesSection announcements={announcements} />
        </>
      )}
    </div>
  );
}
