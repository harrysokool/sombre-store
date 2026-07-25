import {
  formatHkdCentsForDatabase,
  parseHkdDecimalToCents,
  parsePercentageToBasisPoints,
} from "@/lib/checkout/money";

type DecimalValue = number | string | null;

export type SavedOrderDiscountFields = {
  coupon_code: string | null;
  original_subtotal: DecimalValue;
  discount_total: DecimalValue;
  subtotal: number | string;
  shipping_fee: number | string;
  total: number | string;
};

export type SavedOrderItemDiscountFields = {
  original_unit_price: DecimalValue;
  discount_percent: DecimalValue;
  unit_price: number | string;
  quantity: number;
  original_line_total: DecimalValue;
  discount_amount: DecimalValue;
  discounted_line_total: DecimalValue;
};

export type DiscountedOrderDisplay = {
  couponCode: string;
  originalSubtotal: string;
  discountTotal: string;
  discountedSubtotal: string;
  shipping: string;
  total: string;
};

export type DiscountedOrderItemDisplay = {
  originalUnitPrice: string;
  discountPercent: string;
  finalUnitPrice: string;
  originalLineTotal: string;
  lineDiscount: string;
  finalLineTotal: string;
};

function decimalToCents(value: DecimalValue) {
  if (value === null) {
    return null;
  }

  try {
    return parseHkdDecimalToCents(String(value));
  } catch {
    return null;
  }
}

function decimalToBasisPoints(value: DecimalValue) {
  if (value === null) {
    return null;
  }

  try {
    return parsePercentageToBasisPoints(String(value));
  } catch {
    return null;
  }
}

function formatPercentage(basisPoints: number) {
  const wholePart = Math.floor(basisPoints / 100);
  const fractionalPart = String(basisPoints % 100).padStart(2, "0");

  return fractionalPart === "00"
    ? `${wholePart}%`
    : `${wholePart}.${fractionalPart.replace(/0$/, "")}%`;
}

export function getDiscountedOrderDisplay(
  order: SavedOrderDiscountFields,
): DiscountedOrderDisplay | null {
  const couponCode = order.coupon_code?.trim() ?? "";
  const originalSubtotalCents = decimalToCents(order.original_subtotal);
  const discountTotalCents = decimalToCents(order.discount_total);
  const discountedSubtotalCents = decimalToCents(order.subtotal);
  const shippingCents = decimalToCents(order.shipping_fee);
  const totalCents = decimalToCents(order.total);

  if (
    !couponCode ||
    originalSubtotalCents === null ||
    discountTotalCents === null ||
    discountTotalCents <= 0 ||
    discountedSubtotalCents === null ||
    shippingCents === null ||
    totalCents === null ||
    originalSubtotalCents - discountTotalCents !==
      discountedSubtotalCents ||
    discountedSubtotalCents + shippingCents !== totalCents
  ) {
    return null;
  }

  return {
    couponCode,
    originalSubtotal: formatHkdCentsForDatabase(
      originalSubtotalCents,
    ),
    discountTotal: formatHkdCentsForDatabase(discountTotalCents),
    discountedSubtotal: formatHkdCentsForDatabase(
      discountedSubtotalCents,
    ),
    shipping: formatHkdCentsForDatabase(shippingCents),
    total: formatHkdCentsForDatabase(totalCents),
  };
}

export function getDiscountedOrderItemDisplay(
  item: SavedOrderItemDiscountFields,
): DiscountedOrderItemDisplay | null {
  const originalUnitCents = decimalToCents(item.original_unit_price);
  const discountBasisPoints = decimalToBasisPoints(
    item.discount_percent,
  );
  const finalUnitCents = decimalToCents(item.unit_price);
  const originalLineCents = decimalToCents(item.original_line_total);
  const lineDiscountCents = decimalToCents(item.discount_amount);
  const finalLineCents = decimalToCents(item.discounted_line_total);

  if (
    originalUnitCents === null ||
    discountBasisPoints === null ||
    finalUnitCents === null ||
    originalLineCents === null ||
    lineDiscountCents === null ||
    finalLineCents === null ||
    !Number.isSafeInteger(item.quantity) ||
    item.quantity <= 0
  ) {
    return null;
  }

  const expectedUnitDiscount = Number(
    (BigInt(originalUnitCents) * BigInt(discountBasisPoints) +
      BigInt(5_000)) /
      BigInt(10_000),
  );

  if (
    originalUnitCents - expectedUnitDiscount !== finalUnitCents ||
    originalUnitCents * item.quantity !== originalLineCents ||
    expectedUnitDiscount * item.quantity !== lineDiscountCents ||
    finalUnitCents * item.quantity !== finalLineCents ||
    originalLineCents - lineDiscountCents !== finalLineCents
  ) {
    return null;
  }

  return {
    originalUnitPrice: formatHkdCentsForDatabase(originalUnitCents),
    discountPercent: formatPercentage(discountBasisPoints),
    finalUnitPrice: formatHkdCentsForDatabase(finalUnitCents),
    originalLineTotal: formatHkdCentsForDatabase(originalLineCents),
    lineDiscount: formatHkdCentsForDatabase(lineDiscountCents),
    finalLineTotal: formatHkdCentsForDatabase(finalLineCents),
  };
}
