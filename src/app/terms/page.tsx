import type { Metadata } from "next";

import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";
import { BUSINESS_DETAILS } from "@/lib/legal/business-details";

export const metadata: Metadata = {
  title: "Terms and Conditions | Sombre",
  description:
    "The terms that apply when you buy from the Sombre online store.",
};

const sections: PolicySection[] = [
  {
    eyebrow: "Section 1",
    heading: "About these terms",
    paragraphs: [
      `This website is operated by ${BUSINESS_DETAILS.legalName}. By browsing this site or placing an order, you agree to these terms.`,
      "If you do not agree with these terms, please do not use the site.",
    ],
  },
  {
    eyebrow: "Section 2",
    heading: "Products and pricing",
    paragraphs: [
      "All prices are shown in Hong Kong Dollars (HKD) and include any applicable charges shown at checkout.",
      "Prices are confirmed on our server when you check out, so the amount you are charged always reflects our current listed price, not the price stored in your browser.",
      "We try to describe and photograph products accurately, but colours and packaging may vary slightly from what appears on screen.",
      "We may change prices or withdraw products at any time before you place an order.",
    ],
  },
  {
    eyebrow: "Section 3",
    heading: "Orders and acceptance",
    paragraphs: [
      "Adding items to your cart does not reserve them. Stock is confirmed at the moment you pay.",
      "Your order is accepted once payment has been confirmed and we have created your order record. You will see a confirmation on screen after payment.",
      "We may decline or cancel an order if an item is unavailable, if there is an error in the listing, or if we suspect fraudulent use of the site.",
    ],
  },
  {
    eyebrow: "Section 4",
    heading: "Stock availability",
    paragraphs: [
      "Stock is checked at checkout and again when your payment is confirmed.",
      "If an item sells out between those two points, we cannot fulfil that order. In that case we refund the payment to the original payment method and contact you.",
    ],
  },
  {
    eyebrow: "Section 5",
    heading: "Payment",
    paragraphs: [
      "Payments are processed by Stripe on a Stripe-hosted checkout page. Sombre does not receive or store your full card details.",
      "By paying, you confirm that you are authorised to use the payment method provided.",
    ],
  },
  {
    eyebrow: "Section 6",
    heading: "Delivery, returns, and refunds",
    paragraphs: [
      "Delivery is covered by our Shipping Policy, including where we ship, delivery charges, and estimated timings.",
      "Returns and refunds are covered by our Return and Refund Policy.",
      "Both policies form part of these terms.",
    ],
  },
  {
    eyebrow: "Section 7",
    heading: "Using this site",
    paragraphs: [
      "You agree not to misuse this site, including attempting to disrupt it, access it in an automated or abusive way, or interfere with other customers.",
      "All text, images, and branding on this site belong to Sombre or the respective brand owners and may not be copied without permission.",
      "Brand names and product names are the trademarks of their respective owners. Sombre is a retailer and is not the manufacturer of the products it sells.",
    ],
  },
  {
    eyebrow: "Section 8",
    heading: "Liability",
    paragraphs: [
      "We take care to keep the site accurate and available, but we do not guarantee that it will always be uninterrupted or error free.",
      "Our liability for any order is limited to the amount you paid for that order.",
      "Nothing in these terms limits liability that cannot be limited under Hong Kong law, including liability for death or personal injury caused by negligence.",
    ],
  },
  {
    eyebrow: "Section 9",
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of the Hong Kong Special Administrative Region.",
      "Any dispute relating to these terms or to an order will be subject to the exclusive jurisdiction of the Hong Kong courts.",
    ],
  },
  {
    eyebrow: "Section 10",
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms from time to time. The version shown on this page at the time you place an order is the version that applies to that order.",
      `If you have questions about these terms, contact us at ${BUSINESS_DETAILS.supportEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms and Conditions"
      title="The terms of buying from Sombre."
      intro="These terms apply when you browse this site and when you buy from the Sombre online store."
      sections={sections}
    />
  );
}
