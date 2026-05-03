import Image from "next/image";

type CartProductImageProps = {
  imageUrl: string | null;
  name: string;
  variant: "cart" | "checkout";
};

const imageStyles = {
  cart: {
    wrapperClassName:
      "overflow-hidden rounded-2xl border border-white/10 bg-stone-900/80",
    imageClassName: "aspect-[4/5] w-full object-cover",
    fallbackClassName:
      "flex aspect-[4/5] items-center justify-center bg-white/[0.02]",
    fallbackTextClassName:
      "text-xs uppercase tracking-[0.24em] text-stone-500",
    width: 640,
    height: 800,
    altSuffix: "cart image",
  },
  checkout: {
    wrapperClassName: "overflow-hidden rounded-2xl bg-white/[0.02]",
    imageClassName: "h-20 w-16 object-cover",
    fallbackClassName:
      "flex h-20 w-16 items-center justify-center bg-white/[0.02]",
    fallbackTextClassName:
      "text-[10px] uppercase tracking-[0.2em] text-stone-500",
    width: 120,
    height: 150,
    altSuffix: "checkout image",
  },
};

export function CartProductImage({
  imageUrl,
  name,
  variant,
}: CartProductImageProps) {
  const styles = imageStyles[variant];

  return (
    <div className={styles.wrapperClassName}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${name} ${styles.altSuffix}`}
          width={styles.width}
          height={styles.height}
          className={styles.imageClassName}
        />
      ) : (
        <div className={styles.fallbackClassName}>
          <p className={styles.fallbackTextClassName}>No image</p>
        </div>
      )}
    </div>
  );
}
