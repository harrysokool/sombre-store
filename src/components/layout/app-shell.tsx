import type { ReactNode } from "react";

import { AnnouncementBannerSlot } from "@/components/layout/announcement-banner-slot";
import { Footer } from "@/components/layout/footer";
import { NavbarSlot } from "@/components/layout/navbar-slot";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-950 text-stone-100">
      <AnnouncementBannerSlot />
      <NavbarSlot />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
