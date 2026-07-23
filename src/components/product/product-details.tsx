import Link from "next/link";

type ProductDetailsProps = {
  description: string | null;
  brandName: string | null;
  categoryName: string | null;
  sizeLabel: string | null;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950";

function DetailRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
      <dt className="text-[0.65rem] uppercase tracking-[0.24em] text-stone-500">
        {term}
      </dt>
      <dd className="text-sm text-stone-300">{value}</dd>
    </div>
  );
}

export function ProductDetails({
  description,
  brandName,
  categoryName,
  sizeLabel,
}: ProductDetailsProps) {
  // Only rows backed by real data are rendered — nothing is invented to fill
  // the list.
  const detailRows = [
    brandName ? { term: "Brand", value: brandName } : null,
    categoryName ? { term: "Category", value: categoryName } : null,
    sizeLabel ? { term: "Size", value: sizeLabel } : null,
  ].filter((row): row is { term: string; value: string } => row !== null);

  return (
    <div className="mt-24 border-t border-white/10 pt-16 sm:mt-32 sm:pt-20">
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
        {description ? (
          <section className="space-y-5">
            <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
              Description
            </h2>
            <p className="max-w-xl text-sm leading-8 text-stone-400 sm:text-base">
              {description}
            </p>
          </section>
        ) : null}

        <div className="space-y-14">
          {detailRows.length > 0 ? (
            <section className="space-y-5">
              <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
                Details
              </h2>
              <dl>
                {detailRows.map((row) => (
                  <DetailRow key={row.term} term={row.term} value={row.value} />
                ))}
              </dl>
            </section>
          ) : null}

          <section className="space-y-5">
            <h2 className="font-display text-2xl font-light text-stone-100 sm:text-3xl">
              Shipping &amp; Returns
            </h2>
            <p className="max-w-xl text-sm leading-8 text-stone-400">
              Orders are packed by Sombre once payment is confirmed. If anything
              is not right, contact support and we will help with the next step.
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Link
                href="/shipping-policy"
                className={`border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.24em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white ${focusRing}`}
              >
                Shipping Policy
              </Link>
              <Link
                href="/refund-policy"
                className={`border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.24em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white ${focusRing}`}
              >
                Return &amp; Refund Policy
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
