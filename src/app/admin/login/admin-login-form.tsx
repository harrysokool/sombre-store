"use client";

import { useActionState } from "react";

import { signInAdmin, type AdminLoginState } from "@/app/admin/actions";

const initialState: AdminLoginState = { error: null };

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20";

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(
    signInAdmin,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
          Email
        </span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="you@example.com"
          className={inputClassName}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
          Password
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          className={inputClassName}
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.22em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign In"}
      </button>

      {state.error ? (
        <p className="text-center text-xs leading-6 text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
