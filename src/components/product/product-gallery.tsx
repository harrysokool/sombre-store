import Image from "next/image";

import type { ProductImage } from "@/lib/storefront/products";

type ProductGalleryProps = {
  images: ProductImage[] | null;
  productName: string;
};

// Matches the desktop two-column split (image takes the larger side, ~55vw) and
// the full-bleed mobile image, so no oversized candidate is ever fetched.
const IMAGE_SIZES = "(min-width: 1024px) 55vw, 90vw";

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-white">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
          No product image
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {images.map((image, index) => (
        <div
          key={`${image.image_url}-${image.sort_order}`}
          className="relative aspect-square w-full overflow-hidden bg-white"
        >
          <Image
            src={image.image_url}
            alt={image.alt_text ?? `${productName} fragrance bottle`}
            fill
            // The first image is the LCP candidate on this route.
            priority={index === 0}
            sizes={IMAGE_SIZES}
            className="object-contain p-8 sm:p-12"
          />
        </div>
      ))}
    </div>
  );
}
