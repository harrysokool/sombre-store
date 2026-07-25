import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

// The public storefront chrome lives here rather than in the root layout, so
// `/admin` (which sits outside this group) renders without the shop navbar,
// nav drawer, search panel, cart indicator, and footer.
export default function StorefrontLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
