"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementActionState,
} from "@/app/admin/announcements/actions";
import { AdminInfoTooltip } from "@/components/admin/admin-info-tooltip";
import { useCheckboxResetGuard } from "@/hooks/use-checkbox-reset-guard";
import { ANNOUNCEMENT_TEXT_LIMITS } from "@/lib/admin/announcement-content-rules";

const fieldLabelClassName =
  "inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-stone-400";

const initialActionState: AnnouncementActionState = {
  error: null,
  success: null,
  announcementId: null,
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-stone-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

type AnnouncementFormProps = {
  mode: "create" | "edit";
  announcementId?: string;
  prefixText?: string;
  highlightText?: string;
  suffixText?: string;
  linkLabel?: string;
  linkHref?: string;
  isActive?: boolean;
};

export function AnnouncementForm({
  mode,
  announcementId,
  prefixText = "",
  highlightText = "",
  suffixText = "",
  linkLabel = "",
  linkHref = "",
  isActive = false,
}: AnnouncementFormProps) {
  const [state, formAction, isPending] = useActionState(
    mode === "create" ? createAnnouncementAction : updateAnnouncementAction,
    initialActionState,
  );
  // Controlled throughout: React resets the form element once its action
  // completes, which would discard the administrator's edits on a refused save
  // and make them retype the correction.
  const [prefix, setPrefix] = useState(prefixText);
  const [highlight, setHighlight] = useState(highlightText);
  const [suffix, setSuffix] = useState(suffixText);
  const [label, setLabel] = useState(linkLabel);
  const [href, setHref] = useState(linkHref);
  const [active, setActive] = useState(isActive);
  const activeRef = useCheckboxResetGuard(active);

  const trimmedPrefix = prefix.trim();
  const trimmedHighlight = highlight.trim();
  const trimmedSuffix = suffix.trim();
  const hasPreview = Boolean(
    trimmedPrefix || trimmedHighlight || trimmedSuffix,
  );

  return (
    <form action={formAction} className="space-y-8">
      {announcementId ? (
        <input type="hidden" name="announcementId" value={announcementId} />
      ) : null}

      <section
        aria-label="Announcement preview"
        className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:px-6"
      >
        <h2 className="text-xs uppercase tracking-[0.24em] text-stone-400">
          Preview
        </h2>
        {hasPreview ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-100 [overflow-wrap:anywhere]">
            {trimmedPrefix ? (
              <span className="break-words">{trimmedPrefix}</span>
            ) : null}
            {trimmedHighlight ? (
              <span className="inline-flex items-center break-words rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-medium text-stone-100">
                {trimmedHighlight}
              </span>
            ) : null}
            {trimmedSuffix ? (
              <span className="break-words">{trimmedSuffix}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-stone-400">
            Your announcement preview will appear here.
          </p>
        )}
      </section>

      <section className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6">
        <div className="space-y-2 sm:col-span-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="prefixText">Prefix</label>
            <AdminInfoTooltip label="More information about Prefix">
              Text shown before the highlighted pill. Leave empty to begin
              with the highlight.
            </AdminInfoTooltip>
          </span>
          <input
            id="prefixText"
            type="text"
            name="prefixText"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            maxLength={ANNOUNCEMENT_TEXT_LIMITS.prefixText}
            disabled={isPending}
            placeholder="Use code"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="highlightText">Highlight</label>
            <AdminInfoTooltip label="More information about Highlight">
              Shown as a pill. Usually used for a coupon code.
            </AdminInfoTooltip>
          </span>
          <input
            id="highlightText"
            type="text"
            name="highlightText"
            value={highlight}
            onChange={(event) => setHighlight(event.target.value)}
            maxLength={ANNOUNCEMENT_TEXT_LIMITS.highlightText}
            disabled={isPending}
            placeholder="HAPPY2026"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="suffixText">Suffix</label>
            <AdminInfoTooltip label="More information about Suffix">
              Text shown after the highlighted pill. At least one of Prefix,
              Highlight, or Suffix is required.
            </AdminInfoTooltip>
          </span>
          <input
            id="suffixText"
            type="text"
            name="suffixText"
            value={suffix}
            onChange={(event) => setSuffix(event.target.value)}
            maxLength={ANNOUNCEMENT_TEXT_LIMITS.suffixText}
            disabled={isPending}
            placeholder="for up to 60% off selected products"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="linkLabel">Link label</label>
          </span>
          <input
            id="linkLabel"
            type="text"
            name="linkLabel"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={ANNOUNCEMENT_TEXT_LIMITS.linkLabel}
            disabled={isPending}
            placeholder="Shop Now"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <span className={fieldLabelClassName}>
            <label htmlFor="linkHref">Link path</label>
            <AdminInfoTooltip label="More information about Link path">
              An internal path beginning with a single slash, such as /shop.
              Complete both link fields or leave both empty.
            </AdminInfoTooltip>
          </span>
          <input
            id="linkHref"
            type="text"
            name="linkHref"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            maxLength={ANNOUNCEMENT_TEXT_LIMITS.linkHref}
            disabled={isPending}
            placeholder="/shop"
            spellCheck={false}
            className={inputClassName}
          />
        </div>

        <div className="flex items-start gap-3 sm:col-span-2">
          <input
            ref={activeRef}
            id="isActive"
            type="checkbox"
            name="isActive"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            disabled={isPending}
            className="mt-0.5 size-4 rounded border-white/20 bg-transparent accent-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-stone-200">
            <label htmlFor="isActive">Active</label>
          </span>
        </div>
      </section>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create announcement"
              : "Save changes"}
        </button>
        <Link href="/admin/announcements" className={secondaryButtonClassName}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
