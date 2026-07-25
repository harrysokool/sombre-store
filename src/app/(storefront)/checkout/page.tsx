import type { Metadata } from "next";

import { CheckoutPageContent } from "@/components/cart/checkout-page-content";
import { privatePageMetadata } from "@/lib/seo/metadata";

// Transactional, per-visitor, and carries customer form fields.
export const metadata: Metadata = privatePageMetadata("Checkout");

export default function CheckoutPage() {
  return <CheckoutPageContent />;
}
