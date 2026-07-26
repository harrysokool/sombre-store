import Link from "next/link";

// Admin-side 404 (an unknown order or coupon id). Kept inside the admin styling
// language so no storefront chrome appears in the operator area.
export default function AdminNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-[0.34em] text-stone-400">
          404
        </p>
        <h1 className="text-2xl font-medium tracking-[0.08em] text-stone-100">
          Not found
        </h1>
        <p className="text-sm leading-6 text-stone-400">
          This admin record does not exist, or it has been removed.
        </p>
        <Link
          href="/admin/orders"
          className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Back to orders
        </Link>
      </div>
    </main>
  );
}
