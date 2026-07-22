import Link from "next/link";

import { CampaignHero } from "@/components/home/campaign-hero";
import { SignatureShowcase } from "@/components/home/signature-showcase";
import { StoryBand } from "@/components/home/story-band";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
    normalizeProductListItem,
    type ProductListItem,
    type ProductListItemRow,
} from "@/lib/storefront/shop";

const maisonMargielaShopHref = "/shop?category=perfume&brand=maison-margiela";

export const dynamic = "force-dynamic";

async function getMaisonMargielaProducts() {
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
          stock_quantity,
          is_featured,
          created_at,
          brand:brands (
            name,
            slug
          ),
          category:categories (
            name,
            slug
          ),
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

        return (data ?? [])
            .map(normalizeProductListItem)
            .filter((product) => product.brand?.slug === "maison-margiela")
            .filter((product) => product.name.startsWith("Replica "));
    } catch (error) {
        console.error("Failed to load Maison Margiela products for /:", error);

        return [] as ProductListItem[];
    }
}

// Featured products lead the row; the rest follow so the showcase stays full
// even when nothing is flagged. Presentation only - the query above is unchanged.
function getShowcaseProducts(products: ProductListItem[]) {
    return [
        ...products.filter((product) => product.is_featured),
        ...products.filter((product) => !product.is_featured),
    ];
}

export default async function Home() {
    const maisonMargielaProducts = await getMaisonMargielaProducts();
    const showcaseProducts = getShowcaseProducts(maisonMargielaProducts);

    return (
        // `clip` on one axis only: horizontal overflow is still contained, but
        // the hero can still sit under the header via its negative top margin,
        // which `overflow-hidden` would have cropped away.
        <div className="overflow-x-clip">
            <CampaignHero
                eyebrow="Sombre Fragrance"
                headline="Quiet scent, kept close."
                ctaLabel="Discover the edit"
                ctaHref={maisonMargielaShopHref}
            />

            {/* Deliberate pause between the hero and the first product beat. */}
            <section className="px-6 py-28 text-center sm:px-10 sm:py-36 lg:px-12">
                <p className="mx-auto max-w-3xl font-display text-2xl font-light leading-[1.5] text-stone-200 sm:text-3xl lg:text-4xl">
                    A narrow selection, chosen for the way a room remembers it.
                </p>
                <p className="mx-auto mt-8 max-w-xl text-sm leading-8 text-stone-500">
                    Sombre carries a focused Maison Margiela Replica edit — scents
                    built around memory, place, and the hours you return to.
                </p>
            </section>

            <SignatureShowcase
                eyebrow="The Edit"
                heading="Signatures"
                products={showcaseProducts}
                viewAllHref={maisonMargielaShopHref}
            />

            <div className="py-28 sm:py-36">
                <StoryBand
                    eyebrow="Replica"
                    headline="Familiar places, bottled."
                    body="Each Replica reconstructs a moment — woodsmoke in a shuttered room, salt drying on skin, the low hum of a late bar. Worn quietly, they read as memory rather than perfume."
                    ctaLabel="Explore Replica"
                    ctaHref={maisonMargielaShopHref}
                    imageSrc="/images/products/maison-margiela/model-2.jpg"
                    imageAlt="Sombre fragrance styled in an editorial setting"
                    imageSide="left"
                />
            </div>

            <StoryBand
                eyebrow="The Ritual"
                headline="Worn close to the skin."
                body="Applied at the pulse, a Replica settles within the hour and stays near. Nothing announces itself across a room — the intent is atmosphere, held at conversational distance."
                ctaLabel="Shop the collection"
                ctaHref={maisonMargielaShopHref}
                imageSrc="/images/products/maison-margiela/model-4.png"
                imageAlt="Sombre fragrance campaign still life"
                imageSide="right"
            />

            <section className="px-6 py-32 text-center sm:px-10 sm:py-44 lg:px-12">
                <h2 className="mx-auto max-w-2xl font-display text-4xl font-light leading-[1.15] text-stone-100 sm:text-5xl lg:text-6xl">
                    Chosen slowly, worn daily.
                </h2>
                <Link
                    href={maisonMargielaShopHref}
                    className="mt-10 inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white"
                >
                    Enter the shop
                </Link>
            </section>
        </div>
    );
}
