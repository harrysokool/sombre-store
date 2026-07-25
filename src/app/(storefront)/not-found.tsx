import { NotFoundContent } from "@/components/shared/not-found-content";

// Boundary for notFound() thrown inside the storefront, for example an unknown
// product slug. The group layout already supplies the public shell.
export default function StorefrontNotFound() {
  return <NotFoundContent />;
}
