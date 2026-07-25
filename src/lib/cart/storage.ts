/**
 * The one place the cart flow is allowed to touch browser storage.
 *
 * Every call here is wrapped, because `localStorage` and `sessionStorage` throw
 * rather than degrade in ordinary situations: blocked by privacy settings, a
 * restricted private mode, a full quota, or a sandboxed frame. Even reading the
 * `window.localStorage` property itself can throw before any method is called.
 *
 * The contract callers can rely on:
 *
 * - No function here ever throws.
 * - A read that cannot produce trustworthy data reports why, and never
 *   substitutes a guess. `invalid` is not the same as `empty`.
 * - A value that is present but unusable — malformed JSON, or a shape the
 *   caller rejects — is cleared on a best-effort basis, so a single corrupt
 *   write cannot wedge the cart permanently.
 * - Writes report whether the value actually persisted, so a caller can decide
 *   what to do instead of assuming success.
 */

export type StorageArea = "local" | "session";

export type StoredRead<T> =
  /** A value was present and the caller accepted it. */
  | { status: "ok"; value: T }
  /** Storage worked and held nothing under this key. */
  | { status: "empty" }
  /** Something was stored but could not be trusted. It has been cleared. */
  | { status: "invalid" }
  /** Storage could not be reached at all. Nothing is known about the key. */
  | { status: "unavailable" };

export type StoredTextRead =
  | { status: "ok"; value: string }
  | { status: "empty" }
  | { status: "unavailable" };

function getStorage(area: StorageArea): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    // The property access is itself guarded: some privacy modes throw here,
    // before any method on the returned object is called.
    return area === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** Whether storage can currently be reached at all. */
export function isStorageAvailable(area: StorageArea = "local") {
  return getStorage(area) !== null;
}

export function readStoredText(
  key: string,
  area: StorageArea = "local",
): StoredTextRead {
  const storage = getStorage(area);

  if (!storage) {
    return { status: "unavailable" };
  }

  try {
    const raw = storage.getItem(key);

    // An empty string is treated as nothing stored: it can never parse into a
    // usable value, so there is no case where the distinction would matter.
    if (raw === null || raw === "") {
      return { status: "empty" };
    }

    return { status: "ok", value: raw };
  } catch {
    return { status: "unavailable" };
  }
}

/** Returns whether the value actually persisted. */
export function writeStoredText(
  key: string,
  value: string,
  area: StorageArea = "local",
) {
  const storage = getStorage(area);

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Most commonly a quota error, which behaves exactly like being blocked
    // from the caller's point of view: the value is not saved.
    return false;
  }
}

/** Returns whether the key is known to be gone. */
export function removeStoredValue(key: string, area: StorageArea = "local") {
  const storage = getStorage(area);

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and parses a JSON value.
 *
 * `parse` is the caller's validator: it receives whatever was stored and
 * returns the trusted value, or `null` to reject it. Returning `null` is what
 * keeps unvalidated data from ever reaching the rest of the app — a rejected
 * value is reported as `invalid` and cleared, never passed through.
 */
export function readStoredJson<T>(
  key: string,
  parse: (value: unknown) => T | null,
  area: StorageArea = "local",
): StoredRead<T> {
  const raw = readStoredText(key, area);

  if (raw.status !== "ok") {
    return raw;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw.value);
  } catch {
    // Unparseable text holds nothing worth preserving, so dropping it is safe
    // and stops every future read from repeating the same failure.
    removeStoredValue(key, area);
    return { status: "invalid" };
  }

  let value: T | null;

  try {
    value = parse(parsed);
  } catch {
    // A validator that throws is treated as a rejection rather than being
    // allowed to take down the caller.
    value = null;
  }

  if (value === null) {
    removeStoredValue(key, area);
    return { status: "invalid" };
  }

  return { status: "ok", value };
}

/** Returns whether the value actually persisted. */
export function writeStoredJson(
  key: string,
  value: unknown,
  area: StorageArea = "local",
) {
  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    // Circular or otherwise unserializable input. Nothing is written, and the
    // previously stored value is deliberately left alone.
    return false;
  }

  // `JSON.stringify` yields undefined for values with no JSON representation.
  if (typeof serialized !== "string") {
    return false;
  }

  return writeStoredText(key, serialized, area);
}
