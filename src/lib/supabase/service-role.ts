import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseServiceRoleEnv() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase service role environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}

// Use only from backend/server-only code paths. This key bypasses RLS.
export function createSupabaseServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase service role client can only be used on the server.");
  }

  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseServiceRoleEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
