import Link from "next/link";
import { CircleUserRound, LogOut, Store } from "lucide-react";

import { signOutAdmin } from "@/app/admin/actions";

type AdminAccountPanelProps = {
  collapsed?: boolean;
  email?: string | null;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950";

export function AdminAccountPanel({
  collapsed = false,
  email,
}: AdminAccountPanelProps) {
  const accountLabel = email || "Admin";

  if (collapsed) {
    return (
      <div className="min-w-0 border-t border-white/10 pt-4">
        <span
          role="img"
          aria-label={`Signed in as ${accountLabel}`}
          title={`Signed in as ${accountLabel}`}
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-stone-300"
        >
          <CircleUserRound aria-hidden="true" className="h-5 w-5" />
        </span>

        <div className="mt-3 grid gap-2">
          <Link
            href="/"
            aria-label="View store"
            title="View store"
            className={`mx-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-stone-300 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white ${focusRing}`}
          >
            <Store aria-hidden="true" className="h-5 w-5" />
          </Link>

          <form action={signOutAdmin}>
            <button
              type="submit"
              aria-label="Sign Out"
              title="Sign Out"
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-stone-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white ${focusRing}`}
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 border-t border-white/10 pt-5">
      <div className="min-w-0 space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
          Signed in as
        </p>
        <p className="min-w-0 break-words text-xs leading-5 text-stone-300 [overflow-wrap:anywhere]">
          {accountLabel}
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
