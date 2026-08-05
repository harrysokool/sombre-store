"use client";

import { useActionState, useState } from "react";

import {
  updateAnnouncementSettingsAction,
  type AnnouncementSettingsActionState,
} from "@/app/admin/announcements/actions";
import {
  MAX_ROTATION_INTERVAL_SECONDS,
  MIN_ROTATION_INTERVAL_SECONDS,
} from "@/lib/admin/announcement-settings-rules";
import { useCheckboxResetGuard } from "@/hooks/use-checkbox-reset-guard";

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
  const toggleRef = useCheckboxResetGuard(enabled);

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
          <span className="text-sm text-stone-200">
            Show the announcement banner
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-stone-400">
            Rotation interval
          </span>
          <input
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
            {MIN_ROTATION_INTERVAL_SECONDS}&ndash;
            {MAX_ROTATION_INTERVAL_SECONDS} seconds
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

      {/* No success message on a successful save: the saved toggle and
          interval values are the confirmation. */}

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
