import { ProductCard } from "@/components/shop/product-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  is_featured: boolean;
};

async function getActiveProducts() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, short_description, price, size_label, is_featured")
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    return {
      products: (data ?? []) as ProductListItem[],
      hasError: false,
    };
  } catch (error) {
    console.error("Failed to load products for /shop:", error);

    return {
      products: [] as ProductListItem[],
      hasError: true,
    };
  }
}

export default async function ShopPage() {
  const { products, hasError } = await getActiveProducts();

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14">
        <div className="max-w-2xl space-y-5">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            Sombre
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-medium tracking-[0.16em] text-stone-100 sm:text-6xl">
              Shop
            </h1>
            <p className="text-base leading-8 text-stone-400">
              A quiet edit of fragrance and lifestyle essentials, drawn from
              the current Sombre catalog.
            </p>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                slug={product.slug}
                shortDescription={product.short_description}
                price={product.price}
                sizeLabel={product.size_label}
                isFeatured={product.is_featured}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <h2 className="text-xl font-medium text-stone-100">
              {hasError ? "Catalog unavailable" : "No products available yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-400">
              {hasError
                ? "The shop could not load products from Supabase. Check your environment variables and database connection."
                : "Add active products in Supabase and they will appear here automatically."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
