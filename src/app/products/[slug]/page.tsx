import Image from "next/image";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";
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
    size_label: string | null;
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
    size_label: string | null;
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
        size_label: row.size_label,
        is_featured: row.is_featured,
        brand: normalizeProductRelation(row.brand),
        category: normalizeProductRelation(row.category),
        product_images: getSortedProductImages(row.product_images),
    };
}

async function getProductBySlug(slug: string) {
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
        size_label,
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

    return (
        <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
            <div className="mx-auto grid w-full max-w-7xl gap-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-start">
                <div className="grid gap-6 sm:grid-cols-2">
                    {product.product_images &&
                    product.product_images.length > 0 ? (
                        product.product_images.map((image) => (
                            <div
                                key={`${image.image_url}-${image.sort_order}`}
                                className="space-y-4"
                            >
                                <div className="overflow-hidden rounded-[2rem] bg-white/[0.02]">
                                    <Image
                                        src={image.image_url}
                                        alt={
                                            image.alt_text ??
                                            `${product.name} product image`
                                        }
                                        width={960}
                                        height={1200}
                                        className="aspect-[4/5] w-full object-cover"
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="sm:col-span-2">
                            <div className="flex aspect-[16/10] items-center justify-center rounded-[2rem] bg-white/[0.02]">
                                <p className="text-sm uppercase tracking-[0.24em] text-stone-500">
                                    No product images
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-10 lg:pt-6">
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.34em] text-stone-500">
                            <span>{product.brand?.name ?? "Unbranded"}</span>
                            <span className="text-stone-700">/</span>
                            <span>
                                {product.category?.name ?? "Uncategorized"}
                            </span>
                        </div>

                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center gap-4">
                                <h1 className="text-4xl font-medium leading-tight tracking-[0.1em] text-stone-100 sm:text-5xl lg:text-[3.6rem]">
                                    {product.name}
                                </h1>
                                {product.is_featured ? (
                                    <span className="text-[11px] uppercase tracking-[0.24em] text-stone-500">
                                        Featured
                                    </span>
                                ) : null}
                            </div>

                            {product.short_description ? (
                                <p className="max-w-xl text-lg leading-8 text-stone-300">
                                    {product.short_description}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-x-10 gap-y-5 border-y border-white/10 py-7">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                                Price
                            </p>
                            <p className="text-3xl font-medium text-stone-100">
                                {formatPrice(product.price)}
                            </p>
                        </div>

                        {product.size_label ? (
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                                    Size
                                </p>
                                <p className="text-sm uppercase tracking-[0.18em] text-stone-300">
                                    {product.size_label}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <div className="pt-1">
                        <AddToCartButton
                            product={{
                                id: product.id,
                                slug: slug,
                                name: product.name,
                                price: product.price,
                                size_label: product.size_label,
                                image_url: primaryImage?.image_url ?? null,
                            }}
                        />
                    </div>

                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                            Product Details
                        </p>
                        <p className="max-w-2xl text-base leading-8 text-stone-400">
                            {product.description ??
                                "Details for this selection are coming soon."}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
