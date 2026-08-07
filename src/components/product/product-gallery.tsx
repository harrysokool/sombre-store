import Image from "next/image";

import {
  getGalleryProductImages,
  type ProductImage,
} from "@/lib/storefront/products";

type ProductGalleryProps = {
  images: ProductImage[] | null;
  productName: string;
};

// Matches the desktop two-column split (image takes the larger side, ~55vw) and
// the mobile slide, which is a little under the full page width so the next
// image can peek. No oversized candidate is ever fetched.
const IMAGE_SIZES = "(min-width: 1024px) 55vw, 80vw";

// Width is left to the caller: a lone image fills its column, whereas a slide
// is narrower than the viewport so the next one peeks. Declaring it here too
// would leave two competing width utilities on the same element.
const PANEL_CLASSES = "relative aspect-square overflow-hidden bg-white";

/**
 * Alt text for one slide.
 *
 * Authored alt text always wins. The fallback names the product and, from the
 * second image on, which view it is — otherwise a multi-image product would
 * announce the same sentence several times over and tell a screen reader
 * nothing about what changed.
 */
function galleryImageAlt(
  image: ProductImage,
  index: number,
  productName: string,
) {
  if (image.alt_text) {
    return image.alt_text;
  }

  return index === 0
    ? `${productName} product image`
    : `${productName} product image, view ${index + 1}`;
}

/**
 * The product's images, shown large.
 *
 * One layout, read two ways. On desktop the slides stack into a tall column the
 * page scrolls through, which keeps the product itself the largest thing on the
 * screen and needs no controls at all. On a phone the same markup is a
 * scroll-snapped row, swiped with the native gesture — the next image is left
 * partly visible, which says "there is more" without a rail of thumbnails, a
 * row of dots, or a line of JavaScript.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const galleryImages = getGalleryProductImages(images);

  if (galleryImages.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-white">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
          No product image
        </p>
      </div>
    );
  }

  // A single image is not a gallery: no scroll container, no region to land on,
  // nothing to swipe. The tile stays exactly what it has always been.
  if (galleryImages.length === 1) {
    const [image] = galleryImages;

    return (
      <div className={`${PANEL_CLASSES} w-full`}>
        <Image
          src={image.image_url}
          alt={galleryImageAlt(image, 0, productName)}
          fill
          priority
          sizes={IMAGE_SIZES}
          className="object-contain p-6 sm:p-10"
        />
      </div>
    );
  }

  return (
    // Focusable and named because it genuinely scrolls on a phone, and a
    // scrollable region has to be reachable by keyboard too. The ring is the
    // site's own, so the focus state stays visible and familiar.
    <div
      role="region"
      aria-label={`${productName} images`}
      tabIndex={0}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-950 lg:block lg:gap-0 lg:space-y-4 lg:overflow-x-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {galleryImages.map((image, index) => (
        <div
          key={`${image.image_url}-${image.sort_order}`}
          className={`${PANEL_CLASSES} w-[86%] shrink-0 snap-center lg:w-full lg:shrink`}
        >
          <Image
            src={image.image_url}
            alt={galleryImageAlt(image, index, productName)}
            fill
            // The first image is the LCP candidate on this route.
            priority={index === 0}
            sizes={IMAGE_SIZES}
            className="object-contain p-6 sm:p-10"
          />
        </div>
      ))}
    </div>
  );
}
