import type { Metadata } from "next";

import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";
import { BUSINESS_DETAILS } from "@/lib/legal/business-details";

export const metadata: Metadata = {
  title: "Return and Refund Policy | Sombre",
  description:
    "How to return an order to Sombre and how refunds are processed.",
};

const sections: PolicySection[] = [
  {
    eyebrow: "Section 1",
    heading: "Return window",
    paragraphs: [
      `You may request a return within ${BUSINESS_DETAILS.returnWindow} of receiving your order.`,
      "Requests made after that period cannot normally be accepted, unless the item is faulty.",
    ],
  },
  {
    eyebrow: "Section 2",
    heading: "Condition of returned items",
    paragraphs: [
      "Fragrance and body care are personal items, so returned products must be unused and in their original sealed packaging.",
      "Items that have been opened, sprayed, or used cannot be returned for hygiene reasons, unless they are faulty or were sent in error.",
      "Please include all original packaging, boxes, and seals with your return.",
    ],
  },
  {
    eyebrow: "Section 3",
    heading: "How to request a return",
    paragraphs: [
      `Email ${BUSINESS_DETAILS.supportEmail} with your order number and the item you would like to return.`,
      "We will confirm whether the return can be accepted and tell you where to send it before you post anything.",
      "Please do not send items back before contacting us, as we may not be able to process them.",
    ],
  },
  {
    eyebrow: "Section 4",
    heading: "Return shipping cost",
    paragraphs: [
      `Return shipping is paid by ${BUSINESS_DETAILS.returnShippingPayer}.`,
      "If an item is faulty, was damaged in transit, or was not what you ordered, we cover the cost of returning it.",
      "We recommend using a tracked service, as we cannot refund a return that does not reach us.",
    ],
  },
  {
    eyebrow: "Section 5",
    heading: "How refunds are issued",
    paragraphs: [
      "Approved refunds are returned to the original payment method through Stripe. We cannot refund to a different card or account.",
      `Once we have received and checked the returned item, refunds are usually processed within ${BUSINESS_DETAILS.refundProcessingTime}.`,
      "Your bank or card issuer may take additional time to show the refund on your statement.",
      "The original delivery charge is refunded only when the return is our fault, for example a faulty or incorrect item.",
    ],
  },
  {
    eyebrow: "Section 6",
    heading: "Faulty, damaged, or incorrect items",
    paragraphs: [
      "If your order arrives damaged, faulty, or is not what you ordered, contact us with your order number and photographs.",
      "We will arrange a replacement or a full refund, including delivery charges, at no cost to you.",
      "Nothing in this policy affects your statutory rights under Hong Kong law.",
    ],
  },
  {
    eyebrow: "Section 7",
    heading: "Cancellations and unfulfilled orders",
    paragraphs: [
      "Orders are sent for dispatch quickly, so we cannot guarantee that a cancellation request can be actioned. Contact us as soon as possible and we will do what we can.",
      "If an item sells out after your payment is taken and we cannot fulfil your order, we refund that order to the original payment method automatically and contact you to explain.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Return and Refund Policy"
      title="Returns, refunds, and faulty items."
      intro="This policy explains when you can return an order to Sombre, what condition items need to be in, and how refunds are processed."
      sections={sections}
    />
  );
}
