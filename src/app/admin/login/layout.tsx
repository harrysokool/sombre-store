import type { ReactNode } from "react";

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
