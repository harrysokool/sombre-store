import type { Metadata } from "next";

import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";
import { BUSINESS_DETAILS } from "@/lib/legal/business-details";
import { SHIPPING_FEE_HKD } from "@/lib/checkout/shipping";

export const metadata: Metadata = {
  title: "Shipping Policy | Sombre",
  description:
    "Where Sombre ships, what delivery costs, and how long orders take to arrive.",
};

const sections: PolicySection[] = [
  {
    eyebrow: "Section 1",
    heading: "Where we ship",
    paragraphs: [
      "Sombre currently ships within Hong Kong only.",
      "We are not able to accept orders for delivery outside Hong Kong at this time. The country field at checkout is fixed to Hong Kong for this reason.",
    ],
  },
  {
    eyebrow: "Section 2",
    heading: "Delivery charge",
    paragraphs: [
      `Delivery is a flat HK$${SHIPPING_FEE_HKD} per order, regardless of how many items you buy.`,
      "The delivery charge is shown separately in your order summary before you pay, and again on the Stripe payment page.",
      "All prices on this site are in Hong Kong Dollars (HKD).",
    ],
  },
  {
    eyebrow: "Section 3",
    heading: "Processing time",
    paragraphs: [
      `Orders are usually prepared for dispatch within ${BUSINESS_DETAILS.processingTime} after payment is confirmed.`,
      "Orders placed on weekends or public holidays are processed on the next working day.",
    ],
  },
  {
    eyebrow: "Section 4",
    heading: "Delivery time",
    paragraphs: [
      `Once dispatched, orders typically arrive within ${BUSINESS_DETAILS.deliveryTime}.`,
      `Deliveries are handled by ${BUSINESS_DETAILS.courier}.`,
      "Delivery times are estimates. Weather, public holidays, and courier delays can affect them.",
    ],
  },
  {
    eyebrow: "Section 5",
    heading: "Delivery address",
    paragraphs: [
      "Please check your address carefully before paying. We dispatch to the address you enter at checkout.",
      "If an order is returned to us because the address was incomplete or incorrect, we may need to charge delivery again to resend it.",
      "If you notice a mistake in your address, contact us as soon as possible and we will try to correct it before dispatch.",
    ],
  },
  {
    eyebrow: "Section 6",
    heading: "Lost or damaged parcels",
    paragraphs: [
      "If your parcel arrives damaged, keep the packaging and contact us with photographs so we can help.",
      `If your parcel has not arrived well beyond the estimated delivery time, contact us at ${BUSINESS_DETAILS.supportEmail} and we will follow it up with the courier.`,
    ],
  },
  {
    eyebrow: "Section 7",
    heading: "Items that become unavailable",
    paragraphs: [
      "Stock is checked when you pay. In rare cases an item may sell out between your payment and our confirmation.",
      "If we cannot fulfil an order after payment, we refund it to the original payment method. We will contact you when this happens.",
    ],
  },
];

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Shipping Policy"
      title="How your order reaches you."
      intro="This policy covers where Sombre delivers, what delivery costs, and how long you can expect to wait."
      sections={sections}
    />
  );
}
