import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { getStorefrontAnnouncementBanner } from "@/lib/storefront/announcements";

const FALLBACK_ROTATION_INTERVAL_SECONDS = 10;

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

  if (banner.announcements.length === 0) {
    return null;
  }

  // The whole active list, in (sort_order, created_at) order. A single
  // announcement renders statically; more than one rotates on the interval the
  // administrator configured.
  return (
    <AnnouncementBanner
      announcements={banner.announcements}
      rotationIntervalSeconds={
        // Unreachable in practice: a missing settings row reads as disabled and
        // has already returned above. The fallback matches the seeded default
        // so a rotation can never be scheduled from a null.
        banner.rotationIntervalSeconds ?? FALLBACK_ROTATION_INTERVAL_SECONDS
      }
    />
  );
}
