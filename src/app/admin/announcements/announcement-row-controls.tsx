"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  deleteAnnouncementAction,
  setAnnouncementActiveAction,
  type AnnouncementListActionState,
} from "@/app/admin/announcements/actions";

const initialActionState: AnnouncementListActionState = {
  error: null,
  success: null,
};

const controlClassName =
  "inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.16em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50";
const destructiveClassName =
  "inline-flex items-center justify-center rounded-full border border-red-400/25 bg-red-400/5 px-4 py-2 text-xs uppercase tracking-[0.16em] text-red-200 transition-colors hover:border-red-400/40 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-50";

type AnnouncementRowControlsProps = {
  announcementId: string;
  isActive: boolean;
  description: string;
};

export function AnnouncementRowControls({
  announcementId,
  isActive,
  description,
}: AnnouncementRowControlsProps) {
  const [activeState, activeFormAction, isActivePending] = useActionState(
    setAnnouncementActiveAction,
    initialActionState,
  );
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteAnnouncementAction,
    initialActionState,
  );
  // Deletion is irreversible and there is no undo, so the destructive button
  // never submits on its own: the first press only asks.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const error = activeState.error ?? deleteState.error;
  const success = activeState.success ?? deleteState.success;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/announcements/${announcementId}`}
          aria-label={`Edit announcement: ${description}`}
          className={controlClassName}
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
            disabled={isActivePending || isDeletePending}
            aria-label={`${isActive ? "Deactivate" : "Activate"} announcement: ${description}`}
            className={controlClassName}
          >
            {isActivePending
              ? "Saving…"
              : isActive
                ? "Deactivate"
                : "Activate"}
          </button>
        </form>

        {isConfirmingDelete ? null : (
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            disabled={isActivePending || isDeletePending}
            aria-label={`Delete announcement: ${description}`}
            className={destructiveClassName}
          >
            Delete
          </button>
        )}
      </div>

      {isConfirmingDelete ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3">
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
              className={destructiveClassName}
            >
              {isDeletePending ? "Deleting…" : "Confirm delete"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(false)}
            disabled={isDeletePending}
            aria-label={`Keep announcement: ${description}`}
            className={controlClassName}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs leading-5 text-red-300">
          {error}
        </p>
      ) : null}

      {success ? (
        <p role="status" className="text-xs leading-5 text-emerald-300">
          {success}
        </p>
      ) : null}
    </div>
  );
}
