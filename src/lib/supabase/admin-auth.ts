import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSupabaseEnv } from "@/lib/supabase/env";

// Cookie-aware Supabase client used only for the admin session. The storefront
// and checkout keep using the plain anon client, so guest checkout is unchanged.
export async function createSupabaseAuthClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Token refresh happens in
          // proxy.ts and in Server Actions, which can.
        }
      },
    },
  });
}

// A single approved admin address, held server-side only. Unset means nobody is
// approved: the gate fails closed rather than opening to every signed-in user.
export function isApprovedAdminEmail(email: string | null | undefined) {
  const approvedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!approvedEmail) {
    console.error(
      "ADMIN_EMAIL is not set, so no account can access the admin area.",
    );
    return false;
  }

  if (!email) {
    return false;
  }

  return email.trim().toLowerCase() === approvedEmail;
}

// Returns the signed-in admin, or null. Uses getUser(), which revalidates the
// token with Supabase; getSession() would trust whatever the cookie claims.
export async function getAdminUser() {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return isApprovedAdminEmail(user.email) ? user : null;
}

// Sends anyone who is not the approved admin to the login page. Call this from
// pages and layouts, never from inside a try/catch — redirect() signals by
// throwing, and catching it would swallow the redirect.
export async function requireAdminUser() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    redirect("/admin/login");
  }

  return adminUser;
}
