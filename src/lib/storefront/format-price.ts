export function formatPrice(price: number | string) {
  return `HK$${Number(price).toFixed(2)}`;
}
