import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { getStorefrontAnnouncementBanner } from "@/lib/storefront/announcements";

/**
 * Loads the announcement banner for the shared storefront shell.
 *
 * This is the failure boundary for that read. The cached function throws on a
 * database error so a transient outage is never cached as "no announcements";
 * catching it here keeps the failure from taking down every storefront page,
 * since this sits in the layout every route renders through.
 *
 * A failure renders nothing. It deliberately does not fall back to the copy
 * this banner used to hardcode: showing a discount promotion after an
 * administrator switched the banner off would advertise an offer that is meant
 * to be inactive.
 */
export async function AnnouncementBannerSlot() {
  let banner;

  try {
    banner = await getStorefrontAnnouncementBanner();
  } catch (error) {
    console.error("Failed to load the storefront announcement banner", error);
    return null;
  }

  if (!banner.isEnabled) {
    return null;
  }

  // One announcement for now. Rotation across the rest arrives in a later
  // phase; until then the first in (sort_order, created_at) order is the one
  // the storefront shows.
  const [announcement] = banner.announcements;

  if (!announcement) {
    return null;
  }

  return <AnnouncementBanner announcement={announcement} />;
}
