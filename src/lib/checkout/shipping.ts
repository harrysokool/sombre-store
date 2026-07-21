export const SHIPPING_COUNTRY = "Hong Kong";
export const SHIPPING_FEE_HKD = 50;
export const SHIPPING_FEE_HKD_CENTS = SHIPPING_FEE_HKD * 100;

export function isSupportedShippingCountry(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase() === SHIPPING_COUNTRY.toLowerCase()
  );
}

export function getCheckoutTotal(subtotal: number) {
  return subtotal + SHIPPING_FEE_HKD;
}
