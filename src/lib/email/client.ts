import { Resend } from "resend";

// Server-only email configuration. These values must never be exposed to the
// browser, so none of them use the NEXT_PUBLIC_ prefix.
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const sellerNotificationEmail = process.env.SELLER_NOTIFICATION_EMAIL;
const emailReplyTo = process.env.EMAIL_REPLY_TO;

export type EmailConfig = {
  resend: Resend;
  from: string;
  replyTo: string | undefined;
  sellerEmail: string | undefined;
};

// Returns null when email is not configured. Callers skip sending in that case
// rather than failing, because a missing mail setup must never break a payment.
export function getEmailConfig(): EmailConfig | null {
  if (typeof window !== "undefined") {
    throw new Error("Email sending can only be used on the server.");
  }

  if (!resendApiKey || !emailFrom) {
    return null;
  }

  return {
    resend: new Resend(resendApiKey),
    from: emailFrom,
    replyTo: emailReplyTo || undefined,
    sellerEmail: sellerNotificationEmail || undefined,
  };
}
