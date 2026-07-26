import Link from "next/link";

import { signOutAdmin } from "@/app/admin/actions";

type AdminAccountPanelProps = {
  email?: string | null;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

export function AdminAccountPanel({ email }: AdminAccountPanelProps) {
  return (
    <div className="min-w-0 border-t border-white/10 pt-5">
      <div className="min-w-0 space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
          Signed in as
        </p>
        <p className="min-w-0 break-words text-xs leading-5 text-stone-300 [overflow-wrap:anywhere]">
          {email || "Admin"}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        <Link
          href="/"
          className={`inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.16em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white ${focusRing}`}
        >
          View store
        </Link>

        <form action={signOutAdmin}>
          <button
            type="submit"
            className={`inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.16em] text-stone-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white ${focusRing}`}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
