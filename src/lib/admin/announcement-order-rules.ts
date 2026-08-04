// Pure ordering rules. Free of database and server-only imports so the client
// row controls, the Server Action, and the admin data layer agree on what a
// move request looks like.

export const ANNOUNCEMENT_MOVE_DIRECTIONS = ["up", "down"] as const;

export type AnnouncementMoveDirection =
  (typeof ANNOUNCEMENT_MOVE_DIRECTIONS)[number];

export function isAnnouncementMoveDirection(
  value: unknown,
): value is AnnouncementMoveDirection {
  return (
    typeof value === "string" &&
    (ANNOUNCEMENT_MOVE_DIRECTIONS as readonly string[]).includes(value)
  );
}

/**
 * The index a move targets, or null when the move runs off the end.
 *
 * Kept separate from the database work so the "already first" and "already
 * last" cases can be reasoned about on their own — they are ordinary outcomes,
 * not errors.
 */
export function getAdjacentIndex(
  index: number,
  direction: AnnouncementMoveDirection,
  length: number,
): number | null {
  const target = direction === "up" ? index - 1 : index + 1;

  return target < 0 || target >= length ? null : target;
}
