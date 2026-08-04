// Pure announcement content rules. Free of database and server-only imports so
// the same limits and checks back the client form, the Server Actions, and the
// admin data layer, and can be probed on their own.
//
// Every rule here mirrors a constraint in the migration that created the
// announcements table. The database remains the authority; these exist so a
// mistake produces a readable message instead of a constraint violation.

export const ANNOUNCEMENT_TEXT_LIMITS = {
  prefixText: 80,
  highlightText: 32,
  suffixText: 120,
  linkLabel: 32,
  linkHref: 200,
} as const;

// Mirrors announcements_link_href_internal_check. '^/($|[^/])' admits '/' and
// '/shop' but refuses '//evil.example', which a browser resolves as a
// protocol-relative URL to another origin, and refuses any scheme such as
// 'javascript:'.
const INTERNAL_PATH_PATTERN = /^\/($|[^/])/;

export type AdminAnnouncementSubmission = {
  prefixText: unknown;
  highlightText: unknown;
  suffixText: unknown;
  linkLabel: unknown;
  linkHref: unknown;
  isActive: boolean;
};

export type ValidatedAnnouncementContent = {
  prefix_text: string | null;
  highlight_text: string | null;
  suffix_text: string | null;
  link_label: string | null;
  link_href: string | null;
  is_active: boolean;
};

/**
 * Trims a submitted field, turning anything empty into null.
 *
 * An empty input is what "not set" looks like on a form, and the database
 * stores absent values as null rather than "": the length checks there start
 * at 1, so a bare "" would be rejected outright.
 */
export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * Mirrors the database's link_href check: an internal path only, with
 * backslashes refused because some browsers normalise them to forward slashes,
 * which would reopen the same off-site escape.
 */
export function isSafeInternalPath(value: string): boolean {
  return INTERNAL_PATH_PATTERN.test(value) && !value.includes("\\");
}

/** A short, human-readable name for one announcement, for control labels. */
export function describeAnnouncement(announcement: {
  prefix_text: string | null;
  highlight_text: string | null;
  suffix_text: string | null;
}): string {
  const text = [
    announcement.prefix_text,
    announcement.highlight_text,
    announcement.suffix_text,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

export function validateAnnouncementSubmission(
  input: AdminAnnouncementSubmission,
):
  | { ok: true; value: ValidatedAnnouncementContent }
  | { ok: false; error: string } {
  const prefixText = normalizeOptionalText(input.prefixText);
  const highlightText = normalizeOptionalText(input.highlightText);
  const suffixText = normalizeOptionalText(input.suffixText);
  const linkLabel = normalizeOptionalText(input.linkLabel);
  const linkHref = normalizeOptionalText(input.linkHref);

  // Mirrors announcements_content_present_check. An announcement with no text
  // at all would render as an empty bar.
  if (!prefixText && !highlightText && !suffixText) {
    return {
      ok: false,
      error: "Enter at least one of prefix, highlight, or suffix text.",
    };
  }

  const lengthChecks = [
    ["Prefix text", prefixText, ANNOUNCEMENT_TEXT_LIMITS.prefixText],
    ["Highlight text", highlightText, ANNOUNCEMENT_TEXT_LIMITS.highlightText],
    ["Suffix text", suffixText, ANNOUNCEMENT_TEXT_LIMITS.suffixText],
    ["Link label", linkLabel, ANNOUNCEMENT_TEXT_LIMITS.linkLabel],
    ["Link path", linkHref, ANNOUNCEMENT_TEXT_LIMITS.linkHref],
  ] as const;

  for (const [label, value, limit] of lengthChecks) {
    if (value !== null && value.length > limit) {
      return {
        ok: false,
        error: `${label} must be ${limit} characters or fewer.`,
      };
    }
  }

  // Mirrors announcements_link_pair_check. A label with no target renders
  // nothing useful, and a target with no label gives nothing to click.
  if ((linkLabel === null) !== (linkHref === null)) {
    return {
      ok: false,
      error: "A link needs both a label and a path, or neither.",
    };
  }

  if (linkHref !== null && !isSafeInternalPath(linkHref)) {
    return {
      ok: false,
      error:
        "The link path must stay on this site: start it with a single / , as in /shop.",
    };
  }

  return {
    ok: true,
    value: {
      prefix_text: prefixText,
      highlight_text: highlightText,
      suffix_text: suffixText,
      link_label: linkLabel,
      link_href: linkHref,
      is_active: input.isActive === true,
    },
  };
}
