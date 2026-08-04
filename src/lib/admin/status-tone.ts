// The admin status colour language. Pure lookups with no imports, so the
// mapping can be probed on its own and reused by any admin surface.
//
// Tones follow the palette already used across the admin UI:
//   success  emerald  settled, good-news states (paid, confirmed, delivered)
//   pending  amber    still moving, or waiting on a person (pending, review)
//   danger   red      failed, reversed, or unfulfillable
//   neutral  stone    nothing has happened yet, or the value is unknown
//
// Colour is never the only signal: every badge also renders its status word.

export const STATUS_TONES = [
  "success",
  "pending",
  "danger",
  "neutral",
] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

export type StatusKind =
  | "payment"
  | "order"
  | "fulfilment"
  | "refund"
  | "coupon"
  | "webhook"
  | "email"
  | "product"
  | "stock"
  | "announcement";

// Keys are the values the database check constraints allow for each column.
// A refund that succeeded is deliberately red rather than green: the money went
// back, so the row reads as a reversal at a glance, matching order_status
// 'refunded'. Red here means "not a normal sale", not "the API call failed".
const TONES_BY_KIND: Record<StatusKind, Record<string, StatusTone>> = {
  payment: {
    paid: "success",
    no_payment_required: "success",
    unpaid: "pending",
    pending: "pending",
    failed: "danger",
    canceled: "neutral",
  },
  order: {
    confirmed: "success",
    pending: "pending",
    refund_pending: "pending",
    refunded: "danger",
    refund_failed: "danger",
    unfulfillable: "danger",
  },
  fulfilment: {
    delivered: "success",
    shipped: "success",
    processing: "pending",
    unfulfilled: "neutral",
  },
  refund: {
    pending: "pending",
    requires_action: "pending",
    succeeded: "danger",
    failed: "danger",
    canceled: "neutral",
    not_required: "neutral",
  },
  coupon: {
    active: "success",
    inactive: "neutral",
  },
  // webhook_failures.failure_kind. 'retryable' means Stripe is still expected to
  // redeliver, so it may clear itself; 'permanent' was acknowledged after being
  // recorded and can only be settled by a person.
  webhook: {
    retryable: "pending",
    permanent: "danger",
  },
  // order_emails.status. The unsent queue only ever shows the first two, but
  // 'sent' is mapped so the tone stays truthful wherever it is used.
  email: {
    pending: "pending",
    failed: "danger",
    sent: "success",
  },
  product: {
    active: "success",
    inactive: "neutral",
  },
  stock: {
    in_stock: "success",
    low_stock: "pending",
    out_of_stock: "danger",
  },
  // announcements.is_active, rendered as a word rather than the raw boolean.
  // An inactive announcement is not a problem, just one the storefront is not
  // showing, so it stays neutral rather than reading as a failure.
  announcement: {
    active: "success",
    inactive: "neutral",
  },
};

// Anything unrecognised stays neutral rather than guessing a colour, so a status
// added to the database later can never read as "all good" by accident.
export function getStatusTone(kind: StatusKind, value: string): StatusTone {
  return TONES_BY_KIND[kind][value.trim().toLowerCase()] ?? "neutral";
}

// 'no_payment_required' -> 'No payment required'.
export function formatStatusLabel(value: string): string {
  const label = value.trim().replaceAll("_", " ");

  if (!label) {
    return "Unknown";
  }

  return `${label.charAt(0).toUpperCase()}${label.slice(1).toLowerCase()}`;
}

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  pending: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  danger: "border-red-400/25 bg-red-400/10 text-red-200",
  neutral: "border-white/10 bg-white/5 text-stone-300",
};
