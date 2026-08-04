import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
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

// Read-only view. Editing, ordering, and the settings form arrive in later
// phases, so nothing here mutates and no control writes to the database.

const EM_DASH = "—";

function orDash(value: string | null) {
  return value ?? EM_DASH;
}

function formatInterval(seconds: number) {
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
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

function SettingsSummary({
  settings,
}: {
  settings: AdminAnnouncementSettings | null;
}) {
  if (!settings) {
    return (
      <section
        aria-label="Banner settings"
        className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-6"
      >
        <p className="text-sm text-stone-400">
          No banner settings row was found, so the storefront banner has no
          configuration to read.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Banner settings"
      className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-6"
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">
            Banner
          </dt>
          <dd>
            <StatusBadge
              kind="announcement"
              value={settings.is_enabled ? "active" : "inactive"}
              label={settings.is_enabled ? "Enabled" : "Disabled"}
            />
          </dd>
        </div>

        <div className="min-w-0 space-y-2">
          <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">
            Rotation interval
          </dt>
          <dd className="text-sm text-stone-200">
            {formatInterval(settings.rotation_interval_seconds)}
          </dd>
        </div>
      </dl>
    </section>
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
        description="The storefront announcement banner and its messages. This view is read-only; editing arrives in a later phase."
      />

      {hasError ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
          Announcements could not be loaded. Please try again.
        </p>
      ) : (
        <>
          <SettingsSummary settings={settings} />

          {announcements.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-stone-400">
              No announcements yet.
            </p>
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
