"use server";

import { redirect } from "next/navigation";

import {
  createSupabaseAuthClient,
  isApprovedAdminEmail,
} from "@/lib/supabase/admin-auth";

export type AdminLoginState = {
  error: string | null;
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

export async function signOutAdmin() {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
