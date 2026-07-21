// Placeholder business details rendered publicly on the store policy pages.
//
// TODO(launch): every value below is a placeholder and MUST be replaced with
// real Sombre business information before the store accepts real orders.
// Nothing here is invented on purpose — the bracketed text is meant to be
// obvious if it ever reaches production by mistake.

export const BUSINESS_DETAILS = {
  legalName: "[LEGAL BUSINESS NAME]",
  registrationNumber: "[HONG KONG BUSINESS REGISTRATION NUMBER]",
  address: "[REGISTERED BUSINESS ADDRESS]",
  supportEmail: "[SUPPORT EMAIL ADDRESS]",
  privacyEmail: "[PRIVACY CONTACT EMAIL ADDRESS]",
  returnWindow: "[RETURN WINDOW, e.g. 14 DAYS]",
  returnShippingPayer: "[WHO PAYS RETURN SHIPPING]",
  processingTime: "[ORDER PROCESSING TIME, e.g. 1-2 BUSINESS DAYS]",
  deliveryTime: "[DELIVERY TIME, e.g. 2-4 BUSINESS DAYS]",
  courier: "[COURIER NAME]",
  refundProcessingTime: "[REFUND PROCESSING TIME, e.g. 5-10 BUSINESS DAYS]",
  lastUpdated: "[LAST UPDATED DATE]",
} as const;
