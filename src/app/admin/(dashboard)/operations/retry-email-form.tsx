"use client";

import { useActionState } from "react";

import {
  retryOrderEmailAction,
  type EmailRetryActionState,
} from "@/app/admin/actions";

const initialState: EmailRetryActionState = {
  error: null,
  success: null,
};

export function RetryEmailForm({
  emailId,
  status,
  retryAvailable,
  retryBlocked,
}: {
  emailId: string;
  status: string;
  retryAvailable: boolean;
  retryBlocked: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    retryOrderEmailAction,
    initialState,
  );

  if (!retryAvailable) {
    return (
      <p className="text-xs leading-5 text-stone-400">
        {retryBlocked
          ? "This email no longer applies and cannot be retried."
          : status === "pending"
          ? "A send is currently in progress or requires provider verification. Retry is disabled."
          : "Delivery must be verified with the email provider before this email can be retried."}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="emailId" value={emailId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-amber-300/20 bg-amber-300/5 px-4 py-2 text-xs uppercase tracking-[0.16em] text-amber-100 transition-colors hover:border-amber-300/30 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Retrying…" : "Retry email"}
      </button>

      {state.error ? (
        <p
          role="alert"
          className="max-w-sm text-xs leading-5 text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          role="status"
          className="max-w-sm text-xs leading-5 text-emerald-300"
        >
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
