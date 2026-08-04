"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  updateAnnouncementSettingsAction,
  type AnnouncementSettingsActionState,
} from "@/app/admin/announcements/actions";
import {
  MAX_ROTATION_INTERVAL_SECONDS,
  MIN_ROTATION_INTERVAL_SECONDS,
} from "@/lib/admin/announcement-settings-rules";

const initialActionState: AnnouncementSettingsActionState = {
  error: null,
  success: null,
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50";

type AnnouncementSettingsFormProps = {
  isEnabled: boolean;
  rotationIntervalSeconds: number;
};

export function AnnouncementSettingsForm({
  isEnabled,
  rotationIntervalSeconds,
}: AnnouncementSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateAnnouncementSettingsAction,
    initialActionState,
  );
  // Controlled rather than defaultValue/defaultChecked: React resets an
  // uncontrolled form once its action completes, which would throw away the
  // administrator's edits on a refused save and make them retype the
  // correction. Seeded from the saved row, which is also what a successful
  // save leaves them equal to.
  const [enabled, setEnabled] = useState(isEnabled);
  const [interval, setInterval] = useState(String(rotationIntervalSeconds));
  const toggleRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<HTMLInputElement>(null);

  // React resets the form element once a form action completes. That reset
  // changes the DOM without changing React state, so no re-render follows to
  // undo it: the toggle snaps back to its original position while the state
  // that would be submitted still says otherwise. Re-asserting both fields
  // after every render keeps what is displayed equal to what is held.
  useEffect(() => {
    if (toggleRef.current && toggleRef.current.checked !== enabled) {
      toggleRef.current.checked = enabled;
    }

    if (intervalRef.current && intervalRef.current.value !== interval) {
      intervalRef.current.value = interval;
    }
  });

  return (
    <form
      action={formAction}
      aria-label="Banner settings"
      className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:px-6"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            ref={toggleRef}
            type="checkbox"
            name="isEnabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={isPending}
            className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <span>
            <span className="block text-sm text-stone-200">
              Show the announcement banner
            </span>
            <span className="block text-xs leading-5 text-stone-400">
              When off, the storefront shows no banner at all, whatever the
              announcements below say.
            </span>
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-stone-400">
            Rotation interval
          </span>
          <input
            ref={intervalRef}
            type="number"
            name="rotationIntervalSeconds"
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
            min={MIN_ROTATION_INTERVAL_SECONDS}
            max={MAX_ROTATION_INTERVAL_SECONDS}
            step={1}
            required
            inputMode="numeric"
            disabled={isPending}
            className={inputClassName}
          />
          <span className="block text-xs leading-5 text-stone-400">
            Seconds each announcement is shown, from{" "}
            {MIN_ROTATION_INTERVAL_SECONDS} to {MAX_ROTATION_INTERVAL_SECONDS}.
            Only applies when more than one announcement is active.
          </span>
        </label>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm leading-6 text-emerald-200"
        >
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
