import type { Metadata } from "next";
import type { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo/metadata";

// The sign-in form is publicly reachable by design, so unlike the dashboard it
// cannot rely on an auth gate to stay out of an index. The robots rules are the
// only thing keeping it unlisted.
export const metadata: Metadata = privatePageMetadata("Admin sign in");

// Standalone sign-in frame: no storefront navbar or footer, and none of the
// authenticated dashboard navigation either, since nobody is signed in yet.
export default function AdminLoginLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
