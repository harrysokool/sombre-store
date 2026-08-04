// The cache tag shared by the storefront's cached announcement read and the
// admin Server Actions that expire it.
//
// Kept in its own module, free of server-only and Supabase imports, so an
// admin action can name the tag without pulling the storefront's cached read
// into its import graph.

export const ANNOUNCEMENTS_CACHE_TAG = "announcements";

// Admin mutations expire the tag immediately, so this is only a backstop for
// an invalidation that never arrived: a missed update self-heals within five
// minutes instead of persisting until the next deploy.
export const ANNOUNCEMENTS_CACHE_TTL_SECONDS = 300;
