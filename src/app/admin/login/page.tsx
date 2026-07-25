import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/admin-login-form";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // An already-approved admin has no reason to see the form again.
  if (await getAdminUser()) {
    redirect("/admin");
  }

  // The standalone frame (centring and page padding) comes from the login
  // layout, so this page renders the card alone.
  return (
    <section className="w-full space-y-8 rounded-[2rem] border border-white/10 bg-white/[0.02] px-5 py-10 sm:px-8">
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
          Sombre
        </p>
        <h1 className="text-2xl font-medium tracking-[0.14em] text-stone-100 sm:text-3xl">
          Admin Sign In
        </h1>
        <p className="text-sm leading-6 text-stone-400">
          This area is restricted to the store operator.
        </p>
      </div>

      <AdminLoginForm />
    </section>
  );
}
