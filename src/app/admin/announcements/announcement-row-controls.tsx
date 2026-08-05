"use client";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  deleteAnnouncementAction,
  moveAnnouncementAction,
  setAnnouncementActiveAction,
  type AnnouncementListActionState,
} from "@/app/admin/announcements/actions";

const initialActionState: AnnouncementListActionState = {
  error: null,
  success: null,
};

// One square icon button, sized for touch on small screens and tightened up
// from `sm`. Shared by the status and delete actions so the trailing cluster
// reads as one set of controls.
const iconButtonClassName =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40 sm:size-9";
const destructiveIconButtonClassName =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-400/25 bg-red-400/5 text-red-200 transition-colors hover:border-red-400/40 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:size-9";
// Edit keeps its word: it is the primary action on a row and should not need
// an icon to be decoded.
const editLinkClassName =
  "inline-flex h-10 shrink-0 items-center rounded-xl border border-white/10 px-3.5 text-xs uppercase tracking-[0.14em] text-stone-200 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:h-9";
// Taller on touch screens, tightened up from `sm` where a pointer is precise.
const orderingButtonClassName =
  "inline-flex h-7 w-10 items-center justify-center text-stone-400 transition-colors hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent sm:h-6 sm:w-9";
const confirmButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-2 text-xs uppercase tracking-[0.14em] text-red-200 transition-colors hover:border-red-400/40 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-50";
const cancelButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50";

const ICON_CLASS = "size-4";

type AnnouncementRowControlsProps = {
  announcementId: string;
  isActive: boolean;
  description: string;
  isFirst: boolean;
  isLast: boolean;
};

export function AnnouncementRowControls({
  announcementId,
  isActive,
  description,
  isFirst,
  isLast,
}: AnnouncementRowControlsProps) {
  const [activeState, activeFormAction, isActivePending] = useActionState(
    setAnnouncementActiveAction,
    initialActionState,
  );
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteAnnouncementAction,
    initialActionState,
  );
  // One hook per direction so the pending indicator lands on the button that
  // was actually pressed rather than on both.
  const [moveUpState, moveUpFormAction, isMovingUp] = useActionState(
    moveAnnouncementAction,
    initialActionState,
  );
  const [moveDownState, moveDownFormAction, isMovingDown] = useActionState(
    moveAnnouncementAction,
    initialActionState,
  );
  // Deletion is irreversible and there is no undo, so the destructive button
  // never submits on its own: the first press only asks.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const error =
    activeState.error ??
    deleteState.error ??
    moveUpState.error ??
    moveDownState.error;
  const success =
    activeState.success ??
    deleteState.success ??
    moveUpState.success ??
    moveDownState.success;
  const isBusy =
    isActivePending || isDeletePending || isMovingUp || isMovingDown;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-end gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/admin/announcements/${announcementId}`}
            aria-label={`Edit announcement: ${description}`}
            className={editLinkClassName}
          >
            Edit
          </Link>

          <form action={activeFormAction}>
            <input
              type="hidden"
              name="announcementId"
              value={announcementId}
            />
            <input type="hidden" name="isActive" value={String(!isActive)} />
            <button
              type="submit"
              disabled={isBusy}
              aria-busy={isActivePending}
              aria-label={`${isActive ? "Deactivate" : "Activate"} announcement: ${description}`}
              className={iconButtonClassName}
            >
              {isActivePending ? (
                <LoaderCircle className={`${ICON_CLASS} animate-spin`} />
              ) : isActive ? (
                <EyeOff className={ICON_CLASS} />
              ) : (
                <Eye className={ICON_CLASS} />
              )}
            </button>
          </form>

          {isConfirmingDelete ? null : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              disabled={isBusy}
              aria-label={`Delete announcement: ${description}`}
              className={destructiveIconButtonClassName}
            >
              <Trash2 className={ICON_CLASS} />
            </button>
          )}
        </div>

        {/* Ordering sits apart from the item actions, at the trailing edge:
            moving a message is a different kind of change from editing it. */}
        <div
          data-testid="announcement-ordering-controls"
          aria-label="Reorder announcement"
          role="group"
          className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-white/10"
        >
          <form action={moveUpFormAction}>
            <input
              type="hidden"
              name="announcementId"
              value={announcementId}
            />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={isFirst || isBusy}
              aria-busy={isMovingUp}
              aria-label={`Move announcement up: ${description}`}
              className={orderingButtonClassName}
            >
              {isMovingUp ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </button>
          </form>

          <div aria-hidden="true" className="h-px bg-white/10" />

          <form action={moveDownFormAction}>
            <input
              type="hidden"
              name="announcementId"
              value={announcementId}
            />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={isLast || isBusy}
              aria-busy={isMovingDown}
              aria-label={`Move announcement down: ${description}`}
              className={orderingButtonClassName}
            >
              {isMovingDown ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {isConfirmingDelete ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-xs leading-5 text-red-200">
            Delete this announcement? This cannot be undone.
          </p>
          <form action={deleteFormAction}>
            <input
              type="hidden"
              name="announcementId"
              value={announcementId}
            />
            <button
              type="submit"
              disabled={isDeletePending}
              aria-label={`Confirm delete announcement: ${description}`}
              className={confirmButtonClassName}
            >
              {isDeletePending ? "Deleting…" : "Confirm delete"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(false)}
            disabled={isDeletePending}
            aria-label={`Keep announcement: ${description}`}
            className={cancelButtonClassName}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-right text-xs leading-5 text-red-300">
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="text-right text-xs leading-5 text-emerald-300"
        >
          {success}
        </p>
      ) : null}
    </div>
  );
}
