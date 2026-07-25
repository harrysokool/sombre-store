import { AppShell } from "@/components/layout/app-shell";
import { NotFoundContent } from "@/components/shared/not-found-content";

// Root boundary for URLs that match no route at all. It sits above the
// `(storefront)` group, so it renders its own public shell.
export default function NotFound() {
  return (
    <AppShell>
      <NotFoundContent />
    </AppShell>
  );
}
