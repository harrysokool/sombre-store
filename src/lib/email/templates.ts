import { BUSINESS_DETAILS } from "@/lib/legal/business-details";
import { formatPrice } from "@/lib/storefront/format-price";
import {
  getDiscountedOrderDisplay,
  getDiscountedOrderItemDisplay,
} from "@/lib/orders/discount-snapshots";

export type OrderEmailItem = {
  product_name: string;
  size_label: string | null;
  unit_price: number | string;
  original_unit_price: number | string | null;
  discount_percent: number | string | null;
  quantity: number;
  original_line_total: number | string | null;
  discount_amount: number | string | null;
  discounted_line_total: number | string | null;
};

export type OrderEmailOrder = {
  id: string;
  created_at: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  district: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  coupon_code: string | null;
  original_subtotal: number | string | null;
  discount_total: number | string | null;
  subtotal: number | string;
  shipping_fee: number | string;
  total: number | string;
  courier: string | null;
  tracking_number: string | null;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

// Order details come from customer input, so every value interpolated into the
// HTML body is escaped. Without this a name or address could inject markup.
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getLineTotal(item: OrderEmailItem) {
  return Number(item.unit_price) * item.quantity;
}

// Hong Kong addresses lead with the street line and are identified by district.
// A postal code is optional, so empty parts are dropped rather than printed.
function getAddressLines(order: OrderEmailOrder) {
  const cityLine = [order.city, order.postal_code]
    .filter((part) => Boolean(part))
    .join(", ");

  return [
    order.address_line_1,
    order.address_line_2,
    order.district,
    cityLine,
    order.country,
  ].filter((line): line is string => Boolean(line));
}

function getContactLines(order: OrderEmailOrder) {
  return [order.customer_name, order.customer_email, order.customer_phone]
    .filter((line): line is string => Boolean(line));
}

function renderItemsHtml(items: OrderEmailItem[]) {
  if (items.length === 0) {
    return `<tr><td style="padding:12px 0;color:#57534e;">No items recorded.</td></tr>`;
  }

  return items
    .map((item) => {
      const size = item.size_label
        ? `<div style="color:#78716c;font-size:13px;">${escapeHtml(item.size_label)}</div>`
        : "";
      const discount = getDiscountedOrderItemDisplay(item);
      const pricing = discount
        ? `<div style="color:#78716c;font-size:13px;">Quantity ${item.quantity}</div>
    <div style="color:#78716c;font-size:13px;">Original unit ${formatPrice(discount.originalUnitPrice)} · ${escapeHtml(discount.discountPercent)} off</div>
    <div style="color:#78716c;font-size:13px;">Final unit ${formatPrice(discount.finalUnitPrice)} · Line discount −${formatPrice(discount.lineDiscount)}</div>`
        : `<div style="color:#78716c;font-size:13px;">Quantity ${item.quantity} &times; ${formatPrice(item.unit_price)}</div>`;
      const lineTotal = discount
        ? discount.finalLineTotal
        : getLineTotal(item);

      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid #e7e5e4;">
    <div style="color:#1c1917;">${escapeHtml(item.product_name)}</div>
    ${size}
    ${pricing}
  </td>
  <td style="padding:12px 0;border-bottom:1px solid #e7e5e4;text-align:right;color:#1c1917;white-space:nowrap;">
    ${formatPrice(lineTotal)}
  </td>
</tr>`;
    })
    .join("\n");
}

function renderItemsText(items: OrderEmailItem[]) {
  if (items.length === 0) {
    return "No items recorded.";
  }

  return items
    .map((item) => {
      const size = item.size_label ? ` (${item.size_label})` : "";
      const discount = getDiscountedOrderItemDisplay(item);

      if (!discount) {
        return `- ${item.product_name}${size} x${item.quantity} — ${formatPrice(getLineTotal(item))}`;
      }

      return `- ${item.product_name}${size} x${item.quantity} — ${formatPrice(discount.finalLineTotal)}
  Original unit: ${formatPrice(discount.originalUnitPrice)}
  Discount: ${discount.discountPercent} (−${formatPrice(discount.lineDiscount)} line)
  Final unit: ${formatPrice(discount.finalUnitPrice)}`;
    })
    .join("\n");
}

function renderTotalsHtml(order: OrderEmailOrder) {
  const row = (label: string, value: string, isStrong = false) => `<tr>
  <td style="padding:6px 0;color:${isStrong ? "#1c1917" : "#57534e"};${isStrong ? "font-weight:600;" : ""}">${label}</td>
  <td style="padding:6px 0;text-align:right;color:#1c1917;${isStrong ? "font-weight:600;" : ""}">${value}</td>
</tr>`;

  const discount = getDiscountedOrderDisplay(order);

  if (!discount) {
    return [
      row("Subtotal", formatPrice(order.subtotal)),
      row("Shipping", formatPrice(order.shipping_fee)),
      row("Total", formatPrice(order.total), true),
    ].join("\n");
  }

  return [
    row("Original subtotal", formatPrice(discount.originalSubtotal)),
    row("Coupon", escapeHtml(discount.couponCode)),
    row("Discount", `−${formatPrice(discount.discountTotal)}`),
    row(
      "Discounted subtotal",
      formatPrice(discount.discountedSubtotal),
    ),
    row("Shipping", formatPrice(discount.shipping)),
    row("Total paid", formatPrice(discount.total), true),
  ].join("\n");
}

function renderTotalsText(order: OrderEmailOrder) {
  const discount = getDiscountedOrderDisplay(order);

  if (!discount) {
    return [
      `Subtotal: ${formatPrice(order.subtotal)}`,
      `Shipping: ${formatPrice(order.shipping_fee)}`,
      `Total: ${formatPrice(order.total)}`,
    ].join("\n");
  }

  return [
    `Original subtotal: ${formatPrice(discount.originalSubtotal)}`,
    `Coupon: ${discount.couponCode}`,
    `Discount: −${formatPrice(discount.discountTotal)}`,
    `Discounted subtotal: ${formatPrice(discount.discountedSubtotal)}`,
    `Shipping: ${formatPrice(discount.shipping)}`,
    `Total paid: ${formatPrice(discount.total)}`,
  ].join("\n");
}

function renderBlockHtml(title: string, lines: string[]) {
  return `<h2 style="margin:28px 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#78716c;">${title}</h2>
<div style="color:#1c1917;line-height:1.7;">${lines.map((line) => escapeHtml(line)).join("<br />")}</div>`;
}

function renderShell(heading: string, intro: string, body: string) {
  return `<div style="margin:0;padding:24px;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
    <div style="font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#a8a29e;">Sombre</div>
    <h1 style="margin:12px 0 8px;font-size:24px;font-weight:600;color:#1c1917;">${heading}</h1>
    <p style="margin:0 0 8px;color:#57534e;line-height:1.7;">${intro}</p>
    ${body}
  </div>
</div>`;
}

function renderOrderSummaryHtml(order: OrderEmailOrder, items: OrderEmailItem[]) {
  return `<h2 style="margin:28px 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#78716c;">Order</h2>
<div style="color:#57534e;line-height:1.7;">Order number ${escapeHtml(order.id)}</div>

<table style="width:100%;border-collapse:collapse;margin-top:16px;">${renderItemsHtml(items)}</table>
<table style="width:100%;border-collapse:collapse;margin-top:16px;">${renderTotalsHtml(order)}</table>

${renderBlockHtml("Delivery address", getAddressLines(order))}
${renderBlockHtml("Contact details", getContactLines(order))}`;
}

function renderOrderSummaryText(order: OrderEmailOrder, items: OrderEmailItem[]) {
  return `Order number: ${order.id}

Items
${renderItemsText(items)}

${renderTotalsText(order)}

Delivery address
${getAddressLines(order).join("\n")}

Contact details
${getContactLines(order).join("\n")}`;
}

export function renderCustomerOrderConfirmation(
  order: OrderEmailOrder,
  items: OrderEmailItem[],
): RenderedEmail {
  const intro =
    "Thank you for your order. We have received your payment and are preparing your parcel. Your order details are below.";

  return {
    subject: `Your Sombre order is confirmed (${order.id})`,
    html: renderShell(
      "Order confirmed",
      intro,
      renderOrderSummaryHtml(order, items),
    ),
    text: `Order confirmed

${intro}

${renderOrderSummaryText(order, items)}`,
  };
}

export function renderSellerOrderNotification(
  order: OrderEmailOrder,
  items: OrderEmailItem[],
): RenderedEmail {
  const intro = `A new order has been paid and confirmed. Ship to the address below.`;

  return {
    subject: `New Sombre order — ${formatPrice(order.total)} (${order.id})`,
    html: renderShell(
      "New order received",
      intro,
      renderOrderSummaryHtml(order, items),
    ),
    text: `New order received

${intro}

${renderOrderSummaryText(order, items)}`,
  };
}

function renderShippingDetailsHtml(order: OrderEmailOrder) {
  return renderBlockHtml("Shipment details", [
    `Courier: ${order.courier ?? "-"}`,
    `Tracking number: ${order.tracking_number ?? "-"}`,
  ]);
}

function renderShippingDetailsText(order: OrderEmailOrder) {
  return `Courier: ${order.courier ?? "-"}
Tracking number: ${order.tracking_number ?? "-"}`;
}

export function renderCustomerShippingConfirmation(
  order: OrderEmailOrder,
  items: OrderEmailItem[],
): RenderedEmail {
  const courier = order.courier ?? "our courier";
  const introText = `Your order is on its way with ${courier}. Use the tracking number below to follow its progress. Questions about your delivery? Email ${BUSINESS_DETAILS.supportEmail}.`;
  // renderShell inserts the intro directly into the HTML body, so the courier
  // name (admin-entered, not otherwise escaped) needs its own escaped copy.
  const introHtml = `Your order is on its way with ${escapeHtml(courier)}. Use the tracking number below to follow its progress. Questions about your delivery? Email ${escapeHtml(BUSINESS_DETAILS.supportEmail)}.`;

  return {
    subject: `Your Sombre order has shipped (${order.id})`,
    html: renderShell(
      "Your order has shipped",
      introHtml,
      `${renderShippingDetailsHtml(order)}
${renderOrderSummaryHtml(order, items)}`,
    ),
    text: `Your order has shipped

${introText}

${renderShippingDetailsText(order)}

${renderOrderSummaryText(order, items)}`,
  };
}

export function renderCustomerRefundPending(
  order: OrderEmailOrder,
  items: OrderEmailItem[],
): RenderedEmail {
  const intro =
    "Your payment was successful, but we could not fulfil your order because an item sold out before we could reserve it. We are refunding you in full. Refunds usually take a few business days to appear, depending on your bank.";

  return {
    subject: `Your Sombre order could not be fulfilled — refund in progress (${order.id})`,
    html: renderShell(
      "Refund in progress",
      intro,
      renderOrderSummaryHtml(order, items),
    ),
    text: `Refund in progress

${intro}

${renderOrderSummaryText(order, items)}`,
  };
}

export function renderCustomerRefunded(
  order: OrderEmailOrder,
  items: OrderEmailItem[],
): RenderedEmail {
  const intro =
    "Your refund has been issued in full. Depending on your bank or card issuer it may take a few more business days to appear on your statement.";

  return {
    subject: `Your Sombre refund has been issued (${order.id})`,
    html: renderShell(
      "Refund issued",
      intro,
      renderOrderSummaryHtml(order, items),
    ),
    text: `Refund issued

${intro}

${renderOrderSummaryText(order, items)}`,
  };
}

export function renderCustomerRefundFailed(
  order: OrderEmailOrder,
  items: OrderEmailItem[],
): RenderedEmail {
  const intro =
    "Your payment was successful, but we could not fulfil your order and the automatic refund did not complete. We are sorry for the trouble. Please reply to this email with your order number and we will resolve it for you straight away.";

  return {
    subject: `Action needed on your Sombre refund (${order.id})`,
    html: renderShell(
      "Refund needs attention",
      intro,
      renderOrderSummaryHtml(order, items),
    ),
    text: `Refund needs attention

${intro}

${renderOrderSummaryText(order, items)}`,
  };
}
