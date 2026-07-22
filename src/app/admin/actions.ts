"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setOrderFulfilment } from "@/lib/admin/fulfilment";
import {
  isFulfilmentStatus,
  requiresCourierAndTracking,
} from "@/lib/admin/fulfilment-rules";
import {
  createSupabaseAuthClient,
  getAdminUser,
  isApprovedAdminEmail,
} from "@/lib/supabase/admin-auth";

export type AdminLoginState = {
  error: string | null;
};

export type FulfilmentActionState = {
  error: string | null;
  success: string | null;
};

export async function signInAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // One generic message for both a bad address and a bad password, so this form
  // cannot be used to discover which accounts exist.
  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  if (!isApprovedAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { error: "This account is not authorised for admin access." };
  }

  // redirect() throws to signal, so it must run outside the checks above.
  redirect("/admin");
}

export async function updateOrderFulfilment(
  _previousState: FulfilmentActionState,
  formData: FormData,
): Promise<FulfilmentActionState> {
  // A Server Action is its own endpoint: anyone can post to it without ever
  // rendering the admin page, so the gate is re-checked here. setOrderFulfilment
  // checks a third time and throws, which is the real backstop — this branch
  // only turns an expired session into a message instead of a crash.
  const adminUser = await getAdminUser();

  if (!adminUser) {
    return {
      error: "Your admin session has ended. Sign in again to update fulfilment.",
      success: null,
    };
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const courier = String(formData.get("courier") ?? "").trim();
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim();

  if (!isFulfilmentStatus(status)) {
    return { error: "That fulfilment status is not recognised.", success: null };
  }

  // Checked field by field so the message names what is missing. The database
  // enforces the same rule against the order's stored values.
  if (requiresCourierAndTracking(status)) {
    if (!courier) {
      return {
        error: `Enter a courier before marking this order ${status}.`,
        success: null,
      };
    }

    if (!trackingNumber) {
      return {
        error: `Enter a tracking number before marking this order ${status}.`,
        success: null,
      };
    }
  }

  const result = await setOrderFulfilment({
    orderId,
    status,
    courier,
    trackingNumber,
  });

  if (result.error) {
    return { error: result.error, success: null };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");

  return { error: null, success: `Order marked ${status}.` };
}

export async function signOutAdmin() {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
