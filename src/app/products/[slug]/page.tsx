import Image from "next/image";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/storefront/format-price";

type ProductDetailPageProps = {
    params: Promise<{
        slug: string;
    }>;
};

export const dynamic = "force-dynamic";

type ProductImage = {
    image_url: string;
    alt_text: string | null;
    sort_order: number;
    is_primary: boolean;
};

type ProductDetail = {
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    price: number | string;
    size_label: string | null;
    is_featured: boolean;
    brand: {
        name: string;
    } | null;
    category: {
        name: string;
    } | null;
    product_images: ProductImage[] | null;
};

type RelationName = {
    name: string;
};

type ProductDetailRow = {
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    price: number | string;
    size_label: string | null;
    is_featured: boolean;
    brand: RelationName | RelationName[] | null;
    category: RelationName | RelationName[] | null;
    product_images: ProductImage[] | null;
};

function normalizeRelation(
    relation: RelationName | RelationName[] | null,
): RelationName | null {
    if (!relation) {
        return null;
    }

    return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function normalizeProductDetail(row: ProductDetailRow): ProductDetail {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        short_description: row.short_description,
        price: row.price,
        size_label: row.size_label,
        is_featured: row.is_featured,
        brand: normalizeRelation(row.brand),
        category: normalizeRelation(row.category),
        product_images: row.product_images
            ? [...row.product_images].sort(
                  (left, right) => left.sort_order - right.sort_order,
              )
            : null,
    };
}

function getPrimaryImage(images: ProductImage[] | null) {
    const sortedImages = [...(images ?? [])].sort(
        (left, right) => left.sort_order - right.sort_order,
    );

    return sortedImages.find((image) => image.is_primary) ?? sortedImages[0] ?? null;
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

    const primaryImage = getPrimaryImage(product.product_images);

    return (
        <section className="px-6 py-24 sm:px-10 sm:py-32 lg:px-12">
            <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
                <div className="grid gap-4 sm:grid-cols-2">
                    {product.product_images &&
                    product.product_images.length > 0 ? (
                        product.product_images.map((image) => (
                            <div
                                key={`${image.image_url}-${image.sort_order}`}
                                className="rounded-3xl border border-white/10 bg-white/[0.02] p-6"
                            >
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-stone-900/80">
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
                                {image.is_primary ? (
                                    <div className="mt-4">
                                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
                                            Primary
                                        </span>
                                    </div>
                                ) : null}
                                {image.alt_text ? (
                                    <p className="mt-3 text-sm text-stone-500">
                                        {image.alt_text}
                                    </p>
                                ) : null}
                            </div>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:col-span-2">
                            <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-stone-900/80">
                                <p className="text-sm uppercase tracking-[0.24em] text-stone-500">
                                    No product images
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.28em] text-stone-500">
                            <span>{product.brand?.name ?? "Unbranded"}</span>
                            <span className="text-stone-700">/</span>
                            <span>
                                {product.category?.name ?? "Uncategorized"}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-4xl font-medium tracking-[0.14em] text-stone-100 sm:text-5xl">
                                    {product.name}
                                </h1>
                                {product.is_featured ? (
                                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
                                        Featured
                                    </span>
                                ) : null}
                            </div>

                            {product.short_description ? (
                                <p className="text-lg leading-8 text-stone-300">
                                    {product.short_description}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-y border-white/10 py-6">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                                Price
                            </p>
                            <p className="text-2xl font-medium text-stone-100">
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

                    <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                            Description
                        </p>
                        <p className="max-w-2xl text-base leading-8 text-stone-400">
                            {product.description ??
                                "Product description coming soon."}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
