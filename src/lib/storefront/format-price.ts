const hkdFormatter = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  currencyDisplay: "symbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(price: number | string) {
  return hkdFormatter.format(Number(price));
}
