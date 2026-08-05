import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type AdminBackLinkProps = {
  href: string;
  children: ReactNode;
};

/**
 * A compact, button-styled back-navigation control for admin detail pages —
 * the same pill/border/hover language as the admin's other secondary
 * buttons, rather than plain arrow-prefixed text.
 */
export function AdminBackLink({ href, children }: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 w-fit shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-4 text-xs uppercase tracking-[0.18em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:border-white/25 active:bg-white/15 sm:h-8"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {children}
    </Link>
  );
}
