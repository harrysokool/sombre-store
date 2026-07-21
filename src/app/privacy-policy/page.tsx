import type { Metadata } from "next";

import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";
import { BUSINESS_DETAILS } from "@/lib/legal/business-details";

export const metadata: Metadata = {
  title: "Privacy Policy | Sombre",
  description:
    "How Sombre collects, uses, and protects your personal information.",
};

const sections: PolicySection[] = [
  {
    eyebrow: "Section 1",
    heading: "What we collect",
    paragraphs: [
      "When you place an order we collect your name, email address, phone number if you provide one, and the shipping address you enter at checkout.",
      "We also keep a record of what you ordered, the amount paid, and the delivery details for that order.",
      "You do not need an account to shop with Sombre. We do not ask for any information beyond what is needed to process and deliver your order.",
    ],
  },
  {
    eyebrow: "Section 2",
    heading: "How we use it",
    paragraphs: [
      "We use your information to process your order, arrange delivery, and contact you about that order if something needs to be confirmed.",
      "We use your email address to send order-related messages. We do not send marketing email unless you have asked us to.",
      "We do not sell your personal information, and we do not share it with third parties for their own marketing.",
    ],
  },
  {
    eyebrow: "Section 3",
    heading: "Payment information",
    paragraphs: [
      "Payments are handled by Stripe on a Stripe-hosted checkout page. Your card details are entered directly with Stripe.",
      "Sombre never receives or stores your full card number, expiry date, or security code.",
      "Stripe processes your payment information under its own privacy policy and security standards.",
    ],
  },
  {
    eyebrow: "Section 4",
    heading: "Where your information is stored",
    paragraphs: [
      "Order records are stored in our database, which is hosted by Supabase. Access to order data is restricted to Sombre.",
      "Stripe and Supabase may store and process data outside Hong Kong. By placing an order you agree to this transfer for the purpose of completing your purchase.",
      "We keep order records for as long as we need them for accounting, tax, and customer service purposes.",
    ],
  },
  {
    eyebrow: "Section 5",
    heading: "Cookies and browser storage",
    paragraphs: [
      "Your shopping cart is saved in your own browser using local storage. It stays on your device and is not sent to us until you check out.",
      "Stripe may set cookies that are necessary for secure payment processing.",
      "Sombre does not currently run advertising trackers or third-party analytics on this site.",
    ],
  },
  {
    eyebrow: "Section 6",
    heading: "Your rights",
    paragraphs: [
      "Under the Hong Kong Personal Data (Privacy) Ordinance you may request a copy of the personal data we hold about you, and ask us to correct it if it is wrong.",
      "You may also ask us to delete your personal data, unless we are required to keep it for legal or accounting reasons.",
      `To make a request, contact us at ${BUSINESS_DETAILS.privacyEmail}. We may need to confirm your identity before we act on it.`,
    ],
  },
  {
    eyebrow: "Section 7",
    heading: "Changes to this policy",
    paragraphs: [
      "We may update this policy as the store changes. The date at the top of this page shows when it was last revised.",
      "If we make a significant change to how we handle personal information, we will make that clear on this page.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy Policy"
      title="How we handle your information."
      intro="This policy explains what personal information Sombre collects when you shop with us, how it is used, and the choices you have."
      sections={sections}
    />
  );
}
