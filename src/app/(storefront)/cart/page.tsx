import type { Metadata } from "next";

import { CartPageContent } from "@/components/cart/cart-page-content";
import { privatePageMetadata } from "@/lib/seo/metadata";

// A per-visitor transactional page with nothing stable to index.
export const metadata: Metadata = privatePageMetadata("Cart");

export default function CartPage() {
  return <CartPageContent />;
}
