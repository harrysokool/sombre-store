export function formatPrice(price: number | string) {
  return `$${Number(price).toFixed(2)}`;
}
