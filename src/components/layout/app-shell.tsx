import type { ReactNode } from "react";

import { AnnouncementBannerSlot } from "@/components/layout/announcement-banner-slot";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-950 text-stone-100">
      <AnnouncementBannerSlot />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
