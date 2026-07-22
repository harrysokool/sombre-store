import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/admin-login-form";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // An already-approved admin has no reason to see the form again.
  if (await getAdminUser()) {
    redirect("/admin");
  }

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto w-full max-w-md space-y-8 rounded-[2rem] border border-white/10 bg-white/[0.02] px-6 py-10 sm:px-8">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <h1 className="text-3xl font-medium tracking-[0.14em] text-stone-100">
            Admin Sign In
          </h1>
          <p className="text-sm leading-6 text-stone-400">
            This area is restricted to the store operator.
          </p>
        </div>

        <AdminLoginForm />
      </div>
    </section>
  );
}
