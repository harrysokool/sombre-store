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

// Banner settings, then every announcement with its edit, activate, and delete
// controls. The displayed order stays read-only: nothing here can move an
// announcement, and the controls that do arrive in a later phase.

const EM_DASH = "—";

function orDash(value: string | null) {
  return value ?? EM_DASH;
}

// One labelled field inside a mobile announcement card. The label stacks above
// the value on the narrowest screens so a long path never squeezes into a
// sliver.
function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-stone-200 [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
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
        <h2 className="text-sm font-medium text-red-100">
          Banner settings are missing
        </h2>
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

export default async function AdminAnnouncementsPage() {
  // Outside the try/catch below: redirect() signals by throwing, and catching
  // it would swallow the redirect and render the page to a signed-out visitor.
  await requireAdminUser();

  const { settings, announcements, hasError } = await loadAnnouncementData();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Announcements"
        description="Switch the storefront announcement banner on or off, set how fast it rotates, and manage the messages it shows."
        actions={
          <Link
            href="/admin/announcements/new"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Add announcement
          </Link>
        }
      />

      {hasError ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Announcements could not be loaded. Please try again.
        </p>
      ) : (
        <>
          <BannerSettings settings={settings} />

          {announcements.length === 0 ? (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <p className="text-sm text-stone-400">No announcements yet.</p>
              <Link
                href="/admin/announcements/new"
                className="inline-block text-sm text-stone-200 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Create the first announcement
              </Link>
            </div>
          ) : (
            <>
              {/* Small screens: one stacked card per announcement. The table
                  below takes over at `lg`, the first width where its columns
                  fit. */}
              <ul aria-label="Announcements" className="space-y-3 lg:hidden">
                {announcements.map((announcement) => (
                  <li
                    key={announcement.id}
                    className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <AnnouncementPreview announcement={announcement} />
                      <AnnouncementStatus isActive={announcement.is_active} />
                    </div>

                    <dl className="space-y-3">
                      <CardField label="Order">
                        {announcement.sort_order}
                      </CardField>
                      <CardField label="Prefix">
                        {orDash(announcement.prefix_text)}
                      </CardField>
                      <CardField label="Highlight">
                        {orDash(announcement.highlight_text)}
                      </CardField>
                      <CardField label="Suffix">
                        {orDash(announcement.suffix_text)}
                      </CardField>
                      <CardField label="Link label">
                        {orDash(announcement.link_label)}
                      </CardField>
                      <CardField label="Link href">
                        {orDash(announcement.link_href)}
                      </CardField>
                    </dl>

                    <AnnouncementRowControls
                      announcementId={announcement.id}
                      isActive={announcement.is_active}
                      description={describeAnnouncement(announcement)}
                    />
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
                <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Announcements</caption>
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-stone-400">
                      <th className="px-4 py-4 text-right font-normal">
                        Order
                      </th>
                      <th className="px-4 py-4 font-normal">Prefix</th>
                      <th className="px-4 py-4 font-normal">Highlight</th>
                      <th className="px-4 py-4 font-normal">Suffix</th>
                      <th className="px-4 py-4 font-normal">Link label</th>
                      <th className="px-4 py-4 font-normal">Link href</th>
                      <th className="px-4 py-4 font-normal">Status</th>
                      <th className="px-4 py-4 font-normal">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((announcement) => (
                      <tr
                        key={announcement.id}
                        className="border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.03]"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-right text-stone-400">
                          {announcement.sort_order}
                        </td>
                        <td className="max-w-[14rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                          {orDash(announcement.prefix_text)}
                        </td>
                        <td className="max-w-[12rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                          {orDash(announcement.highlight_text)}
                        </td>
                        <td className="max-w-[18rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                          {orDash(announcement.suffix_text)}
                        </td>
                        <td className="max-w-[12rem] break-words px-4 py-4 text-stone-200 [overflow-wrap:anywhere]">
                          {orDash(announcement.link_label)}
                        </td>
                        <td className="max-w-[14rem] break-words px-4 py-4 font-mono text-xs text-stone-400 [overflow-wrap:anywhere]">
                          {orDash(announcement.link_href)}
                        </td>
                        <td className="px-4 py-4">
                          <AnnouncementStatus
                            isActive={announcement.is_active}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <AnnouncementRowControls
                            announcementId={announcement.id}
                            isActive={announcement.is_active}
                            description={describeAnnouncement(announcement)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
