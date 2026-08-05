import { cache } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildProductMetadata } from "@/lib/seo/metadata";
import { ProductDetails } from "@/components/product/product-details";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductInfo } from "@/components/product/product-info";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPromotionDiscounts } from "@/lib/storefront/promotion-discounts";
import { getProductPriceDisplay } from "@/lib/storefront/promotion-display";
import {
    getPrimaryProductImage,
    getSortedProductImages,
    normalizeProductRelation,
    type ProductImage,
    type ProductRelation,
} from "@/lib/storefront/products";

type ProductDetailPageProps = {
    params: Promise<{
        slug: string;
    }>;
};

export const dynamic = "force-dynamic";

type ProductDetail = {
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    price: number | string;
    retail_price: number | string | null;
    size_label: string | null;
    stock_quantity: number;
    is_featured: boolean;
    brand: ProductRelation | null;
    category: ProductRelation | null;
    product_images: ProductImage[] | null;
};

type ProductDetailRow = {
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    price: number | string;
    // Null whenever no official retail price is published for the product.
    retail_price: number | string | null;
    size_label: string | null;
    stock_quantity: number;
    is_featured: boolean;
    brand: ProductRelation | ProductRelation[] | null;
    category: ProductRelation | ProductRelation[] | null;
    product_images: ProductImage[] | null;
};

function normalizeProductDetail(row: ProductDetailRow): ProductDetail {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        short_description: row.short_description,
        price: row.price,
        retail_price: row.retail_price,
        size_label: row.size_label,
        stock_quantity: row.stock_quantity,
        is_featured: row.is_featured,
        brand: normalizeProductRelation(row.brand),
        category: normalizeProductRelation(row.category),
        product_images: getSortedProductImages(row.product_images),
    };
}

/**
 * Wrapped in React `cache` so `generateMetadata` and the page body share one
 * query per request instead of hitting Supabase twice for the same product.
 * The cache is per-request, so it stays correct under `force-dynamic`.
 */
const getProductBySlug = cache(async function getProductBySlug(slug: string) {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from("products")
        .select(
            `
        id,
        name,
        description,
        short_description,
        price,
        retail_price,
        size_label,
        stock_quantity,
        is_featured,
        brand:brands ( name ),
        category:categories ( name ),
        product_images (
          image_url,
          alt_text,
          sort_order,
          is_primary
        )
      `,
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle<ProductDetailRow>();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    return normalizeProductDetail(data);
});

/**
 * Product metadata, built only from fields the page already shows publicly.
 *
 * A slug that matches no active product returns the noindex stub rather than
 * throwing: the page itself calls `notFound()` a moment later, and a 404 must
 * not advertise itself for indexing in the meantime. A Supabase failure is
 * caught for the same reason — a transient outage should degrade the head tags,
 * not turn the whole page into a 500.
 */
export async function generateMetadata({
    params,
}: ProductDetailPageProps): Promise<Metadata> {
    const { slug } = await params;

    let product: Awaited<ReturnType<typeof getProductBySlug>> = null;

    try {
        product = await getProductBySlug(slug);
    } catch {
        product = null;
    }

    if (!product) {
        return {
            title: "Product not found",
            robots: { index: false, follow: false },
        };
    }

    const primaryImage = getPrimaryProductImage(product.product_images);

    return buildProductMetadata({
        slug,
        name: product.name,
        brandName: product.brand?.name ?? null,
        shortDescription: product.short_description,
        description: product.description,
        imageUrl: primaryImage?.image_url ?? null,
        imageAlt: primaryImage?.alt_text ?? null,
    });
}

export default async function ProductDetailPage({
    params,
}: ProductDetailPageProps) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) {
        notFound();
    }

    const primaryImage = getPrimaryProductImage(product.product_images);
    // A single product page asks about a single product id.
    const promotionDiscounts = await loadPromotionDiscounts([product.id]);

    return (
        <section className="px-6 py-16 sm:px-10 sm:py-24 lg:px-12">
            <div className="mx-auto w-full max-w-7xl">
                {/* Image-first on mobile, image on the larger side on desktop. */}
                <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-16">
                    <ProductGallery
                        images={product.product_images}
                        productName={product.name}
                    />

                    <ProductInfo
                        id={product.id}
                        slug={slug}
                        name={product.name}
                        price={product.price}
                        priceDisplay={getProductPriceDisplay({
                            price: product.price,
                            retailPrice: product.retail_price,
                            discountBasisPoints: promotionDiscounts.get(
                                product.id,
                            ),
                        })}
                        sizeLabel={product.size_label}
                        stockQuantity={product.stock_quantity}
                        shortDescription={product.short_description}
                        brandName={product.brand?.name ?? null}
                        categoryName={product.category?.name ?? null}
                        imageUrl={primaryImage?.image_url ?? null}
                    />
                </div>

                <ProductDetails
                    description={product.description}
                    brandName={product.brand?.name ?? null}
                    categoryName={product.category?.name ?? null}
                    sizeLabel={product.size_label}
                />
            </div>
        </section>
    );
}
