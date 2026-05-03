import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/product/product-gallery";
import { ProductInfo } from "@/components/product/product-info";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
                <ProductGallery
                    images={product.product_images}
                    productName={product.name}
                />

                <ProductInfo
                    id={product.id}
                    slug={slug}
                    name={product.name}
                    price={product.price}
                    sizeLabel={product.size_label}
                    shortDescription={product.short_description}
                    description={product.description}
                    isFeatured={product.is_featured}
                    brandName={product.brand?.name ?? null}
                    categoryName={product.category?.name ?? null}
                    imageUrl={primaryImage?.image_url ?? null}
                />
            </div>
        </section>
    );
}
