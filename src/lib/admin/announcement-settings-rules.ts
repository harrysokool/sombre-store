// Pure announcement settings rules. Kept free of database and server-only
// imports so the same bounds and parsing back the client form, the Server
// Action, and the admin data layer, and can be probed on their own.

// Mirrors announcement_settings_rotation_interval_range_check. Validated here
// as well as in the database so an out-of-range value produces a readable
// message instead of a constraint violation.
export const MIN_ROTATION_INTERVAL_SECONDS = 3;
export const MAX_ROTATION_INTERVAL_SECONDS = 60;

export const NOT_A_WHOLE_NUMBER_MESSAGE =
  "Enter the rotation interval as a whole number of seconds.";
export const OUT_OF_RANGE_MESSAGE = `The rotation interval must be between ${MIN_ROTATION_INTERVAL_SECONDS} and ${MAX_ROTATION_INTERVAL_SECONDS} seconds.`;

export type AdminAnnouncementSettingsSubmission = {
  isEnabled: boolean;
  rotationIntervalSeconds: unknown;
};

/**
 * Parses a submitted rotation interval into a whole number of seconds inside
 * the supported range.
 *
 * A form value arrives as a string, so the digits-only test runs before
 * Number(): it rejects "", "10.5", "1e1", "0x0a", "-5", and "+10", each of
 * which Number() would otherwise accept or coerce into something plausible.
 */
export function parseRotationIntervalSeconds(
  value: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    parsed = Number(value.trim());
  } else {
    return { ok: false, error: NOT_A_WHOLE_NUMBER_MESSAGE };
  }

  if (!Number.isInteger(parsed)) {
    return { ok: false, error: NOT_A_WHOLE_NUMBER_MESSAGE };
  }

  if (
    parsed < MIN_ROTATION_INTERVAL_SECONDS ||
    parsed > MAX_ROTATION_INTERVAL_SECONDS
  ) {
    return { ok: false, error: OUT_OF_RANGE_MESSAGE };
  }

  return { ok: true, value: parsed };
}

export function validateAnnouncementSettingsSubmission(
  input: AdminAnnouncementSettingsSubmission,
):
  | { ok: true; value: { isEnabled: boolean; rotationIntervalSeconds: number } }
  | { ok: false; error: string } {
  const rotationIntervalSeconds = parseRotationIntervalSeconds(
    input.rotationIntervalSeconds,
  );

  if (!rotationIntervalSeconds.ok) {
    return rotationIntervalSeconds;
  }

  return {
    ok: true,
    value: {
      isEnabled: input.isEnabled === true,
      rotationIntervalSeconds: rotationIntervalSeconds.value,
    },
  };
}
