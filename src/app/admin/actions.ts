"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setOrderFulfilment } from "@/lib/admin/fulfilment";
import { restoreOrderItemStock } from "@/lib/admin/stock-restoration";
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

export type StockRestorationActionState = {
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
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  return { error: null, success: `Order marked ${status}.` };
}

export async function restoreOrderItemStockAction(
  _previousState: StockRestorationActionState,
  formData: FormData,
): Promise<StockRestorationActionState> {
  // Server Actions are directly callable endpoints, so authenticate here and
  // again inside restoreOrderItemStock before its service-role RPC is created.
  const adminUser = await getAdminUser();

  if (!adminUser) {
    return {
      error: "Your admin session has ended. Sign in again to restore stock.",
      success: null,
    };
  }

  const requestId = String(formData.get("requestId") ?? "").trim();
  const orderId = String(formData.get("orderId") ?? "").trim();
  const orderItemId = String(formData.get("orderItemId") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  let result: Awaited<ReturnType<typeof restoreOrderItemStock>>;

  try {
    result = await restoreOrderItemStock({
      requestId,
      orderId,
      orderItemId,
      quantity,
      reason,
    });
  } catch (error) {
    // A lost response can happen after PostgreSQL committed the atomic stock
    // change. Do not claim that nothing changed or encourage a fresh request
    // until the administrator has checked the append-only audit history.
    console.error("Unable to confirm the stock restoration outcome", {
      orderId,
      orderItemId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      error:
        "The restoration outcome could not be confirmed. Refresh this order and check the restoration audit history before trying again.",
      success: null,
    };
  }

  if (!result.restoration) {
    return {
      error: result.error ?? "That stock restoration was refused.",
      success: null,
    };
  }

  const { restoration } = result;
  let refreshFailed = false;

  try {
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
  } catch (error) {
    refreshFailed = true;
    console.error("Stock restoration succeeded but cache refresh failed", {
      orderId,
      orderItemId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const refreshMessage = refreshFailed
    ? " Refresh this order to update the displayed audit history."
    : "";

  if (restoration.alreadyApplied) {
    return {
      error: null,
      success: `This restoration was already applied. Sellable stock was not increased again.${refreshMessage}`,
    };
  }

  return {
    error: null,
    success: `Restored ${restoration.quantityRestored} unit(s) to sellable stock.${refreshMessage}`,
  };
}

export async function signOutAdmin() {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
