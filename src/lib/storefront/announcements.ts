import "server-only";

import { unstable_cache } from "next/cache";

import {
  ANNOUNCEMENTS_CACHE_TAG,
  ANNOUNCEMENTS_CACHE_TTL_SECONDS,
} from "@/lib/storefront/announcement-cache-tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The storefront's view of the admin-managed announcement banner.
//
// Read with the anonymous client and the public RLS policies: inactive
// announcements are invisible to this role, so a draft cannot reach a customer
// even if the filter below were ever removed. The service-role client must
// never be used here — it bypasses RLS and belongs to trusted admin code only.
//
// createSupabaseServerClient touches no cookies, headers, or session state, so
// it is safe to call inside unstable_cache: the result is global public
// marketing copy, identical for every visitor, and holds no personal data.

const ANNOUNCEMENTS_CACHE_KEY = ["storefront-announcement-banner"];

const SETTINGS_COLUMNS = "is_enabled, rotation_interval_seconds";
const ANNOUNCEMENT_COLUMNS =
  "id, prefix_text, highlight_text, suffix_text, link_label, link_href";

const SETTINGS_ROW_ID = 1;

export type StorefrontAnnouncement = {
  id: string;
  prefix_text: string | null;
  highlight_text: string | null;
  suffix_text: string | null;
  link_label: string | null;
  link_href: string | null;
};

export type StorefrontAnnouncementBanner = {
  isEnabled: boolean;
  // Read now although nothing rotates yet: it is another column of a query
  // already being made, and including it keeps the cached payload shape stable
  // when rotation arrives.
  rotationIntervalSeconds: number | null;
  announcements: StorefrontAnnouncement[];
};

/**
 * Reads the banner configuration and its active announcements.
 *
 * Deliberately throws on a database error rather than returning an empty
 * banner. An empty result is a legitimate state that is safe to cache; a
 * failed query is not, and swallowing it here would cache a transient outage
 * as "no announcements" for the whole TTL. The caller catches instead.
 *
 * A missing settings row is treated as disabled, which is a real state and
 * fine to cache.
 */
async function readStorefrontAnnouncementBanner(): Promise<StorefrontAnnouncementBanner> {
  const supabase = createSupabaseServerClient();

  const [settingsResult, announcementsResult] = await Promise.all([
    supabase
      .from("announcement_settings")
      .select(SETTINGS_COLUMNS)
      .eq("id", SETTINGS_ROW_ID)
      .maybeSingle<{
        is_enabled: boolean;
        rotation_interval_seconds: number;
      }>(),
    supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      // Belt and braces with the RLS policy, which already hides inactive rows
      // from this role.
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<StorefrontAnnouncement[]>(),
  ]);

  if (settingsResult.error) {
    throw new Error("Announcement settings could not be read.");
  }

  if (announcementsResult.error) {
    throw new Error("Announcements could not be read.");
  }

  const settings = settingsResult.data;

  return {
    // A missing settings row leaves the banner off rather than guessing it on.
    isEnabled: settings?.is_enabled === true,
    rotationIntervalSeconds: settings?.rotation_interval_seconds ?? null,
    announcements: announcementsResult.data ?? [],
  };
}

/**
 * The cached read every storefront page shares.
 *
 * Caching is what keeps the pages that have no other data dependency
 * prerendered: an uncached read in the shared layout would opt all of them out
 * of static generation.
 */
export const getStorefrontAnnouncementBanner = unstable_cache(
  readStorefrontAnnouncementBanner,
  ANNOUNCEMENTS_CACHE_KEY,
  {
    tags: [ANNOUNCEMENTS_CACHE_TAG],
    revalidate: ANNOUNCEMENTS_CACHE_TTL_SECONDS,
  },
);
