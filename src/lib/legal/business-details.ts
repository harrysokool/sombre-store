// Business details rendered publicly on the store policy pages.
//
// TODO(launch): legalName, registrationNumber, and address remain placeholders
// because no legal entity is registered yet. They are intentionally NOT
// referenced by any rendered page — the policy pages use neutral wording
// instead — so these bracketed values must stay out of rendered output until
// the business is formally registered. Fill them in and wire them back into
// the policy pages at that point.
//
// TODO(launch): courier remains a placeholder because no specific courier
// partner is confirmed yet. The shipping policy uses neutral wording instead.

export const BUSINESS_DETAILS = {
  legalName: "[LEGAL BUSINESS NAME]",
  registrationNumber: "[HONG KONG BUSINESS REGISTRATION NUMBER]",
  address: "[REGISTERED BUSINESS ADDRESS]",
  supportEmail: "support@sombrebeauty.com",
  privacyEmail: "support@sombrebeauty.com",
  returnWindow: "14 days",
  returnShippingPayer: "the customer",
  processingTime: "3 to 7 business days",
  deliveryTime: "2 to 5 business days",
  courier: "[COURIER NAME]",
  refundProcessingTime: "5-10 business days",
  lastUpdated: "July 26, 2026",
} as const;
