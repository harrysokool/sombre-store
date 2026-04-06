import { ProductCard } from "@/components/shop/product-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";

export const dynamic = "force-dynamic";

type ProductImage = {
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

type ProductListItemRow = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  is_featured: boolean;
  product_images: ProductImage[] | null;
};

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | string;
  size_label: string | null;
  is_featured: boolean;
  primaryImage: ProductImage | null;
};

function getPrimaryImage(images: ProductImage[] | null) {
  const sortedImages = [...(images ?? [])].sort(
    (left, right) => left.sort_order - right.sort_order,
  );

  return sortedImages.find((image) => image.is_primary) ?? sortedImages[0] ?? null;
}

function normalizeProductListItem(row: ProductListItemRow): ProductListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    price: row.price,
    size_label: row.size_label,
    is_featured: row.is_featured,
    primaryImage: getPrimaryImage(row.product_images),
  };
}

async function getActiveProducts() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
          id,
          name,
          slug,
          short_description,
          price,
          size_label,
          is_featured,
          product_images (
            image_url,
            alt_text,
            sort_order,
            is_primary
          )
        `,
      )
      .eq("is_active", true)
      .returns<ProductListItemRow[]>();

    if (error) {
      throw error;
    }

    return {
      products: (data ?? []).map(normalizeProductListItem),
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
              A quiet edit of fragrance and lifestyle essentials, drawn from the
              current Sombre catalog.
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
                formattedPrice={formatPrice(product.price)}
                sizeLabel={product.size_label}
                isFeatured={product.is_featured}
                imageUrl={product.primaryImage?.image_url ?? null}
                imageAlt={product.primaryImage?.alt_text ?? null}
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
