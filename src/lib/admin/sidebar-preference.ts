import {
  readStoredJson,
  writeStoredJson,
} from "@/lib/cart/storage";

export const ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY =
  "sombre-admin-sidebar-preference";

export const ADMIN_SIDEBAR_PREFERENCE_VERSION = 1 as const;

export type AdminSidebarPreference = Readonly<{
  version: typeof ADMIN_SIDEBAR_PREFERENCE_VERSION;
  expanded: boolean;
}>;

function defaultAdminSidebarPreference(): AdminSidebarPreference {
  return {
    version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
    expanded: true,
  };
}

function parseAdminSidebarPreference(
  value: unknown,
): AdminSidebarPreference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const preference = value as Record<string, unknown>;
  const keys = Object.keys(preference);

  if (
    keys.length !== 2 ||
    !keys.includes("version") ||
    !keys.includes("expanded") ||
    preference.version !== ADMIN_SIDEBAR_PREFERENCE_VERSION ||
    typeof preference.expanded !== "boolean"
  ) {
    return null;
  }

  return {
    version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
    expanded: preference.expanded,
  };
}

/**
 * Reads the optional desktop-sidebar preference without making browser storage
 * a requirement. Missing, invalid, or unavailable storage all use the expanded
 * default, and the guarded storage layer ensures this function never throws.
 */
export function readAdminSidebarPreference(): AdminSidebarPreference {
  const stored = readStoredJson(
    ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY,
    parseAdminSidebarPreference,
  );

  return stored.status === "ok"
    ? stored.value
    : defaultAdminSidebarPreference();
}

/**
 * Persists the preference when storage is available and reports whether the
 * write succeeded. A blocked browser store or exhausted quota returns false.
 */
export function writeAdminSidebarPreference(expanded: boolean) {
  return writeStoredJson(ADMIN_SIDEBAR_PREFERENCE_STORAGE_KEY, {
    version: ADMIN_SIDEBAR_PREFERENCE_VERSION,
    expanded: expanded === true,
  } satisfies AdminSidebarPreference);
}
