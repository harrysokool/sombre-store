import Image from "next/image";

import type { ProductImage } from "@/lib/storefront/products";

type ProductGalleryProps = {
  images: ProductImage[] | null;
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {images && images.length > 0 ? (
        images.map((image) => (
          <div key={`${image.image_url}-${image.sort_order}`} className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] bg-white/[0.02]">
              <Image
                src={image.image_url}
                alt={image.alt_text ?? `${productName} product image`}
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
  );
}
